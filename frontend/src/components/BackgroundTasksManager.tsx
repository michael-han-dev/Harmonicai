import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Undo2, CheckCircle2 } from "lucide-react";
import { getOperationStatus, undoOperation, cancelOperation, IOperationStatus } from "../utils/jam-api";

export interface BackgroundTask {
  taskId: string;
  type: 'bulk_add' | 'undo';
  sourceCollectionName?: string;
  targetCollectionName?: string;
  targetCollectionId?: string;
  description: string;
  startTime: Date;
}

interface BackgroundTasksManagerProps {
  tasks: BackgroundTask[];
  onTaskComplete: (taskId: string) => void;
  onTaskRemove: (taskId: string) => void;
}

type UiStage = 'loading' | 'done-show' | 'undo-offer' | 'undo-started' | 'cancelled-show' | 'hidden';

const BackgroundTasksManager = ({ tasks, onTaskComplete, onTaskRemove }: BackgroundTasksManagerProps) => {
  const [taskStatuses, setTaskStatuses] = useState<Record<string, IOperationStatus>>({});
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [uiStageByTask, setUiStageByTask] = useState<Record<string, UiStage>>({});
  // Local ephemeral tasks (e.g., interactive undo tasks started from within this component)
  const [ephemeralTasks, setEphemeralTasks] = useState<BackgroundTask[]>([]);

  // Poll task statuses
  useEffect(() => {
    const allTasks = [...tasks, ...ephemeralTasks];
    if (allTasks.length === 0) return;

    const activeTasks = allTasks.filter(task =>
      !completedTasks.has(task.taskId) &&
      !['completed', 'failed', 'cancelled'].includes(taskStatuses[task.taskId]?.status)
    );

    if (activeTasks.length === 0) return;

    const pollStatuses = async () => {
      for (const task of activeTasks) {
        try {
          const prevStatus = taskStatuses[task.taskId];
          const status = await getOperationStatus(task.taskId);
          setTaskStatuses(prev => ({ ...prev, [task.taskId]: status }));
          // Emit live count increments every 50 moved items when bulk adding
          if (task.type === 'bulk_add' && task.targetCollectionId && status?.current !== undefined) {
            const prevCurrent = prevStatus?.current ?? 0;
            const prevBucket = Math.floor(prevCurrent / 50);
            const currentBucket = Math.floor(status.current / 50);
            if (currentBucket > prevBucket) {
              const amount = (currentBucket - prevBucket) * 50;
              window.dispatchEvent(new CustomEvent('collection:count-increment', {
                detail: { collectionId: task.targetCollectionId, amount }
              }));
            }
          }
          
          if (status.status === 'cancelled') {
            setCompletedTasks(prev => new Set([...prev, task.taskId]));
            setUiStageByTask(prev => ({ ...prev, [task.taskId]: 'cancelled-show' }));
            setTimeout(() => {
              setUiStageByTask(prev2 => ({ ...prev2, [task.taskId]: 'hidden' }));
            }, 2000);
          } else if (status.status === 'completed' || status.status === 'failed') {
            setCompletedTasks(prev => new Set([...prev, task.taskId]));
            // For bulk tasks, show done -> offer undo; for undo tasks, show done and auto-hide after 3s
            if (task.type === 'bulk_add') {
              onTaskComplete(task.taskId);
              setUiStageByTask(prev => ({ ...prev, [task.taskId]: 'done-show' }));
              setTimeout(() => {
                setUiStageByTask(prev => ({ ...prev, [task.taskId]: 'undo-offer' }));
                setTimeout(() => {
                  setUiStageByTask(prev2 => ({ ...prev2, [task.taskId]: 'hidden' }));
                }, 3000);
              }, 2000);
            } else {
              // Interactive undo completes: show check for 2s then hide immediately
              setUiStageByTask(prev => ({ ...prev, [task.taskId]: 'done-show' }));
              setTimeout(() => {
                setUiStageByTask(prev2 => ({ ...prev2, [task.taskId]: 'hidden' }));
              }, 2000);
              // Clean up ephemeral record immediately after marking as hidden
              setTimeout(() => {
                setEphemeralTasks(prev => prev.filter(t => t.taskId !== task.taskId));
              }, 2100);
            }
          } else {
            // Ensure loading stage when polling resumes after a refresh
            setUiStageByTask(prev => (prev[task.taskId] ? prev : { ...prev, [task.taskId]: 'loading' }));
          }
        } catch (error) {
          console.error(`Error polling task ${task.taskId}:`, error);
          // Do not hide other tasks; transient errors should not remove any toast
        }
      }
    };

    // Poll immediately, then every 3 seconds
    pollStatuses();
    const interval = setInterval(pollStatuses, 3000);

    return () => clearInterval(interval);
  }, [tasks, ephemeralTasks, taskStatuses, completedTasks, onTaskComplete]);

  const handleUndo = async (origTask: BackgroundTask) => {
    try {
      // Start a separate interactive undo task so it doesn't replace/hide the bulk toast
      const { undo_task_id } = await undoOperation(origTask.taskId, { target_collection_id: origTask.targetCollectionId! });
      const undoTask: BackgroundTask = {
        taskId: undo_task_id,
        type: 'undo',
        sourceCollectionName: origTask.targetCollectionName,
        targetCollectionName: origTask.sourceCollectionName,
        targetCollectionId: origTask.targetCollectionId,
        description: `Undo: ${origTask.description}`,
        startTime: new Date(),
      };
      setEphemeralTasks(prev => [...prev, undoTask]);
      // Ensure it appears immediately in loading state
      setUiStageByTask(prev => ({ ...prev, [undoTask.taskId]: 'loading' }));
    } catch (error) {
      console.error('Error starting undo:', error);
    }
  };

  const handleCancel = async (task: BackgroundTask) => {
    try {
      // Request graceful cancellation only. Do not auto-trigger undo.
      await cancelOperation(task.taskId);
      // Optimistically reflect cancellation while polling catches up
      setUiStageByTask(prev => ({ ...prev, [task.taskId]: 'cancelled-show' }));
      // Do not mark as completed here; let polling update the final state
      setTimeout(() => {
        setUiStageByTask(prev => ({ ...prev, [task.taskId]: 'hidden' }));
      }, 2000);
    } catch (error) {
      console.error('Error cancelling task:', error);
    }
  };

  // Auto-remove hidden tasks
  useEffect(() => {
    Object.entries(uiStageByTask).forEach(([taskId, stage]) => {
      if (stage === 'hidden') onTaskRemove(taskId);
    });
  }, [uiStageByTask, onTaskRemove]);

  const combinedTasks = [...tasks, ...ephemeralTasks];
  if (combinedTasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2 max-w-[90vw]">
      {(() => {
        const visible = combinedTasks.filter(t => (uiStageByTask[t.taskId] ?? 'loading') !== 'hidden');
        const bulkActive = visible.filter(t => t.type === 'bulk_add');
        const undoActive = visible.filter(t => t.type === 'undo');
        const shouldStack = bulkActive.length > 0 && undoActive.length > 0;

        if (shouldStack) {
          const bulkTop = bulkActive[bulkActive.length - 1];
          const undoTop = undoActive[undoActive.length - 1];
          return (
            <div className="relative w-[460px] max-w-[90vw] h-[72px]">
              {([bulkTop, undoTop] as BackgroundTask[]).map((task, idx) => {
                const z = idx === 0 ? 'z-0' : 'z-10';
                const translate = idx === 0 ? 'translate-x-3 translate-y-2' : '';
                const status = taskStatuses[task.taskId];
                const stage: UiStage = uiStageByTask[task.taskId] ?? 'loading';
                const percent = status && status.total > 0
                  ? Math.min(100, Math.round(((status.percent ?? (status.current / status.total * 100)) as number)))
                  : 0;
                return (
                  <div key={task.taskId} className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${translate} ${z}`}>
                    {renderToast(task, stage, percent, handleCancel, handleUndo)}
                  </div>
                );
              })}
            </div>
          );
        }

        // Default vertical list
        return combinedTasks.map((task) => {
        const status = taskStatuses[task.taskId];
        const stage: UiStage = uiStageByTask[task.taskId] ?? 'loading';
        const percent = status && status.total > 0
          ? Math.min(100, Math.round(((status.percent ?? (status.current / status.total * 100)) as number)))
          : 0;

          if (stage === 'hidden') return null;

          return (
            <div key={task.taskId}>{renderToast(task, stage, percent, handleCancel, handleUndo)}</div>
          );
        });
      })()}
    </div>
  );
};

// Harmonic Logo Animation Component
const HarmonicLoader = ({ className = "" }: { className?: string }) => (
  <div className={`relative ${className}`}>
    {/* Outer rotating ring */}
    <div className="absolute inset-0 rounded-full border-2 border-primary/15 group-hover:border-primary/30 animate-spin transition-colors duration-300" 
         style={{ animation: 'spin 3s linear infinite' }} />
    
    {/* Inner pulsing ring */}
    <div className="absolute inset-1 rounded-full border border-primary/30 group-hover:border-primary/60 animate-pulse transition-colors duration-300" />
    
    {/* Core harmonic symbol */}
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="w-2 h-2 rounded-full bg-primary/50 group-hover:bg-primary animate-pulse transition-colors duration-300" 
           style={{ animation: 'pulse 2s ease-in-out infinite alternate' }} />
    </div>
    
    {/* Orbital dots */}
    <div className="absolute inset-0">
      <div className="absolute top-0 left-1/2 w-1 h-1 -ml-0.5 rounded-full bg-primary/35 group-hover:bg-primary/70 animate-pulse transition-colors duration-300"
           style={{ animation: 'orbit-dot 4s ease-in-out infinite', transformOrigin: '50% 12px' }} />
      <div className="absolute top-1/2 right-0 w-1 h-1 -mt-0.5 rounded-full bg-primary/35 group-hover:bg-primary/70 animate-pulse transition-colors duration-300"
           style={{ animation: 'orbit-dot 4s ease-in-out infinite 1s', transformOrigin: '-12px 50%' }} />
      <div className="absolute bottom-0 left-1/2 w-1 h-1 -ml-0.5 rounded-full bg-primary/35 group-hover:bg-primary/70 animate-pulse transition-colors duration-300"
           style={{ animation: 'orbit-dot 4s ease-in-out infinite 2s', transformOrigin: '50% -12px' }} />
    </div>
  </div>
);

function renderToast(
  task: BackgroundTask,
  stage: UiStage,
  percent: number,
  onCancel?: (task: BackgroundTask) => void,
  onUndo?: (task: BackgroundTask) => void
) {
  return (
    <div className="group relative inline-flex items-center gap-3 bg-background/10 backdrop-blur px-4 py-3 rounded-lg shadow-sm border border-border/20 opacity-30 hover:opacity-100 hover:bg-background/90 hover:shadow-lg hover:border-border transition-all duration-300 ease-in-out">
      {/* Harmonic logo animation for bulk operations */}
      {(stage === 'loading' && task.type === 'bulk_add') && (
        <HarmonicLoader className="w-6 h-6 flex-shrink-0" />
      )}
      
      {/* Other status icons */}
      {stage === 'done-show' && (
        <CheckCircle2 className="h-6 w-6 text-green-400/50 group-hover:text-green-400 transition-colors duration-300 flex-shrink-0" />
      )}
      {(stage === 'loading' && task.type === 'undo') && (
        <Undo2 className="h-6 w-6 text-foreground/50 group-hover:text-foreground animate-spin transition-colors duration-300 flex-shrink-0" />
      )}

      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate text-foreground/60 group-hover:text-foreground transition-colors duration-300">{task.description}</div>
          {(stage === 'loading' && task.type === 'bulk_add') && (
            <div className="flex items-center gap-2 mt-1">
              <div className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors duration-300">{percent}%</div>
              {/* Progress bar */}
              <div className="flex-1 h-1 bg-muted/30 group-hover:bg-muted rounded-full overflow-hidden transition-colors duration-300">
                <div 
                  className="h-full bg-primary/50 group-hover:bg-primary transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
          {(stage === 'loading' && task.type === 'undo') && (
            <div className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors duration-300">Undoing...</div>
          )}
          {stage === 'done-show' && task.type === 'undo' && (
            <div className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors duration-300">Undo complete</div>
          )}
          {stage === 'cancelled-show' && (
            <div className="text-xs text-muted-foreground/60 group-hover:text-muted-foreground transition-colors duration-300">Cancelled</div>
          )}
        </div>
      </div>
      
      {/* Action buttons */}
      {stage === 'loading' && task.type === 'bulk_add' && onCancel && (
        <Button variant="outline" size="sm" className="ml-2 text-xs flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-300" onClick={() => onCancel(task)}>
          Cancel
        </Button>
      )}
      {stage === 'undo-offer' && task.type === 'bulk_add' && task.targetCollectionId && onUndo && (
        <Button variant="outline" size="sm" className="ml-2 text-xs flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity duration-300" onClick={() => onUndo(task)}>
          <Undo2 className="h-3 w-3 mr-1" />
          Undo
        </Button>
      )}
    </div>
  );
}

export default BackgroundTasksManager;