import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMonthInfo, generateCalendarDays, getToday } from "@/lib/date-utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CalendarViewProps {
  currency: "USD" | "INR";
}

export default function CalendarView({ currency }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = getToday();
  
  const monthInfo = getMonthInfo(currentDate);
  const calendarDays = generateCalendarDays(monthInfo.year, monthInfo.month - 1);

  // Query for monthly totals
  const { data: monthlyTotals = [] } = useQuery<Array<{ date: string; total: number }>>({
    queryKey: ["/api/analytics/monthly-totals", { year: monthInfo.year, month: monthInfo.month }],
  });

  const getTotalForDate = (dateString: string) => {
    const total = monthlyTotals.find(mt => mt.date === dateString);
    return total ? total.total : 0;
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 sm:mb-0">Monthly Calendar</h2>
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={previousMonth}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-medium text-gray-900">{monthInfo.monthName}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={nextMonth}
                className="p-2 text-gray-600 hover:text-gray-900"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-6">
          {/* Calendar Header Days */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-sm font-medium text-gray-600 py-3">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const total = getTotalForDate(day.dateString);
              const hasExpenses = total > 0;
              
              return (
                <div
                  key={index}
                  className={`aspect-square p-2 rounded-lg cursor-pointer transition duration-200 ${
                    day.isToday
                      ? "bg-primary text-white"
                      : day.isCurrentMonth
                      ? hasExpenses
                        ? "hover:bg-gray-50 border-2 border-transparent hover:border-primary"
                        : "hover:bg-gray-50"
                      : "text-gray-400 hover:bg-gray-50"
                  }`}
                >
                  <div className={`text-sm font-medium ${day.isToday ? "text-white" : "text-gray-900"}`}>
                    {day.date.getDate()}
                  </div>
                  {day.isCurrentMonth && (
                    <div className={`text-xs font-medium mt-1 ${
                      day.isToday 
                        ? "text-white" 
                        : hasExpenses 
                        ? "text-primary" 
                        : "text-gray-500"
                    }`}>
{total === 0 ? "0" : Math.round(total)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Calendar Legend */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Legend</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-primary rounded"></div>
              <span className="text-sm text-gray-700">Today</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 border-2 border-primary rounded"></div>
              <span className="text-sm text-gray-700">Has Expenses</span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-6 h-6 bg-gray-100 rounded"></div>
              <span className="text-sm text-gray-700">No Expenses</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
