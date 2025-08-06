import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('enhanced-logging');

export interface ErrorReport {
  id: string;
  timestamp: string;
  level: 'error' | 'warning' | 'info';
  component: string;
  message: string;
  stack?: string;
  userAgent: string;
  url: string;
  context?: Record<string, any>;
  tags?: string[];
}

export interface PerformanceMetric {
  id: string;
  timestamp: string;
  type: 'navigation' | 'resource' | 'measure' | 'paint';
  name: string;
  duration: number;
  details?: Record<string, any>;
}

class EnhancedLogger {
  private errorReports: ErrorReport[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private maxReports = 100;
  private maxMetrics = 50;

  constructor() {
    this.setupGlobalErrorHandling();
    this.setupPerformanceMonitoring();
    this.setupConsoleInterception();
  }

  private setupGlobalErrorHandling() {
    // Catch unhandled errors
    window.addEventListener('error', (event) => {
      this.logError('global', event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError('promise', event.reason, {
        promise: 'unhandled rejection',
      });
    });

    // Catch React errors (if React error boundary passes them)
    window.addEventListener('react-error', (event: any) => {
      this.logError('react', event.detail.error, {
        componentStack: event.detail.componentStack,
        errorBoundary: event.detail.errorBoundary,
      });
    });
  }

  private setupPerformanceMonitoring() {
    // Monitor navigation timing
    if ('performance' in window && 'getEntriesByType' in performance) {
      // Navigation timing
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.logPerformanceMetric('navigation', 'page-load', navigation.loadEventEnd - navigation.navigationStart, {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.navigationStart,
            firstPaint: navigation.loadEventEnd - navigation.navigationStart,
          });
        }
      }, 1000);

      // Monitor large resource loads
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          if (entry.transferSize && entry.transferSize > 100000) { // 100KB+
            this.logPerformanceMetric('resource', entry.name, entry.duration, {
              size: entry.transferSize,
              type: (entry as any).initiatorType,
            });
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['resource'] });
      } catch (e) {
        // Some browsers might not support this
      }

      // Monitor long tasks
      try {
        const longTaskObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.duration > 50) { // Tasks longer than 50ms
              this.logPerformanceMetric('measure', 'long-task', entry.duration, {
                startTime: entry.startTime,
              });
            }
          });
        });
        
        longTaskObserver.observe({ entryTypes: ['longtask'] });
      } catch (e) {
        // Not supported in all browsers
      }
    }
  }

  private setupConsoleInterception() {
    const originalError = console.error;
    const originalWarn = console.warn;

    console.error = (...args) => {
      this.logError('console', new Error(args.join(' ')), {
        level: 'error',
        args: args.slice(0, 3), // Limit args to prevent large objects
      });
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      this.logWarning('console', args.join(' '), {
        level: 'warning',
        args: args.slice(0, 3),
      });
      originalWarn.apply(console, args);
    };
  }

  logError(component: string, error: Error, context?: Record<string, any>, tags?: string[]) {
    const report: ErrorReport = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: 'error',
      component,
      message: error.message,
      stack: error.stack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      context,
      tags,
    };

    this.addErrorReport(report);
    logger.error(`[${component}] ${error.message}`, { error, context });
  }

  logWarning(component: string, message: string, context?: Record<string, any>, tags?: string[]) {
    const report: ErrorReport = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: 'warning',
      component,
      message,
      userAgent: navigator.userAgent,
      url: window.location.href,
      context,
      tags,
    };

    this.addErrorReport(report);
    logger.warn(`[${component}] ${message}`, context);
  }

  logInfo(component: string, message: string, context?: Record<string, any>, tags?: string[]) {
    const report: ErrorReport = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      level: 'info',
      component,
      message,
      userAgent: navigator.userAgent,
      url: window.location.href,
      context,
      tags,
    };

    this.addErrorReport(report);
    logger.info(`[${component}] ${message}`, context);
  }

  logPerformanceMetric(type: PerformanceMetric['type'], name: string, duration: number, details?: Record<string, any>) {
    const metric: PerformanceMetric = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type,
      name,
      duration,
      details,
    };

    this.addPerformanceMetric(metric);

    if (duration > 1000) { // Log slow operations
      logger.warn(`Slow ${type}: ${name} took ${duration.toFixed(2)}ms`, details);
    }
  }

  private addErrorReport(report: ErrorReport) {
    this.errorReports.unshift(report);
    if (this.errorReports.length > this.maxReports) {
      this.errorReports = this.errorReports.slice(0, this.maxReports);
    }

    // Store in localStorage for persistence across reloads
    try {
      localStorage.setItem('bolt-error-reports', JSON.stringify(this.errorReports.slice(0, 20)));
    } catch (e) {
      // Storage might be full
    }
  }

  private addPerformanceMetric(metric: PerformanceMetric) {
    this.performanceMetrics.unshift(metric);
    if (this.performanceMetrics.length > this.maxMetrics) {
      this.performanceMetrics = this.performanceMetrics.slice(0, this.maxMetrics);
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getErrorReports(filter?: { level?: string; component?: string; since?: Date }): ErrorReport[] {
    let reports = [...this.errorReports];

    if (filter) {
      if (filter.level) {
        reports = reports.filter(r => r.level === filter.level);
      }
      if (filter.component) {
        reports = reports.filter(r => r.component.includes(filter.component));
      }
      if (filter.since) {
        reports = reports.filter(r => new Date(r.timestamp) >= filter.since!);
      }
    }

    return reports;
  }

  getPerformanceMetrics(filter?: { type?: string; slowOnly?: boolean }): PerformanceMetric[] {
    let metrics = [...this.performanceMetrics];

    if (filter) {
      if (filter.type) {
        metrics = metrics.filter(m => m.type === filter.type);
      }
      if (filter.slowOnly) {
        metrics = metrics.filter(m => m.duration > 100); // Only metrics > 100ms
      }
    }

    return metrics;
  }

  getSystemInfo() {
    const nav = navigator as any;
    const perf = performance as any;

    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      memory: perf.memory ? {
        usedJSHeapSize: perf.memory.usedJSHeapSize,
        totalJSHeapSize: perf.memory.totalJSHeapSize,
        jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
      } : null,
      connection: nav.connection ? {
        effectiveType: nav.connection.effectiveType,
        downlink: nav.connection.downlink,
        rtt: nav.connection.rtt,
      } : null,
      screen: {
        width: screen.width,
        height: screen.height,
        colorDepth: screen.colorDepth,
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      localStorage: (() => {
        try {
          return {
            available: true,
            used: JSON.stringify(localStorage).length,
          };
        } catch (e) {
          return { available: false };
        }
      })(),
    };
  }

  clearReports() {
    this.errorReports = [];
    this.performanceMetrics = [];
    try {
      localStorage.removeItem('bolt-error-reports');
    } catch (e) {
      // Ignore
    }
  }

  // Load persisted reports from localStorage
  loadPersistedReports() {
    try {
      const stored = localStorage.getItem('bolt-error-reports');
      if (stored) {
        const reports = JSON.parse(stored);
        if (Array.isArray(reports)) {
          this.errorReports = [...reports, ...this.errorReports];
        }
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
}

// Export singleton instance
export const enhancedLogger = new EnhancedLogger();

// Load any persisted reports
enhancedLogger.loadPersistedReports();

// Export convenience functions
export function logError(component: string, error: Error, context?: Record<string, any>, tags?: string[]) {
  return enhancedLogger.logError(component, error, context, tags);
}

export function logWarning(component: string, message: string, context?: Record<string, any>, tags?: string[]) {
  return enhancedLogger.logWarning(component, message, context, tags);
}

export function logInfo(component: string, message: string, context?: Record<string, any>, tags?: string[]) {
  return enhancedLogger.logInfo(component, message, context, tags);
}

export function logPerformance(type: PerformanceMetric['type'], name: string, duration: number, details?: Record<string, any>) {
  return enhancedLogger.logPerformanceMetric(type, name, duration, details);
}

export function getDebugData() {
  return {
    errors: enhancedLogger.getErrorReports(),
    performance: enhancedLogger.getPerformanceMetrics(),
    system: enhancedLogger.getSystemInfo(),
  };
}