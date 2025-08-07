import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { contextOptimizationStore, contextOptimizationActions, type ContextAnalysis } from '~/lib/stores/contextOptimization';
import { chatStore } from '~/lib/stores/chat';
import { classNames } from '~/utils/classNames';
import { Button } from './Button';
import { Switch } from './Switch';
import { Collapsible } from './Collapsible';

interface ContextOptimizationPanelProps {
  onOptimizeContext?: (strategy: 'remove_old' | 'compress' | 'summarize') => void;
  currentAnalysis?: ContextAnalysis;
}

export function ContextOptimizationPanel({ onOptimizeContext, currentAnalysis }: ContextOptimizationPanelProps) {
  const contextOptimization = useStore(contextOptimizationStore);
  const chat = useStore(chatStore);
  const [showSettings, setShowSettings] = useState(false);

  const { settings, lastAnalysis, isOptimizing } = contextOptimization;
  const analysis = currentAnalysis || lastAnalysis;

  const handleOptimize = (strategy: 'remove_old' | 'compress' | 'summarize') => {
    if (onOptimizeContext) {
      onOptimizeContext(strategy);
    }
  };

  const updateSetting = (key: keyof typeof settings, value: any) => {
    contextOptimizationActions.updateSettings({ [key]: value });
  };

  const getSeverityColor = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'low': return 'text-green-600 dark:text-green-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'high': return 'text-red-600 dark:text-red-400';
    }
  };

  const getSeverityIcon = (severity: 'low' | 'medium' | 'high') => {
    switch (severity) {
      case 'low': return 'i-ph:info-circle';
      case 'medium': return 'i-ph:warning-circle';
      case 'high': return 'i-ph:warning-octagon';
    }
  };

  if (!chat.started) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-bolt-elements-textTertiary">
        <div className="i-ph:chat-circle-text text-2xl mb-2 opacity-50" />
        <span className="text-sm">Start a conversation to see optimization recommendations</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-bolt-elements-textPrimary flex items-center gap-2">
          <div className="i-ph:gauge text-xl" />
          Context Optimization
        </h3>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-sm text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
        >
          Settings
        </button>
      </div>

      {/* Settings Panel */}
      <Collapsible isOpen={showSettings}>
        <div className="space-y-4 p-4 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
          <h4 className="font-medium text-bolt-elements-textPrimary">Optimization Settings</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm text-bolt-elements-textPrimary">Auto-optimize context</label>
              <Switch
                checked={settings.autoOptimize}
                onCheckedChange={(checked) => updateSetting('autoOptimize', checked)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-bolt-elements-textPrimary">Max context length (tokens)</label>
              <input
                type="number"
                value={settings.maxContextLength}
                onChange={(e) => updateSetting('maxContextLength', parseInt(e.target.value))}
                className="w-full px-3 py-2 text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded focus:outline-none focus:border-bolt-elements-focus"
                min="1000"
                max="50000"
                step="1000"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-bolt-elements-textPrimary">Prioritize recent messages</label>
              <Switch
                checked={settings.prioritizeRecent}
                onCheckedChange={(checked) => updateSetting('prioritizeRecent', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="text-sm text-bolt-elements-textPrimary">Keep system prompts</label>
              <Switch
                checked={settings.keepSystemPrompts}
                onCheckedChange={(checked) => updateSetting('keepSystemPrompts', checked)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-bolt-elements-textPrimary">Compression level</label>
              <select
                value={settings.compressionLevel}
                onChange={(e) => updateSetting('compressionLevel', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded focus:outline-none focus:border-bolt-elements-focus"
              >
                <option value="none">None</option>
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>
          </div>
        </div>
      </Collapsible>

      {/* Current Analysis */}
      {analysis && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor">
            <div className="space-y-1">
              <div className="text-xs text-bolt-elements-textSecondary">Total Tokens</div>
              <div className="text-lg font-semibold text-bolt-elements-textPrimary">
                {analysis.totalTokens.toLocaleString()}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-bolt-elements-textSecondary">Messages</div>
              <div className="text-lg font-semibold text-bolt-elements-textPrimary">
                {analysis.messageCount}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-bolt-elements-textSecondary">Est. Cost</div>
              <div className="text-lg font-semibold text-bolt-elements-textPrimary">
                ${analysis.estimatedCost.toFixed(3)}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-bolt-elements-textSecondary">Recommendations</div>
              <div className="text-lg font-semibold text-bolt-elements-textPrimary">
                {analysis.recommendations.length}
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {analysis.recommendations.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-bolt-elements-textPrimary">Optimization Recommendations</h4>
              
              {analysis.recommendations.map((rec, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 bg-bolt-elements-background-depth-2 rounded-lg border border-bolt-elements-borderColor"
                >
                  <div className={classNames('flex-shrink-0 mt-0.5', getSeverityIcon(rec.severity), getSeverityColor(rec.severity))} />
                  
                  <div className="flex-1 space-y-2">
                    <div className="text-sm text-bolt-elements-textPrimary">
                      {rec.description}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-bolt-elements-textSecondary">
                        Potential savings: {rec.potentialSavings.toLocaleString()} tokens
                      </div>
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOptimize(rec.type === 'reset' ? 'remove_old' : rec.type)}
                        disabled={isOptimizing}
                        className="text-xs"
                      >
                        {isOptimizing ? 'Optimizing...' : getActionLabel(rec.type)}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="space-y-3">
            <h4 className="font-medium text-bolt-elements-textPrimary">Quick Actions</h4>
            
            <div className="grid grid-cols-1 gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOptimize('remove_old')}
                disabled={isOptimizing}
                className="flex items-center justify-center gap-2"
              >
                <div className="i-ph:eraser text-sm" />
                Remove Old Messages
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOptimize('compress')}
                disabled={isOptimizing}
                className="flex items-center justify-center gap-2"
              >
                <div className="i-ph:file-zip text-sm" />
                Compress Context
              </Button>
              
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleOptimize('summarize')}
                disabled={isOptimizing}
                className="flex items-center justify-center gap-2"
              >
                <div className="i-ph:note-blank text-sm" />
                Summarize History
              </Button>
            </div>
          </div>
        </div>
      )}

      {!analysis && (
        <div className="flex flex-col items-center justify-center p-6 text-bolt-elements-textTertiary">
          <div className="i-ph:chart-line text-2xl mb-2 opacity-50" />
          <span className="text-sm">No analysis available</span>
          <span className="text-xs text-bolt-elements-textSecondary">Send a message to analyze context</span>
        </div>
      )}
    </div>
  );
}

function getActionLabel(type: string): string {
  switch (type) {
    case 'remove_old': return 'Remove Old';
    case 'compress': return 'Compress';
    case 'summarize': return 'Summarize';
    case 'reset': return 'Reset Context';
    default: return 'Optimize';
  }
}