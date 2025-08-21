import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertCategorySchema } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { createCategory, deleteCategory, updateCategory } from "@/lib/localStorage";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
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
        deleteCategory(id);
        return { success: true };
      } catch (error) {
        throw new Error('Failed to delete category');
      }
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-totals"] });
      toast({ title: "Success", description: "Category deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete category", variant: "destructive" });
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
    } finally {
      setEditingId(null);
      setEditingName("");
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
                    className="text-left text-sm font-medium text-foreground truncate"
                    onClick={() => { setEditingId(category.id); setEditingName(category.name); }}
                    title="Click to rename"
                  >
                    {category.name}
                  </button>
                )}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-700 text-sm p-1 sm:p-2 flex-shrink-0"
                onClick={() => deleteCategoryMutation.mutate(category.id)}
                disabled={deleteCategoryMutation.isPending}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
