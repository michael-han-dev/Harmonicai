import { useEffect, useState } from "react";
import "./App.css";
import Sidebar from "./components/Sidebar";
import CompanyTable from "./components/CompanyTable";
import BackgroundTasksManager, { BackgroundTask } from "./components/BackgroundTasksManager";
import { getCollectionsMetadata } from "./utils/jam-api";
import useApi from "./utils/useApi";

import ThemeToggle from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Share, X, Check, Link, Palette, Search, Copy, Settings, Lock, ChevronDown, Globe, HelpCircle, Download } from "lucide-react";

function App() {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>();
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);
  const [showShareModal, setShowShareModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'share' | 'publish'>('share');
  const [generalAccess, setGeneralAccess] = useState<string>('only-people-invited');
  const [showGeneralDropdown, setShowGeneralDropdown] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
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
      <aside className="fixed left-0 top-0 h-screen w-64 overflow-hidden overscroll-none bg-background border-r border-border z-30">
        <Sidebar />
      </aside>
      <main className="flex-1 ml-64 min-h-screen bg-background text-foreground flex flex-col">
        {/* Top Header */}
        <div className="bg-background border-b border-border px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold">Company search</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => setShowShareModal(true)}
              >
                <Share className="h-4 w-4" />
              </Button>
          <ThemeToggle />
        </div>
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
                onChangeCollection={setSelectedCollectionId}
              />
            )}
        </div>
        
        <BackgroundTasksManager
          tasks={backgroundTasks}
          onTaskComplete={handleTaskComplete}
          onTaskRemove={handleTaskRemove}
        />
      </main>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg shadow-lg w-[600px] max-w-[90vw]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex gap-4">
                <Button 
                  variant="ghost" 
                  className={`font-medium ${activeTab === 'share' ? 'text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setActiveTab('share')}
                >
                  Share
                </Button>
                <Button 
                  variant="ghost" 
                  className={`font-medium ${activeTab === 'publish' ? 'text-foreground' : 'text-muted-foreground'}`}
                  onClick={() => setActiveTab('publish')}
                >
                  Publish
                </Button>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setShowShareModal(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {activeTab === 'share' ? (
                <>
                  {/* Email Input */}
                  <div className="flex gap-2">
                    <input
                      placeholder="Email or group, separated by commas"
                      className="flex-1 px-3 py-2 border border-[hsl(var(--primary))] rounded-md bg-background text-foreground placeholder:text-muted-foreground h-10"
                    />
                    <Button className="bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))] text-primary-foreground px-6 h-10">Invite</Button>
                  </div>

                  {/* Users List */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-400 flex items-center justify-center text-white">M1</div>
                        <div className="text-left">
                          <div className="text-sm font-medium">Michael Han <span className="text-muted-foreground">(You)</span></div>
                          <div className="text-xs text-muted-foreground">michael.han@queensu.ca</div>
                        </div>
                      </div>
                      <Button variant="ghost" className="text-muted-foreground text-sm">Full access</Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white">M2</div>
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            Mike Han
                          </div>
                          <div className="text-xs text-muted-foreground">mike1@gmail.com</div>
                        </div>
                      </div>
                      <Button variant="ghost" className="text-muted-foreground text-sm">Full access</Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white">M3</div>
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            Mikael Han
                          </div>
                          <div className="text-xs text-muted-foreground">mikael@hotmail.com</div>
                        </div>
                      </div>
                      <Button variant="ghost" className="text-muted-foreground text-sm">Can view</Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-700 flex items-center justify-center text-white">M4</div>
                        <div className="text-left">
                          <div className="text-sm font-medium">
                            Mitchell Han
                          </div>
                          <div className="text-xs text-muted-foreground">mitchell.han@gmail.com</div>
                        </div>
                      </div>
                      <Button variant="ghost" className="text-muted-foreground text-sm">Full access</Button>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <div className="relative">
                      <Button 
                        variant="outline" 
                        className="text-sm flex items-center gap-2"
                        onClick={() => setShowExportDropdown(!showExportDropdown)}
                      >
                        <Download className="h-4 w-4" />
                        Export
                      </Button>
                      
                      {showExportDropdown && (
                        <div className="absolute bottom-full left-0 mb-1 bg-background border border-border rounded-md shadow-lg z-10 min-w-[120px]">
                          <div className="p-1">
                            <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted">
                              Export as CSV
                            </button>
                            <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted">
                              Export as JSON
                            </button>
                            <button className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted">
                              Export as PDF
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" className="text-sm">
                      <Link className="h-4 w-4 mr-2" />
                      Copy link
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Publish Tab Content */}
                  <div className="space-y-6 min-h-[400px]">
                    <div className="flex items-center gap-3 p-3 border border-border rounded-md">
                      <input 
                        value="public-collection-harmonic-ai.site"
                        className="flex-1 bg-transparent border-none outline-none text-foreground"
                        readOnly
                      />
                      <span className="text-muted-foreground">/</span>
                      <span className="text-muted-foreground">{getCollectionName(selectedCollectionId)}...</span>
                      <div className="bg-[hsl(var(--primary))] text-primary-foreground text-xs px-2 py-1 rounded flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-white" />
                        Customize
                      </div>
                      <Button size="icon" variant="ghost">
                        <Link className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer">
                        <Palette className="w-4 h-4" />
                        <span className="text-sm font-medium">Customize site styling</span>
                      </div>

                      <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                        <div className="flex items-center gap-3">
                          <Search className="w-4 h-4" />
                          <span className="text-sm font-medium">Search engine indexing</span>
                        </div>
                        <span className="text-sm text-muted-foreground">Off</span>
                      </div>

                      <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md">
                        <div className="flex items-center gap-3">
                          <Copy className="w-4 h-4" />
                          <span className="text-sm font-medium">Duplicate as template</span>
                        </div>
                        <div className="w-10 h-6 bg-[hsl(var(--primary))] rounded-full flex items-center justify-end p-1">
                          <div className="w-4 h-4 bg-white rounded-full" />
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-md cursor-pointer">
                        <Settings className="w-4 h-4" />
                        <span className="text-sm font-medium">Manage all sites and links</span>
                      </div>
                    </div>

                    <div className="border-t border-border pt-2 space-y-2">
                      <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md cursor-pointer">
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 flex items-center justify-center">
                            <div className="w-2 h-2 border border-foreground" />
                            <div className="w-1 h-1 border border-foreground ml-1" />
                          </div>
                          <span className="text-sm font-medium">Embed this page</span>
                        </div>
                        <ChevronDown className="w-3 h-3 text-muted-foreground rotate-[-90deg]" />
                      </div>

                      <div className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-md cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Share className="w-4 h-4" />
                          <span className="text-sm font-medium">Share via social</span>
                        </div>
                        <ChevronDown className="w-3 h-3 text-muted-foreground rotate-[-90deg]" />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="outline" className="flex-1 text-sm">Unpublish</Button>
                      <Button className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-sm">View site</Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;