import { useState, useEffect } from "react";
import { 
  Building2,
  Users,
  Bookmark,
  List,
  Network,
  Users2,
  DollarSign,
  Brain,
  UserPlus,
  EyeOff,
  Settings,
  HelpCircle,
  MoreHorizontal,
  ChevronDown
} from "lucide-react";

import { getCollectionsMetadata } from "@/utils/jam-api";

interface SidebarItem {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  hasSubmenu?: boolean;
  count?: number;
}

const Sidebar = () => {
  const [isNetworkExpanded, setIsNetworkExpanded] = useState(true);
  const [isFavoritesExpanded, setIsFavoritesExpanded] = useState(true);
  const [collectionsCount, setCollectionsCount] = useState(0);

  useEffect(() => {
    const fetchCollectionsCount = async () => {
      try {
        const collections = await getCollectionsMetadata();
        setCollectionsCount(collections.length);
      } catch (error) {
        console.error('Error fetching collections:', error);
      }
    };
    
    fetchCollectionsCount();
  }, []);

  const mainMenuItems: SidebarItem[] = [
    { icon: <Building2 className="w-5 h-5" />, label: "Company Search", isActive: true },
    { icon: <Users className="w-5 h-5" />, label: "People Search" },
    { icon: <Bookmark className="w-5 h-5" />, label: "Saved Searches", count: 25 },
    { icon: <List className="w-5 h-5" />, label: "Lists", count: collectionsCount },
    { icon: <EyeOff className="w-5 h-5" />, label: "Hidden" },
  ];

  const networkItems: SidebarItem[] = [
    { icon: <Network className="w-5 h-5" />, label: "My Network", count: 5 },
    { icon: <Users2 className="w-5 h-5" />, label: "Team Network", count: 15 },
  ];

  const favoritesItems: SidebarItem[] = [
    { icon: <DollarSign className="w-5 h-5" />, label: "Financial Technology", count: 4 },
    { icon: <Brain className="w-5 h-5" />, label: "Artificial Intelligence", count: 12 },
    { icon: <UserPlus className="w-5 h-5" />, label: "Free Founders" },
  ];

  const bottomItems: SidebarItem[] = [
    { icon: <Settings className="w-5 h-5" />, label: "Settings" },
    { icon: <HelpCircle className="w-5 h-5" />, label: "Get Help" },
  ];

  return (
    <div className="sidebar w-64 h-screen bg-background text-slate-700 dark:text-slate-200 flex flex-col border-r border-slate-200 dark:border-slate-700 overflow-x-hidden overflow-y-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 mb-1">
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
      </div>

      {/* Main Navigation */}
      <div className="flex-1 py-4 overflow-x-hidden overflow-y-hidden">
        <nav className="px-3 space-y-1">
          {mainMenuItems.map((item, index) => (
            <a
              key={index}
              href="#"
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors truncate ${
                item.isActive
                  ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white"
                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </div>
              {item.count !== undefined && (
                <span className="text-xs bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">
                  {item.count}
                </span>
              )}
            </a>
          ))}
        </nav>

        {/* Network Section */}
        <div className="mt-4 px-3">
          <div 
            className="flex items-center justify-between px-3 py-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
            onClick={() => setIsNetworkExpanded(!isNetworkExpanded)}
          >
            <span className="font-medium">Network</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isNetworkExpanded ? 'rotate-180' : ''}`} />
          </div>
          
          {isNetworkExpanded && (
            <nav className="mt-1 space-y-1">
              {networkItems.map((item, index) => (
                <a
                  key={index}
                  href="#"
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors truncate"
                >
                  <div className="flex items-center gap-3 truncate">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span className="text-xs bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">
                      {item.count}
                    </span>
                  )}
                </a>
              ))}
            </nav>
          )}
        </div>

        {/* Favorites Section */}
        <div className="mt-4 px-3">
          <div 
            className="flex items-center justify-between px-3 py-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer hover:text-slate-700 dark:hover:text-slate-300"
            onClick={() => setIsFavoritesExpanded(!isFavoritesExpanded)}
          >
            <span className="font-medium">Favorites</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${isFavoritesExpanded ? 'rotate-180' : ''}`} />
          </div>
          
          {isFavoritesExpanded && (
            <nav className="mt-1 space-y-1">
              {favoritesItems.map((item, index) => (
                <a
                  key={index}
                  href="#"
                  className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors truncate"
                >
                  <div className="flex items-center gap-3 truncate">
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.count !== undefined && (
                    <span className="text-xs bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-slate-300 px-2 py-1 rounded-full">
                      {item.count}
                    </span>
                  )}
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
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors truncate"
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </a>
          ))}
        </nav>

        {/* User Profile */}
        <div className="mt-4 flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer">
          <div className="w-8 h-8 bg-[hsl(var(--primary))] rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-slate-700 dark:text-white">MH</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-900 dark:text-white">Michael Han</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">michael.han@queensu.ca</div>
          </div>
          <MoreHorizontal className="w-4 h-4 text-slate-500 dark:text-slate-400" />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;