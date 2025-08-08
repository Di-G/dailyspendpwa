import { z } from "zod";

// Base schemas for validation
export const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(), // hex color code
  createdAt: z.string(),
});

export const expenseSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.string(),
  details: z.string().nullable(),
  categoryId: z.string().nullable(),
  date: z.string(),
  createdAt: z.string(),
});

// Insert schemas for form validation
export const insertCategorySchema = z.object({
  name: z.string().min(1, "Category name is required"),
  color: z.string().min(1, "Color is required"),
});

export const insertExpenseSchema = z.object({
  name: z.string().min(1, "Expense name is required"),
  amount: z.string().min(1, "Amount is required"),
  details: z.string().optional(),
  categoryId: z.string().optional(),
  date: z.string().min(1, "Date is required"),
});

// TypeScript types
export type Category = z.infer<typeof categorySchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;

// Extended types for frontend
export type ExpenseWithCategory = Expense & {
  category?: Category;
};

export type CategoryWithTotal = Category & {
  total: number;
};
