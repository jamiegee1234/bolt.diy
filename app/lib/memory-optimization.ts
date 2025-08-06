import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('memory-optimization');

export interface MemoryStats {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  usagePercentage: number;
}

export interface MemoryOptimizationConfig {
  maxMemoryUsagePercent: number;
  cleanupInterval: number;
  filesCacheSize: number;
  messagesCacheSize: number;
}

const DEFAULT_CONFIG: MemoryOptimizationConfig = {
  maxMemoryUsagePercent: 75, // Start cleanup at 75% memory usage
  cleanupInterval: 30000, // Check every 30 seconds
  filesCacheSize: 50, // Keep max 50 files in memory
  messagesCacheSize: 100, // Keep max 100 messages in memory
};

class MemoryOptimizer {
  private config: MemoryOptimizationConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isCleaningUp = false;
  private lastCleanupTime = 0;

  constructor(config: Partial<MemoryOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startMonitoring();
  }

  getMemoryStats(): MemoryStats | null {
    if (!performance || !('memory' in performance)) {
      return null;
    }

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
    };
  }

  isMemoryPressure(): boolean {
    const stats = this.getMemoryStats();
    if (!stats) return false;

    return stats.usagePercentage > this.config.maxMemoryUsagePercent;
  }

  private startMonitoring() {
    if (typeof window === 'undefined') return; // Only run in browser

    this.cleanupInterval = setInterval(() => {
      this.checkAndCleanup();
    }, this.config.cleanupInterval);

    // Listen for browser events that might indicate memory pressure
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });

    // Listen for visibility change to cleanup when tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.cleanup();
      }
    });
  }

  private async checkAndCleanup() {
    if (this.isCleaningUp) return;

    const stats = this.getMemoryStats();
    if (!stats) return;

    logger.debug(`Memory usage: ${stats.usagePercentage.toFixed(2)}%`);

    if (this.isMemoryPressure()) {
      logger.warn(`Memory pressure detected: ${stats.usagePercentage.toFixed(2)}%`);
      await this.cleanup();
    }
  }

  async cleanup() {
    if (this.isCleaningUp) return;

    const now = Date.now();
    // Prevent too frequent cleanups
    if (now - this.lastCleanupTime < 10000) return; // Max once per 10 seconds

    this.isCleaningUp = true;
    this.lastCleanupTime = now;

    try {
      logger.debug('Starting memory cleanup...');

      // Clear various caches and temporary data
      await this.clearFileCache();
      await this.clearMessageCache();
      await this.clearDOMCache();
      await this.triggerGarbageCollection();

      const stats = this.getMemoryStats();
      if (stats) {
        logger.debug(`Memory cleanup completed. Usage: ${stats.usagePercentage.toFixed(2)}%`);
      }
    } catch (error) {
      logger.error('Error during memory cleanup:', error);
    } finally {
      this.isCleaningUp = false;
    }
  }

  private async clearFileCache() {
    try {
      // Clear file editor cache
      const editorEvents = new CustomEvent('bolt:clear-editor-cache', {
        detail: { reason: 'memory-optimization' }
      });
      window.dispatchEvent(editorEvents);

      // Clear file tree cache
      const fileTreeEvents = new CustomEvent('bolt:clear-file-cache', {
        detail: { maxSize: this.config.filesCacheSize }
      });
      window.dispatchEvent(fileTreeEvents);

      logger.debug('File cache cleared');
    } catch (error) {
      logger.error('Error clearing file cache:', error);
    }
  }

  private async clearMessageCache() {
    try {
      // Clear old chat messages from memory
      const messageEvents = new CustomEvent('bolt:clear-message-cache', {
        detail: { maxSize: this.config.messagesCacheSize }
      });
      window.dispatchEvent(messageEvents);

      logger.debug('Message cache cleared');
    } catch (error) {
      logger.error('Error clearing message cache:', error);
    }
  }

  private async clearDOMCache() {
    try {
      // Clear unused DOM elements
      const unusedElements = document.querySelectorAll('[data-cleanup="true"]');
      unusedElements.forEach(element => element.remove());

      // Clear inline styles that might be holding references
      const inlineStyleSheets = Array.from(document.styleSheets).filter(
        sheet => sheet.ownerNode?.nodeName === 'STYLE'
      );
      
      inlineStyleSheets.forEach(sheet => {
        if (sheet.ownerNode && sheet.ownerNode.textContent?.includes('/* temp */')) {
          sheet.ownerNode.remove();
        }
      });

      logger.debug('DOM cache cleared');
    } catch (error) {
      logger.error('Error clearing DOM cache:', error);
    }
  }

  private async triggerGarbageCollection() {
    try {
      // Try to trigger garbage collection if available
      if ('gc' in window && typeof (window as any).gc === 'function') {
        (window as any).gc();
        logger.debug('Manual garbage collection triggered');
      }

      // Create memory pressure to encourage GC
      const memoryPressure = new Array(1000).fill(null);
      memoryPressure.length = 0;

      // Use setTimeout to allow GC to run
      await new Promise(resolve => setTimeout(resolve, 0));
    } catch (error) {
      logger.error('Error triggering garbage collection:', error);
    }
  }

  stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Method to manually trigger cleanup
  forceCleanup() {
    this.lastCleanupTime = 0; // Reset to allow immediate cleanup
    return this.cleanup();
  }

  // Update configuration
  updateConfig(newConfig: Partial<MemoryOptimizationConfig>) {
    this.config = { ...this.config, ...newConfig };
    logger.debug('Memory optimizer configuration updated:', this.config);
  }
}

// Export singleton instance
export const memoryOptimizer = new MemoryOptimizer();

// Export utility functions for components to use
export function optimizeComponentMemory() {
  // Clean up component-specific memory
  return memoryOptimizer.forceCleanup();
}

export function getMemoryUsage(): MemoryStats | null {
  return memoryOptimizer.getMemoryStats();
}

export function isMemoryUnderPressure(): boolean {
  return memoryOptimizer.isMemoryPressure();
}

// Utility to check if we should defer heavy operations due to memory pressure
export function shouldDeferOperation(): boolean {
  const stats = getMemoryUsage();
  if (!stats) return false;
  
  return stats.usagePercentage > 85; // Defer at 85% memory usage
}

// Utility for components to register cleanup listeners
export function registerCleanupListener(
  type: 'editor' | 'file' | 'message', 
  callback: (detail: any) => void
) {
  window.addEventListener(`bolt:clear-${type}-cache`, (event) => {
    callback((event as CustomEvent).detail);
  });
}

// Memory-aware debouncing for expensive operations
export function memoryAwareDebounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  maxWait?: number
): T {
  let timeout: NodeJS.Timeout | null = null;
  let maxTimeout: NodeJS.Timeout | null = null;
  
  return ((...args: Parameters<T>) => {
    const executeFunc = () => {
      timeout = null;
      maxTimeout = null;
      
      // Check memory before executing
      if (shouldDeferOperation()) {
        // Defer execution if under memory pressure
        timeout = setTimeout(() => executeFunc(), wait);
        return;
      }
      
      func.apply(null, args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(executeFunc, wait);
    
    if (maxWait && !maxTimeout) {
      maxTimeout = setTimeout(executeFunc, maxWait);
    }
  }) as T;
}