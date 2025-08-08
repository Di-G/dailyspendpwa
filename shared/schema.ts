import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull(), // hex color code
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  details: text("details"),
  categoryId: varchar("category_id").references(() => categories.id),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  color: true,
});

export const insertExpenseSchema = createInsertSchema(expenses).pick({
  name: true,
  amount: true,
  details: true,
  categoryId: true,
  date: true,
});

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expenses.$inferSelect;

// Extended types for frontend
export type ExpenseWithCategory = Expense & {
  category?: Category;
};

export type CategoryWithTotal = Category & {
  total: number;
};
