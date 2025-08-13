import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Calendar, PieChart, Settings as SettingsIcon, User } from "lucide-react";
import ExpenseEntry from "@/components/expense-entry";
import ChartsView from "@/components/charts-view";
import CalendarView from "@/components/calendar-view";
import RecurringExpenses from "@/components/recurring-expenses";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import BottomNavigation from "@/components/bottom-navigation";
import FloatingActionButton from "@/components/floating-action-button";
import ThemeToggle from "@/components/theme-toggle";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import SettingsDrawer from "@/components/settings-drawer";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { queryClient } from "@/lib/queryClient";

type ViewType = "entry" | "charts" | "calendar" | "recurring";
type CurrencyCode = "USD" | "INR";

export default function ExpenseTracker() {
  const [currentView, setCurrentView] = useState<ViewType>("entry");
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem("dailyspend_currency") as CurrencyCode | null;
    return saved || "USD";
  });
  const isMobile = useIsMobile();
  const [focusAmountTrigger, setFocusAmountTrigger] = useState<number | null>(null);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-totals"] });
  }, []);

  usePullToRefresh(handleRefresh, { thresholdPx: 12, enabled: true });

  const handleFabClick = () => {
    setCurrentView("entry");
    setFocusAmountTrigger((t) => (t ?? 0) + 1);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Title Bar */}
      <header className="bg-card shadow-sm border-b border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center cursor-pointer" onClick={() => setCurrentView("entry") }>
              <Wallet className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-foreground">Daily Spends</h1>
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              <Button variant="ghost" size="icon" aria-label="Profile">
                <User className="w-5 h-5" />
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open Settings">
                    <SettingsIcon className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                 <SheetContent side="right" className="bg-card p-0 flex flex-col">
                  <div className="p-6 border-b border">
                    <SheetHeader>
                      <SheetTitle>Settings</SheetTitle>
                    </SheetHeader>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <SettingsDrawer currency={currency} setCurrency={setCurrency} />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Secondary Nav Bar - Only show on desktop */}
      {!isMobile && (
        <div className="bg-card border-b border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-2 sm:space-x-4 h-12">
              <Button
                onClick={() => setCurrentView("entry")}
                size="default"
                className={`${currentView === "entry" ? "bg-primary hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                Home
              </Button>
              <Button
                onClick={() => setCurrentView("calendar")}
                size="default"
                className={`${currentView === "calendar" ? "bg-primary hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Calendar View
              </Button>
              <Button
                onClick={() => setCurrentView("charts")}
                size="default"
                className={`${currentView === "charts" ? "bg-secondary hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                <PieChart className="w-4 h-4 mr-2" />
                Insights
              </Button>
              <Button
                onClick={() => setCurrentView("recurring")}
                size="default"
                className={`${currentView === "recurring" ? "bg-primary hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Recurring
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 ${isMobile ? 'pb-[calc(env(safe-area-inset-bottom)+7rem)]' : ''}`}>
        {currentView === "entry" && (
          <ExpenseEntry
            currency={currency}
            setCurrency={setCurrency}
            focusAmountTrigger={focusAmountTrigger}
            onFocusAmountConsumed={() => setFocusAmountTrigger(null)}
          />
        )}
        {currentView === "charts" && <ChartsView currency={currency} />}
        {currentView === "calendar" && <CalendarView currency={currency} />}
        {currentView === "recurring" && <RecurringExpenses currency={currency} />}
      </div>

      {/* Floating Action Button - Mobile only */}
      <FloatingActionButton onClick={handleFabClick} />

      {/* Bottom Navigation - Mobile only */}
      <BottomNavigation
        currentView={currentView}
        onViewChange={(v) => setCurrentView(v as ViewType)}
      />

      {/* Add to Home Screen Popup */}
      <AddToHomeScreen />
    </div>
  );
}
