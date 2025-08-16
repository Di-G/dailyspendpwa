import { Home, Calendar, BarChart3, Repeat } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRef, useState, useEffect, useCallback } from "react";

interface BottomNavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
  onSlideProgress?: (progress: number, direction: 'left' | 'right' | null) => void;
  onSlideStart?: () => void;
  onSlideEnd?: () => void;
}

export default function BottomNavigation({ currentView, onViewChange, onSlideProgress, onSlideStart, onSlideEnd }: BottomNavigationProps) {
  const isMobile = useIsMobile();
  // Temporarily disabled sliding feature
  // const [isDragging, setIsDragging] = useState(false);
  // const [startX, setStartX] = useState(0);
  // const [currentX, setCurrentX] = useState(0);
  // const [slideProgress, setSlideProgress] = useState(0);
  // const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
      id: "charts",
      label: "Insights",
      icon: BarChart3,
      active: currentView === "charts",
    },
    {
      id: "recurring",
      label: "Recurring",
      icon: Repeat,
      active: currentView === "recurring",
    },
  ];

  const currentIndex = navigationItems.findIndex(item => item.id === currentView);

  // Temporarily disabled sliding logic
  /*
  // Memoize the event handlers to avoid dependency issues
  const handleTouchStart = useCallback((e: TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
    setSlideProgress(0);
    setSlideDirection(null);
    if (onSlideStart) onSlideStart();
  }, [onSlideStart]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging) {
      const newX = e.touches[0].clientX;
      setCurrentX(newX);
      
      const deltaX = newX - startX;
      const screenWidth = window.innerWidth;
      const progress = Math.abs(deltaX) / screenWidth;
      
      // Determine slide direction and limit progress
      if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - going to previous tab
        setSlideDirection('right');
        setSlideProgress(Math.min(progress, 1));
        if (onSlideProgress) onSlideProgress(Math.min(progress, 1), 'right');
      } else if (deltaX < 0 && currentIndex < navigationItems.length - 1) {
        // Swipe left - going to next tab
        setSlideDirection('left');
        setSlideProgress(Math.min(progress, 1));
        if (onSlideProgress) onSlideProgress(Math.min(progress, 1), 'left');
      }
    }
  }, [isDragging, startX, currentIndex, navigationItems.length, onSlideProgress]);

  const handleTouchEnd = useCallback(() => {
    if (isDragging) {
      const deltaX = currentX - startX;
      const screenWidth = window.innerWidth;
      const progress = Math.abs(deltaX) / screenWidth;
      const threshold = 0.3; // 30% of screen width to trigger navigation
      
      if (progress > threshold) {
        if (deltaX > 0 && currentIndex > 0) {
          // Swipe right - go to previous tab
          const newIndex = currentIndex - 1;
          onViewChange(navigationItems[newIndex].id);
        } else if (deltaX < 0 && currentIndex < navigationItems.length - 1) {
          // Swipe left - go to next tab
          const newIndex = currentIndex + 1;
          onViewChange(navigationItems[newIndex].id);
        }
      }
      
      // Reset states
      setIsDragging(false);
      setStartX(0);
      setCurrentX(0);
      setSlideProgress(0);
      setSlideDirection(null);
      if (onSlideProgress) onSlideProgress(0, null);
      if (onSlideEnd) onSlideEnd();
    }
  }, [isDragging, currentX, startX, currentIndex, navigationItems, onViewChange, onSlideProgress, onSlideEnd]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    setIsDragging(true);
    setStartX(e.clientX);
    setCurrentX(e.clientX);
    setSlideProgress(0);
    setSlideDirection(null);
    if (onSlideStart) onSlideStart();
  }, [onSlideStart]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX;
      setCurrentX(newX);
      
      const deltaX = newX - startX;
      const screenWidth = window.innerWidth;
      const progress = Math.abs(deltaX) / screenWidth;
      
      // Determine slide direction and limit progress
      if (deltaX > 0 && currentIndex > 0) {
        // Swipe right - going to previous tab
        setSlideDirection('right');
        setSlideProgress(Math.min(progress, 1));
        if (onSlideProgress) onSlideProgress(Math.min(progress, 1), 'right');
      } else if (deltaX < 0 && currentIndex < navigationItems.length - 1) {
        // Swipe left - going to next tab
        setSlideDirection('left');
        setSlideProgress(Math.min(progress, 1));
        if (onSlideProgress) onSlideProgress(Math.min(progress, 1), 'left');
      }
    }
  }, [isDragging, startX, currentIndex, navigationItems.length, onSlideProgress]);

  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      const deltaX = currentX - startX;
      const screenWidth = window.innerWidth;
      const progress = Math.abs(deltaX) / screenWidth;
      const threshold = 0.3; // 30% of screen width to trigger navigation
      
      if (progress > threshold) {
        if (deltaX > 0 && currentIndex > 0) {
          // Swipe right - go to previous tab
          const newIndex = currentIndex - 1;
          onViewChange(navigationItems[newIndex].id);
        } else if (deltaX < 0 && currentIndex < navigationItems.length - 1) {
          // Swipe left - go to next tab
          const newIndex = currentIndex + 1;
          onViewChange(navigationItems[newIndex].id);
        }
      }
      
      // Reset states
      setIsDragging(false);
      setStartX(0);
      setCurrentX(0);
      setSlideProgress(0);
      setSlideDirection(null);
      if (onSlideProgress) onSlideProgress(0, null);
      if (onSlideEnd) onSlideEnd();
    }
  }, [isDragging, currentX, startX, currentIndex, navigationItems, onViewChange, onSlideProgress, onSlideEnd]);

  // Global swipe detection for the entire screen
  useEffect(() => {
    // Add global event listeners to the document
    document.addEventListener('touchstart', handleTouchStart);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseMove, handleMouseUp]);
  */

  if (!isMobile) {
    return null; // Only show on mobile devices
  }

  return (
    <>
      {/* Temporarily disabled sliding indicator */}
      {/* {isDragging && slideProgress > 0.1 && (
        <div className="fixed inset-0 bg-black bg-opacity-5 flex items-center justify-center pointer-events-none z-40">
          <div className="bg-white px-4 py-2 rounded-full shadow-lg border">
            <span className="text-sm font-medium text-gray-700">
              {slideDirection === 'right' ? '← Previous Tab' : 'Next Tab →'} ({Math.round(slideProgress * 100)}%)
            </span>
          </div>
        </div>
      )} */}
      
      {/* Bottom Navigation */}
      <div 
        ref={containerRef}
        className="fixed bottom-0 left-0 right-0 bg-card border-t border z-50 pb-[env(safe-area-inset-bottom)]"
      >
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
    </>
  );
}
