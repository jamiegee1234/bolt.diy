import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { Tooltip } from './Tooltip';

interface SessionUsage {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  messageCount: number;
}

interface TokenUsageDisplayProps {
  currentUsage?: {
    totalTokens: number;
    promptTokens: number;
    completionTokens: number;
  };
  compact?: boolean;
}

export function TokenUsageDisplay({ currentUsage, compact = false }: TokenUsageDisplayProps) {
  const chat = useStore(chatStore);
  const [sessionUsage, setSessionUsage] = useState<SessionUsage>(() => {
    // Load from localStorage or initialize
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('bolt.session.tokenUsage');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // Fall through to default
        }
      }
    }
    return {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      messageCount: 0,
    };
  });

  // Update session usage when currentUsage changes
  useEffect(() => {
    if (currentUsage && currentUsage.totalTokens > 0) {
      setSessionUsage(prev => {
        const updated = {
          totalTokens: prev.totalTokens + currentUsage.totalTokens,
          promptTokens: prev.promptTokens + currentUsage.promptTokens,
          completionTokens: prev.completionTokens + currentUsage.completionTokens,
          messageCount: prev.messageCount + 1,
        };
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('bolt.session.tokenUsage', JSON.stringify(updated));
        }
        
        return updated;
      });
    }
  }, [currentUsage]);

  // Reset session usage when starting new chat
  useEffect(() => {
    if (!chat.started && sessionUsage.totalTokens > 0) {
      const resetUsage = {
        totalTokens: 0,
        promptTokens: 0,
        completionTokens: 0,
        messageCount: 0,
      };
      setSessionUsage(resetUsage);
      if (typeof window !== 'undefined') {
        localStorage.setItem('bolt.session.tokenUsage', JSON.stringify(resetUsage));
      }
    }
  }, [chat.started, sessionUsage.totalTokens]);

  // Calculate usage levels for color coding
  const getUsageLevel = (tokens: number) => {
    if (tokens < 1000) return 'low';
    if (tokens < 5000) return 'medium';
    if (tokens < 10000) return 'high';
    return 'critical';
  };

  const usageLevel = getUsageLevel(sessionUsage.totalTokens);
  
  const formatTokens = (tokens: number) => {
    if (tokens < 1000) return tokens.toString();
    if (tokens < 1000000) return `${(tokens / 1000).toFixed(1)}K`;
    return `${(tokens / 1000000).toFixed(1)}M`;
  };

  const resetSessionUsage = () => {
    const resetUsage = {
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      messageCount: 0,
    };
    setSessionUsage(resetUsage);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bolt.session.tokenUsage', JSON.stringify(resetUsage));
    }
  };

  if (compact) {
    return (
      <Tooltip
        content={
          <div className="text-xs space-y-1">
            <div>Session Total: {formatTokens(sessionUsage.totalTokens)} tokens</div>
            <div>Messages: {sessionUsage.messageCount}</div>
            <div>Input: {formatTokens(sessionUsage.promptTokens)} | Output: {formatTokens(sessionUsage.completionTokens)}</div>
            {currentUsage && (
              <div className="border-t border-bolt-elements-borderColor pt-1 mt-1">
                Last: {formatTokens(currentUsage.totalTokens)} tokens
              </div>
            )}
          </div>
        }
      >
        <div
          className={classNames(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-help transition-colors',
            {
              'bg-green-500/10 text-green-600 dark:text-green-400': usageLevel === 'low',
              'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400': usageLevel === 'medium',
              'bg-orange-500/10 text-orange-600 dark:text-orange-400': usageLevel === 'high',
              'bg-red-500/10 text-red-600 dark:text-red-400': usageLevel === 'critical',
            }
          )}
        >
          <div className="i-ph:coins text-xs" />
          <span>{formatTokens(sessionUsage.totalTokens)}</span>
        </div>
      </Tooltip>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-bolt-elements-textPrimary flex items-center gap-2">
          <div className="i-ph:coins text-base" />
          Token Usage
        </h3>
        <button
          onClick={resetSessionUsage}
          className="text-xs text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
          title="Reset session usage"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <div className="text-bolt-elements-textSecondary">Session Total</div>
          <div className={classNames(
            'font-medium text-sm',
            {
              'text-green-600 dark:text-green-400': usageLevel === 'low',
              'text-yellow-600 dark:text-yellow-400': usageLevel === 'medium',
              'text-orange-600 dark:text-orange-400': usageLevel === 'high',
              'text-red-600 dark:text-red-400': usageLevel === 'critical',
            }
          )}>
            {formatTokens(sessionUsage.totalTokens)}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-bolt-elements-textSecondary">Messages</div>
          <div className="font-medium text-sm text-bolt-elements-textPrimary">
            {sessionUsage.messageCount}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-bolt-elements-textSecondary">Input Tokens</div>
          <div className="font-medium text-sm text-bolt-elements-textPrimary">
            {formatTokens(sessionUsage.promptTokens)}
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-bolt-elements-textSecondary">Output Tokens</div>
          <div className="font-medium text-sm text-bolt-elements-textPrimary">
            {formatTokens(sessionUsage.completionTokens)}
          </div>
        </div>
      </div>

      {currentUsage && currentUsage.totalTokens > 0 && (
        <div className="pt-2 border-t border-bolt-elements-borderColor">
          <div className="text-xs text-bolt-elements-textSecondary mb-1">Last Message</div>
          <div className="text-xs text-bolt-elements-textPrimary">
            {formatTokens(currentUsage.totalTokens)} tokens 
            ({formatTokens(currentUsage.promptTokens)} in, {formatTokens(currentUsage.completionTokens)} out)
          </div>
        </div>
      )}

      {usageLevel === 'critical' && (
        <div className="flex items-start gap-2 p-2 rounded bg-red-500/10 border border-red-500/20">
          <div className="i-ph:warning-circle text-red-500 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-red-600 dark:text-red-400">
            High token usage detected. Consider using context optimization or resetting the conversation.
          </div>
        </div>
      )}
    </div>
  );
}