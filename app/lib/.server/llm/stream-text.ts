import { convertToCoreMessages, streamText as _streamText, type Message } from 'ai';
import { MAX_TOKENS, type FileMap } from './constants';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MODIFICATIONS_TAG_NAME, PROVIDER_LIST, WORK_DIR } from '~/utils/constants';
import type { IProviderSetting } from '~/types/model';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { allowedHTMLElements } from '~/utils/markdown';
import { LLMManager } from '~/lib/modules/llm/manager';
import { createScopedLogger } from '~/utils/logger';
import { createFilesContext, extractPropertiesFromMessage } from './utils';
import { 
  estimateTokenCount, 
  estimateMessagesTokens, 
  truncateMessagesToFitLimit, 
  calculateOptimalContext 
} from './token-utils';
import { createContextLengthError, createApiKeyError, createModelNotFoundError } from '~/lib/error-handling';

export type Messages = Message[];

export interface StreamingOptions extends Omit<Parameters<typeof _streamText>[0], 'model'> {
  supabaseConnection?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
}

const logger = createScopedLogger('stream-text');

export async function streamText(props: {
  messages: Omit<Message, 'id'>[];
  env?: Env;
  options?: StreamingOptions;
  apiKeys?: Record<string, string>;
  files?: FileMap;
  providerSettings?: Record<string, IProviderSetting>;
  promptId?: string;
  contextOptimization?: boolean;
  contextFiles?: FileMap;
  summary?: string;
  messageSliceId?: number;
}) {
  const {
    messages,
    env: serverEnv,
    options,
    apiKeys,
    files,
    providerSettings,
    promptId,
    contextOptimization,
    contextFiles,
    summary,
  } = props;
  let currentModel = DEFAULT_MODEL;
  let currentProvider = DEFAULT_PROVIDER.name;
  let processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const { model, provider, content } = extractPropertiesFromMessage(message);
      currentModel = model;
      currentProvider = provider;

      return { ...message, content };
    } else if (message.role == 'assistant') {
      let content = message.content;
      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');

      // Remove package-lock.json content specifically keeping token usage MUCH lower
      content = content.replace(
        /<boltAction type="file" filePath="package-lock\.json">[\s\S]*?<\/boltAction>/g,
        '[package-lock.json content removed]',
      );

      // Trim whitespace potentially left after removals
      content = content.trim();

      return { ...message, content };
    }

    return message;
  });

  const provider = PROVIDER_LIST.find((p) => p.name === currentProvider) || DEFAULT_PROVIDER;
  const staticModels = LLMManager.getInstance().getStaticModelListFromProvider(provider);
  let modelDetails = staticModels.find((m) => m.name === currentModel);

  if (!modelDetails) {
    const modelsList = [
      ...(provider.staticModels || []),
      ...(await LLMManager.getInstance().getModelListFromProvider(provider, {
        apiKeys,
        providerSettings,
        serverEnv: serverEnv as any,
      })),
    ];

    if (!modelsList.length) {
      throw createApiKeyError(provider.name);
    }

    modelDetails = modelsList.find((m) => m.name === currentModel);

    if (!modelDetails) {
      // Check if any models are available
      if (modelsList.length > 0) {
        // Fallback to first model
        logger.warn(
          `MODEL [${currentModel}] not found in provider [${provider.name}]. Falling back to first model. ${modelsList[0].name}`,
        );
        modelDetails = modelsList[0];
      } else {
        throw createModelNotFoundError(currentModel, provider.name);
      }
    }
  }

  const dynamicMaxTokens = modelDetails && modelDetails.maxTokenAllowed ? modelDetails.maxTokenAllowed : MAX_TOKENS;

  let systemPrompt =
    PromptLibrary.getPropmtFromLibrary(promptId || 'default', {
      cwd: WORK_DIR,
      allowedHtmlElements: allowedHTMLElements,
      modificationTagName: MODIFICATIONS_TAG_NAME,
      supabase: {
        isConnected: options?.supabaseConnection?.isConnected || false,
        hasSelectedProject: options?.supabaseConnection?.hasSelectedProject || false,
        credentials: options?.supabaseConnection?.credentials || undefined,
      },
    }) ?? getSystemPrompt();

  if (contextFiles && contextOptimization) {
    const codeContext = createFilesContext(contextFiles, true);

    systemPrompt = `${systemPrompt}

Below is the artifact containing the context loaded into context buffer for you to have knowledge of and might need changes to fullfill current user request.
CONTEXT BUFFER:
---
${codeContext}
---
`;

    if (summary) {
      systemPrompt = `${systemPrompt}
      below is the chat history till now
CHAT SUMMARY:
---
${props.summary}
---
`;

      if (props.messageSliceId) {
        processedMessages = processedMessages.slice(props.messageSliceId);
      } else {
        const lastMessage = processedMessages.pop();

        if (lastMessage) {
          processedMessages = [lastMessage];
        }
      }
    }
  }

  const effectiveLockedFilePaths = new Set<string>();

  if (files) {
    for (const [filePath, fileDetails] of Object.entries(files)) {
      if (fileDetails?.isLocked) {
        effectiveLockedFilePaths.add(filePath);
      }
    }
  }

  if (effectiveLockedFilePaths.size > 0) {
    const lockedFilesListString = Array.from(effectiveLockedFilePaths)
      .map((filePath) => `- ${filePath}`)
      .join('\n');
    systemPrompt = `${systemPrompt}

IMPORTANT: The following files are locked and MUST NOT be modified in any way. Do not suggest or make any changes to these files. You can proceed with the request but DO NOT make any changes to these files specifically:
${lockedFilesListString}
---
`;
  } else {
    console.log('No locked files found from any source for prompt.');
  }

  // Token management - ensure we don't exceed model limits
  const systemPromptTokens = estimateTokenCount(systemPrompt);
  const messagesTokens = estimateMessagesTokens(processedMessages);
  const modelMaxTokens = modelDetails.maxTokenAllowed || MAX_TOKENS;
  
  const context = calculateOptimalContext(
    modelMaxTokens,
    systemPromptTokens,
    messagesTokens,
    0 // File context tokens already included in system prompt
  );
  
  logger.debug(`Token usage: System: ${systemPromptTokens}, Messages: ${messagesTokens}, Model limit: ${modelMaxTokens}`);
  
  if (!context.canFit) {
    logger.warn(`Token limit exceeded. Truncating messages to fit within ${modelMaxTokens} tokens.`);
    
    // If we still can't fit even after truncation, throw a helpful error
    if (systemPromptTokens > modelMaxTokens * 0.8) {
      throw createContextLengthError(
        modelDetails.name,
        systemPromptTokens + messagesTokens,
        modelMaxTokens
      );
    }
    
    // Truncate messages to fit within the available space
    processedMessages = truncateMessagesToFitLimit(
      processedMessages,
      modelMaxTokens,
      systemPromptTokens,
      context.completionTokens
    );
    
    logger.debug(`Truncated to ${processedMessages.length} messages`);
  }
  
  // Use a safe maxTokens value for completion (reserve space for response)
  const completionMaxTokens = Math.min(
    context.completionTokens,
    modelMaxTokens - systemPromptTokens - estimateMessagesTokens(processedMessages)
  );
  
  logger.info(`Sending llm call to ${provider.name} with model ${modelDetails.name} (${completionMaxTokens} max completion tokens)`);

  // console.log(systemPrompt, processedMessages);

  return await _streamText({
    model: provider.getModelInstance({
      model: modelDetails.name,
      serverEnv,
      apiKeys,
      providerSettings,
    }),
    system: systemPrompt,
    maxTokens: Math.max(completionMaxTokens, 1000), // Ensure minimum viable completion space
    messages: convertToCoreMessages(processedMessages as any),
    ...options,
  });
}
