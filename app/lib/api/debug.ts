export interface DebugWarning {
  id: string;
  message: string;
  timestamp: string;
  code: string;
}

export interface DebugError {
  id: string;
  message: string;
  timestamp: string;
  stack?: string;
}

export interface DebugStatus {
  warnings: DebugIssue[];
  errors: DebugIssue[];
}

export interface DebugIssue {
  id: string;
  message: string;
  type: 'warning' | 'error';
  timestamp: string;
  details?: Record<string, unknown>;
}

// Keep track of acknowledged issues
const acknowledgedIssues = new Set<string>();

export const getDebugStatus = async (): Promise<DebugStatus> => {
  const issues: DebugStatus = {
    warnings: [],
    errors: [],
  };

  try {
    // Check memory usage using our optimization system
    try {
      const { getMemoryUsage } = await import('~/lib/memory-optimization');
      const memoryStats = getMemoryUsage();
      
      if (memoryStats) {
        if (memoryStats.usagePercentage > 80) {
          issues.warnings.push({
            id: 'high-memory-usage',
            message: `High memory usage detected: ${memoryStats.usagePercentage.toFixed(1)}%`,
            type: 'warning',
            timestamp: new Date().toISOString(),
            details: {
              usagePercentage: memoryStats.usagePercentage,
              used: memoryStats.usedJSHeapSize,
              total: memoryStats.jsHeapSizeLimit,
              recommendation: 'Consider clearing browser cache, closing unused tabs, or using the memory optimizer'
            },
          });
        }
        
        if (memoryStats.usagePercentage > 90) {
          issues.errors.push({
            id: 'critical-memory-usage',
            message: `Critical memory usage: ${memoryStats.usagePercentage.toFixed(1)}%`,
            type: 'error',
            timestamp: new Date().toISOString(),
            details: {
              usagePercentage: memoryStats.usagePercentage,
              used: memoryStats.usedJSHeapSize,
              total: memoryStats.jsHeapSizeLimit,
              recommendation: 'Immediate action required: restart the browser or clear application data'
            },
          });
        }
      }
    } catch (error) {
      // Fallback to original memory checking if import fails
      if (performance && 'memory' in performance) {
        const memory = (performance as any).memory;

        if (memory.usedJSHeapSize > memory.jsHeapSizeLimit * 0.8) {
          issues.warnings.push({
            id: 'high-memory-usage',
            message: 'High memory usage detected',
            type: 'warning',
            timestamp: new Date().toISOString(),
            details: {
              used: memory.usedJSHeapSize,
              total: memory.jsHeapSizeLimit,
            },
          });
        }
      }
    }

    // Check storage quota
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const usageRatio = (estimate.usage || 0) / (estimate.quota || 1);

      if (usageRatio > 0.9) {
        issues.warnings.push({
          id: 'storage-quota-warning',
          message: 'Storage quota nearly reached',
          type: 'warning',
          timestamp: new Date().toISOString(),
          details: {
            used: estimate.usage,
            quota: estimate.quota,
          },
        });
      }
    }

    // Check for console errors (if any)
    const errorLogs = localStorage.getItem('error_logs');

    if (errorLogs) {
      const errors = JSON.parse(errorLogs);
      errors.forEach((error: any) => {
        issues.errors.push({
          id: `error-${error.timestamp}`,
          message: error.message,
          type: 'error',
          timestamp: error.timestamp,
          details: error.details,
        });
      });
    }

    // Filter out acknowledged issues
    issues.warnings = issues.warnings.filter((warning) => !acknowledgedIssues.has(warning.id));
    issues.errors = issues.errors.filter((error) => !acknowledgedIssues.has(error.id));

    return issues;
  } catch (error) {
    console.error('Error getting debug status:', error);
    return issues;
  }
};

export const acknowledgeWarning = async (id: string): Promise<void> => {
  acknowledgedIssues.add(id);
};

export const acknowledgeError = async (id: string): Promise<void> => {
  acknowledgedIssues.add(id);

  // Also remove from error logs if present
  try {
    const errorLogs = localStorage.getItem('error_logs');

    if (errorLogs) {
      const errors = JSON.parse(errorLogs);
      const updatedErrors = errors.filter((error: any) => `error-${error.timestamp}` !== id);
      localStorage.setItem('error_logs', JSON.stringify(updatedErrors));
    }
  } catch (error) {
    console.error('Error acknowledging error:', error);
  }
};
