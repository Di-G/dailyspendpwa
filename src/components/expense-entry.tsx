import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertExpenseSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { createExpense, deleteExpense } from "@/lib/localStorage";
import { getToday, getYesterday, formatDisplayDate } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import type { ExpenseWithCategory, Category } from "@shared/schema";
import { z } from "zod";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatAmountDisplay } from "@/lib/utils";

const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar" },
  INR: { symbol: "₹", name: "Indian Rupee" }
} as const;

type CurrencyCode = keyof typeof CURRENCIES;

interface ExpenseEntryProps {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
}

export default function ExpenseEntry({ currency, setCurrency }: ExpenseEntryProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState(getToday());
  const today = getToday();
  
  // Calculate yesterday relative to selected date
  const getYesterdayForDate = (date: string) => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  };
  
  const yesterday = getYesterdayForDate(selectedDate);

  // Queries
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    staleTime: 0, // Always fetch fresh data
  });

  const { data: selectedDateExpenses = [] } = useQuery<ExpenseWithCategory[]>({
    queryKey: ["/api/expenses", { date: selectedDate }],
  });

  const { data: selectedDateTotal = { total: 0 } } = useQuery<{ total: number }>({
    queryKey: ["/api/analytics/daily-total", { date: selectedDate }],
  });

  const { data: yesterdayTotal = { total: 0 } } = useQuery<{ total: number }>({
    queryKey: ["/api/analytics/daily-total", { date: yesterday }],
  });

  const { data: categoryTotals = [] } = useQuery<Array<{ categoryId: string; total: number; category: Category }>>({
    queryKey: ["/api/analytics/category-totals", { date: selectedDate }],
  });

  // Mutations
  const addExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        return createExpense(data);
      } catch (error) {
        throw new Error('Failed to create expense');
      }
    },
    onSuccess: () => {
      // Invalidate all expense-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
      toast({ title: "Success", description: "Expense added successfully" });
      form.reset({
        name: "",
        amount: "",
        details: "",
        categoryId: "",
        date: selectedDate,
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add expense", variant: "destructive" });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        deleteExpense(id);
        return { success: true };
      } catch (error) {
        throw new Error('Failed to delete expense');
      }
    },
    onSuccess: () => {
      // Invalidate all expense-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
      toast({ title: "Success", description: "Expense deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
    },
  });

  // Form
  const form = useForm({
    resolver: zodResolver(insertExpenseSchema.omit({ amount: true }).extend({
      amount: z.string().min(1, "Amount is required")
    })),
    defaultValues: {
      name: "",
      amount: "",
      details: "",
      categoryId: "",
      date: selectedDate,
    },
  });

  // Update form date when selectedDate changes
  useEffect(() => {
    form.setValue("date", selectedDate);
  }, [selectedDate, form]);

  const onSubmit = (data: any) => {
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    
    addExpenseMutation.mutate({
      ...data,
      amount: amount.toString(),
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Date and Summary Section */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col space-y-4 sm:space-y-0 sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">
                {selectedDate === today ? "Today's Expenses" : "Expenses"}
              </h2>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-primary font-medium cursor-pointer border border-gray-300 rounded px-2 py-1 text-sm hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center sm:space-x-6 gap-4 sm:gap-0">
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-gray-500">Yesterday</p>
                <p className="text-lg sm:text-xl font-semibold text-gray-700">{CURRENCIES[currency].symbol}{formatAmountDisplay(yesterdayTotal.total)}</p>
              </div>
              <div className="text-center col-span-2 sm:col-span-1">
                <p className="text-xs sm:text-sm font-medium text-gray-500">
                  {selectedDate === today ? "Today" : "Selected Date"}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{CURRENCIES[currency].symbol}{formatAmountDisplay(selectedDateTotal.total)}</p>
              </div>
            </div>
          </div>

          {/* Categories Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {categoriesLoading ? (
              <div className="col-span-2 sm:col-span-4 text-center py-4">
                <p className="text-sm text-gray-500">Loading categories...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="col-span-2 sm:col-span-4 text-center py-4">
                <p className="text-sm text-gray-500">No categories available</p>
              </div>
            ) : (
              categories.map((category) => {
                const categoryTotal = categoryTotals.find(ct => ct.categoryId === category.id);
                return (
                  <div
                    key={category.id}
                    className="border rounded-lg p-2 sm:p-3 text-center"
                    style={{
                      backgroundColor: `${category.color}10`,
                      borderColor: `${category.color}40`,
                    }}
                  >
                    <div
                      className="w-3 h-3 sm:w-4 sm:h-4 rounded-full mx-auto mb-1 sm:mb-2"
                      style={{ backgroundColor: category.color }}
                    ></div>
                    <p className="text-xs font-medium text-gray-700 truncate">{category.name}</p>
                    <p className="text-xs sm:text-sm font-semibold text-gray-900">
                      {CURRENCIES[currency].symbol}{formatAmountDisplay(categoryTotal?.total || 0)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Add Expense Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Expense</h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Expense Name</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g., Lunch at cafe" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount ({CURRENCIES[currency].symbol})</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categoriesLoading ? (
                              <SelectItem value="loading" disabled>
                                Loading categories...
                              </SelectItem>
                            ) : categories.length === 0 ? (
                              <SelectItem value="no-categories" disabled>
                                No categories available
                              </SelectItem>
                            ) : (
                              categories.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  <div className="flex items-center">
                                    <div
                                      className="w-3 h-3 rounded-full mr-2"
                                      style={{ backgroundColor: category.color }}
                                    ></div>
                                    {category.name}
                                  </div>
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="details"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Additional Details (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Add any additional notes about this expense..."
                            rows={3}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="submit"
                    className="w-full bg-primary hover:bg-blue-700 transition duration-200"
                    disabled={addExpenseMutation.isPending}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {addExpenseMutation.isPending ? "Adding..." : "Add Expense"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Settings removed from home. Manage categories moved to Settings drawer. */}
      </div>

      {/* Selected Date Expenses List */}
      <Card>
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {selectedDate === today ? "Today's Expense List" : `Expenses for ${formatDisplayDate(selectedDate)}`}
          </h3>
        </div>
        <CardContent className="p-4 sm:p-6">
          {selectedDateExpenses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No expenses added for this date. Start by adding your first expense above.</p>
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-4">
              {selectedDateExpenses.map((expense) => (
                <div
                  key={expense.id}
                  className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition duration-200"
                >
                  <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: expense.category?.color || "#gray" }}
                    ></div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 truncate">{expense.name}</p>
                      {expense.details && (
                        <p className="text-sm text-gray-600 truncate">{expense.details}</p>
                      )}
                      <p className="text-xs text-gray-500">{formatTime(expense.createdAt!.toString())}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 sm:space-x-3 flex-shrink-0">
                    <span className="font-semibold text-gray-900 text-sm sm:text-base">{CURRENCIES[currency].symbol}{formatAmountDisplay(parseFloat(expense.amount))}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 p-1 sm:p-2"
                      onClick={() => deleteExpenseMutation.mutate(expense.id)}
                      disabled={deleteExpenseMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
