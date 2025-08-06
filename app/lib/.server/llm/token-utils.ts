import type { Message } from 'ai';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('token-utils');

/**
 * Rough token estimation - roughly 4 characters per token for most content
 * This is a conservative estimate that works well for most models
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  
  // More accurate estimation considering:
  // - Regular text: ~4 chars per token
  // - Code: ~3 chars per token (more dense)
  // - JSON/structured data: ~3.5 chars per token
  
  const codeRegex = /```[\s\S]*?```|<boltAction[\s\S]*?<\/boltAction>/g;
  const jsonRegex = /\{[\s\S]*?\}|\[[\s\S]*?\]/g;
  
  let totalTokens = 0;
  let processedText = text;
  
  // Extract and count code blocks
  const codeBlocks = text.match(codeRegex) || [];
  codeBlocks.forEach(block => {
    totalTokens += Math.ceil(block.length / 3); // Code is more token-dense
    processedText = processedText.replace(block, '');
  });
  
  // Extract and count JSON structures
  const jsonBlocks = processedText.match(jsonRegex) || [];
  jsonBlocks.forEach(block => {
    totalTokens += Math.ceil(block.length / 3.5);
    processedText = processedText.replace(block, '');
  });
  
  // Count remaining text
  totalTokens += Math.ceil(processedText.length / 4);
  
  return totalTokens;
}

/**
 * Estimate tokens for a message including role and metadata
 */
export function estimateMessageTokens(message: Message): number {
  const content = Array.isArray(message.content) 
    ? message.content.map(c => c.type === 'text' ? c.text : '').join('')
    : message.content;
    
  const baseTokens = estimateTokenCount(content);
  
  // Add tokens for role and structure
  const roleTokens = 5; // Rough estimate for role formatting
  
  return baseTokens + roleTokens;
}

/**
 * Estimate total tokens for an array of messages
 */
export function estimateMessagesTokens(messages: Message[]): number {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

/**
 * Truncate messages to fit within token limit, preserving the most recent messages
 */
export function truncateMessagesToFitLimit(
  messages: Message[], 
  maxTokens: number, 
  systemPromptTokens: number = 0,
  reservedTokens: number = 8000 // Reserve tokens for completion
): Message[] {
  const availableTokens = maxTokens - systemPromptTokens - reservedTokens;
  
  if (availableTokens <= 0) {
    logger.warn('No tokens available for messages after system prompt and reserved tokens');
    return [];
  }
  
  let totalTokens = 0;
  const truncatedMessages: Message[] = [];
  
  // Start from the end (most recent) and work backwards
  for (let i = messages.length - 1; i >= 0; i--) {
    const messageTokens = estimateMessageTokens(messages[i]);
    
    if (totalTokens + messageTokens <= availableTokens) {
      totalTokens += messageTokens;
      truncatedMessages.unshift(messages[i]);
    } else {
      // If this message would exceed the limit, try to truncate it
      const remainingTokens = availableTokens - totalTokens;
      
      if (remainingTokens > 100) { // Only truncate if we have reasonable space left
        const truncatedMessage = truncateMessageContent(messages[i], remainingTokens);
        if (truncatedMessage) {
          truncatedMessages.unshift(truncatedMessage);
        }
      }
      break;
    }
  }
  
  logger.debug(`Truncated ${messages.length} messages to ${truncatedMessages.length} messages (${totalTokens} tokens)`);
  
  return truncatedMessages;
}

/**
 * Truncate a single message's content to fit within token limit
 */
function truncateMessageContent(message: Message, maxTokens: number): Message | null {
  if (maxTokens < 50) return null; // Not worth truncating if we have very few tokens
  
  const content = Array.isArray(message.content) 
    ? message.content.map(c => c.type === 'text' ? c.text : '').join('')
    : message.content;
    
  const targetChars = Math.floor(maxTokens * 3.5); // Conservative char-to-token ratio
  
  if (content.length <= targetChars) {
    return message;
  }
  
  // Truncate from the middle to preserve both beginning and end context
  const keepStart = Math.floor(targetChars * 0.4);
  const keepEnd = Math.floor(targetChars * 0.4);
  const truncatedContent = content.slice(0, keepStart) + 
    '\n\n[... content truncated due to length ...]\n\n' + 
    content.slice(-keepEnd);
  
  return {
    ...message,
    content: truncatedContent
  };
}

/**
 * Calculate optimal context distribution
 */
export function calculateOptimalContext(
  modelMaxTokens: number,
  systemPromptLength: number,
  messagesLength: number,
  filesContextLength: number = 0
): {
  systemTokens: number;
  messageTokens: number;
  contextTokens: number;
  completionTokens: number;
  totalUsed: number;
  canFit: boolean;
} {
  const completionTokens = 8000; // Reserve for response
  const systemTokens = Math.max(systemPromptLength, 1000); // Minimum system prompt space
  
  const availableForContent = modelMaxTokens - completionTokens - systemTokens;
  
  if (availableForContent <= 0) {
    return {
      systemTokens,
      messageTokens: 0,
      contextTokens: 0,
      completionTokens,
      totalUsed: systemTokens + completionTokens,
      canFit: false
    };
  }
  
  // Prioritize recent messages over file context
  const messagesPriority = 0.7; // 70% for messages, 30% for context
  const maxMessageTokens = Math.floor(availableForContent * messagesPriority);
  const maxContextTokens = availableForContent - maxMessageTokens;
  
  const actualMessageTokens = Math.min(messagesLength, maxMessageTokens);
  const actualContextTokens = Math.min(filesContextLength, maxContextTokens);
  
  const totalUsed = systemTokens + actualMessageTokens + actualContextTokens + completionTokens;
  
  return {
    systemTokens,
    messageTokens: actualMessageTokens,
    contextTokens: actualContextTokens,
    completionTokens,
    totalUsed,
    canFit: totalUsed <= modelMaxTokens
  };
}