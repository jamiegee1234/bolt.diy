import { getSystemPrompt } from './prompts/prompts';
import optimized from './prompts/optimized';
import { getFineTunedPrompt } from './prompts/new-prompt';
import { AdaptivePromptLibrary } from './prompts/adaptive-prompting';
import type { DesignScheme } from '~/types/design-scheme';
import type { ModelInfo } from '~/lib/modules/llm/types';

export interface PromptOptions {
  cwd: string;
  allowedHtmlElements: string[];
  modificationTagName: string;
  designScheme?: DesignScheme;
  modelInfo?: ModelInfo;
  supabase?: {
    isConnected: boolean;
    hasSelectedProject: boolean;
    credentials?: {
      anonKey?: string;
      supabaseUrl?: string;
    };
  };
}

export class PromptLibrary {
  static library: Record<
    string,
    {
      label: string;
      description: string;
      get: (options: PromptOptions) => string;
    }
  > = {
    adaptive: {
      label: 'Smart Adaptive Prompt',
      description: 'Automatically adapts to model capabilities for optimal performance',
      get: (options) => {
        if (options.modelInfo) {
          return AdaptivePromptLibrary.getAdaptive(options.modelInfo, {
            cwd: options.cwd,
            allowedHtmlElements: options.allowedHtmlElements,
            modificationTagName: options.modificationTagName,
            designScheme: options.designScheme,
            supabase: options.supabase,
          });
        }
        return getFineTunedPrompt(options.cwd, options.supabase, options.designScheme);
      },
    },
    default: {
      label: 'Default Prompt',
      description: 'Fine tuned prompt for better results and less token usage',
      get: (options) => getFineTunedPrompt(options.cwd, options.supabase, options.designScheme),
    },
    minimal: {
      label: 'Minimal Prompt',
      description: 'Ultra-compact prompt for very small models (< 4B parameters)',
      get: (options) => AdaptivePromptLibrary.getMinimal({
        cwd: options.cwd,
        allowedHtmlElements: options.allowedHtmlElements,
        modificationTagName: options.modificationTagName,
        designScheme: options.designScheme,
        supabase: options.supabase,
      }),
    },
    'small-model': {
      label: 'Small Model Optimized',
      description: 'Optimized for smaller models with clear, focused instructions',
      get: (options) => AdaptivePromptLibrary.getSmallModel({
        cwd: options.cwd,
        allowedHtmlElements: options.allowedHtmlElements,
        modificationTagName: options.modificationTagName,
        designScheme: options.designScheme,
        supabase: options.supabase,
      }),
    },
    'code-focused': {
      label: 'Code Generation Focus',
      description: 'Specialized for fixing code window startup issues and development workflows',
      get: (options) => AdaptivePromptLibrary.getCodeFocused({
        cwd: options.cwd,
        allowedHtmlElements: options.allowedHtmlElements,
        modificationTagName: options.modificationTagName,
        designScheme: options.designScheme,
        supabase: options.supabase,
      }),
    },
    original: {
      label: 'Original Full Prompt',
      description: 'The original comprehensive system prompt (for large models)',
      get: (options) => getSystemPrompt(options.cwd, options.supabase, options.designScheme),
    },
    optimized: {
      label: 'Optimized Prompt (experimental)',
      description: 'Experimental version of the prompt for lower token usage',
      get: (options) => optimized(options),
    },
  };
  static getList() {
    return Object.entries(this.library).map(([key, value]) => {
      const { label, description } = value;
      return {
        id: key,
        label,
        description,
      };
    });
  }
  static getPropmtFromLibrary(promptId: string, options: PromptOptions) {
    const prompt = this.library[promptId];

    if (!prompt) {
      throw 'Prompt Now Found';
    }

    return this.library[promptId]?.get(options);
  }
}
