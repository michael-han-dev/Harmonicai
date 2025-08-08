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
              // Interactive undo completes: show check for 3s then hide
              setUiStageByTask(prev => ({ ...prev, [task.taskId]: 'done-show' }));
              setTimeout(() => {
                setUiStageByTask(prev2 => ({ ...prev2, [task.taskId]: 'hidden' }));
                // Clean up local ephemeral record once hidden
                setEphemeralTasks(prev => prev.filter(t => t.taskId !== task.taskId));
              }, 3000);
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
      // 1) Cancel the bulk job
      await cancelOperation(task.taskId);
      // 2) Immediately start an interactive undo to revert inserted rows so far
      if (task.type === 'bulk_add' && task.targetCollectionId) {
        try {
          const { undo_task_id } = await undoOperation(task.taskId, { target_collection_id: task.targetCollectionId });
          const undoTask: BackgroundTask = {
            taskId: undo_task_id,
            type: 'undo',
            sourceCollectionName: task.targetCollectionName,
            targetCollectionName: task.sourceCollectionName,
            targetCollectionId: task.targetCollectionId,
            description: `Undo: ${task.description}`,
            startTime: new Date(),
          };
          setEphemeralTasks(prev => [...prev, undoTask]);
          setUiStageByTask(prev => ({ ...prev, [undoTask.taskId]: 'loading', [task.taskId]: 'cancelled-show' }));
          setCompletedTasks(prev => new Set([...prev, task.taskId]));
          setTimeout(() => {
            setUiStageByTask(prev => ({ ...prev, [task.taskId]: 'hidden' }));
          }, 2000);
        } catch (err) {
          console.error('Error starting undo after cancel:', err);
        }
      }
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

function renderToast(
  task: BackgroundTask,
  stage: UiStage,
  percent: number,
  onCancel?: (task: BackgroundTask) => void,
  onUndo?: (task: BackgroundTask) => void
) {
  return (
    <div className="relative inline-flex items-center gap-2 bg-background/90 backdrop-blur px-3 py-2 rounded-md shadow border border-border">

      <div className="flex items-center gap-2 min-w-0">
        {stage === 'done-show' && (
          <CheckCircle2 className="h-6 w-6 text-green-400" />
        )}
        {stage === 'undo-started' && (
          <Undo2 className="h-6 w-6 text-foreground animate-spin" />
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{task.description}</div>
          {(stage === 'loading' && task.type === 'bulk_add') && (
            <div className="text-xs text-muted-foreground">{percent}%</div>
          )}
          {(stage === 'loading' && task.type === 'undo') && (
            <div className="text-xs text-muted-foreground">Undoing...</div>
          )}
          {stage === 'done-show' && task.type === 'undo' && (
            <div className="text-xs text-muted-foreground">Undo complete</div>
          )}
          {stage === 'cancelled-show' && (
            <div className="text-xs text-muted-foreground">Cancelled</div>
          )}
        </div>
      </div>
      {stage === 'loading' && task.type === 'bulk_add' && onCancel && (
        <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => onCancel(task)}>
          Cancel
        </Button>
      )}
      {stage === 'undo-offer' && task.type === 'bulk_add' && task.targetCollectionId && onUndo && (
        <Button variant="outline" size="sm" className="ml-2 text-xs" onClick={() => onUndo(task)}>
          <Undo2 className="h-3 w-3 mr-1" />
          Undo
        </Button>
      )}
    </div>
  );
}

export default BackgroundTasksManager;