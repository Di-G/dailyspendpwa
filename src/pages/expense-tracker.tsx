import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Calendar, PieChart, Settings as SettingsIcon, User } from "lucide-react";
import ExpenseEntry from "@/components/expense-entry";
import ChartsView from "@/components/charts-view";
import CalendarView from "@/components/calendar-view";
import AddToHomeScreen from "@/components/AddToHomeScreen";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import SettingsDrawer from "@/components/settings-drawer";

type ViewType = "entry" | "charts" | "calendar";
type CurrencyCode = "USD" | "INR";

export default function ExpenseTracker() {
  const [currentView, setCurrentView] = useState<ViewType>("entry");
  const [currency, setCurrency] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem("dailyspend_currency") as CurrencyCode | null;
    return saved || "USD";
  });
  const isMobile = useIsMobile();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Title Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center cursor-pointer" onClick={() => setCurrentView("entry") }>
              <Wallet className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Daily Spends Tracker</h1>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" aria-label="Profile">
                <User className="w-5 h-5" />
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Open Settings">
                    <SettingsIcon className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="bg-white p-0 flex flex-col">
                  <div className="p-6 border-b">
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

      {/* Secondary Nav Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 sm:space-x-4 h-12">
            <Button
              onClick={() => setCurrentView("entry")}
              size={isMobile ? "sm" : "default"}
              className={`bg-gray-600 hover:bg-gray-700 text-white transition duration-200`}
            >
              Home
            </Button>
            <Button
              onClick={() => setCurrentView("calendar")}
              size={isMobile ? "sm" : "default"}
              className={`${currentView === "calendar" ? "bg-primary hover:bg-blue-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
            >
              <Calendar className="w-4 h-4 mr-1 sm:mr-2" />
              {isMobile ? "Calendar" : "Calendar View"}
            </Button>
            <Button
              onClick={() => setCurrentView("charts")}
              size={isMobile ? "sm" : "default"}
              className={`${currentView === "charts" ? "bg-secondary hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"} text-white transition duration-200`}
            >
              <PieChart className="w-4 h-4 mr-1 sm:mr-2" />
              {isMobile ? "Insights" : "Insights"}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {currentView === "entry" && <ExpenseEntry currency={currency} setCurrency={setCurrency} />}
        {currentView === "charts" && <ChartsView currency={currency} />}
        {currentView === "calendar" && <CalendarView currency={currency} />}
      </div>

      {/* Add to Home Screen Popup */}
      <AddToHomeScreen />
    </div>
  );
}
