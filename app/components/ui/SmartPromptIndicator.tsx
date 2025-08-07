import { useState, useEffect } from 'react';
import { useStore } from '@nanostores/react';
import { chatStore } from '~/lib/stores/chat';
import { AdaptivePromptLibrary } from '~/lib/common/prompts/adaptive-prompting';
import { classNames } from '~/utils/classNames';
import { Tooltip } from './Tooltip';
import type { ModelInfo } from '~/lib/modules/llm/types';

interface SmartPromptIndicatorProps {
  modelInfo?: ModelInfo;
  compact?: boolean;
}

export function SmartPromptIndicator({ modelInfo, compact = false }: SmartPromptIndicatorProps) {
  const chat = useStore(chatStore);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (modelInfo) {
      const caps = AdaptivePromptLibrary.analyzeModel(modelInfo);
      setCapabilities(caps);
      
      // Show indicator when model needs adaptation
      setIsVisible(caps.isSmallModel || caps.needsSimplification);
    } else {
      setIsVisible(false);
    }
  }, [modelInfo]);

  if (!isVisible || !capabilities || !chat.started) {
    return null;
  }

  const getIndicatorConfig = () => {
    switch (capabilities.recommendedPromptType) {
      case 'minimal':
        return {
          icon: 'i-ph:lightning',
          color: 'text-blue-600 dark:text-blue-400',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/20',
          label: 'Minimal',
          description: 'Ultra-compact prompting for very small models',
        };
      case 'optimized':
        return {
          icon: 'i-ph:gear',
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/20',
          label: 'Optimized',
          description: 'Streamlined prompting for better performance on smaller models',
        };
      case 'standard':
        return {
          icon: 'i-ph:check-circle',
          color: 'text-purple-600 dark:text-purple-400',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/20',
          label: 'Standard',
          description: 'Balanced prompting for medium-sized models',
        };
      default:
        return {
          icon: 'i-ph:cpu',
          color: 'text-gray-600 dark:text-gray-400',
          bgColor: 'bg-gray-500/10',
          borderColor: 'border-gray-500/20',
          label: 'Adaptive',
          description: 'Smart prompting adapted for your model',
        };
    }
  };

  const config = getIndicatorConfig();

  if (compact) {
    return (
      <Tooltip
        content={
          <div className="text-xs space-y-1">
            <div className="font-medium">{config.label} Prompting Active</div>
            <div>{config.description}</div>
            <div className="text-xs text-bolt-elements-textTertiary">
              Model: {modelInfo?.name}
            </div>
            <div className="text-xs text-bolt-elements-textTertiary">
              Context: {capabilities.contextLength.toLocaleString()} tokens
            </div>
          </div>
        }
      >
        <div
          className={classNames(
            'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium cursor-help transition-colors',
            config.bgColor,
            config.borderColor,
            config.color,
            'border'
          )}
        >
          <div className={classNames(config.icon, 'text-xs')} />
          <span>{config.label}</span>
        </div>
      </Tooltip>
    );
  }

  return (
    <div
      className={classNames(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        config.bgColor,
        config.borderColor
      )}
    >
      <div className={classNames('flex-shrink-0 mt-0.5', config.icon, config.color)} />
      
      <div className="flex-1 space-y-1">
        <div className={classNames('font-medium text-sm', config.color)}>
          {config.label} Prompting Active
        </div>
        
        <div className="text-xs text-bolt-elements-textSecondary">
          {config.description}
        </div>
        
        <div className="flex items-center gap-4 text-xs text-bolt-elements-textTertiary">
          <div>Model: {modelInfo?.name}</div>
          <div>Context: {capabilities.contextLength.toLocaleString()} tokens</div>
          {capabilities.isSmallModel && (
            <div className="flex items-center gap-1">
              <div className="i-ph:warning-circle text-yellow-500" />
              <span>Small Model Detected</span>
            </div>
          )}
        </div>

        {capabilities.needsSimplification && (
          <div className="text-xs text-bolt-elements-textSecondary">
            <div className="i-ph:info text-blue-500 inline mr-1" />
            Prompts have been simplified for better compatibility with this model.
          </div>
        )}
      </div>
    </div>
  );
}

// Hook to use smart prompting info in other components
export function useSmartPrompting(modelInfo?: ModelInfo) {
  const [capabilities, setCapabilities] = useState<any>(null);

  useEffect(() => {
    if (modelInfo) {
      const caps = AdaptivePromptLibrary.analyzeModel(modelInfo);
      setCapabilities(caps);
    }
  }, [modelInfo]);

  return capabilities;
}