import { createScopedLogger } from '~/utils/logger';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { Messages } from '~/lib/.server/llm/stream-text';

const logger = createScopedLogger('BaseAgent');

export interface AgentStep {
  id: string;
  type: 'analyze' | 'plan' | 'code' | 'review' | 'validate' | 'fix';
  description: string;
  input: any;
  output?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  startTime?: number;
  endTime?: number;
}

export interface AgentContext {
  messages: Messages;
  files?: any;
  environment: {
    cwd: string;
    capabilities: string[];
    constraints: string[];
  };
  objectives: string[];
  currentStep?: string;
  metadata: Record<string, any>;
}

export interface AgentResult {
  success: boolean;
  steps: AgentStep[];
  finalOutput: any;
  summary: string;
  recommendations?: string[];
  nextActions?: string[];
}

export abstract class BaseAgent {
  protected logger = createScopedLogger(this.constructor.name);
  protected steps: AgentStep[] = [];
  protected context: AgentContext;

  constructor(context: AgentContext) {
    this.context = context;
  }

  // Abstract methods that must be implemented by subclasses
  abstract analyze(): Promise<AgentStep>;
  abstract plan(): Promise<AgentStep[]>;
  abstract execute(step: AgentStep): Promise<AgentStep>;
  abstract validate(result: any): Promise<boolean>;

  // Core agent execution flow
  async run(): Promise<AgentResult> {
    this.logger.info('Agent execution started');
    
    try {
      // Step 1: Analyze the problem
      const analysisStep = await this.analyze();
      this.steps.push(analysisStep);
      
      if (analysisStep.status === 'failed') {
        return this.createFailedResult('Analysis failed');
      }

      // Step 2: Create execution plan
      const planSteps = await this.plan();
      this.steps.push(...planSteps);

      // Step 3: Execute each step
      for (const step of planSteps) {
        if (step.status === 'pending') {
          step.status = 'running';
          step.startTime = Date.now();
          
          try {
            const executedStep = await this.execute(step);
            Object.assign(step, executedStep);
            step.status = 'completed';
            step.endTime = Date.now();
            
            this.logger.info(`Step completed: ${step.description}`);
          } catch (error) {
            step.status = 'failed';
            step.error = error instanceof Error ? error.message : String(error);
            step.endTime = Date.now();
            
            this.logger.error(`Step failed: ${step.description}`, error);
            
            // Attempt recovery or fail gracefully
            if (!await this.handleStepFailure(step)) {
              return this.createFailedResult(`Step failed: ${step.description}`);
            }
          }
        }
      }

      // Step 4: Validate results
      const finalOutput = this.aggregateResults();
      const isValid = await this.validate(finalOutput);
      
      if (!isValid) {
        return this.createFailedResult('Validation failed');
      }

      return {
        success: true,
        steps: this.steps,
        finalOutput,
        summary: this.generateSummary(),
        recommendations: this.generateRecommendations(),
        nextActions: this.generateNextActions(),
      };
      
    } catch (error) {
      this.logger.error('Agent execution failed', error);
      return this.createFailedResult(error instanceof Error ? error.message : String(error));
    }
  }

  // Helper methods
  protected createStep(
    type: AgentStep['type'],
    description: string,
    input: any = {}
  ): AgentStep {
    return {
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      description,
      input,
      status: 'pending',
    };
  }

  protected async handleStepFailure(step: AgentStep): Promise<boolean> {
    // Default implementation - can be overridden by subclasses
    this.logger.warn(`Attempting to handle step failure: ${step.description}`);
    
    // For now, continue execution for non-critical steps
    const nonCriticalTypes = ['review', 'validate'];
    return nonCriticalTypes.includes(step.type);
  }

  protected aggregateResults(): any {
    // Collect outputs from all completed steps
    return this.steps
      .filter(step => step.status === 'completed' && step.output)
      .map(step => step.output);
  }

  protected generateSummary(): string {
    const completedSteps = this.steps.filter(step => step.status === 'completed');
    const failedSteps = this.steps.filter(step => step.status === 'failed');
    
    return `Agent execution completed. ${completedSteps.length} steps succeeded, ${failedSteps.length} steps failed.`;
  }

  protected generateRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Check for failed steps
    const failedSteps = this.steps.filter(step => step.status === 'failed');
    if (failedSteps.length > 0) {
      recommendations.push(`Review and fix ${failedSteps.length} failed step(s)`);
    }
    
    // Check execution time
    const totalTime = this.steps.reduce((total, step) => {
      if (step.startTime && step.endTime) {
        return total + (step.endTime - step.startTime);
      }
      return total;
    }, 0);
    
    if (totalTime > 30000) { // More than 30 seconds
      recommendations.push('Consider optimizing for faster execution');
    }
    
    return recommendations;
  }

  protected generateNextActions(): string[] {
    // Default implementation - can be overridden
    return [
      'Review generated code for quality',
      'Test the implementation',
      'Consider adding error handling',
    ];
  }

  private createFailedResult(reason: string): AgentResult {
    return {
      success: false,
      steps: this.steps,
      finalOutput: null,
      summary: `Agent execution failed: ${reason}`,
      recommendations: ['Review the error logs', 'Simplify the task', 'Try a different approach'],
    };
  }

  // Utility methods for subclasses
  protected updateContext(updates: Partial<AgentContext>): void {
    this.context = { ...this.context, ...updates };
  }

  protected addObjective(objective: string): void {
    this.context.objectives.push(objective);
  }

  protected setMetadata(key: string, value: any): void {
    this.context.metadata[key] = value;
  }

  protected getMetadata<T>(key: string): T | undefined {
    return this.context.metadata[key] as T;
  }
}