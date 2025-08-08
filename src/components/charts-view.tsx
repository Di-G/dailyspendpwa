import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getToday } from "@/lib/date-utils";
import { RefreshCw, TrendingUp, Calculator, BarChart3 } from "lucide-react";
import type { Category } from "@shared/schema";

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
  const pieChartRef = useRef<HTMLCanvasElement>(null);
  const barChartRef = useRef<HTMLCanvasElement>(null);
  const pieChartInstance = useRef<any>(null);
  const barChartInstance = useRef<any>(null);

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

  // Generate last 7 days from selected date
  const getLast7Days = (date: string) => {
    const days = [];
    const currentDate = new Date(date);
    for (let i = 6; i >= 0; i--) {
      const day = new Date(currentDate);
      day.setDate(currentDate.getDate() - i);
      days.push({
        date: day.toISOString().split('T')[0],
        label: day.toLocaleDateString('en-US', { weekday: 'short' })
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

  const initializeCharts = () => {
    if (!window.Chart) return;

    // Destroy existing charts
    if (pieChartInstance.current) {
      pieChartInstance.current.destroy();
    }
    if (barChartInstance.current) {
      barChartInstance.current.destroy();
    }

    // Pie Chart
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
    }

    // Bar Chart
    if (barChartRef.current) {
      const ctx = barChartRef.current.getContext('2d');
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
    }
  };

  useEffect(() => {
    const timer = setTimeout(initializeCharts, 100);
    return () => clearTimeout(timer);
  }, [categoryTotals]);

  const updateCharts = () => {
    initializeCharts();
  };

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
    <div className="space-y-6">
      {/* Charts Header with Date Selector */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 sm:mb-0">Expense Analytics</h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Select Date:</label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <Button
                onClick={updateCharts}
                className="bg-primary text-white hover:bg-blue-700 transition duration-200"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Update Charts
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Charts Container */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Distribution</h3>
            <div className="relative h-64">
              <canvas ref={pieChartRef} className="w-full h-full"></canvas>
            </div>
            <div className="mt-4 space-y-2">
              {categoryTotals.map((ct) => {
                const percentage = totalExpense > 0 ? ((ct.total / totalExpense) * 100).toFixed(0) : 0;
                return (
                  <div key={ct.categoryId} className="flex items-center justify-between text-sm">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: ct.category.color }}
                      ></div>
                      <span>{ct.category.name}</span>
                    </div>
                    <span className="font-medium">{CURRENCIES[currency].symbol}{ct.total.toFixed(2)} ({percentage}%)</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Comparison</h3>
            <div className="relative h-64">
              <canvas ref={barChartRef} className="w-full h-full"></canvas>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Overview */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <TrendingUp className="text-red-500 text-2xl mb-2 mx-auto" />
              <p className="text-sm font-medium text-gray-700">Highest Day</p>
              <p className="text-xl font-bold text-gray-900">{CURRENCIES[currency].symbol}{monthlyHighest.toFixed(2)}</p>
              <p className="text-xs text-gray-500">
                {highestDayName && highestDayDate ? `${highestDayName}, ${highestDayDate}` : 'This month'}
              </p>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <BarChart3 className="text-green-500 text-2xl mb-2 mx-auto" />
              <p className="text-sm font-medium text-gray-700">Average Daily</p>
              <p className="text-xl font-bold text-gray-900">{CURRENCIES[currency].symbol}{monthlyAverage.toFixed(2)}</p>
              <p className="text-xs text-gray-500">This month</p>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <Calculator className="text-blue-500 text-2xl mb-2 mx-auto" />
              <p className="text-sm font-medium text-gray-700">Selected Date Total</p>
              <p className="text-xl font-bold text-gray-900">{CURRENCIES[currency].symbol}{dailyTotal.total.toFixed(2)}</p>
              <p className="text-xs text-gray-500">{selectedDate}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
