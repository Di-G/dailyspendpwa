import { Home, Calendar, BarChart3, Repeat, Users } from "lucide-react";

interface BottomNavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
  colorVariant?: 'primary' | 'rose' | 'emerald' | 'yellow';
  isCoupleTab?: boolean;
  disabledIds?: string[];
}

export default function BottomNavigation({ currentView, onViewChange, colorVariant = 'primary', isCoupleTab, disabledIds = [] }: BottomNavigationProps) {

  const navigationItems = [
    {
      id: "entry",
      label: "Home",
      icon: Home,
      active: currentView === "entry",
    },
    {
      id: "calendar",
      label: "Calendar",
      icon: Calendar,
      active: currentView === "calendar",
    },
    {
      id: "recurring",
      label: "Recurring",
      icon: Repeat,
      active: currentView === "recurring",
    },
    {
      id: isCoupleTab ? "chat" : "charts",
      label: isCoupleTab ? "Chat" : "Insights",
      icon: isCoupleTab ? Users : BarChart3,
      active: isCoupleTab ? currentView === "chat" : currentView === "charts",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch h-16">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isDisabled = disabledIds.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => { if (!isDisabled) onViewChange(item.id); }}
              disabled={isDisabled}
              className={`flex-1 flex flex-col items-center justify-center transition-all duration-200 ${
                isDisabled
                  ? "opacity-50 cursor-not-allowed"
                  : item.active
                  ? `${colorVariant === 'rose' ? 'bg-rose-600' : colorVariant === 'emerald' ? 'bg-emerald-600' : colorVariant === 'yellow' ? 'bg-yellow-500' : 'bg-primary'} text-white`
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${isDisabled ? "text-gray-400" : item.active ? "text-white" : "text-gray-600"}`} />
              <span className={`text-xs font-medium ${isDisabled ? "text-gray-400" : item.active ? "text-white" : "text-gray-600"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
