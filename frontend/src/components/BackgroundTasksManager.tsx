import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { X, Undo2 } from "lucide-react";
import { 
  getOperationStatus, 
  cancelOperation, 
  undoOperation, 
  IOperationStatus 
} from "../utils/jam-api";

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

const BackgroundTasksManager = ({ tasks, onTaskComplete, onTaskRemove }: BackgroundTasksManagerProps) => {
  const [taskStatuses, setTaskStatuses] = useState<Record<string, IOperationStatus>>({});
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

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

  const handleCancel = async (taskId: string) => {
    try {
      await cancelOperation(taskId);
      // Status will be updated by polling
    } catch (error) {
      console.error('Error cancelling task:', error);
    }
  };

  const handleUndo = async (taskId: string, targetCollectionId: string) => {
    try {
      const response = await undoOperation(taskId, { target_collection_id: targetCollectionId });
      // Add the undo task to be tracked
      const undoTask: BackgroundTask = {
        taskId: response.undo_task_id,
        type: 'undo',
        targetCollectionId,
        description: `Undoing previous operation`,
        startTime: new Date(),
      };
      // This would need to be handled by parent component
      console.log('Undo started:', undoTask);
    } catch (error) {
      console.error('Error starting undo:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'cancelled': return 'text-yellow-400';
      case 'in_progress': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const formatDuration = (startTime: Date, endTime?: Date) => {
    const end = endTime || new Date();
    const duration = Math.floor((end.getTime() - startTime.getTime()) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };

  const formatETA = (etaSeconds?: number) => {
    if (!etaSeconds || etaSeconds <= 0) return '';
    const minutes = Math.floor(etaSeconds / 60);
    const seconds = Math.floor(etaSeconds % 60);
    return minutes > 0 ? `~${minutes}m ${seconds}s remaining` : `~${seconds}s remaining`;
  };

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-md z-50">
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Background Tasks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.map((task) => {
            const status = taskStatuses[task.taskId];
            const isComplete = status?.status === 'completed';
            const isFailed = status?.status === 'failed';
            const isCancelled = status?.status === 'cancelled';
            const canCancel = status && !['completed', 'failed', 'cancelled'].includes(status.status);
            const canUndo = isComplete && task.type === 'bulk_add' && task.targetCollectionId;

            return (
              <div key={task.taskId} className="space-y-2 p-3 bg-accent/50 rounded-md">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {task.description}
                    </div>
                    {status && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={getStatusColor(status.status)}>
                          {status.status}
                        </span>
                        {status.current > 0 && status.total > 0 && (
                          <span>
                            {status.current.toLocaleString()} / {status.total.toLocaleString()}
                          </span>
                        )}
                        <span>({formatDuration(task.startTime)})</span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 ml-2"
                    onClick={() => onTaskRemove(task.taskId)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                {status && status.total > 0 && (
                  <div className="space-y-1">
                    <Progress value={status.percent || 0} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{status.percent?.toFixed(1)}%</span>
                      <span>{formatETA(status.eta_seconds)}</span>
                    </div>
                  </div>
                )}

                {status?.message && (isFailed || isCancelled) && (
                  <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                    {status.message}
                  </div>
                )}

                <div className="flex gap-2">
                  {canCancel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancel(task.taskId)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                  )}
                  {canUndo && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUndo(task.taskId, task.targetCollectionId!)}
                      className="text-xs"
                    >
                      <Undo2 className="h-3 w-3 mr-1" />
                      Undo
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default BackgroundTasksManager;