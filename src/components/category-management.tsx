import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { insertCategorySchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { createCategory, deleteCategory, updateCategory, getExpensesCountByCategory } from "@/lib/localStorage";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import type { Category } from "@shared/schema";

const COLOR_OPTIONS = [
  "#EF4444", // red
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // yellow
  "#8B5CF6", // purple
  "#EC4899", // pink
  "#06B6D4", // cyan
];

interface CategoryManagementProps {
  hideHeader?: boolean;
}

export default function CategoryManagement({ hideHeader = false }: CategoryManagementProps) {
  const { toast } = useToast();
  const [selectedColor, setSelectedColor] = useState(COLOR_OPTIONS[0]);
  const [customSwatchColor, setCustomSwatchColor] = useState<string>("#000000");
  const colorInputRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{ id: string; name: string; expenseCount: number } | null>(null);

  // Query
  const { data: categories = [], isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
    staleTime: 0, // Always fetch fresh data
  });

  // Mutations
  const addCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      try {
        return createCategory(data);
      } catch (error) {
        throw new Error('Failed to create category');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: "Success", description: "Category added successfully" });
      form.reset();
      setSelectedColor(COLOR_OPTIONS[0]);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add category", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      try {
        const result = deleteCategory(id);
        return result;
      } catch (error: any) {
        throw new Error(error.message || 'Failed to delete category');
      }
    },
    onSuccess: (result) => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-totals"] });
      
      // Show success message with details about moved expenses
      if (result.movedExpensesCount > 0) {
        toast({ 
          title: "Category deleted successfully", 
          description: `${result.movedExpensesCount} expense${result.movedExpensesCount === 1 ? '' : 's'} from "${result.categoryName}" moved to uncategorized expenses.` 
        });
      } else {
        toast({ 
          title: "Category deleted successfully", 
          description: `"${result.categoryName}" category has been removed.` 
        });
      }
      
      // Close confirmation dialog
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
      setDeleteConfirmOpen(false);
      setCategoryToDelete(null);
    },
  });

  // Form
  const form = useForm({
    resolver: zodResolver(insertCategorySchema),
    defaultValues: {
      name: "",
      color: selectedColor,
    },
  });

  const onSubmit = (data: any) => {
    addCategoryMutation.mutate({
      ...data,
      color: selectedColor,
    });
  };

  const commitRename = (catId: string) => {
    const name = editingName.trim();
    if (!name) {
      setEditingId(null);
      setEditingName("");
      return;
    }
    try {
      updateCategory(catId, { name });
      // Invalidate all relevant queries so the rename reflects everywhere
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-totals"] });
      toast({ title: "Renamed", description: "Category name updated" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to update category", variant: "destructive" });
    } finally {
      setEditingId(null);
      setEditingName("");
    }
  };

  const handleDeleteClick = (category: Category) => {
    if (category.name === 'Uncategorized') return;
    
    const expenseCount = getExpensesCountByCategory(category.id);
    setCategoryToDelete({
      id: category.id,
      name: category.name,
      expenseCount
    });
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = () => {
    if (categoryToDelete) {
      deleteCategoryMutation.mutate(categoryToDelete.id);
    }
  };

  return (
    <div className="space-y-4">
      {!hideHeader && (
      <h3 className="text-lg font-semibold text-foreground">Manage Categories</h3>
      )}
      
      {/* Add New Category */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mb-6">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Groceries" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div>
      <FormLabel className="text-sm font-medium text-foreground/80 mb-2 block">Color</FormLabel>
            <div className="flex space-x-2 overflow-x-auto pb-4 pt-1 -mx-2 px-2 scrollbar-hide">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all duration-200 flex-shrink-0 ${
                    selectedColor === color ? "border-gray-600 scale-105" : "border-transparent hover:border-gray-400"
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
              {/* Custom color swatch (last) */}
              <button
                type="button"
                className={`w-8 h-8 rounded-full border-2 transition-all duration-200 flex-shrink-0 ${
                selectedColor.toLowerCase() === customSwatchColor.toLowerCase() ? "border-muted-foreground scale-105" : "border-dashed border hover:border-muted-foreground"
                }`}
                style={
                  selectedColor.toLowerCase() === customSwatchColor.toLowerCase()
                    ? { backgroundColor: customSwatchColor }
                    : { backgroundImage: 'linear-gradient(90deg, #EF4444, #F59E0B, #10B981, #3B82F6, #8B5CF6, #EC4899)' }
                }
                onClick={() => colorInputRef.current?.click()}
                aria-label="Choose custom color"
                title="Choose custom color"
              />
              <input
                ref={colorInputRef}
                type="color"
                value={customSwatchColor}
                onChange={(e) => {
                  setCustomSwatchColor(e.target.value);
                  setSelectedColor(e.target.value);
                }}
                className="hidden"
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-secondary hover:bg-green-700 transition duration-200 text-sm"
            disabled={addCategoryMutation.isPending}
          >
            <Plus className="w-4 h-4 mr-2" />
            {addCategoryMutation.isPending ? "Adding..." : "Add Category"}
          </Button>
        </form>
      </Form>

      {/* Existing Categories */}
      <div className="space-y-2">
      <h4 className="text-sm font-medium text-foreground/80 mb-3">Existing Categories</h4>
        {categoriesLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Loading categories...</p>
        ) : categories.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No categories created yet</p>
        ) : (
          categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="flex items-center min-w-0 flex-1">
                <div className="w-4 h-4 rounded-full mr-3 flex-shrink-0" style={{ backgroundColor: category.color }} />
                {editingId === category.id ? (
                  <input
                    className="bg-transparent border-b border-border focus:outline-none text-sm flex-1 min-w-0"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => commitRename(category.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename(category.id);
                      if (e.key === 'Escape') { setEditingId(null); setEditingName(''); }
                    }}
                    autoFocus
                  />
                ) : (
                  <button
                    className={`text-left text-sm font-medium truncate ${
                      category.name === 'Uncategorized' 
                        ? 'text-muted-foreground cursor-not-allowed' 
                        : 'text-foreground'
                    }`}
                    onClick={() => { 
                      if (category.name !== 'Uncategorized') {
                        setEditingId(category.id); 
                        setEditingName(category.name); 
                      }
                    }}
                    title={category.name === 'Uncategorized' ? 'Uncategorized category cannot be edited' : 'Click to rename'}
                    disabled={category.name === 'Uncategorized'}
                  >
                    {category.name}
                    {category.name === 'Uncategorized' && (
                      <span className="ml-1 text-xs text-muted-foreground">(Protected)</span>
                    )}
                  </button>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className={`text-sm p-1 sm:p-2 flex-shrink-0 ${
                  category.name === 'Uncategorized'
                    ? 'text-muted-foreground cursor-not-allowed'
                    : 'text-red-500 hover:text-red-700'
                }`}
                onClick={() => handleDeleteClick(category)}
                disabled={deleteCategoryMutation.isPending || category.name === 'Uncategorized'}
                title={category.name === 'Uncategorized' ? 'Uncategorized category cannot be deleted' : 'Delete category'}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Delete Category
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the category "{categoryToDelete?.name}"?
              {categoryToDelete?.expenseCount && categoryToDelete.expenseCount > 0 && (
                <span className="block mt-2 text-sm text-muted-foreground">
                  This will move <strong>{categoryToDelete.expenseCount} expense{categoryToDelete.expenseCount === 1 ? '' : 's'}</strong> from this category to the "Uncategorized" category.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteConfirmOpen(false);
                setCategoryToDelete(null);
              }}
              disabled={deleteCategoryMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteCategoryMutation.isPending}
            >
              {deleteCategoryMutation.isPending ? "Deleting..." : "Delete Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
