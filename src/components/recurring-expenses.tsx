import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Edit, Plus, Calendar, Repeat } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getCategories, getRecurringExpensesWithCategories, createRecurringExpense, updateRecurringExpense, deleteRecurringExpense, toggleRecurringExpense } from "@/lib/localStorage";
import { InsertRecurringExpense, RecurringExpenseWithCategory, Category } from "@shared/schema";
import { formatDate } from "@/lib/date-utils";

interface RecurringExpensesProps {
  currency: "USD" | "INR";
}

export default function RecurringExpenses({ currency }: RecurringExpensesProps) {
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpenseWithCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<InsertRecurringExpense>({
    name: "",
    amount: "",
    details: "",
    categoryId: "",
    frequency: "monthly",
    customDays: undefined,
    startDate: formatDate(new Date()),
    endDate: "",
  });
  const { toast } = useToast();

  const CURRENCIES = {
    USD: { symbol: "$", name: "US Dollar" },
    INR: { symbol: "₹", name: "Indian Rupee" }
  } as const;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setCategories(getCategories());
    setRecurringExpenses(getRecurringExpensesWithCategories());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.amount || !formData.startDate) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    // Disallow start date before today
    const todayStr = formatDate(new Date());
    if (formData.startDate < todayStr) {
      toast({
        title: "Validation Error",
        description: "Start date cannot be in the past.",
        variant: "destructive",
      });
      return;
    }

    if (formData.frequency === "custom" && !formData.customDays) {
      toast({
        title: "Validation Error",
        description: "Please specify the number of days for custom frequency.",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingId) {
        updateRecurringExpense(editingId, formData);
        toast({
          title: "Success",
          description: "Recurring expense updated successfully.",
        });
      } else {
        createRecurringExpense(formData);
        toast({
          title: "Success",
          description: "Recurring expense created successfully.",
        });
      }
      
      resetForm();
      loadData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save recurring expense.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (expense: RecurringExpenseWithCategory) => {
    setEditingId(expense.id);
    setFormData({
      name: expense.name,
      amount: expense.amount,
      details: expense.details || "",
      categoryId: expense.categoryId || "",
      frequency: expense.frequency,
      customDays: expense.customDays,
      startDate: expense.startDate,
      endDate: expense.endDate || "",
    });
    setIsAddingNew(true);
  };

  const handleDelete = (id: string) => {
    setPendingDeleteId(id);
    setShowDeleteDialog(true);
  };

  const handleToggle = (id: string) => {
    toggleRecurringExpense(id);
    loadData();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      amount: "",
      details: "",
      categoryId: "",
      frequency: "monthly",
      customDays: undefined,
      startDate: formatDate(new Date()),
      endDate: "",
    });
    setEditingId(null);
    setIsAddingNew(false);
  };

  const getFrequencyLabel = (frequency: string, customDays?: number) => {
    switch (frequency) {
      case "daily":
        return "Daily";
      case "weekly":
        return "Weekly";
      case "monthly":
        return "Monthly";
      case "custom":
        return `Every ${customDays} days`;
      default:
        return frequency;
    }
  };

  const getNextOccurrence = (expense: RecurringExpenseWithCategory): string => {
    const today = new Date();
    const startDate = new Date(expense.startDate);
    
    if (today < startDate) {
      return formatDate(startDate);
    }

    let nextDate = new Date(startDate);
    
    while (nextDate <= today) {
      switch (expense.frequency) {
        case "daily":
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case "weekly":
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case "monthly":
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case "custom":
          if (expense.customDays) {
            nextDate.setDate(nextDate.getDate() + expense.customDays);
          }
          break;
      }
    }
    
    return formatDate(nextDate);
  };

  return (
    <div className="space-y-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Recurring Expenses</h2>
          <p className="text-muted-foreground">Manage your recurring expenses and subscriptions</p>
        </div>
        <Button
          onClick={() => setIsAddingNew(true)}
          aria-label="Add Recurring"
          className="bg-primary hover:bg-blue-700 px-3 py-2 sm:px-4 sm:py-3 text-sm sm:text-base min-w-0"
        >
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Add/Edit Form */}
      {isAddingNew && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? "Edit Recurring Expense" : "Add New Recurring Expense"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Netflix Subscription"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount *</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="details">Details</Label>
                <Input
                  id="details"
                  value={formData.details}
                  onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                  placeholder="Optional description"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.categoryId}
                    onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <div className="flex items-center">
                            <div
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: category.color }}
                            />
                            {category.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequency *</Label>
                  <Select
                    value={formData.frequency}
                    onValueChange={(value: any) => setFormData({ ...formData, frequency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.frequency === "custom" && (
                <div className="space-y-2">
                  <Label htmlFor="customDays">Every X Days *</Label>
                  <Input
                    id="customDays"
                    type="number"
                    min="1"
                    value={formData.customDays || ""}
                    onChange={(e) => setFormData({ ...formData, customDays: parseInt(e.target.value) || undefined })}
                    placeholder="e.g., 14 for every 2 weeks"
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date *</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    min={formatDate(new Date())}
                    className="bg-card text-foreground"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date (Optional)</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    min={formData.startDate}
                    className="bg-card text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button type="submit" className="bg-primary hover:bg-blue-700">
                  {editingId ? "Update" : "Create"}
                </Button>
                {editingId && (
                  <Button type="button" variant="destructive" onClick={() => handleDelete(editingId!)}>
                    Delete
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Recurring Expense</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the recurring expense.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setShowDeleteDialog(false); setPendingDeleteId(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDeleteId) {
                  deleteRecurringExpense(pendingDeleteId);
                  loadData();
                  resetForm();
                  toast({ title: "Success", description: "Recurring expense deleted successfully." });
                }
                setShowDeleteDialog(false);
                setPendingDeleteId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Recurring Expenses List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Active Recurring Expenses</h3>
        
        {recurringExpenses.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Repeat className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h4 className="text-lg font-medium text-foreground mb-2">No Recurring Expenses</h4>
              <p className="text-muted-foreground">Create your first recurring expense to get started.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {recurringExpenses.map((expense) => (
              <Card key={expense.id}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2 min-w-0">
                        <h4 className="font-medium text-foreground truncate">{expense.name}</h4>
                      </div>
                      
                      <div className="flex items-center space-x-4 text-sm text-muted-foreground min-w-0">
                        <span className="flex items-center">
                          <span className="font-medium text-gray-900">
                            {CURRENCIES[currency].symbol}{expense.amount}
                          </span>
                        </span>
                        
                        {expense.category && (
                          <span className="flex items-center">
                            <div
                              className="w-3 h-3 rounded-full mr-1"
                              style={{ backgroundColor: expense.category.color }}
                            />
                            {expense.category.name}
                          </span>
                        )}
                      </div>
                      
                      {expense.details && (
                        <p className="text-sm text-muted-foreground mt-2 break-words">{expense.details}</p>
                      )}
                      
                      <div className="mt-3 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={expense.isActive ? "default" : "secondary"}>
                            {expense.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="outline">
                            {getFrequencyLabel(expense.frequency, expense.customDays)}
                          </Badge>
                        </div>
                        {expense.endDate && (
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4 mr-1" />
                            Ends: {formatDate(new Date(expense.endDate))}
                          </div>
                        )}
                        <div className="text-sm text-muted-foreground">
                          Next occurrence: {getNextOccurrence(expense)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4 shrink-0">
                      <Switch
                        checked={expense.isActive}
                        onCheckedChange={() => handleToggle(expense.id)}
                      />
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(expense)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
