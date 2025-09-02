import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { getToday, formatDate } from "@/lib/date-utils";
import { RefreshCw, TrendingUp, Calculator, BarChart3, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button as UIButton } from "@/components/ui/button";
import type { Category, Expense } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar as UICalendar } from "@/components/ui/calendar";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatAmountDisplay } from "@/lib/utils";
import { type CurrencyCode, CURRENCIES } from "@/lib/currencies";

declare global {
  interface Window {
    Chart: any;
  }
}

interface ChartsViewProps {
  currency: CurrencyCode;
}

export default function ChartsView({ currency }: ChartsViewProps) {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [chartsReady, setChartsReady] = useState(false);
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartInstance = useRef<any>(null);
  const barChartInstance = useRef<any>(null);
  const isMobile = useIsMobile();



  // Queries
  const { data: categoryTotals = [] } = useQuery<Array<{ categoryId: string; total: number; category: Category }>>({
    queryKey: ["/api/analytics/category-totals", { date: selectedDate }],
  });

  const { data: dailyTotal = { total: 0 } } = useQuery<{ total: number }>({
    queryKey: ["/api/analytics/daily-total", { date: selectedDate }],
  });

  // Get real weekly data
  const { data: weeklyTotals = [] } = useQuery<Array<{ date: string; total: number }>>({
    queryKey: ["/api/analytics/weekly-totals", { date: selectedDate }],
  });

  // Get monthly data for current month
  const selectedMonth = new Date(selectedDate);
  const { data: monthlyTotals = [] } = useQuery<Array<{ date: string; total: number }>>({
    queryKey: ["/api/analytics/monthly-totals", { year: selectedMonth.getFullYear(), month: selectedMonth.getMonth() + 1 }],
  });

  // Generate last 7 days from selected date
  const getLast7Days = (date: string) => {
    const days = [];
    const currentDate = new Date(date);
    for (let i = 6; i >= 0; i--) {
      const day = new Date(currentDate);
      day.setDate(currentDate.getDate() - i);
      days.push({
        date: formatDate(day),
        label: day.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    return days;
  };

  const weeklyDays = getLast7Days(selectedDate);
  const weeklyData = weeklyDays.map(day => {
    const dayTotal = weeklyTotals.find(wt => wt.date === day.date);
    return dayTotal ? dayTotal.total : 0;
  });
  const weeklyLabels = weeklyDays.map(day => day.label);

  // Simple function to go back to newest (today)
  const goToNewest = () => {
    // No longer needed as we're back to simple 7-day view
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        // Left arrow - go to newer dates
        if (barChartInstance.current) {
          barChartInstance.current.scrollBy({ left: -100, behavior: 'smooth' });
        }
      } else if (e.key === 'ArrowRight') {
        // Right arrow - go to older dates
        if (barChartInstance.current) {
          barChartInstance.current.scrollBy({ left: 100, behavior: 'smooth' });
        }
      } else if (e.key === 'Home') {
        // Home key - go to newest
        goToNewest();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const initializeCharts = useCallback(() => {
    if (!window.Chart) return;

    // Destroy existing charts
    if (pieChartInstance.current) {
      pieChartInstance.current.destroy();
    }
    if (barChartInstance.current) {
      barChartInstance.current.destroy();
    }

    let chartsInitialized = false;

    // Resolve theme colors from CSS variables
    const css = getComputedStyle(document.documentElement);
    const colorPrimary = css.getPropertyValue('--primary').trim() || '#1976D2';
    const colorBorder = css.getPropertyValue('--border').trim() || 'rgba(0,0,0,0.1)';
    const colorMutedForeground = css.getPropertyValue('--muted-foreground').trim() || '#6b7280';

    // Pie Chart - only render if we have category data
    if (pieChartRef.current && categoryTotals.length > 0) {
      const ctx = pieChartRef.current.getContext('2d');
      pieChartInstance.current = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: categoryTotals.map(ct => ct.category.name),
          datasets: [{
            data: categoryTotals.map(ct => ct.total),
            backgroundColor: categoryTotals.map(ct => ct.category.color),
            borderWidth: 0,
            borderColor: 'transparent'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: false
            }
          }
        }
      });
      chartsInitialized = true;
    }

    // Bar Chart - always render (shows zero values when no data)
    if (barChartRef.current) {
      const ctx = barChartRef.current.getContext('2d');
      if (!ctx) {
        console.error('Could not get 2D context from canvas');
        return;
      }
      
      console.log('Creating bar chart with data:', weeklyData);
      console.log('Creating bar chart with labels:', weeklyLabels);
      
      barChartInstance.current = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: weeklyLabels,
          datasets: [{
            label: 'Daily Expenses',
            data: weeklyData,
            backgroundColor: colorPrimary,
            borderColor: colorPrimary,
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 300,
            easing: 'easeInOutQuart'
          },
          transitions: {
            active: {
              animation: {
                duration: 300,
                easing: 'easeInOutQuart'
              }
            }
          },
          plugins: {
            legend: {
              display: false
            },
            tooltip: {
              callbacks: {
                title: function(context: any) {
                  const index = context[0].dataIndex;
                  const day = weeklyDays[index];
                  return `${day.label} - ${day.fullDate}`;
                },
                label: function(context: any) {
                  return `Amount: ${CURRENCIES[currency].symbol}${formatAmountDisplay(context.parsed.y)}`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                display: true,
                color: colorBorder
              },
              ticks: {
                display: true,
                color: colorMutedForeground
              }
            },
            x: {
              grid: {
                display: false
              },
              ticks: {
                maxTicksLimit: 7, // Show all 7 day labels
                maxRotation: 0,
                display: true,
                color: colorMutedForeground
              }
            }
          },
          elements: {
            bar: {
              borderWidth: 1,
              borderColor: colorPrimary
            }
          }
        }
      });
      chartsInitialized = true;
    }

    setChartsReady(chartsInitialized);
  }, [categoryTotals, weeklyData, weeklyLabels, currency, weeklyDays]);

  // Reset weekly chart offset when date changes
  useEffect(() => {
    // No longer needed as chart is horizontally scrollable
  }, [selectedDate]);

  // Initialize charts when data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeCharts();
    }, 100);
    return () => clearTimeout(timer);
  }, [categoryTotals, weeklyData, weeklyLabels, initializeCharts]);

  // Check if Chart.js is available and initialize on mount
  useEffect(() => {
    const checkChartAvailability = () => {
      if (window.Chart) {
        initializeCharts();
      } else {
        // Retry after a short delay if Chart.js isn't loaded yet
        setTimeout(checkChartAvailability, 100);
      }
    };
    
    checkChartAvailability();
  }, [initializeCharts]);

  // Cleanup charts on unmount
  useEffect(() => {
    return () => {
      if (pieChartInstance.current) {
        pieChartInstance.current.destroy();
      }
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }
    };
  }, []);

  // Ensure weekly chart is always rendered
  useEffect(() => {
    if (window.Chart && barChartRef.current && weeklyLabels.length > 0) {
      console.log('Forcing weekly chart render with labels:', weeklyLabels);
      // Destroy existing bar chart
      if (barChartInstance.current) {
        barChartInstance.current.destroy();
      }
      
      const ctx = barChartRef.current.getContext('2d');
      if (ctx) {
        const css = getComputedStyle(document.documentElement);
        const colorPrimary = css.getPropertyValue('--primary').trim() || '#1976D2';
        const colorBorder = css.getPropertyValue('--border').trim() || 'rgba(0,0,0,0.1)';
        const colorMutedForeground = css.getPropertyValue('--muted-foreground').trim() || '#6b7280';
        barChartInstance.current = new window.Chart(ctx, {
          type: 'bar',
          data: {
            labels: weeklyLabels,
            datasets: [{
              label: 'Daily Expenses',
              data: weeklyData,
              backgroundColor: colorPrimary,
              borderColor: colorPrimary,
              borderWidth: 1,
              borderRadius: 4
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
              duration: 300,
              easing: 'easeInOutQuart'
            },
            transitions: {
              active: {
                animation: {
                  duration: 300,
                  easing: 'easeInOutQuart'
                }
              }
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  title: function(context: any) {
                    const index = context[0].dataIndex;
                    const day = weeklyDays[index];
                    return `${day.label} - ${day.fullDate}`;
                  },
                  label: function(context: any) {
                    return `Amount: ${CURRENCIES[currency].symbol}${formatAmountDisplay(context.parsed.y)}`;
                  }
                }
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                grid: {
                  display: true,
                  color: colorBorder
                },
                ticks: {
                  display: true,
                  color: colorMutedForeground
                }
              },
              x: {
                grid: {
                  display: false
                },
                ticks: {
                  maxTicksLimit: 7, // Show all 7 day labels
                  maxRotation: 0,
                  display: true,
                  color: colorMutedForeground
                }
              }
            },
            elements: {
              bar: {
                borderWidth: 1,
                borderColor: colorPrimary
              }
            }
          }
        });
        console.log('Weekly chart forced render successful');
      }
    }
  }, [weeklyData, weeklyLabels, currency]);

  const updateCharts = useCallback(() => {
    initializeCharts();
  }, [initializeCharts]);

  const totalExpense = categoryTotals.reduce((sum, ct) => sum + ct.total, 0);
  
  // Calculate real monthly statistics
  const monthlyHighest = monthlyTotals.length > 0 ? Math.max(...monthlyTotals.map(mt => mt.total)) : 0;
  const monthlyAverage = monthlyTotals.length > 0 ? 
    monthlyTotals.reduce((sum, mt) => sum + mt.total, 0) / monthlyTotals.length : 0;

  // Range selection state for Total card
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false);
  const [totalRange, setTotalRange] = useState<{ mode: 'week' | 'lastNDays' | 'custom'; days?: number; startDate?: string }>({ mode: 'week' });

  // Compute current week (Mon..selected date) range for selected date
  const selectedForWeek = new Date(selectedDate);
  const weekStart = new Date(selectedForWeek);
  {
    const day = selectedForWeek.getDay(); // 0=Sun ... 6=Sat
    const diffToMonday = (day + 6) % 7; // Mon->0, Tue->1, ... Sun->6
    weekStart.setDate(selectedForWeek.getDate() - diffToMonday);
  }
  const weekEnd = new Date(selectedForWeek); // Up to selected date (Mon..selected)

  // Resolve active range based on selection
  const resolveRangeStart = () => {
    if (totalRange.mode === 'week') {
      return new Date(weekStart);
    }
    if (totalRange.mode === 'lastNDays') {
      const d = new Date(selectedDate);
      d.setDate(d.getDate() - ((totalRange.days || 1) - 1));
      return d;
    }
    if (totalRange.mode === 'custom' && totalRange.startDate) {
      return new Date(totalRange.startDate);
    }
    return new Date(weekStart);
  };
  const rangeStart = resolveRangeStart();
  const rangeEnd = new Date(selectedDate);
  const rangeStartStr = formatDate(rangeStart);
  const rangeEndStr = formatDate(rangeEnd);

  // Fetch range expenses and sum them
  const { data: rangeExpenses = [] } = useQuery<Expense[]>({
    queryKey: ["/api/expenses", { startDate: rangeStartStr, endDate: rangeEndStr }],
  });
  const totalRangeSum = rangeExpenses.reduce((sum, e) => sum + parseFloat((e as any).amount || '0'), 0);

  // UI helpers for title and subtitle
  const rangeTitle = totalRange.mode === 'week'
    ? 'Total This Week'
    : totalRange.mode === 'lastNDays'
      ? `Total Last ${totalRange.days} Day${(totalRange.days || 0) > 1 ? 's' : ''}`
      : totalRange.mode === 'custom'
        ? `Total Since`
        : 'Total This Week';

  // Month picker for "Total This Month"
  const [monthDialogOpen, setMonthDialogOpen] = useState(false);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => `${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`);
  const nowYear = new Date().getFullYear();
  const nowMonthIdx = new Date().getMonth();
  const [monthYearView, setMonthYearView] = useState<number>(nowYear);
  const parseMonthKey = (key: string) => {
    const [y, m] = key.split('-').map((v) => parseInt(v));
    return { year: y, monthIdx: m };
  };
  const selectedParsed = parseMonthKey(selectedMonthKey);
  const selectedMonthLabel = new Date(selectedParsed.year, selectedParsed.monthIdx, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const { data: selectedMonthTotals = [] } = useQuery<Array<{ date: string; total: number }>>({
    queryKey: ["/api/analytics/monthly-totals", { year: selectedParsed.year, month: (selectedParsed.monthIdx) + 1 }],
  });
  const selectedMonthTotal = useMemo(() => selectedMonthTotals.reduce((s, t) => s + t.total, 0), [selectedMonthTotals]);
  const isCurrentSelectedMonth = selectedParsed.year === nowYear && selectedParsed.monthIdx === nowMonthIdx;
  const totalMonthTitle = isCurrentSelectedMonth ? 'Total This Month' : `Total – ${selectedMonthLabel}`;

  // Average month selector
  const [avgMonthDialogOpen, setAvgMonthDialogOpen] = useState(false);
  const [avgSelectedMonthKey, setAvgSelectedMonthKey] = useState<string>(() => `${selectedMonth.getFullYear()}-${selectedMonth.getMonth()}`);
  const [avgMonthYearView, setAvgMonthYearView] = useState<number>(nowYear);
  const avgSelectedParsed = parseMonthKey(avgSelectedMonthKey);
  const avgSelectedMonthLabel = new Date(avgSelectedParsed.year, avgSelectedParsed.monthIdx, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isCurrentAvgMonth = avgSelectedParsed.year === nowYear && avgSelectedParsed.monthIdx === nowMonthIdx;
  const avgMonthTitle = isCurrentAvgMonth ? 'Average This Month' : `Average – ${avgSelectedMonthLabel}`;
  const { data: avgMonthTotals = [] } = useQuery<Array<{ date: string; total: number }>>({
    queryKey: ["/api/analytics/monthly-totals", { year: avgSelectedParsed.year, month: avgSelectedParsed.monthIdx + 1 }],
  });
  const avgSelectedMonthAverage = useMemo(() => {
    if (avgMonthTotals.length === 0) return 0;
    const days = avgMonthTotals.length;
    const sum = avgMonthTotals.reduce((s, t) => s + t.total, 0);
    return sum / days;
  }, [avgMonthTotals]);
  
  // Find highest day with date and day name
  const highestDayData = monthlyTotals.find(mt => mt.total === monthlyHighest);
  const highestDayName = highestDayData ? 
    new Date(highestDayData.date).toLocaleDateString('en-US', { weekday: 'long' }) : '';
  const highestDayDate = highestDayData ? 
    new Date(highestDayData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Charts Header with Date Selector */}
      <Card className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 border-orange-200 dark:border-orange-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-4 sm:mb-0">Expense Analytics</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                <label className="text-sm font-medium text-foreground/80">Select Date:</label>
                <DatePicker value={selectedDate} onChange={setSelectedDate} className="h-9" />
              </div>
                <UIButton
                onClick={updateCharts}
                size={isMobile ? "sm" : "default"}
                className="bg-primary text-white hover:bg-blue-700 transition duration-200 w-full sm:w-auto"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Update Charts
                </UIButton>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Pie Chart */}
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-800">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Category Distribution</h3>
            <div className="relative h-48 sm:h-64">
              {categoryTotals.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No category data available</p>
                    <p className="text-xs text-muted-foreground">Select a date to view category distribution</p>
                  </div>
                </div>
              ) : (
                <canvas ref={pieChartRef} className="w-full h-full"></canvas>
              )}
            </div>
            {categoryTotals.length > 0 && (
              <div className="mt-4 space-y-2">
                {categoryTotals.map((ct) => {
                  const percentage = totalExpense > 0 ? Math.round((ct.total / totalExpense) * 100) : 0;
                  return (
                    <div key={ct.categoryId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center min-w-0 flex-1">
                        <div
                          className="w-3 h-3 rounded-full mr-2 flex-shrink-0"
                          style={{ backgroundColor: ct.category.color }}
                        ></div>
                        <span className="truncate">{ct.category.name}</span>
                      </div>
                      <span className="font-medium text-sm sm:text-base flex-shrink-0">{CURRENCIES[currency].symbol}{formatAmountDisplay(ct.total)} ({percentage}%)</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Weekly Comparison</h3>
            
            {/* Navigation Controls */}
            <div className="flex items-center justify-end mb-4">
              {/* No navigation needed for simple 7-day view */}
            </div>
            
            <div className="relative h-48 sm:h-64">
              <canvas 
                ref={barChartRef} 
                className="w-full h-full"
              ></canvas>
            </div>
            
            {/* Date Range Info */}
            <div className="mt-2 text-xs text-muted-foreground text-center">
              Showing: {weeklyDays[6]?.fullDate} - {weeklyDays[0]?.fullDate}
            </div>
            
            {/* Navigation Hints */}
            <div className="mt-2 text-xs text-muted-foreground text-center space-y-1">
              💡 Weekly comparison showing last 7 days
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Overview */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Monthly Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 sm:gap-6">
            <button type="button" onClick={() => { setMonthDialogOpen(true); setMonthYearView(selectedParsed.year); }} className="text-center p-4 rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
              <Calculator className="text-red-500 dark:text-red-300 text-xl sm:text-2xl mb-2 mx-auto" />
              <p className="text-xs sm:text-sm font-medium text-foreground/80">{totalMonthTitle}</p>
              <p className="text-lg sm:text-xl font-bold text-foreground">{CURRENCIES[currency].symbol}{formatAmountDisplay(selectedMonthTotal)}</p>
              <p className="text-xs text-muted-foreground">Tap to change month</p>
            </button>
            <button type="button" onClick={() => setRangeDialogOpen(true)} className="text-center p-4 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <Calendar className="text-blue-500 dark:text-blue-300 text-xl sm:text-2xl mb-2 mx-auto" />
              <p className="text-xs sm:text-sm font-medium text-foreground/80">{rangeTitle}</p>
              <p className="text-lg sm:text-xl font-bold text-foreground">{CURRENCIES[currency].symbol}{formatAmountDisplay(totalRangeSum)}</p>
              <p className="text-xs text-muted-foreground">{rangeStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {rangeEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
            </button>
            <button type="button" onClick={() => { setAvgMonthDialogOpen(true); setAvgMonthYearView(avgSelectedParsed.year); }} className="text-center p-4 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
              <BarChart3 className="text-green-500 dark:text-green-300 text-xl sm:text-2xl mb-2 mx-auto" />
              <p className="text-xs sm:text-sm font-medium text-foreground/80">{avgMonthTitle}</p>
              <p className="text-lg sm:text-xl font-bold text-foreground">{CURRENCIES[currency].symbol}{formatAmountDisplay(avgSelectedMonthAverage)}</p>
              <p className="text-xs text-muted-foreground">Tap to change month</p>
            </button>
            <div className="text-center p-4 rounded-lg border bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800">
              <TrendingUp className="text-purple-500 dark:text-purple-300 text-xl sm:text-2xl mb-2 mx-auto" />
              <p className="text-xs sm:text-sm font-medium text-foreground/80">Highest Day</p>
              <p className="text-lg sm:text-xl font-bold text-foreground">{CURRENCIES[currency].symbol}{formatAmountDisplay(monthlyHighest)}</p>
              <p className="text-xs text-muted-foreground">
                {highestDayName && highestDayDate ? `${highestDayName}, ${highestDayDate}` : 'This month'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Range selection dialog */}
      <Dialog open={rangeDialogOpen} onOpenChange={setRangeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select total range</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setTotalRange({ mode: 'week' }); setRangeDialogOpen(false); }}
                className="p-3 rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-left hover:opacity-90"
              >
                <div className="text-xs text-foreground/80">Quick</div>
                <div className="text-sm font-semibold">Total This Week</div>
              </button>
              <button
                type="button"
                onClick={() => { setTotalRange({ mode: 'lastNDays', days: 2 }); setRangeDialogOpen(false); }}
                className="p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-left hover:opacity-90"
              >
                <div className="text-xs text-foreground/80">Quick</div>
                <div className="text-sm font-semibold">Total of last 2 days</div>
              </button>
              <button
                type="button"
                onClick={() => { setTotalRange({ mode: 'lastNDays', days: 3 }); setRangeDialogOpen(false); }}
                className="p-3 rounded-lg border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-left hover:opacity-90"
              >
                <div className="text-xs text-foreground/80">Quick</div>
                <div className="text-sm font-semibold">Total of last 3 days</div>
              </button>
              <button
                type="button"
                onClick={() => { setTotalRange({ mode: 'lastNDays', days: 4 }); setRangeDialogOpen(false); }}
                className="p-3 rounded-lg border bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800 text-left hover:opacity-90"
              >
                <div className="text-xs text-foreground/80">Quick</div>
                <div className="text-sm font-semibold">Total of last 4 days</div>
              </button>
              <button
                type="button"
                onClick={() => { setTotalRange({ mode: 'lastNDays', days: 5 }); setRangeDialogOpen(false); }}
                className="p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-left hover:opacity-90"
              >
                <div className="text-xs text-foreground/80">Quick</div>
                <div className="text-sm font-semibold">Total of last 5 days</div>
              </button>
              <div className="p-3 rounded-lg border bg-muted/40 border-border">
                <div className="text-xs text-foreground/80 mb-2">Custom</div>
                <UICalendar
                  mode="single"
                  selected={rangeStart}
                  onSelect={(d) => {
                    if (!d) return;
                    // Limit to last 3 months from today
                    const today = new Date();
                    const limit = new Date(today);
                    limit.setMonth(limit.getMonth() - 3);
                    limit.setDate(1); // first of month
                    if (d < limit) return;
                    setTotalRange({ mode: 'custom', startDate: formatDate(d) });
                    setRangeDialogOpen(false);
                  }}
                  disabled={(date) => {
                    const today = new Date();
                    const limit = new Date(today);
                    limit.setMonth(limit.getMonth() - 3);
                    limit.setDate(1);
                    return date < limit || date > new Date(selectedDate);
                  }}
                  initialFocus
                />
                <div className="mt-2 text-xs text-muted-foreground">Select a start date (up to last 3 months)</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Month selection dialog */}
      <Dialog open={monthDialogOpen} onOpenChange={setMonthDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="p-2 rounded-md hover:bg-accent"
                onClick={() => setMonthYearView((y) => y - 1)}
                disabled={monthYearView <= 2000}
                title="Previous year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <DialogTitle className="text-base">{monthYearView}</DialogTitle>
              <button
                type="button"
                className="p-2 rounded-md hover:bg-accent"
                onClick={() => setMonthYearView((y) => Math.min(y + 1, nowYear))}
                disabled={monthYearView >= nowYear}
                title="Next year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }).map((_, idx) => {
              const year = monthYearView;
              const monthIdx = idx;
              const label = new Date(year, monthIdx, 1).toLocaleDateString('en-US', { month: 'short' });
              const key = `${year}-${monthIdx}`;
              const isDisabled = year < 2000 || (year === nowYear && monthIdx > nowMonthIdx);
              const isSelected = key === selectedMonthKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (isDisabled) {
                      alert('Please select a month from year 2000 onwards, not in the future.');
                      return;
                    }
                    setSelectedMonthKey(key);
                    setMonthDialogOpen(false);
                  }}
                  disabled={isDisabled}
                  className={`p-3 rounded-lg border text-center hover:opacity-90 ${isSelected ? 'bg-blue-100 dark:bg-blue-900/40 border-blue-300 dark:border-blue-700' : 'bg-card border-border'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="text-sm font-semibold">{label}</div>
                </button>
              );
            })}
          </div>
          <div className="pt-3 text-xs text-muted-foreground">Months available from Jan 2000 to current. Use the arrows to navigate years.</div>
        </DialogContent>
      </Dialog>

      {/* Average month selection dialog */}
      <Dialog open={avgMonthDialogOpen} onOpenChange={setAvgMonthDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="p-2 rounded-md hover:bg-accent"
                onClick={() => setAvgMonthYearView((y) => y - 1)}
                disabled={avgMonthYearView <= 2000}
                title="Previous year"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <DialogTitle className="text-base">{avgMonthYearView}</DialogTitle>
              <button
                type="button"
                className="p-2 rounded-md hover:bg-accent"
                onClick={() => setAvgMonthYearView((y) => Math.min(y + 1, nowYear))}
                disabled={avgMonthYearView >= nowYear}
                title="Next year"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }).map((_, idx) => {
              const year = avgMonthYearView;
              const monthIdx = idx;
              const label = new Date(year, monthIdx, 1).toLocaleDateString('en-US', { month: 'short' });
              const key = `${year}-${monthIdx}`;
              const isDisabled = year < 2000 || (year === nowYear && monthIdx > nowMonthIdx);
              const isSelected = key === avgSelectedMonthKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (isDisabled) {
                      alert('Please select a month from year 2000 onwards, not in the future.');
                      return;
                    }
                    setAvgSelectedMonthKey(key);
                    setAvgMonthDialogOpen(false);
                  }}
                  disabled={isDisabled}
                  className={`p-3 rounded-lg border text-center hover:opacity-90 ${isSelected ? 'bg-green-100 dark:bg-green-900/40 border-green-300 dark:border-green-700' : 'bg-card border-border'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="text-sm font-semibold">{label}</div>
                </button>
              );
            })}
          </div>
          <div className="pt-3 text-xs text-muted-foreground">Months available from Jan 2000 to current. Use the arrows to navigate years.</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
