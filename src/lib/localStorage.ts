import { Category, Expense, RecurringExpense, InsertCategory, InsertExpense, InsertRecurringExpense, ExpenseWithCategory, RecurringExpenseWithCategory, Friend, InsertFriend } from "@shared/schema";
import { formatDate } from "./date-utils";
import { emitDataChanged } from "./syncBridge";

// Storage keys
const CATEGORIES_KEY = 'dailyspend_categories';
const EXPENSES_KEY = 'dailyspend_expenses';
const RECURRING_EXPENSES_KEY = 'dailyspend_recurring_expenses';
const LAST_PROCESSED_DATE_KEY = 'dailyspend_last_processed_date';
const FRIENDS_KEY = 'dailyspend_friends';

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

// Helper function to enrich recurring expenses with category data
const enrichRecurringExpensesWithCategories = (recurringExpenses: RecurringExpense[]): RecurringExpenseWithCategory[] => {
  const categories = getCategories();
  return recurringExpenses.map(expense => ({
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
  emitDataChanged();
  return newCategory;
};

export const deleteCategory = (id: string): void => {
  const categories = getCategories();
  const updatedCategories = categories.filter(cat => cat.id !== id);
  setToStorage(CATEGORIES_KEY, updatedCategories);
  emitDataChanged();
  
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
  emitDataChanged();
  return newExpense;
};

export const deleteExpense = (id: string): void => {
  const expenses = getExpenses();
  const updatedExpenses = expenses.filter(expense => expense.id !== id);
  setToStorage(EXPENSES_KEY, updatedExpenses);
  emitDataChanged();
};

export const restoreExpense = (expense: Expense): void => {
  const expenses = getExpenses();
  const updatedExpenses = [...expenses, expense];
  setToStorage(EXPENSES_KEY, updatedExpenses);
  emitDataChanged();
};

export const updateExpense = (
  id: string,
  data: {
    name?: string;
    amount?: string; // keep string format consistent with storage
    details?: string | null;
    categoryId?: string | null;
    date?: string; // optional: allow moving between dates
  }
): Expense | null => {
  const expenses = getExpenses();
  let updated: Expense | null = null;
  const updatedExpenses = expenses.map(expense => {
    if (expense.id !== id) return expense;
    updated = {
      ...expense,
      name: data.name !== undefined ? data.name : expense.name,
      amount: data.amount !== undefined ? data.amount : expense.amount,
      details: data.details !== undefined ? data.details : expense.details,
      categoryId: data.categoryId !== undefined ? data.categoryId : expense.categoryId,
      date: data.date !== undefined ? data.date : expense.date,
    };
    return updated;
  });
  setToStorage(EXPENSES_KEY, updatedExpenses);
  emitDataChanged();
  return updated;
};

// Recurring Expenses
export const getRecurringExpenses = (): RecurringExpense[] => {
  return getFromStorage<RecurringExpense[]>(RECURRING_EXPENSES_KEY, []);
};

export const getRecurringExpensesWithCategories = (): RecurringExpenseWithCategory[] => {
  const recurringExpenses = getRecurringExpenses();
  return enrichRecurringExpensesWithCategories(recurringExpenses);
};

export const createRecurringExpense = (data: InsertRecurringExpense): RecurringExpense => {
  const recurringExpenses = getRecurringExpenses();
  // Enforce no past start dates
  const todayStr = formatDate(new Date());
  if (data.startDate < todayStr) {
    throw new Error('Start date cannot be in the past');
  }
  const newRecurringExpense: RecurringExpense = {
    id: generateId(),
    name: data.name,
    amount: data.amount,
    details: data.details || null,
    categoryId: data.categoryId || null,
    frequency: data.frequency,
    customDays: data.customDays,
    startDate: data.startDate,
    endDate: data.endDate || null,
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  
  const updatedRecurringExpenses = [...recurringExpenses, newRecurringExpense];
  setToStorage(RECURRING_EXPENSES_KEY, updatedRecurringExpenses);
  emitDataChanged();

  // If a recurring expense starts today, immediately add today's occurrence only
  try {
    const todayStr = formatDate(new Date());
    if (
      newRecurringExpense.isActive &&
      newRecurringExpense.startDate === todayStr &&
      (!newRecurringExpense.endDate || todayStr <= newRecurringExpense.endDate)
    ) {
      const existingExpenses = getExpensesByDate(todayStr);
      const alreadyExists = existingExpenses.some(exp =>
        exp.name === newRecurringExpense.name &&
        exp.amount === newRecurringExpense.amount &&
        exp.categoryId === newRecurringExpense.categoryId
      );
      if (!alreadyExists) {
        createExpense({
          name: newRecurringExpense.name,
          amount: newRecurringExpense.amount,
          details: newRecurringExpense.details || undefined,
          categoryId: newRecurringExpense.categoryId || undefined,
          date: todayStr,
        });
      }
    }
  } catch (e) {
    // Fail-safe: do not block creation on immediate-add errors
    console.error('Error adding immediate occurrence for recurring expense:', e);
  }
  return newRecurringExpense;
};

export const updateRecurringExpense = (
  id: string,
  data: Partial<InsertRecurringExpense> & { isActive?: boolean }
): RecurringExpense | null => {
  const recurringExpenses = getRecurringExpenses();
  let updated: RecurringExpense | null = null;
  const updatedRecurringExpenses = recurringExpenses.map(expense => {
    if (expense.id !== id) return expense;
    // Enforce no past start dates when updating, but allow keeping an existing past start date
    const todayStr = formatDate(new Date());
    if (
      data.startDate !== undefined &&
      data.startDate !== expense.startDate &&
      data.startDate < todayStr
    ) {
      throw new Error('Start date cannot be in the past');
    }
    updated = {
      ...expense,
      name: data.name !== undefined ? data.name : expense.name,
      amount: data.amount !== undefined ? data.amount : expense.amount,
      details: data.details !== undefined ? data.details : expense.details,
      categoryId: data.categoryId !== undefined ? data.categoryId : expense.categoryId,
      frequency: data.frequency !== undefined ? data.frequency : expense.frequency,
      customDays: data.customDays !== undefined ? data.customDays : expense.customDays,
      startDate: data.startDate !== undefined ? data.startDate : expense.startDate,
      endDate: data.endDate !== undefined ? data.endDate : expense.endDate,
      isActive: data.isActive !== undefined ? data.isActive : expense.isActive,
    };
    return updated;
  });
  setToStorage(RECURRING_EXPENSES_KEY, updatedRecurringExpenses);
  emitDataChanged();
  return updated;
};

export const deleteRecurringExpense = (id: string): void => {
  const recurringExpenses = getRecurringExpenses();
  const updatedRecurringExpenses = recurringExpenses.filter(expense => expense.id !== id);
  setToStorage(RECURRING_EXPENSES_KEY, updatedRecurringExpenses);
  emitDataChanged();
};

export const toggleRecurringExpense = (id: string): void => {
  const recurringExpenses = getRecurringExpenses();
  const updatedRecurringExpenses = recurringExpenses.map(expense => 
    expense.id === id ? { ...expense, isActive: !expense.isActive } : expense
  );
  setToStorage(RECURRING_EXPENSES_KEY, updatedRecurringExpenses);
  emitDataChanged();
};

// Function to generate expenses from recurring expenses for a given date
export const generateExpensesFromRecurring = (date: string): Expense[] => {
  const recurringExpenses = getRecurringExpenses().filter(re => re.isActive);
  const generatedExpenses: Expense[] = [];
  
  recurringExpenses.forEach(recurring => {
    if (recurring.endDate && date > recurring.endDate) return;
    if (date < recurring.startDate) return;
    
    let shouldGenerate = false;
    const startDate = new Date(recurring.startDate);
    const targetDate = new Date(date);
    
    switch (recurring.frequency) {
      case 'daily':
        shouldGenerate = true;
        break;
      case 'weekly':
        const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        shouldGenerate = daysDiff % 7 === 0;
        break;
      case 'monthly':
        const monthsDiff = (targetDate.getFullYear() - startDate.getFullYear()) * 12 + 
                          (targetDate.getMonth() - startDate.getMonth());
        const dayOfMonth = startDate.getDate();
        shouldGenerate = monthsDiff >= 0 && targetDate.getDate() === dayOfMonth;
        break;
      case 'custom':
        if (recurring.customDays) {
          const daysDiff = Math.floor((targetDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          shouldGenerate = daysDiff % recurring.customDays === 0;
        }
        break;
    }
    
    if (shouldGenerate) {
      // Check if expense already exists for this date
      const existingExpenses = getExpensesByDate(date);
      const alreadyExists = existingExpenses.some(exp => 
        exp.name === recurring.name && 
        exp.amount === recurring.amount && 
        exp.categoryId === recurring.categoryId
      );
      
      if (!alreadyExists) {
        const generatedExpense: Expense = {
          id: generateId(),
          name: recurring.name,
          amount: recurring.amount,
          details: recurring.details,
          categoryId: recurring.categoryId,
          date: date,
          createdAt: new Date().toISOString(),
        };
        generatedExpenses.push(generatedExpense);
      }
    }
  });
  
  return generatedExpenses;
};

// Persist generated expenses for a specific date and return how many were saved
export const processRecurringForDate = (date: string): number => {
  const expensesToAdd = generateExpensesFromRecurring(date);
  if (expensesToAdd.length === 0) return 0;
  const current = getExpenses();
  const updated = [...current, ...expensesToAdd];
  setToStorage(EXPENSES_KEY, updated);
  emitDataChanged();
  return expensesToAdd.length;
};

export const getLastProcessedDate = (): string | null => {
  return getFromStorage<string | null>(LAST_PROCESSED_DATE_KEY, null);
};

export const setLastProcessedDate = (date: string): void => {
  setToStorage(LAST_PROCESSED_DATE_KEY, date);
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
  const endDate = formatDate(new Date(year, month, 0)); // Last day of month (month is 1-based here)
  
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
  
  const startDateStr = formatDate(startDate);
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
  try {
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
      console.log('Default categories initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing default categories:', error);
  }
};

/**
 * Update all data at once (used for conflict resolution)
 */
export const updateAllData = (
  categories: Category[],
  expenses: Expense[],
  recurring: RecurringExpense[],
  friends?: Friend[]
): void => {
  try {
    setToStorage(CATEGORIES_KEY, categories);
    setToStorage(EXPENSES_KEY, expenses);
    setToStorage(RECURRING_EXPENSES_KEY, recurring);
    if (friends !== undefined) {
      setToStorage(FRIENDS_KEY, friends);
    }
    emitDataChanged();
  } catch (error) {
    console.error('Error updating all data:', error);
    throw error;
  }
};

// Friends
export const getFriends = (): Friend[] => {
  return getFromStorage<Friend[]>(FRIENDS_KEY, []);
};

export const addFriend = (data: InsertFriend): Friend => {
  const friends = getFriends();
  const newFriend: Friend = {
    id: generateId(),
    userId: data.userId,
    displayName: data.displayName,
    email: data.email,
    addedAt: new Date().toISOString(),
    isActive: true,
  };
  
  const updatedFriends = [...friends, newFriend];
  setToStorage(FRIENDS_KEY, updatedFriends);
  emitDataChanged();
  return newFriend;
};

export const removeFriend = (id: string): void => {
  const friends = getFriends();
  const updatedFriends = friends.filter(friend => friend.id !== id);
  setToStorage(FRIENDS_KEY, updatedFriends);
  emitDataChanged();
};

export const updateFriend = (id: string, updates: Partial<Friend>): void => {
  const friends = getFriends();
  const updatedFriends = friends.map(friend => 
    friend.id === id ? { ...friend, ...updates } : friend
  );
  setToStorage(FRIENDS_KEY, updatedFriends);
  emitDataChanged();
};
