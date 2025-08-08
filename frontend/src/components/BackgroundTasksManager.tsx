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

type UiStage = 'loading' | 'done-show' | 'undo-offer' | 'undo-started' | 'hidden';

const BackgroundTasksManager = ({ tasks, onTaskComplete, onTaskRemove }: BackgroundTasksManagerProps) => {
  const [taskStatuses, setTaskStatuses] = useState<Record<string, IOperationStatus>>({});
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  const [uiStageByTask, setUiStageByTask] = useState<Record<string, UiStage>>({});

  // Poll task statuses
  useEffect(() => {
    if (tasks.length === 0) return;

    const activeTasks = tasks.filter(task =>
      !completedTasks.has(task.taskId) &&
      !['completed', 'failed', 'cancelled'].includes(taskStatuses[task.taskId]?.status)
    );

    if (activeTasks.length === 0) return;

    const pollStatuses = async () => {
      for (const task of activeTasks) {
        try {
          const status = await getOperationStatus(task.taskId);
          setTaskStatuses(prev => ({ ...prev, [task.taskId]: status }));
          
          if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
            setCompletedTasks(prev => new Set([...prev, task.taskId]));
            onTaskComplete(task.taskId);
            // Advance UI stage for a completed task: show done 2s -> show undo 3s -> hide
            setUiStageByTask(prev => ({ ...prev, [task.taskId]: 'done-show' }));
            setTimeout(() => {
              setUiStageByTask(prev => ({ ...prev, [task.taskId]: 'undo-offer' }));
              setTimeout(() => {
                setUiStageByTask(prev2 => ({ ...prev2, [task.taskId]: 'hidden' }));
              }, 3000);
            }, 2000);
          } else {
            // Ensure loading stage when polling resumes after a refresh
            setUiStageByTask(prev => (prev[task.taskId] ? prev : { ...prev, [task.taskId]: 'loading' }));
          }
        } catch (error) {
          console.error(`Error polling task ${task.taskId}:`, error);
        }
      }
    };

    // Poll immediately, then every 3 seconds
    pollStatuses();
    const interval = setInterval(pollStatuses, 3000);

    return () => clearInterval(interval);
  }, [tasks, taskStatuses, completedTasks, onTaskComplete]);

  const handleUndo = async (taskId: string, targetCollectionId: string) => {
    try {
      setUiStageByTask(prev => ({ ...prev, [taskId]: 'undo-started' }));
      await undoOperation(taskId, { target_collection_id: targetCollectionId });
      setTimeout(() => {
        setUiStageByTask(prev => ({ ...prev, [taskId]: 'hidden' }));
      }, 1500);
    } catch (error) {
      console.error('Error starting undo:', error);
    }
  };

  const handleCancel = async (taskId: string) => {
    try {
      await cancelOperation(taskId);
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

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 space-y-2 w-[420px] max-w-[90vw]">
      {tasks.map((task) => {
        const status = taskStatuses[task.taskId];
        const stage: UiStage = uiStageByTask[task.taskId] ?? 'loading';
        const percent = status && status.total > 0
          ? Math.min(100, Math.round(((status.percent ?? (status.current / status.total * 100)) as number)))
          : 0;

        if (stage === 'hidden') return null;

        return (
          <div key={task.taskId} className="relative flex items-center justify-between gap-3 bg-background/90 backdrop-blur px-4 py-3 rounded-md shadow border border-border">
            {/* Overlay animation for loading and interactive undo */}
            {(stage === 'loading' || stage === 'undo-started') && (
              <video
                src="/Logo_Loading_Animation_Generation.mp4"
                className="pointer-events-none absolute -top-3 -left-3 h-10 w-10 rounded opacity-90"
                autoPlay
                loop
                muted
                playsInline
              />
            )}
            <div className="flex items-center gap-3 min-w-0">
              {stage === 'done-show' && (
                <CheckCircle2 className="h-6 w-6 text-green-400" />
              )}
              {stage === 'undo-started' && (
                <Undo2 className="h-6 w-6 text-foreground animate-spin" />
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{task.description}</div>
                {(stage === 'loading' || stage === 'done-show') && (
                  <div className="text-xs text-muted-foreground">{percent}%</div>
                )}
                {stage === 'undo-started' && (
                  <div className="text-xs text-muted-foreground">Undoing...</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
            {stage === 'loading' && task.type === 'bulk_add' && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => handleCancel(task.taskId)}>
                Cancel
              </Button>
            )}
            {stage === 'undo-offer' && task.type === 'bulk_add' && task.targetCollectionId && (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => handleUndo(task.taskId, task.targetCollectionId!)}>
                <Undo2 className="h-3 w-3 mr-1" />
                Undo
              </Button>
            )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default BackgroundTasksManager;