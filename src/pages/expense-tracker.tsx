import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, Calendar, PieChart } from "lucide-react";
import ExpenseEntry from "@/components/expense-entry";
import ChartsView from "@/components/charts-view";
import CalendarView from "@/components/calendar-view";
import AddToHomeScreen from "@/components/AddToHomeScreen";

type ViewType = "entry" | "charts" | "calendar";
type CurrencyCode = "USD" | "INR";

export default function ExpenseTracker() {
  const [currentView, setCurrentView] = useState<ViewType>("entry");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setCurrentView("entry")}>
              <Wallet className="text-primary text-2xl mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">DET</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setCurrentView("calendar")}
                className={`${
                  currentView === "calendar"
                    ? "bg-primary hover:bg-blue-700"
                    : "bg-gray-600 hover:bg-gray-700"
                } text-white transition duration-200`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Calendar View
              </Button>
              <Button
                onClick={() => setCurrentView("charts")}
                className={`${
                  currentView === "charts"
                    ? "bg-secondary hover:bg-green-700"
                    : "bg-gray-600 hover:bg-gray-700"
                } text-white transition duration-200`}
              >
                <PieChart className="w-4 h-4 mr-2" />
                Charts
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentView === "entry" && <ExpenseEntry currency={currency} setCurrency={setCurrency} />}
        {currentView === "charts" && <ChartsView currency={currency} />}
        {currentView === "calendar" && <CalendarView currency={currency} />}
      </div>

      {/* Add to Home Screen Popup */}
      <AddToHomeScreen />
    </div>
  );
}
