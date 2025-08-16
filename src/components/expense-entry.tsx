import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertExpenseSchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { createExpense, deleteExpense, updateExpense, restoreExpense } from "@/lib/localStorage";
import { getToday, getYesterday, formatDisplayDate, formatDate } from "@/lib/date-utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Plus, Trash2, Pencil } from "lucide-react";
import type { ExpenseWithCategory, Category } from "@shared/schema";
import { z } from "zod";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatAmountDisplay } from "@/lib/utils";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";


const CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar" },
  INR: { symbol: "₹", name: "Indian Rupee" }
} as const;

type CurrencyCode = keyof typeof CURRENCIES;

interface ExpenseEntryProps {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  focusAmountTrigger?: number | null;
  onFocusAmountConsumed?: () => void;
  isFriendMode?: boolean;
  friendData?: any;
  selectedFriend?: any;
}

export default function ExpenseEntry({ 
  currency, 
  setCurrency, 
  focusAmountTrigger, 
  onFocusAmountConsumed,
  isFriendMode = false,
  friendData,
  selectedFriend
}: ExpenseEntryProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [selectedDate, setSelectedDate] = useState(getToday());
  const today = getToday();
  const amountInputRef = useRef<HTMLInputElement | null>(null);
  const addExpenseSectionRef = useRef<HTMLDivElement | null>(null);
  const handledTriggerRef = useRef<number | null>(null);
  
  // Calculate yesterday relative to selected date
  const getYesterdayForDate = (date: string) => {
    const d = new Date(date);
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  };
  
  const yesterday = getYesterdayForDate(selectedDate);

  // Queries
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories", { userId: user?.uid }],
    staleTime: 0, // Always fetch fresh data
  });

  // In friend mode, use friend's data instead of local data
  const { data: selectedDateExpenses = [] } = useQuery<ExpenseWithCategory[]>({
    queryKey: ["/api/expenses", { date: selectedDate, userId: user?.uid }],
    enabled: !isFriendMode, // Only query local data when not in friend mode
  });

  const { data: selectedDateTotal = { total: 0 } } = useQuery<{ total: number }>({
    queryKey: ["/api/analytics/daily-total", { date: selectedDate, userId: user?.uid }],
    enabled: !isFriendMode,
  });

  const { data: yesterdayTotal = { total: 0 } } = useQuery<{ total: number }>({
    queryKey: ["/api/analytics/daily-total", { date: yesterday, userId: user?.uid }],
    enabled: !isFriendMode,
  });

  const { data: categoryTotals = [] } = useQuery<Array<{ categoryId: string; total: number; category: Category }>>({
    queryKey: ["/api/analytics/category-totals", { date: selectedDate, userId: user?.uid }],
    enabled: !isFriendMode,
  });

  // Friend mode data
  const friendExpenses = isFriendMode && friendData?.expenses 
    ? friendData.expenses.filter((expense: any) => expense.date === selectedDate)
    : [];
  
  const friendTotal = isFriendMode && friendExpenses.length > 0
    ? friendExpenses.reduce((sum: number, expense: any) => sum + parseFloat(expense.amount), 0)
    : 0;

  const friendCategoryTotals = isFriendMode && friendExpenses.length > 0
    ? Object.values(friendExpenses.reduce((acc: any, expense: any) => {
        const categoryId = expense.categoryId || 'uncategorized';
        if (!acc[categoryId]) {
          acc[categoryId] = { categoryId, total: 0, category: null };
        }
        acc[categoryId].total += parseFloat(expense.amount);
        return acc;
      }, {}))
    : [];

  // Use friend data when in friend mode
  const expenses = isFriendMode ? friendExpenses : selectedDateExpenses;
  const total = isFriendMode ? friendTotal : selectedDateTotal.total;
  const categoryTotalsData = isFriendMode ? friendCategoryTotals : categoryTotals;

  // Mutations
  const addExpenseMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        return createExpense(data, user?.uid);
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
        // Find the expense before deleting it for undo functionality
        const expenseToDelete = expenses.find((exp: ExpenseWithCategory) => exp.id === id);
        if (expenseToDelete) {
          setDeletedExpense(expenseToDelete);
        }
        
        deleteExpense(id, user?.uid);
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
      
      // Show success toast with undo button
      toast({
        title: "Success",
        description: "Expense deleted successfully",
        action: (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleUndo()}
            className="ml-2"
          >
            Undo
          </Button>
        ),
      });
      
      // Set timeout to clear deleted expense after 10 seconds
      const timeout = setTimeout(() => {
        setDeletedExpense(null);
      }, 10000);
      setUndoTimeout(timeout);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete expense", variant: "destructive" });
    },
  });

  // Edit dialog state
  const [editingExpense, setEditingExpense] = useState<ExpenseWithCategory | null>(null);
  const [editFields, setEditFields] = useState<{
    name: string;
    amount: string;
    details: string;
    categoryId: string;
  } | null>(null);
  
  // Additional details visibility state
  const [showAddDetails, setShowAddDetails] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  
  // Undo delete state
  const [deletedExpense, setDeletedExpense] = useState<ExpenseWithCategory | null>(null);
  const [undoTimeout, setUndoTimeout] = useState<NodeJS.Timeout | null>(null);
  


  const openEdit = (expense: ExpenseWithCategory) => {
    setEditingExpense(expense);
    setEditFields({
      name: expense.name,
      amount: expense.amount,
      details: expense.details || "",
      categoryId: expense.categoryId || "",
    });
    setShowEditDetails(!!expense.details); // Show details if expense has details
  };

  const closeEdit = () => {
    setEditingExpense(null);
    setEditFields(null);
    setShowEditDetails(false);
  };

  const handleUndo = () => {
    if (deletedExpense) {
      // Restore the expense
      restoreExpense(deletedExpense, user?.uid);
      
      // Clear the undo state
      setDeletedExpense(null);
      if (undoTimeout) {
        clearTimeout(undoTimeout);
        setUndoTimeout(null);
      }
      
      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
      
      // Show success toast
      toast({ title: "Success", description: "Expense restored successfully" });
    }
  };

  const updateExpenseMutation = useMutation({
    mutationFn: async (payload: { id: string; updates: any }) => {
      const result = updateExpense(payload.id, payload.updates, user?.uid);
      if (!result) throw new Error("Failed to update expense");
      return result;
    },
    onSuccess: () => {
      // Invalidate all expense-related queries so all views update
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-totals"] });
      toast({ title: "Success", description: "Expense updated successfully" });
      closeEdit();
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update expense", variant: "destructive" });
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeout) {
        clearTimeout(undoTimeout);
      }
    };
  }, [undoTimeout]);

  // When triggered, scroll to the add expense section and focus the amount input
  useEffect(() => {
    if (
      typeof focusAmountTrigger === "number" &&
      focusAmountTrigger > 0 &&
      focusAmountTrigger !== handledTriggerRef.current
    ) {
      addExpenseSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      // Focus immediately and once more after scrolling finishes
      amountInputRef.current?.focus({ preventScroll: true });
      const id = window.setTimeout(() => {
        amountInputRef.current?.focus({ preventScroll: true });
      }, 350);
      handledTriggerRef.current = focusAmountTrigger;
      // Inform parent to clear the trigger so it does not re-run on return to Home
      onFocusAmountConsumed?.();
      return () => window.clearTimeout(id);
    }
  }, [focusAmountTrigger]);

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

  // Removed auto-generation on viewing other dates. Recurring is processed centrally at midnight or on app start.

  // Compute change vs yesterday
  const todayTotalValue = selectedDateTotal.total || 0;
  const yesterdayTotalValue = yesterdayTotal.total || 0;
  const diffValue = todayTotalValue - yesterdayTotalValue;
  const absDiffValue = Math.abs(diffValue);
  const percentChange = yesterdayTotalValue > 0 ? (diffValue / yesterdayTotalValue) * 100 : null;
  const changeColorClass = diffValue > 0
    ? "text-red-600"
    : diffValue < 0
      ? "text-green-600"
      : "text-gray-500";

  const changeText = (() => {
    if (diffValue === 0) return "No change vs yesterday";
    if (percentChange === null) {
      return `${diffValue > 0 ? "+" : "-"}${CURRENCIES[currency].symbol}${formatAmountDisplay(absDiffValue)} vs yesterday`;
    }
    return `${diffValue > 0 ? "+" : "-"}${Math.abs(percentChange).toFixed(1)}% (${diffValue > 0 ? "+" : "-"}${CURRENCIES[currency].symbol}${formatAmountDisplay(absDiffValue)}) vs yesterday`;
  })();

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
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-1">
                {selectedDate === today ? "Today's Expenses" : "Expense list"}
              </h2>
              {selectedDate !== today && (
                <p className="text-xs text-muted-foreground mb-1">
                  {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                </p>
              )}
              <DatePicker
                value={selectedDate}
                onChange={setSelectedDate}
                className="h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center sm:space-x-6 gap-4 sm:gap-0">
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Yesterday</p>
                <p className="text-lg sm:text-xl font-semibold text-foreground">{CURRENCIES[currency].symbol}{formatAmountDisplay(yesterdayTotal.total)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                  {selectedDate === today ? "Today" : "Selected Date"}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-primary">{CURRENCIES[currency].symbol}{formatAmountDisplay(selectedDateTotal.total)}</p>
                <p className={`mt-1 text-[10px] sm:text-xs font-medium ${changeColorClass.replace('text-gray-500','text-muted-foreground')}`}>
                  {changeText}
                </p>
              </div>
            </div>
          </div>

          {/* Categories Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
            {categoriesLoading ? (
              <div className="col-span-2 sm:col-span-4 text-center py-4">
                <p className="text-sm text-muted-foreground">Loading categories...</p>
              </div>
            ) : categories.length === 0 ? (
              <div className="col-span-2 sm:col-span-4 text-center py-4">
                <p className="text-sm text-muted-foreground">No categories available</p>
              </div>
            ) : (
              categories.map((category) => {
                const categoryTotal = categoryTotalsData.find((ct: any) => ct.categoryId === category.id);
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
                    <p className="text-xs font-medium text-muted-foreground truncate">{category.name}</p>
                    <p className="text-xs sm:text-sm font-semibold text-foreground">
                      {CURRENCIES[currency].symbol}{formatAmountDisplay((categoryTotal as any)?.total || 0)}
                    </p>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Add Expense Form - Hidden in friend mode */}
        {!isFriendMode && (
          <div className="lg:col-span-2" ref={addExpenseSectionRef}>
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Add New Expense</h3>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Amount ({CURRENCIES[currency].symbol})</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                placeholder="0.00"
                                {...field}
                                ref={(el) => {
                                  field.ref(el);
                                  amountInputRef.current = el;
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                    <div className="space-y-3">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setShowAddDetails(!showAddDetails)}
                        className="w-full justify-start text-gray-600 hover:text-gray-900 p-0 h-auto font-normal"
                      >
                        <span className="text-sm">Additional Details (Optional)</span>
                      </Button>
                      {showAddDetails && (
                        <FormField
                          control={form.control}
                          name="details"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  placeholder="Add any additional notes about this expense..."
                                  rows={3}
                                  {...field}
                                  className="transition-all duration-200 ease-in-out"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
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
        )}

        {/* Friend mode info card */}
        {isFriendMode && (
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-4 sm:p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">
                  Viewing {selectedFriend?.displayName || 'Friend'}'s Expenses
                </h3>
                <p className="text-muted-foreground mb-4">
                  You can view {selectedFriend?.displayName || 'your friend'}'s expenses for different dates. Use the calendar to navigate between dates.
                </p>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>• Expenses are read-only</span>
                  <span>• Use the + button to import expenses</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings removed from home. Manage categories moved to Settings drawer. */}
      </div>

      {/* Selected Date Expenses List */}
      <Card>
        <div className="p-4 sm:p-6 border-b border">
          <h3 className="text-lg font-semibold text-foreground">
            {isFriendMode 
              ? `${selectedFriend?.displayName || 'Friend'}'s ${selectedDate === today ? "Today's" : ""} Expense List`
              : selectedDate === today ? "Today's Expense List" : "Expense list"
            }
          </h3>
          {selectedDate !== today && (
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
        <CardContent className="p-4 sm:p-6">
          {expenses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>
                {isFriendMode 
                  ? `${selectedFriend?.displayName || 'Your friend'} has no expenses for this date.`
                  : "No expenses added for this date. Start by adding your first expense above."
                }
              </p>
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden space-y-2">
              {expenses.map((expense: ExpenseWithCategory) => (
                <div
                  key={expense.id}
                  className="w-full text-left p-4 rounded-lg bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                  onClick={() => !isFriendMode && openEdit(expense)}
                >
                  {/* Expense content - non-editable in friend mode */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-medium text-foreground truncate">{expense.name}</h4>
                        {expense.category && (
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: expense.category.color }}
                          />
                        )}
                      </div>
                      {expense.details && (
                        <p className="text-sm text-muted-foreground mb-1">{expense.details}</p>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <p className="text-lg font-semibold text-foreground">
                        {CURRENCIES[currency].symbol}{formatAmountDisplay(parseFloat(expense.amount))}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Expense Dialog */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <DialogContent className="sm:max-w-md -mt-16 sm:mt-0">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          {editFields && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground/80">Amount ({CURRENCIES[currency].symbol})</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editFields.amount}
                    onChange={(e) => setEditFields({ ...editFields, amount: e.target.value })}
                  />
                </div>
                <div>
                <label className="text-sm font-medium text-foreground/80">Expense Name</label>
                  <Input
                    value={editFields.name}
                    onChange={(e) => setEditFields({ ...editFields, name: e.target.value })}
                  />
                </div>
              </div>
              <div>
              <label className="text-sm font-medium text-foreground/80">Category</label>
                <Select
                  onValueChange={(val) => setEditFields({ ...editFields, categoryId: val })}
                  value={editFields.categoryId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center">
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: category.color }} />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowEditDetails(!showEditDetails)}
                  className="w-full justify-start text-gray-600 hover:text-gray-900 p-0 h-auto font-normal"
                >
                  <span className="text-sm">Additional Details</span>
                </Button>
                {showEditDetails && (
                  <Textarea
                    rows={3}
                    value={editFields.details}
                    onChange={(e) => setEditFields({ ...editFields, details: e.target.value })}
                    className="transition-all duration-200 ease-in-out"
                  />
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-row justify-end gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (!editingExpense) return;
                deleteExpenseMutation.mutate(editingExpense.id);
                closeEdit();
              }}
              disabled={deleteExpenseMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleteExpenseMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!editingExpense || !editFields) return;
                const amount = parseFloat(editFields.amount);
                if (isNaN(amount) || amount <= 0) {
                  toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
                  return;
                }
                updateExpenseMutation.mutate({
                  id: editingExpense.id,
                  updates: {
                    name: editFields.name,
                    amount: amount.toString(),
                    details: editFields.details.trim() === "" ? null : editFields.details,
                    categoryId: editFields.categoryId ? editFields.categoryId : null,
                },
              });
            }}
            disabled={updateExpenseMutation.isPending}
            className="bg-primary hover:bg-blue-700"
          >
            {updateExpenseMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
