import { createScopedLogger } from '~/utils/logger';
import { BaseAgent, type AgentContext, type AgentResult } from './base-agent';
import { CodingAgent, type CodingTask } from './coding-agent';
import type { Messages } from '~/lib/.server/llm/stream-text';
import { WORK_DIR } from '~/utils/constants';

const logger = createScopedLogger('AgentManager');

export interface AgentConfig {
  enableAgents: boolean;
  maxSteps: number;
  timeout: number;
  retryAttempts: number;
  complexityThreshold: 'simple' | 'medium' | 'complex';
}

export interface AgentManagerOptions {
  config: AgentConfig;
  modelInfo: any;
  apiKeys: Record<string, string>;
  providerSettings: any;
  files?: any;
  env?: any;
}

export class AgentManager {
  private config: AgentConfig;
  private modelInfo: any;
  private apiKeys: Record<string, string>;
  private providerSettings: any;
  private files?: any;
  private env?: any;
  private activeAgents: Map<string, BaseAgent> = new Map();

  constructor(options: AgentManagerOptions) {
    this.config = options.config;
    this.modelInfo = options.modelInfo;
    this.apiKeys = options.apiKeys;
    this.providerSettings = options.providerSettings;
    this.files = options.files;
    this.env = options.env;
  }

  /**
   * Determine if a task should use agents or fall back to single LLM call
   */
  shouldUseAgents(messages: Messages): boolean {
    if (!this.config.enableAgents) {
      return false;
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return false;
    }

    const content = lastMessage.content.toLowerCase();
    
    // Indicators that suggest complex tasks that would benefit from agents
    const complexityIndicators = [
      // Multi-step requests
      /create.*and.*test/i,
      /build.*with.*features/i,
      /implement.*system/i,
      /develop.*application/i,
      
      // Multiple file operations
      /multiple files?/i,
      /project structure/i,
      /full.*app/i,
      /complete.*implementation/i,
      
      // Complex requirements
      /authentication.*and.*database/i,
      /frontend.*and.*backend/i,
      /responsive.*design/i,
      /production.*ready/i,
      
      // Quality requirements
      /test.*coverage/i,
      /error handling/i,
      /performance.*optimization/i,
      /accessibility/i,
    ];

    const hasComplexityIndicators = complexityIndicators.some(pattern => 
      pattern.test(content)
    );

    // Length-based complexity
    const wordCount = content.split(' ').length;
    const isLongRequest = wordCount > 30;

    // Check for multiple requirements
    const hasMultipleRequirements = (
      content.includes(' and ') || 
      content.includes(' also ') || 
      content.includes(' plus ')
    );

    const shouldUse = hasComplexityIndicators || (isLongRequest && hasMultipleRequirements);
    
    logger.info(`Agent usage decision: ${shouldUse}`, {
      hasComplexityIndicators,
      isLongRequest,
      hasMultipleRequirements,
      wordCount,
    });

    return shouldUse;
  }

  /**
   * Analyze messages and determine the appropriate agent and task
   */
  analyzeTask(messages: Messages): { agentType: string; task: CodingTask } | null {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return null;
    }

    const content = lastMessage.content.toLowerCase();
    
    // Determine task type
    let taskType: CodingTask['type'] = 'create';
    
    if (content.includes('debug') || content.includes('fix') || content.includes('error')) {
      taskType = 'debug';
    } else if (content.includes('modify') || content.includes('update') || content.includes('change')) {
      taskType = 'modify';
    } else if (content.includes('refactor') || content.includes('restructure') || content.includes('improve')) {
      taskType = 'refactor';
    } else if (content.includes('test') && !content.includes('create')) {
      taskType = 'test';
    }

    // Extract requirements
    const requirements = this.extractRequirements(content);
    const constraints = this.extractConstraints(content);

    const task: CodingTask = {
      type: taskType,
      description: lastMessage.content,
      requirements,
      constraints,
    };

    return {
      agentType: 'coding',
      task,
    };
  }

  /**
   * Execute task using appropriate agent
   */
  async executeWithAgent(messages: Messages): Promise<AgentResult> {
    logger.info('Starting agent execution');

    const taskAnalysis = this.analyzeTask(messages);
    if (!taskAnalysis) {
      throw new Error('Could not analyze task for agent execution');
    }

    const context: AgentContext = {
      messages,
      files: this.files,
      environment: {
        cwd: WORK_DIR,
        capabilities: [
          'file_creation',
          'code_generation',
          'package_management',
          'web_development',
          'testing',
        ],
        constraints: [
          'no_native_binaries',
          'webcontainer_only',
          'no_git',
          'no_pip',
        ],
      },
      objectives: this.extractObjectives(messages),
      metadata: {
        startTime: Date.now(),
        modelInfo: this.modelInfo,
      },
    };

    // Create and execute agent
    let agent: BaseAgent;
    
    switch (taskAnalysis.agentType) {
      case 'coding':
        agent = new CodingAgent(
          context,
          taskAnalysis.task,
          this.modelInfo,
          this.apiKeys,
          this.providerSettings
        );
        break;
      default:
        throw new Error(`Unknown agent type: ${taskAnalysis.agentType}`);
    }

    const agentId = `${taskAnalysis.agentType}-${Date.now()}`;
    this.activeAgents.set(agentId, agent);

    try {
      // Set timeout for agent execution
      const timeoutPromise = new Promise<AgentResult>((_, reject) => {
        setTimeout(() => reject(new Error('Agent execution timeout')), this.config.timeout);
      });

      const executionPromise = agent.run();
      const result = await Promise.race([executionPromise, timeoutPromise]);
      
      logger.info('Agent execution completed', {
        success: result.success,
        steps: result.steps.length,
        duration: Date.now() - (context.metadata.startTime || 0),
      });

      return result;

    } catch (error) {
      logger.error('Agent execution failed', error);
      throw error;
    } finally {
      this.activeAgents.delete(agentId);
    }
  }

  /**
   * Get status of active agents
   */
  getActiveAgentsStatus(): Array<{ id: string; type: string; status: string }> {
    return Array.from(this.activeAgents.entries()).map(([id, agent]) => ({
      id,
      type: agent.constructor.name,
      status: 'running', // Could be enhanced to get actual status
    }));
  }

  /**
   * Stop all active agents
   */
  stopAllAgents(): void {
    logger.info(`Stopping ${this.activeAgents.size} active agents`);
    this.activeAgents.clear();
  }

  // Private helper methods
  private extractRequirements(content: string): string[] {
    const requirements: string[] = [];
    
    // Common requirement patterns
    const patterns = [
      /needs? to (.*?)(?:\.|$)/gi,
      /should (.*?)(?:\.|$)/gi,
      /must (.*?)(?:\.|$)/gi,
      /requirements?:?\s*(.*?)(?:\n|$)/gi,
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          requirements.push(match[1].trim());
        }
      }
    });

    // Technology requirements
    if (content.includes('react')) requirements.push('Use React framework');
    if (content.includes('typescript')) requirements.push('Use TypeScript');
    if (content.includes('responsive')) requirements.push('Responsive design');
    if (content.includes('accessible')) requirements.push('Accessibility compliance');

    return requirements;
  }

  private extractConstraints(content: string): string[] {
    const constraints: string[] = [];
    
    // Common constraint patterns
    if (content.includes('no framework') || content.includes('vanilla')) {
      constraints.push('No frameworks allowed');
    }
    if (content.includes('mobile first')) {
      constraints.push('Mobile-first design');
    }
    if (content.includes('lightweight')) {
      constraints.push('Minimize bundle size');
    }

    return constraints;
  }

  private extractObjectives(messages: Messages): string[] {
    const objectives: string[] = [];
    
    // Look at the last few messages to understand objectives
    const recentMessages = messages.slice(-3);
    
    recentMessages.forEach(message => {
      if (message.role === 'user') {
        // Extract main action verbs to understand objectives
        const content = message.content.toLowerCase();
        
        if (content.includes('create') || content.includes('build') || content.includes('make')) {
          objectives.push('Create new implementation');
        }
        if (content.includes('fix') || content.includes('debug')) {
          objectives.push('Fix existing issues');
        }
        if (content.includes('improve') || content.includes('optimize')) {
          objectives.push('Improve existing code');
        }
        if (content.includes('test')) {
          objectives.push('Add comprehensive testing');
        }
      }
    });

    return objectives.length > 0 ? objectives : ['Complete the requested task'];
  }

  /**
   * Convert agent result to format compatible with existing chat system
   */
  convertAgentResultToStreamFormat(result: AgentResult): any {
    return {
      content: this.generateAgentResponse(result),
      steps: result.steps,
      success: result.success,
      summary: result.summary,
      recommendations: result.recommendations,
    };
  }

  private generateAgentResponse(result: AgentResult): string {
    let response = '';
    
    if (result.success) {
      response += `✅ **Task completed successfully**\n\n`;
      response += `${result.summary}\n\n`;
      
      if (result.steps.length > 0) {
        response += `## Execution Steps:\n`;
        result.steps.forEach((step, index) => {
          const status = step.status === 'completed' ? '✅' : 
                        step.status === 'failed' ? '❌' : '⏳';
          response += `${index + 1}. ${status} ${step.description}\n`;
        });
        response += '\n';
      }
      
      if (result.recommendations && result.recommendations.length > 0) {
        response += `## Recommendations:\n`;
        result.recommendations.forEach(rec => {
          response += `- ${rec}\n`;
        });
        response += '\n';
      }
      
      if (result.nextActions && result.nextActions.length > 0) {
        response += `## Next Steps:\n`;
        result.nextActions.forEach(action => {
          response += `- ${action}\n`;
        });
      }
    } else {
      response += `❌ **Task execution failed**\n\n`;
      response += `${result.summary}\n\n`;
      
      if (result.recommendations && result.recommendations.length > 0) {
        response += `## Suggested Solutions:\n`;
        result.recommendations.forEach(rec => {
          response += `- ${rec}\n`;
        });
      }
    }
    
    return response;
  }
}