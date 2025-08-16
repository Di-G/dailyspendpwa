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

// Recurring expense schema
export const recurringExpenseSchema = z.object({
  id: z.string(),
  name: z.string(),
  amount: z.string(),
  details: z.string().nullable(),
  categoryId: z.string().nullable(),
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
  customDays: z.number().optional(), // for custom frequency
  startDate: z.string(),
  endDate: z.string().nullable(), // null means recurring indefinitely
  isActive: z.boolean(),
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

export const insertRecurringExpenseSchema = z.object({
  name: z.string().min(1, "Recurring expense name is required"),
  amount: z.string().min(1, "Amount is required"),
  details: z.string().optional(),
  categoryId: z.string().optional(),
  frequency: z.enum(["daily", "weekly", "monthly", "custom"]),
  customDays: z.number().optional(),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional(),
});

// Friend management schemas
export const friendSchema = z.object({
  id: z.string(),
  userId: z.string(), // The friend's user ID
  displayName: z.string(),
  email: z.string(),
  addedAt: z.string(),
  isActive: z.boolean(),
});

export const insertFriendSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  displayName: z.string().min(1, "Display name is required"),
  email: z.string().email("Valid email is required"),
});

// TypeScript types
export type Category = z.infer<typeof categorySchema>;
export type Expense = z.infer<typeof expenseSchema>;
export type RecurringExpense = z.infer<typeof recurringExpenseSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type InsertRecurringExpense = z.infer<typeof insertRecurringExpenseSchema>;
export type Friend = z.infer<typeof friendSchema>;
export type InsertFriend = z.infer<typeof insertFriendSchema>;

// Extended types for frontend
export type ExpenseWithCategory = Expense & {
  category?: Category;
};

export type CategoryWithTotal = Category & {
  total: number;
};

export type RecurringExpenseWithCategory = RecurringExpense & {
  category?: Category;
};
