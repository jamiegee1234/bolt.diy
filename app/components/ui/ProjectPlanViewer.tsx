import { useState } from 'react';
import { classNames } from '~/utils/classNames';
import { Collapsible } from './Collapsible';
import type { ProjectPlan, ProjectPhase, Task, Technology, Risk } from '~/lib/planning/project-planner';

interface ProjectPlanViewerProps {
  plan: ProjectPlan;
  compact?: boolean;
  showProgress?: boolean;
}

export function ProjectPlanViewer({ plan, compact = false, showProgress = false }: ProjectPlanViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['overview']));

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const isExpanded = (sectionId: string) => expandedSections.has(sectionId);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (compact) {
    return (
      <div className="border border-bolt-elements-borderColor rounded-lg p-4 bg-bolt-elements-background-depth-1">
        <div className="flex items-start gap-3">
          <div className="i-ph:file-text text-blue-500 text-lg mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-bolt-elements-textPrimary">{plan.title}</h3>
            <p className="text-sm text-bolt-elements-textSecondary mt-1 line-clamp-2">
              {plan.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-bolt-elements-textTertiary mt-2">
              <span>{plan.phases.length} phases</span>
              <span>{plan.phases.reduce((total, phase) => total + phase.tasks.length, 0)} tasks</span>
              <span>{plan.technologies.length} technologies</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="border-b border-bolt-elements-borderColor pb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="i-ph:file-text text-blue-500 text-2xl mt-1 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-bolt-elements-textPrimary">{plan.title}</h1>
            <p className="text-bolt-elements-textSecondary mt-2">{plan.description}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6 text-sm text-bolt-elements-textTertiary">
          <div className="flex items-center gap-1">
            <div className="i-ph:calendar" />
            <span>Created: {formatDate(plan.created_at)}</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="i-ph:clock" />
            <span>Updated: {formatDate(plan.updated_at)}</span>
          </div>
        </div>
      </div>

      {/* Overview */}
      <Collapsible
        title="Project Overview"
        isOpen={isExpanded('overview')}
        onToggle={() => toggleSection('overview')}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Scope */}
          {plan.scope.length > 0 && (
            <div>
              <h4 className="font-medium text-bolt-elements-textPrimary mb-2">Scope</h4>
              <ul className="space-y-1">
                {plan.scope.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-bolt-elements-textSecondary">
                    <div className="i-ph:check text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Objectives */}
          {plan.objectives.length > 0 && (
            <div>
              <h4 className="font-medium text-bolt-elements-textPrimary mb-2">Objectives</h4>
              <ul className="space-y-1">
                {plan.objectives.map((objective, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm text-bolt-elements-textSecondary">
                    <div className="i-ph:target text-blue-500 mt-0.5 flex-shrink-0" />
                    <span>{objective}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Collapsible>

      {/* Technology Stack */}
      {plan.technologies.length > 0 && (
        <Collapsible
          title={`Technology Stack (${plan.technologies.length})`}
          isOpen={isExpanded('technologies')}
          onToggle={() => toggleSection('technologies')}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {plan.technologies.map((tech, index) => (
              <TechnologyCard key={index} technology={tech} />
            ))}
          </div>
        </Collapsible>
      )}

      {/* Project Phases */}
      <Collapsible
        title={`Project Phases (${plan.phases.length})`}
        isOpen={isExpanded('phases')}
        onToggle={() => toggleSection('phases')}
      >
        <div className="space-y-6">
          {plan.phases.map((phase, index) => (
            <PhaseCard 
              key={phase.id} 
              phase={phase} 
              phaseNumber={index + 1}
              showProgress={showProgress}
            />
          ))}
        </div>
      </Collapsible>

      {/* Risk Assessment */}
      {plan.risks.length > 0 && (
        <Collapsible
          title={`Risk Assessment (${plan.risks.length})`}
          isOpen={isExpanded('risks')}
          onToggle={() => toggleSection('risks')}
        >
          <div className="space-y-4">
            {plan.risks.map((risk, index) => (
              <RiskCard key={risk.id} risk={risk} />
            ))}
          </div>
        </Collapsible>
      )}

      {/* Success Criteria */}
      {plan.success_criteria.length > 0 && (
        <Collapsible
          title="Success Criteria"
          isOpen={isExpanded('success')}
          onToggle={() => toggleSection('success')}
        >
          <ul className="space-y-2">
            {plan.success_criteria.map((criteria, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <div className="i-ph:medal text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-bolt-elements-textSecondary">{criteria}</span>
              </li>
            ))}
          </ul>
        </Collapsible>
      )}
    </div>
  );
}

function TechnologyCard({ technology }: { technology: Technology }) {
  return (
    <div className="border border-bolt-elements-borderColor rounded-lg p-4 bg-bolt-elements-background-depth-1">
      <div className="flex items-start gap-3">
        <div className="i-ph:code text-purple-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-bolt-elements-textPrimary">{technology.name}</h4>
            <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200">
              {technology.type}
            </span>
            {technology.version && (
              <span className="text-xs text-bolt-elements-textTertiary">v{technology.version}</span>
            )}
          </div>
          <p className="text-sm text-bolt-elements-textSecondary mb-2">{technology.purpose}</p>
          <p className="text-xs text-bolt-elements-textTertiary">{technology.justification}</p>
          {technology.alternatives_considered && technology.alternatives_considered.length > 0 && (
            <div className="mt-2">
              <span className="text-xs text-bolt-elements-textTertiary">
                Alternatives: {technology.alternatives_considered.join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseCard({ phase, phaseNumber, showProgress }: { 
  phase: ProjectPhase; 
  phaseNumber: number;
  showProgress: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const completedTasks = showProgress ? 
    phase.tasks.filter(task => (task as any).status === 'completed').length : 0;
  const progressPercentage = showProgress && phase.tasks.length > 0 ? 
    (completedTasks / phase.tasks.length) * 100 : 0;

  return (
    <div className="border border-bolt-elements-borderColor rounded-lg bg-bolt-elements-background-depth-1">
      <div 
        className="p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-medium text-sm flex-shrink-0">
            {phaseNumber}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-medium text-bolt-elements-textPrimary">{phase.name}</h3>
              <div className={classNames(
                'i-ph:chevron-down text-bolt-elements-textTertiary transition-transform',
                isExpanded && 'rotate-180'
              )} />
            </div>
            <p className="text-sm text-bolt-elements-textSecondary mb-2">{phase.description}</p>
            
            <div className="flex items-center gap-4 text-xs text-bolt-elements-textTertiary">
              <span className="flex items-center gap-1">
                <div className="i-ph:clock" />
                {phase.estimated_duration}
              </span>
              <span className="flex items-center gap-1">
                <div className="i-ph:list-checks" />
                {phase.tasks.length} tasks
              </span>
              {showProgress && (
                <span className="flex items-center gap-1">
                  <div className="i-ph:chart-bar" />
                  {Math.round(progressPercentage)}% complete
                </span>
              )}
            </div>
            
            {showProgress && (
              <div className="mt-2">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="border-t border-bolt-elements-borderColor p-4">
          <div className="space-y-3">
            {phase.tasks.map((task, index) => (
              <TaskCard key={task.id} task={task} showProgress={showProgress} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, showProgress }: { task: Task; showProgress: boolean }) {
  const priorityColor = getPriorityColor(task.priority);
  const status = showProgress ? (task as any).status : undefined;
  
  return (
    <div className="border border-bolt-elements-borderColor rounded p-3 bg-bolt-elements-background-depth-2">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {status === 'completed' && <div className="i-ph:check-circle text-green-500" />}
          {status === 'in_progress' && <div className="i-ph:clock text-blue-500" />}
          {status === 'failed' && <div className="i-ph:x-circle text-red-500" />}
          {!status && <div className="i-ph:circle text-gray-400" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm text-bolt-elements-textPrimary">{task.name}</h4>
            <span className={classNames(
              'text-xs px-2 py-0.5 rounded border',
              priorityColor
            )}>
              {task.priority}
            </span>
          </div>
          
          <p className="text-sm text-bolt-elements-textSecondary mb-2">{task.description}</p>
          
          <div className="flex items-center gap-4 text-xs text-bolt-elements-textTertiary mb-2">
            <span className="flex items-center gap-1">
              <div className="i-ph:timer" />
              {task.estimated_effort}
            </span>
            <span className="flex items-center gap-1">
              <div className="i-ph:tag" />
              {task.type}
            </span>
          </div>
          
          {task.acceptance_criteria.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-bolt-elements-textPrimary mb-1">
                Acceptance Criteria:
              </h5>
              <ul className="space-y-0.5">
                {task.acceptance_criteria.map((criteria, index) => (
                  <li key={index} className="text-xs text-bolt-elements-textSecondary flex items-start gap-1">
                    <div className="i-ph:dot text-bolt-elements-textTertiary mt-1 flex-shrink-0" />
                    <span>{criteria}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RiskCard({ risk }: { risk: Risk }) {
  const riskColor = getRiskColor(risk.impact);
  
  return (
    <div className="border border-bolt-elements-borderColor rounded-lg p-4 bg-bolt-elements-background-depth-1">
      <div className="flex items-start gap-3">
        <div className="i-ph:warning text-orange-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-bolt-elements-textPrimary">{risk.description}</h4>
            <span className={classNames(
              'text-xs px-2 py-0.5 rounded',
              riskColor
            )}>
              {risk.impact} impact
            </span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-bolt-elements-textPrimary">Probability:</span>
              <span className="ml-2 text-bolt-elements-textSecondary">{risk.probability}</span>
            </div>
            <div>
              <span className="font-medium text-bolt-elements-textPrimary">Category:</span>
              <span className="ml-2 text-bolt-elements-textSecondary">{risk.category}</span>
            </div>
          </div>
          
          <div className="mt-3 space-y-2 text-sm">
            <div>
              <span className="font-medium text-bolt-elements-textPrimary">Mitigation:</span>
              <p className="text-bolt-elements-textSecondary">{risk.mitigation}</p>
            </div>
            <div>
              <span className="font-medium text-bolt-elements-textPrimary">Contingency:</span>
              <p className="text-bolt-elements-textSecondary">{risk.contingency}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'critical': return 'text-red-600 bg-red-50 border-red-200';
    case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'low': return 'text-green-600 bg-green-50 border-green-200';
    default: return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

function getRiskColor(level: string) {
  switch (level) {
    case 'high': return 'text-red-600 bg-red-50';
    case 'medium': return 'text-yellow-600 bg-yellow-50';
    case 'low': return 'text-green-600 bg-green-50';
    default: return 'text-gray-600 bg-gray-50';
  }
}