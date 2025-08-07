import { BaseAgent, type AgentStep, type AgentContext, type AgentResult } from './base-agent';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import { PromptLibrary } from '~/lib/common/prompt-library';
import { WORK_DIR } from '~/utils/constants';
import { allowedHTMLElements } from '~/utils/markdown';
import { MODIFICATIONS_TAG_NAME } from '~/utils/constants';

export interface CodingTask {
  type: 'create' | 'modify' | 'debug' | 'refactor' | 'test';
  description: string;
  files?: string[];
  requirements?: string[];
  constraints?: string[];
}

export interface CodingStep extends AgentStep {
  code?: string;
  files?: Record<string, string>;
  commands?: string[];
  validationResult?: {
    compiles: boolean;
    tests: boolean;
    linting: boolean;
    issues: string[];
  };
}

export class CodingAgent extends BaseAgent {
  private task: CodingTask;
  private modelInfo: any;
  private apiKeys: Record<string, string>;
  private providerSettings: any;

  constructor(
    context: AgentContext,
    task: CodingTask,
    modelInfo: any,
    apiKeys: Record<string, string> = {},
    providerSettings: any = {}
  ) {
    super(context);
    this.task = task;
    this.modelInfo = modelInfo;
    this.apiKeys = apiKeys;
    this.providerSettings = providerSettings;
  }

  async analyze(): Promise<AgentStep> {
    const analysisStep = this.createStep(
      'analyze',
      'Analyze the coding task and requirements',
      { task: this.task, messages: this.context.messages }
    );

    try {
      analysisStep.status = 'running';
      analysisStep.startTime = Date.now();

      // Use LLM to analyze the task
      const analysisPrompt = this.buildAnalysisPrompt();
      const analysisResult = await this.callLLM(analysisPrompt, 'analyze');

      analysisStep.output = {
        taskComplexity: this.assessComplexity(),
        requiredSteps: this.identifyRequiredSteps(),
        dependencies: this.identifyDependencies(),
        risks: this.identifyRisks(),
        analysisText: analysisResult,
      };

      analysisStep.status = 'completed';
      analysisStep.endTime = Date.now();

      this.logger.info('Task analysis completed', analysisStep.output);
      return analysisStep;
      
    } catch (error) {
      analysisStep.status = 'failed';
      analysisStep.error = error instanceof Error ? error.message : String(error);
      analysisStep.endTime = Date.now();
      return analysisStep;
    }
  }

  async plan(): Promise<AgentStep[]> {
    const planSteps: AgentStep[] = [];
    
    // Based on task type, create appropriate steps
    switch (this.task.type) {
      case 'create':
        planSteps.push(
          this.createStep('plan', 'Design application architecture'),
          this.createStep('code', 'Create project structure and files'),
          this.createStep('code', 'Implement core functionality'),
          this.createStep('code', 'Add styling and UI polish'),
          this.createStep('validate', 'Test and validate implementation')
        );
        break;
        
      case 'modify':
        planSteps.push(
          this.createStep('analyze', 'Understand existing code structure'),
          this.createStep('plan', 'Plan modifications'),
          this.createStep('code', 'Implement changes'),
          this.createStep('validate', 'Verify changes work correctly')
        );
        break;
        
      case 'debug':
        planSteps.push(
          this.createStep('analyze', 'Identify root cause of issues'),
          this.createStep('plan', 'Plan debugging approach'),
          this.createStep('fix', 'Implement fixes'),
          this.createStep('validate', 'Verify issues are resolved')
        );
        break;
        
      case 'refactor':
        planSteps.push(
          this.createStep('analyze', 'Analyze code quality and structure'),
          this.createStep('plan', 'Plan refactoring strategy'),
          this.createStep('code', 'Refactor code while preserving functionality'),
          this.createStep('validate', 'Ensure functionality is preserved')
        );
        break;
        
      case 'test':
        planSteps.push(
          this.createStep('analyze', 'Understand testing requirements'),
          this.createStep('plan', 'Design test strategy'),
          this.createStep('code', 'Implement comprehensive tests'),
          this.createStep('validate', 'Run tests and verify coverage')
        );
        break;
    }

    return planSteps;
  }

  async execute(step: AgentStep): Promise<AgentStep> {
    switch (step.type) {
      case 'analyze':
        return await this.executeAnalyze(step);
      case 'plan':
        return await this.executePlan(step);
      case 'code':
        return await this.executeCode(step);
      case 'fix':
        return await this.executeFix(step);
      case 'validate':
        return await this.executeValidate(step);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  async validate(result: any): Promise<boolean> {
    // Final validation of the entire result
    try {
      // Check if we have generated code/files
      const hasOutput = result && result.length > 0;
      if (!hasOutput) {
        this.logger.warn('No output generated');
        return false;
      }

      // Basic validation checks
      let validationScore = 0;
      const checks = [
        this.validateCodeStructure(result),
        this.validateRequirements(result),
        this.validateQuality(result),
      ];

      validationScore = checks.filter(Boolean).length;
      const isValid = validationScore >= 2; // At least 2 out of 3 checks must pass

      this.logger.info(`Validation completed. Score: ${validationScore}/3, Valid: ${isValid}`);
      return isValid;
      
    } catch (error) {
      this.logger.error('Validation failed', error);
      return false;
    }
  }

  // Private helper methods
  private buildAnalysisPrompt(): string {
    return `
    Analyze this coding task:
    Task Type: ${this.task.type}
    Description: ${this.task.description}
    
    User Messages: ${JSON.stringify(this.context.messages.slice(-3))}
    
    Please provide:
    1. Task complexity assessment (simple/medium/complex)
    2. Key requirements identification
    3. Potential challenges and risks
    4. Recommended approach
    
    Be concise and focus on actionable insights.
    `;
  }

  private async callLLM(prompt: string, context: string): Promise<string> {
    const messages: Messages = [
      {
        id: `analysis-${Date.now()}`,
        role: 'user',
        content: prompt,
      }
    ];

    try {
      const result = await streamText({
        messages,
        env: {} as any, // Will need proper env
        options: {
          supabaseConnection: undefined,
          toolChoice: 'auto',
          tools: {},
          maxSteps: 1,
        } as StreamingOptions,
        apiKeys: this.apiKeys,
        files: this.context.files,
        providerSettings: this.providerSettings,
        promptId: 'adaptive',
        contextOptimization: true,
        contextFiles: undefined,
        chatMode: 'build',
        designScheme: undefined,
        summary: undefined,
        messageSliceId: 0,
      });

      // Collect the streamed response
      let response = '';
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'text-delta') {
          response += chunk.textDelta;
        }
      }

      return response;
      
    } catch (error) {
      this.logger.error(`LLM call failed for ${context}`, error);
      throw error;
    }
  }

  private assessComplexity(): 'simple' | 'medium' | 'complex' {
    // Assess task complexity based on various factors
    let complexity = 0;
    
    // Task type complexity
    if (this.task.type === 'create') complexity += 2;
    if (this.task.type === 'refactor') complexity += 2;
    if (this.task.type === 'debug') complexity += 1;
    
    // Description complexity
    const words = this.task.description.split(' ').length;
    if (words > 50) complexity += 1;
    if (words > 100) complexity += 1;
    
    // Requirements complexity
    if (this.task.requirements && this.task.requirements.length > 3) complexity += 1;
    
    // File count complexity
    if (this.task.files && this.task.files.length > 5) complexity += 1;
    
    if (complexity <= 2) return 'simple';
    if (complexity <= 4) return 'medium';
    return 'complex';
  }

  private identifyRequiredSteps(): string[] {
    const steps: string[] = [];
    
    if (this.task.type === 'create') {
      steps.push('Setup project structure');
      steps.push('Implement core features');
      steps.push('Add styling and UI');
      steps.push('Test functionality');
    }
    
    return steps;
  }

  private identifyDependencies(): string[] {
    // Analyze task for potential dependencies
    const deps: string[] = [];
    
    if (this.task.description.toLowerCase().includes('react')) {
      deps.push('react', 'react-dom');
    }
    if (this.task.description.toLowerCase().includes('typescript')) {
      deps.push('typescript');
    }
    
    return deps;
  }

  private identifyRisks(): string[] {
    const risks: string[] = [];
    
    if (this.assessComplexity() === 'complex') {
      risks.push('High complexity may lead to longer execution time');
    }
    
    if (this.task.files && this.task.files.length > 10) {
      risks.push('Large number of files may affect performance');
    }
    
    return risks;
  }

  private async executeAnalyze(step: AgentStep): Promise<AgentStep> {
    // Implementation for analyze step
    step.output = { analysis: 'Analysis completed' };
    return step;
  }

  private async executePlan(step: AgentStep): Promise<AgentStep> {
    // Implementation for plan step
    step.output = { plan: 'Planning completed' };
    return step;
  }

  private async executeCode(step: AgentStep): Promise<AgentStep> {
    // Implementation for code generation step
    const codePrompt = this.buildCodePrompt(step);
    const codeResult = await this.callLLM(codePrompt, 'code');
    
    step.output = {
      code: codeResult,
      files: this.extractFiles(codeResult),
      commands: this.extractCommands(codeResult),
    };
    
    return step;
  }

  private async executeFix(step: AgentStep): Promise<AgentStep> {
    // Implementation for fix step
    step.output = { fixes: 'Fixes applied' };
    return step;
  }

  private async executeValidate(step: AgentStep): Promise<AgentStep> {
    // Implementation for validation step
    step.output = { validation: 'Validation completed' };
    return step;
  }

  private buildCodePrompt(step: AgentStep): string {
    return `
    Generate code for: ${step.description}
    
    Task: ${this.task.description}
    Context: ${JSON.stringify(this.context.objectives)}
    
    Requirements:
    ${this.task.requirements?.join('\n') || 'No specific requirements'}
    
    Please provide complete, working code with proper structure.
    `;
  }

  private extractFiles(response: string): Record<string, string> {
    // Extract file content from LLM response
    // This would need proper parsing of boltArtifact tags
    return {};
  }

  private extractCommands(response: string): string[] {
    // Extract shell commands from LLM response
    return [];
  }

  private validateCodeStructure(result: any): boolean {
    // Validate that generated code has proper structure
    return true; // Placeholder
  }

  private validateRequirements(result: any): boolean {
    // Validate that all requirements are met
    return true; // Placeholder
  }

  private validateQuality(result: any): boolean {
    // Validate code quality aspects
    return true; // Placeholder
  }
}