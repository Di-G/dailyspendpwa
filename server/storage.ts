import { type Category, type InsertCategory, type Expense, type InsertExpense, type ExpenseWithCategory } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Categories
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // Expenses
  getExpenses(): Promise<Expense[]>;
  getExpensesByDate(date: string): Promise<ExpenseWithCategory[]>;
  getExpensesByDateRange(startDate: string, endDate: string): Promise<ExpenseWithCategory[]>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  
  // Analytics
  getDailyTotal(date: string): Promise<number>;
  getCategoryTotals(date: string): Promise<{ categoryId: string; total: number; category: Category }[]>;
  getMonthlyTotals(year: number, month: number): Promise<{ date: string; total: number }[]>;
  getWeeklyTotals(date: string): Promise<{ date: string; total: number }[]>;
}

export class MemStorage implements IStorage {
  private categories: Map<string, Category>;
  private expenses: Map<string, Expense>;

  constructor() {
    this.categories = new Map();
    this.expenses = new Map();
    
    // Initialize with default categories
    this.initializeDefaultCategories();
  }

  private async initializeDefaultCategories() {
    const defaultCategories = [
      { name: "Food", color: "#EF4444" },
      { name: "Transport", color: "#3B82F6" },
      { name: "Shopping", color: "#10B981" },
      { name: "Entertainment", color: "#F59E0B" },
    ];

    for (const cat of defaultCategories) {
      await this.createCategory(cat);
    }
  }

  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = randomUUID();
    const category: Category = {
      ...insertCategory,
      id,
      createdAt: new Date(),
    };
    this.categories.set(id, category);
    return category;
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories.delete(id);
  }

  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values());
  }

  async getExpensesByDate(date: string): Promise<ExpenseWithCategory[]> {
    const expenses = Array.from(this.expenses.values()).filter(
      expense => expense.date === date
    );
    
    return expenses.map(expense => ({
      ...expense,
      category: expense.categoryId ? this.categories.get(expense.categoryId) : undefined
    }));
  }

  async getExpensesByDateRange(startDate: string, endDate: string): Promise<ExpenseWithCategory[]> {
    const expenses = Array.from(this.expenses.values()).filter(
      expense => expense.date >= startDate && expense.date <= endDate
    );
    
    return expenses.map(expense => ({
      ...expense,
      category: expense.categoryId ? this.categories.get(expense.categoryId) : undefined
    }));
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const id = randomUUID();
    const expense: Expense = {
      ...insertExpense,
      details: insertExpense.details || null,
      categoryId: insertExpense.categoryId || null,
      id,
      createdAt: new Date(),
    };
    this.expenses.set(id, expense);
    return expense;
  }

  async deleteExpense(id: string): Promise<void> {
    this.expenses.delete(id);
  }

  async getDailyTotal(date: string): Promise<number> {
    const expenses = Array.from(this.expenses.values()).filter(
      expense => expense.date === date
    );
    
    return expenses.reduce((total, expense) => total + parseFloat(expense.amount), 0);
  }

  async getCategoryTotals(date: string): Promise<{ categoryId: string; total: number; category: Category }[]> {
    const expenses = Array.from(this.expenses.values()).filter(
      expense => expense.date === date
    );
    
    const categoryTotals = new Map<string, number>();
    
    expenses.forEach(expense => {
      if (expense.categoryId) {
        const current = categoryTotals.get(expense.categoryId) || 0;
        categoryTotals.set(expense.categoryId, current + parseFloat(expense.amount));
      }
    });
    
    return Array.from(categoryTotals.entries()).map(([categoryId, total]) => ({
      categoryId,
      total,
      category: this.categories.get(categoryId)!
    }));
  }

  async getMonthlyTotals(year: number, month: number): Promise<{ date: string; total: number }[]> {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;
    
    const expenses = Array.from(this.expenses.values()).filter(
      expense => expense.date >= startDate && expense.date <= endDate
    );
    
    const dailyTotals = new Map<string, number>();
    
    expenses.forEach(expense => {
      const current = dailyTotals.get(expense.date) || 0;
      dailyTotals.set(expense.date, current + parseFloat(expense.amount));
    });
    
    return Array.from(dailyTotals.entries()).map(([date, total]) => ({
      date,
      total
    }));
  }

  async getWeeklyTotals(date: string): Promise<{ date: string; total: number }[]> {
    const currentDate = new Date(date);
    const weeklyTotals: { date: string; total: number }[] = [];
    
    // Generate last 7 days from the given date
    for (let i = 6; i >= 0; i--) {
      const day = new Date(currentDate);
      day.setDate(currentDate.getDate() - i);
      const dayString = day.toISOString().split('T')[0];
      
      const dailyTotal = await this.getDailyTotal(dayString);
      weeklyTotals.push({
        date: dayString,
        total: dailyTotal
      });
    }
    
    return weeklyTotals;
  }
}

export const storage = new MemStorage();
