import { Category, Expense, InsertCategory, InsertExpense, ExpenseWithCategory } from "@shared/schema";

// Storage keys
const CATEGORIES_KEY = 'dailyspend_categories';
const EXPENSES_KEY = 'dailyspend_expenses';

// Helper functions
const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

const getFromStorage = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading from localStorage key ${key}:`, error);
    return defaultValue;
  }
};

const setToStorage = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing to localStorage key ${key}:`, error);
  }
};

// Helper function to enrich expenses with category data
const enrichExpensesWithCategories = (expenses: Expense[]): ExpenseWithCategory[] => {
  const categories = getCategories();
  return expenses.map(expense => ({
    ...expense,
    category: expense.categoryId ? categories.find(cat => cat.id === expense.categoryId) : undefined,
  }));
};

// Categories
export const getCategories = (): Category[] => {
  return getFromStorage<Category[]>(CATEGORIES_KEY, []);
};

export const createCategory = (data: InsertCategory): Category => {
  const categories = getCategories();
  const newCategory: Category = {
    id: generateId(),
    name: data.name,
    color: data.color,
    createdAt: new Date().toISOString(),
  };
  
  const updatedCategories = [...categories, newCategory];
  setToStorage(CATEGORIES_KEY, updatedCategories);
  return newCategory;
};

export const deleteCategory = (id: string): void => {
  const categories = getCategories();
  const updatedCategories = categories.filter(cat => cat.id !== id);
  setToStorage(CATEGORIES_KEY, updatedCategories);
  
  // Also remove category from expenses
  const expenses = getExpenses();
  const updatedExpenses = expenses.map(expense => 
    expense.categoryId === id ? { ...expense, categoryId: null } : expense
  );
  setToStorage(EXPENSES_KEY, updatedExpenses);
};

// Expenses
export const getExpenses = (): Expense[] => {
  return getFromStorage<Expense[]>(EXPENSES_KEY, []);
};

export const getExpensesWithCategories = (): ExpenseWithCategory[] => {
  const expenses = getExpenses();
  return enrichExpensesWithCategories(expenses);
};

export const getExpensesByDate = (date: string): ExpenseWithCategory[] => {
  const expenses = getExpenses();
  const filteredExpenses = expenses.filter(expense => expense.date === date);
  return enrichExpensesWithCategories(filteredExpenses);
};

export const getExpensesByDateRange = (startDate: string, endDate: string): ExpenseWithCategory[] => {
  const expenses = getExpenses();
  const filteredExpenses = expenses.filter(expense => 
    expense.date >= startDate && expense.date <= endDate
  );
  return enrichExpensesWithCategories(filteredExpenses);
};

export const createExpense = (data: InsertExpense): Expense => {
  const expenses = getExpenses();
  const newExpense: Expense = {
    id: generateId(),
    name: data.name,
    amount: data.amount,
    details: data.details || null,
    categoryId: data.categoryId || null,
    date: data.date,
    createdAt: new Date().toISOString(),
  };
  
  const updatedExpenses = [...expenses, newExpense];
  setToStorage(EXPENSES_KEY, updatedExpenses);
  return newExpense;
};

export const deleteExpense = (id: string): void => {
  const expenses = getExpenses();
  const updatedExpenses = expenses.filter(expense => expense.id !== id);
  setToStorage(EXPENSES_KEY, updatedExpenses);
};

// Analytics
export const getDailyTotal = (date: string): number => {
  const expenses = getExpensesByDate(date);
  return expenses.reduce((total, expense) => total + parseFloat(expense.amount), 0);
};

export const getCategoryTotals = (date: string): Array<{ categoryId: string; total: number; category: Category }> => {
  const expenses = getExpensesByDate(date);
  const categories = getCategories();
  
  const categoryTotals = new Map<string, number>();
  
  expenses.forEach(expense => {
    if (expense.categoryId) {
      const current = categoryTotals.get(expense.categoryId) || 0;
      categoryTotals.set(expense.categoryId, current + parseFloat(expense.amount));
    }
  });
  
  return Array.from(categoryTotals.entries()).map(([categoryId, total]) => {
    const category = categories.find(cat => cat.id === categoryId);
    return {
      categoryId,
      total,
      category: category!,
    };
  });
};

export const getMonthlyTotals = (year: number, month: number): Array<{ date: string; total: number }> => {
  const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
  const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
  
  const expenses = getExpensesByDateRange(startDate, endDate);
  
  const dailyTotals = new Map<string, number>();
  
  expenses.forEach(expense => {
    const current = dailyTotals.get(expense.date) || 0;
    dailyTotals.set(expense.date, current + parseFloat(expense.amount));
  });
  
  return Array.from(dailyTotals.entries()).map(([date, total]) => ({
    date,
    total,
  }));
};

export const getWeeklyTotals = (date: string): Array<{ date: string; total: number }> => {
  const currentDate = new Date(date);
  const startDate = new Date(currentDate);
  startDate.setDate(currentDate.getDate() - 6); // 7 days ago
  
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = date;
  
  const expenses = getExpensesByDateRange(startDateStr, endDateStr);
  
  const dailyTotals = new Map<string, number>();
  
  expenses.forEach(expense => {
    const current = dailyTotals.get(expense.date) || 0;
    dailyTotals.set(expense.date, current + parseFloat(expense.amount));
  });
  
  return Array.from(dailyTotals.entries()).map(([date, total]) => ({
    date,
    total,
  }));
};

// Initialize default categories if none exist
export const initializeDefaultCategories = (): void => {
  const categories = getCategories();
  if (categories.length === 0) {
    const defaultCategories: InsertCategory[] = [
      { name: "Food & Dining", color: "#EF4444" },
      { name: "Transportation", color: "#3B82F6" },
      { name: "Shopping", color: "#10B981" },
      { name: "Entertainment", color: "#F59E0B" },
      { name: "Bills & Utilities", color: "#8B5CF6" },
      { name: "Healthcare", color: "#EC4899" },
    ];
    
    defaultCategories.forEach(category => createCategory(category));
  }
};
