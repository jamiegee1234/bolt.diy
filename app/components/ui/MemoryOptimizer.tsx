import { useEffect, useState } from 'react';
import { Button } from './Button';
import { getMemoryUsage, optimizeComponentMemory, type MemoryStats } from '~/lib/memory-optimization';

interface MemoryOptimizerProps {
  className?: string;
  autoCleanup?: boolean;
}

export function MemoryOptimizer({ className, autoCleanup = true }: MemoryOptimizerProps) {
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastOptimization, setLastOptimization] = useState<Date | null>(null);

  useEffect(() => {
    const updateMemoryStats = () => {
      const stats = getMemoryUsage();
      setMemoryStats(stats);
    };

    // Update immediately
    updateMemoryStats();

    // Update every 10 seconds
    const interval = setInterval(updateMemoryStats, 10000);

    return () => clearInterval(interval);
  }, []);

  const handleOptimize = async () => {
    setIsOptimizing(true);
    
    try {
      await optimizeComponentMemory();
      setLastOptimization(new Date());
      
      // Update stats after optimization
      setTimeout(() => {
        const stats = getMemoryUsage();
        setMemoryStats(stats);
      }, 1000);
    } catch (error) {
      console.error('Memory optimization failed:', error);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Auto cleanup when memory usage is high
  useEffect(() => {
    if (!autoCleanup || !memoryStats || isOptimizing) return;

    if (memoryStats.usagePercentage > 85) {
      // Auto cleanup if memory usage is very high and hasn't been done recently
      const timeSinceLastOptimization = lastOptimization ? 
        Date.now() - lastOptimization.getTime() : Infinity;
      
      if (timeSinceLastOptimization > 60000) { // 1 minute
        handleOptimize();
      }
    }
  }, [memoryStats, autoCleanup, isOptimizing, lastOptimization]);

  if (!memoryStats) {
    return (
      <div className={className}>
        <span className="text-bolt-elements-textSecondary text-sm">
          Memory monitoring not available
        </span>
      </div>
    );
  }

  const getMemoryStatusColor = (percentage: number) => {
    if (percentage < 60) return 'text-green-500';
    if (percentage < 75) return 'text-yellow-500';
    if (percentage < 85) return 'text-orange-500';
    return 'text-red-500';
  };

  const getMemoryStatusText = (percentage: number) => {
    if (percentage < 60) return 'Good';
    if (percentage < 75) return 'Moderate';
    if (percentage < 85) return 'High';
    return 'Critical';
  };

  const formatBytes = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Memory usage indicator */}
      <div className="flex items-center gap-2">
        <span className="text-bolt-elements-textSecondary text-sm">
          Memory:
        </span>
        <span className={`text-sm font-medium ${getMemoryStatusColor(memoryStats.usagePercentage)}`}>
          {memoryStats.usagePercentage.toFixed(1)}%
        </span>
        <span className="text-bolt-elements-textTertiary text-xs">
          ({getMemoryStatusText(memoryStats.usagePercentage)})
        </span>
      </div>

      {/* Memory details tooltip */}
      <div className="group relative">
        <div className="cursor-help text-bolt-elements-textTertiary text-xs">
          ℹ️
        </div>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
          <div className="bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor rounded p-2 text-xs whitespace-nowrap shadow-lg">
            <div>Used: {formatBytes(memoryStats.usedJSHeapSize)}</div>
            <div>Total: {formatBytes(memoryStats.totalJSHeapSize)}</div>
            <div>Limit: {formatBytes(memoryStats.jsHeapSizeLimit)}</div>
            {lastOptimization && (
              <div className="text-bolt-elements-textTertiary mt-1">
                Last cleanup: {lastOptimization.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual optimize button - only show when memory usage is high */}
      {memoryStats.usagePercentage > 60 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={handleOptimize}
          disabled={isOptimizing}
          className="text-xs px-2 py-1"
        >
          {isOptimizing ? 'Optimizing...' : 'Free Memory'}
        </Button>
      )}
    </div>
  );
}

// Simplified version for status bars
export function MemoryIndicator({ className }: { className?: string }) {
  const [memoryStats, setMemoryStats] = useState<MemoryStats | null>(null);

  useEffect(() => {
    const updateMemoryStats = () => {
      const stats = getMemoryUsage();
      setMemoryStats(stats);
    };

    updateMemoryStats();
    const interval = setInterval(updateMemoryStats, 15000); // Update every 15 seconds

    return () => clearInterval(interval);
  }, []);

  if (!memoryStats || memoryStats.usagePercentage < 50) {
    return null; // Don't show indicator if memory usage is low
  }

  const getStatusColor = (percentage: number) => {
    if (percentage < 70) return 'bg-yellow-500';
    if (percentage < 85) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div 
        className={`w-2 h-2 rounded-full ${getStatusColor(memoryStats.usagePercentage)}`}
        title={`Memory usage: ${memoryStats.usagePercentage.toFixed(1)}%`}
      />
      <span className="text-xs text-bolt-elements-textTertiary">
        {memoryStats.usagePercentage.toFixed(0)}%
      </span>
    </div>
  );
}