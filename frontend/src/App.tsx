import { useEffect, useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import CompanyTable from "./components/CompanyTable";
import BackgroundTasksManager, { BackgroundTask } from "./components/BackgroundTasksManager";
import { getCollectionsMetadata } from "./utils/jam-api";
import useApi from "./utils/useApi";

import ThemeToggle from "@/components/ui/ThemeToggle";

function App() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>();
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const { data: collectionResponse } = useApi(() => getCollectionsMetadata());

  useEffect(() => {
    setSelectedCollectionId(collectionResponse?.[0]?.id);
  }, [collectionResponse]);

  useEffect(() => {
    if (selectedCollectionId) {
      window.history.pushState({}, "", `?collection=${selectedCollectionId}`);
    }
  }, [selectedCollectionId]);

  const addBackgroundTask = (task: BackgroundTask) => {
    setBackgroundTasks(prev => [...prev, task]);
  };

  const handleTaskComplete = (taskId: string) => {
    // Task completion handled by polling, no additional action needed
    console.log('Task completed:', taskId);
  };

  const handleTaskRemove = (taskId: string) => {
    setBackgroundTasks(prev => prev.filter(task => task.taskId !== taskId));
  };

  const getCollectionName = (collectionId: string): string => {
    return collectionResponse?.find(c => c.id === collectionId)?.collection_name || 'Unknown Collection';
  };

  return (
    <div className="flex min-h-screen w-screen m-0 p-0">
      <aside className="fixed left-0 top-0 h-screen w-64 overflow-y-auto bg-background border-r border-border z-30">
        <Sidebar />
      </aside>
      <main className="flex-1 ml-64 min-h-screen bg-background text-foreground flex flex-col">
        {/* Top Header */}
        <div className="bg-background border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold">Documents</h1>
              
              {/* Collections Dropdown */}
              <select
                value={selectedCollectionId || ''}
                onChange={(e) => setSelectedCollectionId(e.target.value)}
                className="px-3 py-1 rounded-md border border-border bg-background text-foreground text-sm"
              >
                <option value="">Select Collection</option>
                {collectionResponse?.map((collection) => (
                  <option key={collection.id} value={collection.id}>
                    {collection.collection_name}
                  </option>
                ))}
              </select>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Content Area - Full Width Company Table */}
        <div className="flex-1">
          {selectedCollectionId && (
            <CompanyTable 
              selectedCollectionId={selectedCollectionId}
              collectionResponse={collectionResponse}
              onStartBulkTask={addBackgroundTask}
              getCollectionName={getCollectionName}
            />
          )}
        </div>
        
        <BackgroundTasksManager
          tasks={backgroundTasks}
          onTaskComplete={handleTaskComplete}
          onTaskRemove={handleTaskRemove}
        />
      </main>
    </div>
  );
}

export default App;