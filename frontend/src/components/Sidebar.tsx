import { useState } from "react";
import { 
  LayoutDashboard, 
  BarChart3, 
  Users, 
  FolderOpen,
  FileBarChart,
  Database,
  HelpCircle,
  Settings,
  Search,
  MoreHorizontal,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarItem {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  hasSubmenu?: boolean;
}

const Sidebar = () => {
  const [isDocsExpanded, setIsDocsExpanded] = useState(true);

  const mainMenuItems: SidebarItem[] = [
    { icon: <LayoutDashboard className="w-5 h-5" />, label: "Dashboard" },
    { icon: <BarChart3 className="w-5 h-5" />, label: "Lifecycle" },
    { icon: <BarChart3 className="w-5 h-5" />, label: "Analytics" },
    { icon: <FolderOpen className="w-5 h-5" />, label: "Projects", isActive: true },
    { icon: <Users className="w-5 h-5" />, label: "Team" },
  ];

  const docItems: SidebarItem[] = [
    { icon: <Database className="w-5 h-5" />, label: "Data Library" },
    { icon: <FileBarChart className="w-5 h-5" />, label: "Reports" },
    { icon: <HelpCircle className="w-5 h-5" />, label: "Word Assistant" },
    { icon: <MoreHorizontal className="w-5 h-5" />, label: "More" },
  ];

  const bottomItems: SidebarItem[] = [
    { icon: <Settings className="w-5 h-5" />, label: "Settings" },
    { icon: <HelpCircle className="w-5 h-5" />, label: "Get Help" },
    { icon: <Search className="w-5 h-5" />, label: "Search" },
  ];

  return (
    <div className="w-full h-screen bg-background text-slate-700 dark:text-slate-200 flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
            <img 
              src="/harmonic_logo.png" 
              alt="Harmonic" 
              className="w-6 h-6"
              onError={(e) => {
                // Fallback to a simple H if logo fails to load
                e.currentTarget.style.display = 'none';
                const nextSibling = e.currentTarget.nextElementSibling as HTMLElement;
                if (nextSibling) {
                  nextSibling.style.display = 'flex';
                }
              }}
            />
            <div className="w-6 h-6 items-center justify-center text-slate-700 dark:text-white font-bold text-sm hidden">
              H
            </div>
          </div>
          <span className="text-lg font-semibold text-slate-800 dark:text-white">Harmonic</span>
        </div>
        
        <Button className="w-full --popover text-white rounded-lg py-2 px-4 flex items-center gap-2">
          <span className="text-lg">+</span>
          Quick Create
        </Button>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4">
        <nav className="px-3 space-y-1">
          {mainMenuItems.map((item, index) => (
            <a
              key={index}
              href="#"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                item.isActive
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {item.icon}
              {item.label}
            </a>
          ))}
        </nav>

        {/* Documents Section */}
        <div className="mt-8 px-3">
          <div 
            className="flex items-center justify-between px-3 py-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
            onClick={() => setIsDocsExpanded(!isDocsExpanded)}
          >
            <span className="font-medium">Documents</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isDocsExpanded ? 'rotate-180' : ''}`} />
          </div>
          
          {isDocsExpanded && (
            <nav className="mt-2 space-y-1">
              {docItems.map((item, index) => (
                <a
                  key={index}
                  href="#"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {item.icon}
                  {item.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* Bottom Section */}
      <div className="border-t border-slate-200 dark:border-slate-700 px-3 py-4">
        <nav className="space-y-1">
          {bottomItems.map((item, index) => (
            <a
              key={index}
              href="#"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {item.icon}
              {item.label}
            </a>
          ))}
        </nav>

        {/* User Profile */}
        <div className="mt-4 flex items-center gap-3 px-3 py-2 bg-[var(--card)] dark:text-[var(--muted-foreground)] rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="w-8 h-8 bg-slate-300 dark:bg-slate-600 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-slate-700 dark:text-white">CN</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-white">shadcn</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">m@example.com</div>
          </div>
          <MoreHorizontal className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;