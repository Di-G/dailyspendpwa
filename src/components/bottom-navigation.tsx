import { Home, Calendar, BarChart3, Repeat } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface BottomNavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function BottomNavigation({ currentView, onViewChange }: BottomNavigationProps) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return null; // Only show on mobile devices
  }

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
      id: "charts",
      label: "Insights",
      icon: BarChart3,
      active: currentView === "charts",
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card border-t border z-50 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch h-16">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex-1 flex flex-col items-center justify-center transition-all duration-200 ${
                item.active
                  ? "bg-primary text-white"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${item.active ? "text-white" : "text-gray-600"}`} />
              <span className={`text-xs font-medium ${item.active ? "text-white" : "text-gray-600"}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
