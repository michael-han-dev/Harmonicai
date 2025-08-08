import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  ChevronRight, 
  Sun, 
  Moon, 
  Monitor, 
  Check,
  ArrowLeft,
  Building2,
  Users,
  Bookmark,
  List,
  EyeOff,
  Network,
  Users2,
  DollarSign,
  Brain,
  UserPlus,
  Settings,
  HelpCircle,
  Palette
} from "lucide-react";

interface SearchCommandProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchItem {
  icon: any;
  label: string;
  shortcut?: string;
  hasArrow?: boolean;
  action?: () => void;
  count?: number;
}

type Page = 'main' | 'themes';

const SearchCommand = ({ isOpen, onClose }: SearchCommandProps) => {
  const [query, setQuery] = useState("");
  const [currentPage, setCurrentPage] = useState<Page>('main');
  const [currentTheme, setCurrentTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Navigation items matching Sidebar
  const mainMenuItems: SearchItem[] = [
    { icon: Building2, label: "Company Search", shortcut: "G C" },
    { icon: Users, label: "People Search", shortcut: "G P" },
    { icon: Bookmark, label: "Saved Searches", shortcut: "G S" },
    { icon: List, label: "Lists", shortcut: "G L" },
    { icon: EyeOff, label: "Hidden", shortcut: "G H" },
  ];

  const networkItems: SearchItem[] = [
    { icon: Network, label: "My Network", shortcut: "G N" },
    { icon: Users2, label: "Team Network", shortcut: "G T" },
  ];

  const favoritesItems: SearchItem[] = [
    { icon: DollarSign, label: "Financial Technology", shortcut: "G F" },
    { icon: Brain, label: "Artificial Intelligence", shortcut: "G A" },
    { icon: UserPlus, label: "Free Founders", shortcut: "G R" },
  ];

  const settingsItems: SearchItem[] = [
    { icon: Palette, label: "Themes", hasArrow: true, action: () => setCurrentPage('themes') },
    { icon: Settings, label: "Settings", shortcut: "⌘ ," },
    { icon: HelpCircle, label: "Get Help", shortcut: "⌘ ?" },
  ];

  const allItems = [
    { category: "Main Menu", items: mainMenuItems },
    { category: "Network", items: networkItems },
    { category: "Favorites", items: favoritesItems },
    { category: "Settings", items: settingsItems },
  ];

  const filteredItems = allItems.map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.label.toLowerCase().includes(query.toLowerCase())
    )
  })).filter(section => section.items.length > 0);

  const handleThemeChange = (theme: 'light' | 'dark' | 'system') => {
    setCurrentTheme(theme);
    const root = window.document.documentElement;
    
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.toggle('dark', systemTheme === 'dark');
    } else {
      root.classList.toggle('dark', theme === 'dark');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setCurrentPage('main');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Escape') {
        if (currentPage === 'themes') {
          setCurrentPage('main');
        } else {
          onClose();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, currentPage, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center pt-20 z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-[600px] max-w-[90vw] max-h-[70vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-3">
            {currentPage === 'themes' && (
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={() => setCurrentPage('main')}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2 flex-1">
              <Search className="h-4 w-4 text-muted-foreground" />
              {currentPage === 'main' ? (
                <input
                  type="text"
                  placeholder="Type a command or search..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
                  autoFocus
                />
              ) : (
                <span className="text-sm text-muted-foreground">Themes</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">ESC</div>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto">
          {currentPage === 'main' ? (
            <div className="p-2">
              {query === "" ? (
                // Default view
                allItems.map((section, sectionIndex) => (
                  <div key={sectionIndex} className="mb-4">
                    <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left">
                      {section.category}
                    </div>
                    <div className="space-y-1">
                      {section.items.map((item, itemIndex) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={itemIndex}
                            className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-muted cursor-pointer group"
                            onClick={item.action}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="h-5 w-5 text-muted-foreground" />
                              <span className="text-sm">{item.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.shortcut && (
                                <div className="flex items-center gap-1">
                                  {item.shortcut.split(' ').map((key: string, keyIndex: number) => (
                                    <kbd key={keyIndex} className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded">
                                      {key}
                                    </kbd>
                                  ))}
                                </div>
                              )}
                              {item.hasArrow && (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              ) : (
                // Search results
                <div className="p-2">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((section, sectionIndex) => (
                      <div key={sectionIndex} className="mb-4">
                        <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wide text-left">
                          {section.category}
                        </div>
                        <div className="space-y-1">
                          {section.items.map((item, itemIndex) => {
                            const Icon = item.icon;
                            return (
                              <div
                                key={itemIndex}
                                className="flex items-center justify-between px-2 py-2 rounded-md hover:bg-muted cursor-pointer"
                                onClick={item.action}
                              >
                                <div className="flex items-center gap-3">
                                  <Icon className="h-5 w-5 text-muted-foreground" />
                                  <span className="text-sm">{item.label}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {item.shortcut && (
                                    <div className="flex items-center gap-1">
                                      {item.shortcut.split(' ').map((key: string, keyIndex: number) => (
                                        <kbd key={keyIndex} className="px-1.5 py-0.5 text-xs bg-muted border border-border rounded">
                                          {key}
                                        </kbd>
                                      ))}
                                    </div>
                                  )}
                                  {item.hasArrow && (
                                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-muted-foreground text-sm">
                      No results found for "{query}"
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            // Themes page
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Themes</h3>
                <div className="space-y-2">
                  <div
                    className="flex items-center justify-between p-3 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => handleThemeChange('light')}
                  >
                    <div className="flex items-center gap-3">
                      <Sun className="h-4 w-4" />
                      <span className="text-sm">Light</span>
                    </div>
                    {currentTheme === 'light' && (
                      <Check className="h-4 w-4 text-[hsl(var(--primary))]" />
                    )}
                  </div>
                  
                  <div
                    className="flex items-center justify-between p-3 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => handleThemeChange('dark')}
                  >
                    <div className="flex items-center gap-3">
                      <Moon className="h-4 w-4" />
                      <span className="text-sm">Dark</span>
                    </div>
                    {currentTheme === 'dark' && (
                      <Check className="h-4 w-4 text-[hsl(var(--primary))]" />
                    )}
                  </div>
                  
                  <div
                    className="flex items-center justify-between p-3 rounded-md hover:bg-muted cursor-pointer"
                    onClick={() => handleThemeChange('system')}
                  >
                    <div className="flex items-center gap-3">
                      <Monitor className="h-4 w-4" />
                      <span className="text-sm">System</span>
                    </div>
                    {currentTheme === 'system' && (
                      <Check className="h-4 w-4 text-[hsl(var(--primary))]" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchCommand;