import { createScopedLogger } from '~/utils/logger';
import { streamText, type Messages, type StreamingOptions } from '~/lib/.server/llm/stream-text';
import type { ModelInfo } from '~/lib/modules/llm/types';
import { WORK_DIR } from '~/utils/constants';

const logger = createScopedLogger('ProjectPlanner');

export interface ProjectPlan {
  id: string;
  title: string;
  description: string;
  scope: string[];
  objectives: string[];
  phases: ProjectPhase[];
  technologies: Technology[];
  architecture: ArchitectureDecision[];
  timeline: TimelineItem[];
  risks: Risk[];
  dependencies: Dependency[];
  deliverables: Deliverable[];
  success_criteria: string[];
  created_at: string;
  updated_at: string;
}

export interface ProjectPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  tasks: Task[];
  estimated_duration: string;
  dependencies: string[];
  deliverables: string[];
}

export interface Task {
  id: string;
  name: string;
  description: string;
  type: 'design' | 'development' | 'testing' | 'deployment' | 'documentation';
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimated_effort: string;
  dependencies: string[];
  acceptance_criteria: string[];
}

export interface Technology {
  name: string;
  type: 'framework' | 'library' | 'tool' | 'language' | 'database' | 'service';
  version?: string;
  purpose: string;
  justification: string;
  alternatives_considered?: string[];
}

export interface ArchitectureDecision {
  id: string;
  title: string;
  context: string;
  decision: string;
  rationale: string;
  consequences: string[];
  alternatives: string[];
}

export interface TimelineItem {
  phase: string;
  milestone: string;
  estimated_completion: string;
  dependencies: string[];
}

export interface Risk {
  id: string;
  category: 'technical' | 'business' | 'resource' | 'timeline' | 'external';
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
  contingency: string;
}

export interface Dependency {
  id: string;
  name: string;
  type: 'internal' | 'external' | 'third-party';
  description: string;
  required_by: string;
  availability: string;
  risk_level: 'low' | 'medium' | 'high';
}

export interface Deliverable {
  id: string;
  name: string;
  type: 'code' | 'documentation' | 'design' | 'deployment' | 'test';
  description: string;
  phase: string;
  acceptance_criteria: string[];
}

export interface PlannerOptions {
  modelInfo: ModelInfo;
  apiKeys: Record<string, string>;
  providerSettings: any;
  env: any;
  enableDetailedPlanning: boolean;
  includeRiskAssessment: boolean;
  includeArchitecture: boolean;
}

export class ProjectPlanner {
  private options: PlannerOptions;
  private logger = createScopedLogger('ProjectPlanner');

  constructor(options: PlannerOptions) {
    this.options = options;
  }

  /**
   * Analyze user request and determine if planning is needed
   */
  shouldCreatePlan(messages: Messages): boolean {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return false;
    }

    const content = lastMessage.content.toLowerCase();
    
    // Indicators that suggest need for planning
    const planningIndicators = [
      // Project scale indicators
      /build.*application/i,
      /create.*system/i,
      /develop.*platform/i,
      /full.*stack/i,
      /complete.*solution/i,
      
      // Complex feature requests
      /multiple.*features/i,
      /with.*authentication/i,
      /database.*integration/i,
      /user.*management/i,
      /api.*endpoints/i,
      
      // Quality requirements
      /production.*ready/i,
      /scalable/i,
      /maintainable/i,
      /secure/i,
      /tested/i,
      
      // Architecture keywords
      /microservices/i,
      /architecture/i,
      /design.*patterns/i,
      /best.*practices/i,
    ];

    const hasComplexityIndicators = planningIndicators.some(pattern => 
      pattern.test(content)
    );

    // Length and complexity assessment
    const wordCount = content.split(' ').length;
    const isComplex = wordCount > 50 || hasComplexityIndicators;

    this.logger.info(`Planning assessment: ${isComplex}`, {
      hasComplexityIndicators,
      wordCount,
    });

    return isComplex;
  }

  /**
   * Generate a comprehensive project plan
   */
  async generatePlan(messages: Messages): Promise<ProjectPlan> {
    this.logger.info('Generating project plan');

    const planningPrompt = this.buildPlanningPrompt(messages);
    const planResponse = await this.callLLM(planningPrompt, 'planning');
    
    // Parse the structured plan from the response
    const plan = this.parsePlanFromResponse(planResponse);
    
    // Generate detailed plan file
    const planMarkdown = this.generatePlanMarkdown(plan);
    
    // Store the plan (could be saved to file system or database)
    await this.storePlan(plan, planMarkdown);
    
    this.logger.info('Project plan generated', {
      phases: plan.phases.length,
      tasks: plan.phases.reduce((total, phase) => total + phase.tasks.length, 0),
      technologies: plan.technologies.length,
    });

    return plan;
  }

  /**
   * Update existing plan based on new requirements
   */
  async updatePlan(existingPlan: ProjectPlan, changes: string): Promise<ProjectPlan> {
    this.logger.info('Updating project plan');

    const updatePrompt = this.buildUpdatePrompt(existingPlan, changes);
    const updateResponse = await this.callLLM(updatePrompt, 'plan-update');
    
    const updatedPlan = this.parsePlanFromResponse(updateResponse);
    updatedPlan.updated_at = new Date().toISOString();
    
    return updatedPlan;
  }

  // Private helper methods
  private buildPlanningPrompt(messages: Messages): string {
    const lastMessage = messages[messages.length - 1];
    const projectDescription = lastMessage?.content || '';
    
    return `
# Project Planning Request

You are an expert project planner and software architect. Create a comprehensive project plan for the following request:

## User Request:
${projectDescription}

## Previous Context:
${messages.slice(-3, -1).map(m => `${m.role}: ${m.content}`).join('\n')}

Please provide a detailed project plan in the following JSON structure:

\`\`\`json
{
  "title": "Project Title",
  "description": "Brief project description",
  "scope": ["scope item 1", "scope item 2"],
  "objectives": ["objective 1", "objective 2"],
  "phases": [
    {
      "name": "Phase Name",
      "description": "Phase description",
      "order": 1,
      "tasks": [
        {
          "name": "Task Name",
          "description": "Task description",
          "type": "development|design|testing|deployment|documentation",
          "priority": "low|medium|high|critical",
          "estimated_effort": "2 hours",
          "dependencies": ["task-id"],
          "acceptance_criteria": ["criteria 1", "criteria 2"]
        }
      ],
      "estimated_duration": "2 days",
      "dependencies": ["previous-phase"],
      "deliverables": ["deliverable 1"]
    }
  ],
  "technologies": [
    {
      "name": "React",
      "type": "framework",
      "version": "18.x",
      "purpose": "Frontend UI development",
      "justification": "Component-based architecture, large ecosystem",
      "alternatives_considered": ["Vue", "Angular"]
    }
  ],
  "architecture": [
    {
      "title": "Frontend Architecture",
      "context": "Need to decide on frontend structure",
      "decision": "Component-based React app with TypeScript",
      "rationale": "Type safety and maintainability",
      "consequences": ["Better DX", "Compile-time checks"],
      "alternatives": ["JavaScript only", "Vue.js"]
    }
  ],
  "timeline": [
    {
      "phase": "Phase 1",
      "milestone": "MVP Ready",
      "estimated_completion": "1 week",
      "dependencies": []
    }
  ],
  "risks": [
    {
      "category": "technical",
      "description": "Integration complexity",
      "probability": "medium",
      "impact": "high",
      "mitigation": "Early prototyping",
      "contingency": "Alternative approach"
    }
  ],
  "dependencies": [
    {
      "name": "External API",
      "type": "third-party",
      "description": "Required for data",
      "required_by": "core-features",
      "availability": "Available",
      "risk_level": "low"
    }
  ],
  "deliverables": [
    {
      "name": "Working Application",
      "type": "code",
      "description": "Fully functional app",
      "phase": "Development",
      "acceptance_criteria": ["All features working", "Tests passing"]
    }
  ],
  "success_criteria": ["User can complete main workflow", "Performance meets targets"]
}
\`\`\`

Guidelines:
1. Be specific and actionable in task descriptions
2. Include realistic time estimates
3. Consider dependencies between tasks
4. Identify potential risks and mitigation strategies
5. Choose appropriate technologies with justification
6. Break down complex tasks into manageable pieces
7. Include proper testing and validation steps
8. Consider both technical and business objectives

Focus on creating a plan that maximizes the chance of project success while being efficient and maintainable.
    `;
  }

  private buildUpdatePrompt(existingPlan: ProjectPlan, changes: string): string {
    return `
# Project Plan Update Request

Update the existing project plan based on new requirements:

## Current Plan:
${JSON.stringify(existingPlan, null, 2)}

## Requested Changes:
${changes}

Please provide the updated plan in the same JSON structure, incorporating the changes while maintaining consistency and feasibility.
    `;
  }

  private async callLLM(prompt: string, context: string): Promise<string> {
    const messages: Messages = [
      {
        id: `planning-${Date.now()}`,
        role: 'user',
        content: prompt,
      }
    ];

    try {
      const result = await streamText({
        messages,
        env: this.options.env,
        options: {
          supabaseConnection: undefined,
          toolChoice: 'auto',
          tools: {},
          maxSteps: 1,
        } as StreamingOptions,
        apiKeys: this.options.apiKeys,
        files: {},
        providerSettings: this.options.providerSettings,
        promptId: 'adaptive',
        contextOptimization: true,
        contextFiles: undefined,
        chatMode: 'build',
        designScheme: undefined,
        summary: undefined,
        messageSliceId: 0,
      });

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

  private parsePlanFromResponse(response: string): ProjectPlan {
    try {
      // Extract JSON from the response
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch) {
        throw new Error('No JSON plan found in response');
      }

      const planData = JSON.parse(jsonMatch[1]);
      
      // Add required fields if missing
      const plan: ProjectPlan = {
        id: `plan-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...planData,
      };

      // Add IDs to sub-objects if missing
      this.ensureIds(plan);
      
      return plan;
      
    } catch (error) {
      this.logger.error('Failed to parse plan from response', error);
      
      // Return a minimal fallback plan
      return this.createFallbackPlan();
    }
  }

  private ensureIds(plan: ProjectPlan): void {
    // Ensure all phases have IDs
    plan.phases.forEach((phase, index) => {
      if (!phase.id) {
        phase.id = `phase-${index + 1}`;
      }
      
      // Ensure all tasks have IDs
      phase.tasks.forEach((task, taskIndex) => {
        if (!task.id) {
          task.id = `${phase.id}-task-${taskIndex + 1}`;
        }
      });
    });

    // Ensure other entities have IDs
    ['architecture', 'risks', 'dependencies', 'deliverables'].forEach(key => {
      const items = (plan as any)[key] || [];
      items.forEach((item: any, index: number) => {
        if (!item.id) {
          item.id = `${key}-${index + 1}`;
        }
      });
    });
  }

  private createFallbackPlan(): ProjectPlan {
    return {
      id: `fallback-plan-${Date.now()}`,
      title: 'Project Plan',
      description: 'Auto-generated fallback plan',
      scope: ['Implement requested features'],
      objectives: ['Complete the project successfully'],
      phases: [
        {
          id: 'phase-1',
          name: 'Development',
          description: 'Main development phase',
          order: 1,
          tasks: [
            {
              id: 'task-1',
              name: 'Implement core functionality',
              description: 'Build the main features',
              type: 'development',
              priority: 'high',
              estimated_effort: '4 hours',
              dependencies: [],
              acceptance_criteria: ['Features work as expected'],
            }
          ],
          estimated_duration: '1 day',
          dependencies: [],
          deliverables: ['Working application'],
        }
      ],
      technologies: [],
      architecture: [],
      timeline: [],
      risks: [],
      dependencies: [],
      deliverables: [],
      success_criteria: ['Project meets requirements'],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  private generatePlanMarkdown(plan: ProjectPlan): string {
    let markdown = `# ${plan.title}\n\n`;
    markdown += `**Created:** ${new Date(plan.created_at).toLocaleDateString()}\n`;
    markdown += `**Last Updated:** ${new Date(plan.updated_at).toLocaleDateString()}\n\n`;
    
    markdown += `## Description\n${plan.description}\n\n`;
    
    if (plan.scope.length > 0) {
      markdown += `## Project Scope\n`;
      plan.scope.forEach(item => {
        markdown += `- ${item}\n`;
      });
      markdown += '\n';
    }
    
    if (plan.objectives.length > 0) {
      markdown += `## Objectives\n`;
      plan.objectives.forEach(obj => {
        markdown += `- ${obj}\n`;
      });
      markdown += '\n';
    }
    
    if (plan.technologies.length > 0) {
      markdown += `## Technology Stack\n\n`;
      plan.technologies.forEach(tech => {
        markdown += `### ${tech.name} (${tech.type})\n`;
        markdown += `- **Purpose:** ${tech.purpose}\n`;
        markdown += `- **Justification:** ${tech.justification}\n`;
        if (tech.version) {
          markdown += `- **Version:** ${tech.version}\n`;
        }
        if (tech.alternatives_considered && tech.alternatives_considered.length > 0) {
          markdown += `- **Alternatives Considered:** ${tech.alternatives_considered.join(', ')}\n`;
        }
        markdown += '\n';
      });
    }
    
    if (plan.phases.length > 0) {
      markdown += `## Project Phases\n\n`;
      plan.phases.forEach((phase, index) => {
        markdown += `### Phase ${index + 1}: ${phase.name}\n`;
        markdown += `${phase.description}\n\n`;
        markdown += `**Estimated Duration:** ${phase.estimated_duration}\n\n`;
        
        if (phase.tasks.length > 0) {
          markdown += `#### Tasks:\n`;
          phase.tasks.forEach(task => {
            markdown += `- **${task.name}** (${task.priority} priority)\n`;
            markdown += `  - ${task.description}\n`;
            markdown += `  - Estimated effort: ${task.estimated_effort}\n`;
            if (task.acceptance_criteria.length > 0) {
              markdown += `  - Acceptance criteria:\n`;
              task.acceptance_criteria.forEach(criteria => {
                markdown += `    - ${criteria}\n`;
              });
            }
          });
          markdown += '\n';
        }
      });
    }
    
    if (plan.risks.length > 0) {
      markdown += `## Risk Assessment\n\n`;
      plan.risks.forEach(risk => {
        markdown += `### ${risk.description}\n`;
        markdown += `- **Category:** ${risk.category}\n`;
        markdown += `- **Probability:** ${risk.probability}\n`;
        markdown += `- **Impact:** ${risk.impact}\n`;
        markdown += `- **Mitigation:** ${risk.mitigation}\n`;
        markdown += `- **Contingency:** ${risk.contingency}\n\n`;
      });
    }
    
    if (plan.success_criteria.length > 0) {
      markdown += `## Success Criteria\n`;
      plan.success_criteria.forEach(criteria => {
        markdown += `- ${criteria}\n`;
      });
      markdown += '\n';
    }
    
    return markdown;
  }

  private async storePlan(plan: ProjectPlan, markdown: string): Promise<void> {
    // For now, just log the plan. In a real implementation, 
    // this would save to file system or database
    this.logger.info('Generated plan:', {
      id: plan.id,
      title: plan.title,
      phases: plan.phases.length,
      markdownLength: markdown.length,
    });
    
    // Could save to a file:
    // await fs.writeFile(`${WORK_DIR}/PROJECT_PLAN.md`, markdown);
  }
}