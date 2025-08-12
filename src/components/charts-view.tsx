import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getToday, formatDate } from "@/lib/date-utils";
import { RefreshCw, TrendingUp, Calculator, BarChart3 } from "lucide-react";
import { Button as UIButton } from "@/components/ui/button";
import type { Category } from "@shared/schema";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatAmountDisplay } from "@/lib/utils";

declare global {
  interface Window {
    Chart: any;
  }
}

interface ChartsViewProps {
  currency: "USD" | "INR";
}

export default function ChartsView({ currency }: ChartsViewProps) {
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [chartsReady, setChartsReady] = useState(false);
  const [weeklyChartOffset, setWeeklyChartOffset] = useState(0); // Simple offset for sliding
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartInstance = useRef<any>(null);
  const barChartInstance = useRef<any>(null);
  const isMobile = useIsMobile();

  const CURRENCIES = {
    USD: { symbol: "$", name: "US Dollar" },
    INR: { symbol: "₹", name: "Indian Rupee" }
  } as const;

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

  // Generate sliding weeks from selected date
  const getSlidingWeeks = (date: string, offset: number) => {
    const days = [];
    const currentDate = new Date(date);
    // Start from offset days ago
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - offset);
    
    for (let i = 6; i >= 0; i--) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() - i);
      days.push({
        date: formatDate(day),
        label: day.toLocaleDateString('en-US', { weekday: 'short' }),
        fullDate: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      });
    }
    return days;
  };

  const weeklyDays = getSlidingWeeks(selectedDate, weeklyChartOffset);
  const weeklyData = weeklyDays.map(day => {
    const dayTotal = weeklyTotals.find(wt => wt.date === day.date);
    return dayTotal ? dayTotal.total : 0;
  });
  const weeklyLabels = weeklyDays.map(day => day.label);

  // Touch/swipe support for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd || isAnimating) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      // Swipe left - go to newer dates
      smoothSlideTo(Math.max(0, weeklyChartOffset - 1));
    } else if (isRightSwipe) {
      // Swipe right - go to older dates
      smoothSlideTo(weeklyChartOffset + 1);
    }
  };

  // Smooth sliding function
  const smoothSlideTo = (newOffset: number) => {
    if (isAnimating) return;
    
    setIsAnimating(true);
    
    // Animate the chart data transition
    if (barChartInstance.current) {
      const chart = barChartInstance.current;
      
      // Get the target data for smooth transition
      const targetDays = getSlidingWeeks(selectedDate, newOffset);
      const targetData = targetDays.map(day => {
        const dayTotal = weeklyTotals.find(wt => wt.date === day.date);
        return dayTotal ? dayTotal.total : 0;
      });
      const targetLabels = targetDays.map(day => day.label);

      // Animate the transition
      chart.data.labels = targetLabels;
      chart.data.datasets[0].data = targetData;
      
      // Use Chart.js animation
      chart.update('active');
    }
    
    // Update the offset after animation
    setTimeout(() => {
      setWeeklyChartOffset(newOffset);
      setIsAnimating(false);
    }, 300); // Match Chart.js animation duration
  };

  // Simple function to go back to newest (today) with smooth animation
  const goToNewest = () => {
    smoothSlideTo(0);
  };

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating) return;
      
      if (e.key === 'ArrowLeft') {
        // Left arrow - go to newer dates
        smoothSlideTo(Math.max(0, weeklyChartOffset - 1));
      } else if (e.key === 'ArrowRight') {
        // Right arrow - go to older dates
        smoothSlideTo(weeklyChartOffset + 1);
      } else if (e.key === 'Home') {
        // Home key - go to newest
        smoothSlideTo(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [weeklyChartOffset, isAnimating]);

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
            borderWidth: 2,
            borderColor: '#ffffff'
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
      barChartInstance.current = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: weeklyLabels,
          datasets: [{
            label: 'Daily Expenses',
            data: weeklyData,
            backgroundColor: '#1976D2',
            borderColor: '#1976D2',
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
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
                color: '#f0f0f0'
              }
            },
            x: {
              grid: {
                display: false
              }
            }
          }
        }
      });
      chartsInitialized = true;
    }

    setChartsReady(chartsInitialized);
  }, [categoryTotals, weeklyTotals, weeklyLabels, weeklyData, currency, weeklyDays]);

  // Reset weekly chart offset when date changes
  useEffect(() => {
    setWeeklyChartOffset(0);
  }, [selectedDate]);

  // Initialize charts when data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      initializeCharts();
    }, 100);
    return () => clearTimeout(timer);
  }, [categoryTotals, weeklyTotals, selectedDate, weeklyChartOffset, initializeCharts]);

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
        barChartInstance.current = new window.Chart(ctx, {
          type: 'bar',
          data: {
            labels: weeklyLabels,
            datasets: [{
              label: 'Daily Expenses',
              data: weeklyData,
              backgroundColor: '#1976D2',
              borderColor: '#1976D2',
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
                  color: '#f0f0f0'
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            }
          }
        });
        console.log('Weekly chart forced render successful');
      }
    }
  }, [weeklyLabels, weeklyData, weeklyChartOffset, currency]);

  const updateCharts = useCallback(() => {
    initializeCharts();
  }, [initializeCharts]);

  const totalExpense = categoryTotals.reduce((sum, ct) => sum + ct.total, 0);
  
  // Calculate real monthly statistics
  const monthlyHighest = monthlyTotals.length > 0 ? Math.max(...monthlyTotals.map(mt => mt.total)) : 0;
  const monthlyAverage = monthlyTotals.length > 0 ? 
    monthlyTotals.reduce((sum, mt) => sum + mt.total, 0) / monthlyTotals.length : 0;
  
  // Find highest day with date and day name
  const highestDayData = monthlyTotals.find(mt => mt.total === monthlyHighest);
  const highestDayName = highestDayData ? 
    new Date(highestDayData.date).toLocaleDateString('en-US', { weekday: 'long' }) : '';
  const highestDayDate = highestDayData ? 
    new Date(highestDayData.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Charts Header with Date Selector */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-4 sm:mb-0">Expense Analytics</h2>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full sm:w-auto">
                <label className="text-sm font-medium text-gray-700">Select Date:</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent w-full sm:w-auto"
                />
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
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Distribution</h3>
            <div className="relative h-48 sm:h-64">
              {categoryTotals.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <TrendingUp className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">No category data available</p>
                    <p className="text-xs text-gray-400">Select a date to view category distribution</p>
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
        <Card>
          <CardContent className="p-4 sm:p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Comparison</h3>
            
            {/* Navigation Controls */}
            <div className="flex items-center justify-end mb-4">
              <Button
                onClick={goToNewest}
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={isAnimating}
              >
                {isAnimating ? '⏳' : 'Newest ⏭️'}
              </Button>
            </div>
            
            <div className="relative h-48 sm:h-64">
              {isAnimating && (
                <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                  <div className="text-blue-600 text-sm">Sliding...</div>
                </div>
              )}
              <canvas 
                ref={barChartRef} 
                className="w-full h-full"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
              ></canvas>
            </div>
            
            {/* Date Range Info */}
            <div className="mt-2 text-xs text-gray-500 text-center">
              Showing: {weeklyDays[0]?.fullDate} - {weeklyDays[6]?.fullDate}
            </div>
            
            {/* Navigation Hints */}
            <div className="mt-2 text-xs text-gray-400 text-center space-y-1">
              {isMobile ? (
                <div>💡 Swipe left/right to navigate through dates</div>
              ) : (
                <div>💡 Use ← → arrow keys or swipe to navigate • Press Home to return to today</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Overview */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Overview</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <TrendingUp className="text-red-500 text-xl sm:text-2xl mb-2 mx-auto" />
              <p className="text-xs sm:text-sm font-medium text-gray-700">Highest Day</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{CURRENCIES[currency].symbol}{formatAmountDisplay(monthlyHighest)}</p>
              <p className="text-xs text-gray-500">
                {highestDayName && highestDayDate ? `${highestDayName}, ${highestDayDate}` : 'This month'}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <BarChart3 className="text-green-500 text-xl sm:text-2xl mb-2 mx-auto" />
              <p className="text-xs sm:text-sm font-medium text-gray-700">Average Daily</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{CURRENCIES[currency].symbol}{formatAmountDisplay(monthlyAverage)}</p>
              <p className="text-xs text-gray-500">This month</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Calculator className="text-blue-500 text-xl sm:text-2xl mb-2 mx-auto" />
              <p className="text-xs sm:text-sm font-medium text-gray-700">Total This Month</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{CURRENCIES[currency].symbol}{formatAmountDisplay(monthlyTotals.reduce((s, mt) => s + mt.total, 0))}</p>
              <p className="text-xs text-gray-500">{selectedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
