import { atom, type WritableAtom } from 'nanostores';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('ContextOptimization');

export interface ContextOptimizationSettings {
  autoOptimize: boolean;
  maxContextLength: number;
  prioritizeRecent: boolean;
  keepSystemPrompts: boolean;
  compressionLevel: 'none' | 'light' | 'medium' | 'aggressive';
}

export interface ContextAnalysis {
  totalTokens: number;
  messageCount: number;
  estimatedCost: number;
  recommendations: Array<{
    type: 'remove_old' | 'compress' | 'summarize' | 'reset';
    severity: 'low' | 'medium' | 'high';
    description: string;
    potentialSavings: number;
  }>;
}

interface ContextOptimizationState {
  settings: ContextOptimizationSettings;
  lastAnalysis: ContextAnalysis | null;
  optimizationSuggestions: string[];
  isOptimizing: boolean;
}

const defaultSettings: ContextOptimizationSettings = {
  autoOptimize: false,
  maxContextLength: 8000,
  prioritizeRecent: true,
  keepSystemPrompts: true,
  compressionLevel: 'light',
};

const initialState: ContextOptimizationState = {
  settings: defaultSettings,
  lastAnalysis: null,
  optimizationSuggestions: [],
  isOptimizing: false,
};

export const contextOptimizationStore: WritableAtom<ContextOptimizationState> = atom(initialState);

// Actions
export const contextOptimizationActions = {
  updateSettings(newSettings: Partial<ContextOptimizationSettings>) {
    const currentState = contextOptimizationStore.get();
    const updatedSettings = { ...currentState.settings, ...newSettings };
    
    contextOptimizationStore.set({
      ...currentState,
      settings: updatedSettings,
    });

    // Save to localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('bolt.contextOptimization.settings', JSON.stringify(updatedSettings));
    }

    logger.info('Context optimization settings updated', updatedSettings);
  },

  loadSettings() {
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('bolt.contextOptimization.settings');
        if (stored) {
          const settings = JSON.parse(stored);
          const currentState = contextOptimizationStore.get();
          contextOptimizationStore.set({
            ...currentState,
            settings: { ...defaultSettings, ...settings },
          });
        }
      } catch (error) {
        logger.error('Failed to load context optimization settings', error);
      }
    }
  },

  analyzeContext(messages: any[], currentUsage?: { totalTokens: number }): ContextAnalysis {
    const settings = contextOptimizationStore.get().settings;
    const messageCount = messages.length;
    const estimatedTokens = currentUsage?.totalTokens || messageCount * 100; // Rough estimate
    const estimatedCost = (estimatedTokens / 1000) * 0.002; // Rough cost estimate

    const recommendations: ContextAnalysis['recommendations'] = [];

    // Analyze and provide recommendations
    if (estimatedTokens > settings.maxContextLength) {
      recommendations.push({
        type: 'remove_old',
        severity: 'high',
        description: `Context length (${estimatedTokens} tokens) exceeds limit (${settings.maxContextLength})`,
        potentialSavings: estimatedTokens - settings.maxContextLength,
      });
    }

    if (messageCount > 20) {
      recommendations.push({
        type: 'compress',
        severity: 'medium',
        description: `${messageCount} messages in context. Consider compressing older messages.`,
        potentialSavings: Math.floor(messageCount * 0.3) * 50, // Estimate
      });
    }

    if (estimatedTokens > 5000) {
      recommendations.push({
        type: 'summarize',
        severity: 'medium',
        description: 'High token usage detected. Consider summarizing the conversation.',
        potentialSavings: Math.floor(estimatedTokens * 0.4),
      });
    }

    if (estimatedCost > 0.10) {
      recommendations.push({
        type: 'reset',
        severity: 'high',
        description: `Estimated cost ($${estimatedCost.toFixed(3)}) is high. Consider starting fresh.`,
        potentialSavings: Math.floor(estimatedTokens * 0.8),
      });
    }

    const analysis: ContextAnalysis = {
      totalTokens: estimatedTokens,
      messageCount,
      estimatedCost,
      recommendations,
    };

    // Update store with analysis
    const currentState = contextOptimizationStore.get();
    contextOptimizationStore.set({
      ...currentState,
      lastAnalysis: analysis,
    });

    return analysis;
  },

  optimizeContext(messages: any[], strategy: 'remove_old' | 'compress' | 'summarize' = 'remove_old'): any[] {
    const settings = contextOptimizationStore.get().settings;
    
    contextOptimizationStore.set({
      ...contextOptimizationStore.get(),
      isOptimizing: true,
    });

    try {
      let optimizedMessages = [...messages];

      switch (strategy) {
        case 'remove_old':
          optimizedMessages = removeOldMessages(optimizedMessages, settings);
          break;
        case 'compress':
          optimizedMessages = compressMessages(optimizedMessages, settings);
          break;
        case 'summarize':
          optimizedMessages = summarizeMessages(optimizedMessages, settings);
          break;
      }

      logger.info(`Context optimized using ${strategy}`, {
        originalCount: messages.length,
        optimizedCount: optimizedMessages.length,
      });

      return optimizedMessages;
    } finally {
      contextOptimizationStore.set({
        ...contextOptimizationStore.get(),
        isOptimizing: false,
      });
    }
  },

  addSuggestion(suggestion: string) {
    const currentState = contextOptimizationStore.get();
    contextOptimizationStore.set({
      ...currentState,
      optimizationSuggestions: [...currentState.optimizationSuggestions, suggestion],
    });
  },

  clearSuggestions() {
    const currentState = contextOptimizationStore.get();
    contextOptimizationStore.set({
      ...currentState,
      optimizationSuggestions: [],
    });
  },

  resetState() {
    contextOptimizationStore.set(initialState);
  },
};

// Helper functions
function removeOldMessages(messages: any[], settings: ContextOptimizationSettings): any[] {
  const { maxContextLength, prioritizeRecent, keepSystemPrompts } = settings;
  
  let result = [...messages];
  
  // Keep system prompts if enabled
  const systemMessages = keepSystemPrompts ? result.filter(m => m.role === 'system') : [];
  const nonSystemMessages = result.filter(m => m.role !== 'system');
  
  if (prioritizeRecent) {
    // Keep recent messages up to max length
    const estimatedLength = nonSystemMessages.length * 100; // Rough estimate
    if (estimatedLength > maxContextLength) {
      const keepCount = Math.floor(maxContextLength / 100);
      result = [
        ...systemMessages,
        ...nonSystemMessages.slice(-keepCount)
      ];
    }
  }
  
  return result;
}

function compressMessages(messages: any[], settings: ContextOptimizationSettings): any[] {
  // Compress by removing code blocks from older messages and keeping summaries
  const result = [...messages];
  const cutoffIndex = Math.floor(result.length * 0.7); // Compress older 70%
  
  for (let i = 0; i < cutoffIndex; i++) {
    if (result[i].content && typeof result[i].content === 'string') {
      // Remove code blocks and long explanations, keep key information
      result[i].content = result[i].content
        .replace(/```[\s\S]*?```/g, '[Code block removed for context optimization]')
        .replace(/\n{3,}/g, '\n\n')
        .substring(0, 200) + (result[i].content.length > 200 ? '...' : '');
    }
  }
  
  return result;
}

function summarizeMessages(messages: any[], settings: ContextOptimizationSettings): any[] {
  // Create a summary of older messages
  const result = [...messages];
  const cutoffIndex = Math.floor(result.length * 0.5); // Summarize older 50%
  
  if (cutoffIndex > 2) {
    const oldMessages = result.slice(0, cutoffIndex);
    const summary = `[Context Summary: This conversation involved ${oldMessages.length} messages covering various topics. Key files were modified and discussed.]`;
    
    return [
      { role: 'system', content: summary },
      ...result.slice(cutoffIndex)
    ];
  }
  
  return result;
}

// Initialize settings on load
if (typeof window !== 'undefined') {
  contextOptimizationActions.loadSettings();
}