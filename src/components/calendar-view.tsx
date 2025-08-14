import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMonthInfo, generateCalendarDays, getToday } from "@/lib/date-utils";
import { ChevronLeft, ChevronRight, Repeat } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { getRecurringExpenses } from "@/lib/localStorage";
import type { RecurringExpense, ExpenseWithCategory } from "@shared/schema";

interface CalendarViewProps {
  currency: "USD" | "INR";
}

export default function CalendarView({ currency }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const today = getToday();
  const isMobile = useIsMobile();
  const [previewItems, setPreviewItems] = useState<Array<{ name: string; amount: string }>>([]);
  const [previewDate, setPreviewDate] = useState<string | null>(null);
  
  const monthInfo = getMonthInfo(currentDate);
  const calendarDays = generateCalendarDays(monthInfo.year, monthInfo.month - 1);

  // Query for monthly totals
  const { data: monthlyTotals = [] } = useQuery<Array<{ date: string; total: number }>>({
    queryKey: ["/api/analytics/monthly-totals", { year: monthInfo.year, month: monthInfo.month }],
  });

  // Get recurring expenses for the month
  const recurringExpenses = getRecurringExpenses();

  const CURRENCIES = {
    USD: { symbol: "$" },
    INR: { symbol: "₹" }
  } as const;

  // Expenses for the clicked date
  const { data: previewExpenses = [] } = useQuery<ExpenseWithCategory[]>({
    queryKey: ["/api/expenses", previewDate ? { date: previewDate } : {}],
    enabled: !!previewDate,
  });

  // Determine which recurring items are not yet present in the expense list for the selected date
  const missingRecurringItems = previewItems.filter((item) =>
    !previewExpenses.some((exp) => exp.name === item.name && exp.amount === item.amount)
  );

  // Build a combined preview list: existing expenses + missing recurring items
  const combinedPreviewItems = (
    previewDate
      ? [
          ...previewExpenses.map(exp => ({
            key: exp.id,
            name: exp.name,
            amount: exp.amount,
            isRecurring: false,
          })),
          ...missingRecurringItems.map((item, idx) => ({
            key: `rec-${idx}-${item.name}-${item.amount}`,
            name: item.name,
            amount: item.amount,
            isRecurring: true,
          })),
        ]
      : []
  );

  const getTotalForDate = (dateString: string) => {
    const total = monthlyTotals.find(mt => mt.date === dateString);
    return total ? total.total : 0;
  };

  const hasRecurringExpenseOnDate = (dateString: string) => {
    return recurringExpenses.some(recurring => {
      if (!recurring.isActive) return false;
      if (recurring.endDate && dateString > recurring.endDate) return false;
      if (dateString < recurring.startDate) return false;
      
      const startDate = new Date(recurring.startDate);
      const targetDate = new Date(dateString);
      
      switch (recurring.frequency) {
        case 'daily':
          return true;
        case 'weekly':
          const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff % 7 === 0;
        case 'monthly':
          const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + 
                            (targetDate.getMonth() - startDate.getMonth());
          const dayOfMonth = startDate.getDate();
          return monthsDiff >= 0 && targetDate.getDate() === dayOfMonth;
        case 'custom':
          if (recurring.customDays) {
            const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            return daysDiff % recurring.customDays === 0;
          }
          return false;
        default:
          return false;
      }
    });
  };

  const getRecurringItemsForDate = (dateString: string): RecurringExpense[] => {
    return recurringExpenses.filter(recurring => {
      if (!recurring.isActive) return false;
      if (recurring.endDate && dateString > recurring.endDate) return false;
      if (dateString < recurring.startDate) return false;
      const startDate = new Date(recurring.startDate);
      const targetDate = new Date(dateString);
      switch (recurring.frequency) {
        case 'daily':
          return true;
        case 'weekly': {
          const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          return daysDiff % 7 === 0;
        }
        case 'monthly': {
          const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + (targetDate.getMonth() - startDate.getMonth());
          const dayOfMonth = startDate.getDate();
          return monthsDiff >= 0 && targetDate.getDate() === dayOfMonth;
        }
        case 'custom': {
          if (recurring.customDays) {
            const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
            return daysDiff % recurring.customDays === 0;
          }
          return false;
        }
        default:
          return false;
      }
    });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Calendar Header */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-4 sm:mb-0">Monthly Calendar</h2>
            <div className="flex items-center justify-center sm:justify-start space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={previousMonth}
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-lg font-medium text-foreground">{monthInfo.monthName}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={nextMonth}
                className="p-2 text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar Grid */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Calendar Header Days */}
          <div className="grid grid-cols-7 gap-1 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-2 sm:py-3">
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, index) => {
              const total = getTotalForDate(day.dateString);
              const hasExpenses = total > 0;
              const hasRecurringExpense = hasRecurringExpenseOnDate(day.dateString);
              
              return (
                <div
                  key={index}
                  onClick={() => {
                    if (!day.isCurrentMonth) {
                      setPreviewItems([]);
                      setPreviewDate(null);
                      return;
                    }
                    setPreviewDate(day.dateString);
                    const items = getRecurringItemsForDate(day.dateString).map(i => ({ name: i.name, amount: i.amount }));
                    setPreviewItems(items);
                  }}
                  className={`aspect-square p-1 sm:p-2 rounded-lg transition duration-200 ${
                    day.isToday
                      ? "bg-primary text-white"
                      : day.isCurrentMonth
                      ? "hover:bg-muted border-2 border-transparent hover:border-primary cursor-pointer"
                      : "text-muted-foreground hover:bg-muted"
                  } ${day.isCurrentMonth ? 'cursor-pointer' : ''}`}
                  title={day.isCurrentMonth ? `View details for ${day.dateString}` : ''}
                >
                  <div className={`text-xs sm:text-sm font-medium ${day.isToday ? "text-white" : "text-foreground"}`}>
                    {day.date.getDate()}
                  </div>
                  {day.isCurrentMonth && (
                    <>
                      {hasExpenses && (
                        <div className={`text-xs font-medium mt-1 ${day.isToday ? "text-white" : "text-foreground"}`}>{total === 0 ? "0" : Math.round(total)}</div>
                      )}
                      {hasRecurringExpense && (
                        <div className="flex items-center justify-center mt-1">
                          <Repeat className="w-3 h-3 text-muted-foreground" aria-label="Recurring" />
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {previewDate && combinedPreviewItems.length > 0 && (
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="space-y-2">
              {combinedPreviewItems.map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <span className="text-sm text-foreground font-medium flex items-center gap-1">
                    {item.isRecurring && <Repeat className="w-3 h-3 text-muted-foreground" aria-label="Recurring" />}
                    {item.name}
                  </span>
                  <span className="text-sm text-foreground font-semibold">{CURRENCIES[currency].symbol}{item.amount}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend removed as requested */}
    </div>
  );
}
