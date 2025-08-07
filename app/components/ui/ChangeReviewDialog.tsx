import { useState, useRef } from 'react';
import { classNames } from '~/utils/classNames';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { Checkbox } from './Checkbox';

export interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  oldContent?: string;
  newContent?: string;
  binary?: boolean;
  language?: string;
}

export interface ChangeReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  changes: FileChange[];
  title?: string;
  onApprove: (selectedChanges: FileChange[]) => void;
  onReject: () => void;
  showSelectAll?: boolean;
  loading?: boolean;
}

export function ChangeReviewDialog({
  isOpen,
  onClose,
  changes,
  title = 'Review Changes',
  onApprove,
  onReject,
  showSelectAll = true,
  loading = false,
}: ChangeReviewDialogProps) {
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(
    new Set(changes.map(change => change.path))
  );
  const [activeTab, setActiveTab] = useState<string>(changes[0]?.path || '');
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  const dialogRef = useRef<HTMLDivElement>(null);

  const toggleChange = (path: string) => {
    const newSelected = new Set(selectedChanges);
    if (newSelected.has(path)) {
      newSelected.delete(path);
    } else {
      newSelected.add(path);
    }
    setSelectedChanges(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedChanges.size === changes.length) {
      setSelectedChanges(new Set());
    } else {
      setSelectedChanges(new Set(changes.map(change => change.path)));
    }
  };

  const handleApprove = () => {
    const selectedChangeObjects = changes.filter(change => 
      selectedChanges.has(change.path)
    );
    onApprove(selectedChangeObjects);
  };

  const getChangeTypeIcon = (type: FileChange['type']) => {
    switch (type) {
      case 'create': return 'i-ph:plus-circle text-green-500';
      case 'modify': return 'i-ph:pencil-simple text-blue-500';
      case 'delete': return 'i-ph:minus-circle text-red-500';
      default: return 'i-ph:file text-gray-500';
    }
  };

  const getChangeTypeLabel = (type: FileChange['type']) => {
    switch (type) {
      case 'create': return 'Created';
      case 'modify': return 'Modified';
      case 'delete': return 'Deleted';
      default: return 'Changed';
    }
  };

  const activeChange = changes.find(change => change.path === activeTab);

  if (!isOpen) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="full"
      className="h-[90vh]"
    >
      <div className="flex h-full">
        {/* Sidebar with file list */}
        <div className="w-80 border-r border-bolt-elements-borderColor bg-bolt-elements-background-depth-1 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-bolt-elements-borderColor">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-bolt-elements-textPrimary">
                Changes ({changes.length})
              </h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode(viewMode === 'unified' ? 'split' : 'unified')}
                  className="text-xs"
                >
                  <div className={viewMode === 'unified' ? 'i-ph:rows' : 'i-ph:columns'} />
                  {viewMode === 'unified' ? 'Split' : 'Unified'}
                </Button>
              </div>
            </div>
            
            {showSelectAll && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedChanges.size === changes.length}
                  onChange={toggleSelectAll}
                  indeterminate={selectedChanges.size > 0 && selectedChanges.size < changes.length}
                />
                <span className="text-sm text-bolt-elements-textSecondary">
                  Select All ({selectedChanges.size}/{changes.length})
                </span>
              </div>
            )}
          </div>

          {/* File list */}
          <div className="flex-1 overflow-y-auto">
            {changes.map((change) => (
              <div
                key={change.path}
                className={classNames(
                  'flex items-center gap-3 p-3 cursor-pointer border-b border-bolt-elements-borderColor hover:bg-bolt-elements-background-depth-2 transition-colors',
                  activeTab === change.path && 'bg-bolt-elements-background-depth-2'
                )}
                onClick={() => setActiveTab(change.path)}
              >
                {showSelectAll && (
                  <Checkbox
                    checked={selectedChanges.has(change.path)}
                    onChange={() => toggleChange(change.path)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                
                <div className={classNames('flex-shrink-0', getChangeTypeIcon(change.type))} />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-bolt-elements-textPrimary truncate">
                      {change.path.split('/').pop()}
                    </span>
                    <span className={classNames(
                      'text-xs px-1.5 py-0.5 rounded',
                      change.type === 'create' && 'bg-green-100 text-green-700',
                      change.type === 'modify' && 'bg-blue-100 text-blue-700',
                      change.type === 'delete' && 'bg-red-100 text-red-700'
                    )}>
                      {getChangeTypeLabel(change.type)}
                    </span>
                  </div>
                  <div className="text-xs text-bolt-elements-textTertiary truncate">
                    {change.path}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
            <div className="flex gap-2">
              <Button
                onClick={handleApprove}
                disabled={selectedChanges.size === 0 || loading}
                className="flex-1"
                variant="primary"
              >
                {loading ? (
                  <>
                    <div className="i-ph:spinner animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <div className="i-ph:check" />
                    Apply ({selectedChanges.size})
                  </>
                )}
              </Button>
              <Button
                onClick={onReject}
                disabled={loading}
                variant="ghost"
              >
                <div className="i-ph:x" />
                Reject
              </Button>
            </div>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {activeChange ? (
            <FileChangeViewer
              change={activeChange}
              viewMode={viewMode}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-bolt-elements-textSecondary">
              <div className="text-center">
                <div className="i-ph:file-x text-4xl mb-2 text-bolt-elements-textTertiary" />
                <p>Select a file to view changes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}

interface FileChangeViewerProps {
  change: FileChange;
  viewMode: 'unified' | 'split';
}

function FileChangeViewer({ change, viewMode }: FileChangeViewerProps) {
  if (change.binary) {
    return (
      <div className="flex-1 flex items-center justify-center text-bolt-elements-textSecondary">
        <div className="text-center">
          <div className="i-ph:file-code text-4xl mb-2 text-bolt-elements-textTertiary" />
          <p className="font-medium">Binary file</p>
          <p className="text-sm">Cannot display preview</p>
        </div>
      </div>
    );
  }

  if (change.type === 'delete') {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
          <div className="flex items-center gap-2 text-red-600">
            <div className="i-ph:trash" />
            <span className="font-medium">File will be deleted</span>
          </div>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">{change.path}</p>
        </div>
        
        {change.oldContent && (
          <div className="flex-1 overflow-auto bg-bolt-elements-background-depth-2">
            <pre className="p-4 text-sm font-mono">
              <code>{change.oldContent}</code>
            </pre>
          </div>
        )}
      </div>
    );
  }

  if (change.type === 'create') {
    return (
      <div className="flex-1 flex flex-col">
        <div className="p-4 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
          <div className="flex items-center gap-2 text-green-600">
            <div className="i-ph:plus-circle" />
            <span className="font-medium">New file</span>
          </div>
          <p className="text-sm text-bolt-elements-textSecondary mt-1">{change.path}</p>
        </div>
        
        <div className="flex-1 overflow-auto bg-bolt-elements-background-depth-2">
          <pre className="p-4 text-sm font-mono">
            <code className="text-green-700 dark:text-green-300">
              {change.newContent}
            </code>
          </pre>
        </div>
      </div>
    );
  }

  // Modified file - show diff
  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
        <div className="flex items-center gap-2 text-blue-600">
          <div className="i-ph:pencil-simple" />
          <span className="font-medium">Modified file</span>
        </div>
        <p className="text-sm text-bolt-elements-textSecondary mt-1">{change.path}</p>
      </div>
      
      <div className="flex-1 overflow-auto">
        {viewMode === 'split' ? (
          <SplitDiffView
            oldContent={change.oldContent || ''}
            newContent={change.newContent || ''}
          />
        ) : (
          <UnifiedDiffView
            oldContent={change.oldContent || ''}
            newContent={change.newContent || ''}
          />
        )}
      </div>
    </div>
  );
}

interface DiffViewProps {
  oldContent: string;
  newContent: string;
}

function SplitDiffView({ oldContent, newContent }: DiffViewProps) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const maxLines = Math.max(oldLines.length, newLines.length);

  return (
    <div className="flex h-full">
      {/* Before */}
      <div className="flex-1 border-r border-bolt-elements-borderColor">
        <div className="p-2 bg-red-50 dark:bg-red-900/20 border-b border-bolt-elements-borderColor text-sm font-medium text-red-700 dark:text-red-300">
          Before
        </div>
        <div className="overflow-auto h-full">
          <pre className="text-sm font-mono">
            {Array.from({ length: maxLines }, (_, i) => (
              <div key={i} className="flex">
                <div className="w-12 text-right pr-2 text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1 border-r border-bolt-elements-borderColor">
                  {i < oldLines.length ? i + 1 : ''}
                </div>
                <div className="flex-1 px-2 py-0.5">
                  <code>{oldLines[i] || ''}</code>
                </div>
              </div>
            ))}
          </pre>
        </div>
      </div>

      {/* After */}
      <div className="flex-1">
        <div className="p-2 bg-green-50 dark:bg-green-900/20 border-b border-bolt-elements-borderColor text-sm font-medium text-green-700 dark:text-green-300">
          After
        </div>
        <div className="overflow-auto h-full">
          <pre className="text-sm font-mono">
            {Array.from({ length: maxLines }, (_, i) => (
              <div key={i} className="flex">
                <div className="w-12 text-right pr-2 text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1 border-r border-bolt-elements-borderColor">
                  {i < newLines.length ? i + 1 : ''}
                </div>
                <div className="flex-1 px-2 py-0.5">
                  <code>{newLines[i] || ''}</code>
                </div>
              </div>
            ))}
          </pre>
        </div>
      </div>
    </div>
  );
}

function UnifiedDiffView({ oldContent, newContent }: DiffViewProps) {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  
  // Simple diff algorithm - in a real implementation, you'd use a proper diff library
  const diffLines = generateUnifiedDiff(oldLines, newLines);

  return (
    <div className="overflow-auto h-full bg-bolt-elements-background-depth-2">
      <pre className="text-sm font-mono">
        {diffLines.map((line, i) => (
          <div key={i} className={classNames(
            'flex',
            line.type === 'add' && 'bg-green-50 dark:bg-green-900/20',
            line.type === 'remove' && 'bg-red-50 dark:bg-red-900/20',
            line.type === 'context' && 'bg-bolt-elements-background-depth-2'
          )}>
            <div className="w-12 text-right pr-2 text-bolt-elements-textTertiary bg-bolt-elements-background-depth-1 border-r border-bolt-elements-borderColor">
              {line.lineNumber}
            </div>
            <div className="w-4 text-center border-r border-bolt-elements-borderColor bg-bolt-elements-background-depth-1">
              {line.type === 'add' && <span className="text-green-600">+</span>}
              {line.type === 'remove' && <span className="text-red-600">-</span>}
            </div>
            <div className="flex-1 px-2 py-0.5">
              <code className={classNames(
                line.type === 'add' && 'text-green-700 dark:text-green-300',
                line.type === 'remove' && 'text-red-700 dark:text-red-300'
              )}>
                {line.content}
              </code>
            </div>
          </div>
        ))}
      </pre>
    </div>
  );
}

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
  lineNumber?: number;
}

function generateUnifiedDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  // Very basic diff implementation - a real implementation would use Myers' algorithm
  const result: DiffLine[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex >= oldLines.length) {
      // Only new lines left
      result.push({
        type: 'add',
        content: newLines[newIndex],
        lineNumber: newIndex + 1,
      });
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Only old lines left
      result.push({
        type: 'remove',
        content: oldLines[oldIndex],
        lineNumber: oldIndex + 1,
      });
      oldIndex++;
    } else if (oldLines[oldIndex] === newLines[newIndex]) {
      // Lines are the same
      result.push({
        type: 'context',
        content: oldLines[oldIndex],
        lineNumber: newIndex + 1,
      });
      oldIndex++;
      newIndex++;
    } else {
      // Lines are different - for simplicity, just show as remove + add
      result.push({
        type: 'remove',
        content: oldLines[oldIndex],
        lineNumber: oldIndex + 1,
      });
      result.push({
        type: 'add',
        content: newLines[newIndex],
        lineNumber: newIndex + 1,
      });
      oldIndex++;
      newIndex++;
    }
  }

  return result;
}