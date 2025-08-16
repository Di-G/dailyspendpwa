import { Category, Expense, RecurringExpense } from "@shared/schema";
import { getCategories, getExpenses, getRecurringExpenses } from "./localStorage";

export type DataConflict = {
  hasLocalData: boolean;
  hasOnlineData: boolean;
  conflicts: {
    categories: boolean;
    expenses: boolean;
    recurring: boolean;
  };
  localData: {
    categories: Category[];
    expenses: Expense[];
    recurring: RecurringExpense[];
  };
  onlineData: {
    categories: Category[];
    expenses: Expense[];
    recurring: RecurringExpense[];
  };
};

export type ConflictResolution = 'merge' | 'overwrite-local' | 'overwrite-online';

/**
 * Analyzes data conflicts between local and online storage
 */
export function analyzeDataConflicts(
  localData: { categories: Category[]; expenses: Expense[]; recurring: RecurringExpense[] },
  onlineData: { categories: Category[]; expenses: Expense[]; recurring: RecurringExpense[] } | null
): DataConflict {
  const hasLocalData = localData.categories.length > 0 || localData.expenses.length > 0 || localData.recurring.length > 0;
  const hasOnlineData = onlineData !== null && (
    (onlineData.categories && onlineData.categories.length > 0) ||
    (onlineData.expenses && onlineData.expenses.length > 0) ||
    (onlineData.recurring && onlineData.recurring.length > 0)
  );

  if (!hasLocalData || !hasOnlineData) {
    return {
      hasLocalData,
      hasOnlineData: !!hasOnlineData,
      conflicts: { categories: false, expenses: false, recurring: false },
      localData,
      onlineData: onlineData || { categories: [], expenses: [], recurring: [] }
    };
  }

  // Check for conflicts by comparing data
  const categoriesConflict = !areArraysEqual(localData.categories, onlineData.categories || []);
  const expensesConflict = !areArraysEqual(localData.expenses, onlineData.expenses || []);
  const recurringConflict = !areArraysEqual(localData.recurring, onlineData.recurring || []);

  return {
    hasLocalData,
    hasOnlineData,
    conflicts: {
      categories: categoriesConflict,
      expenses: expensesConflict,
      recurring: recurringConflict
    },
    localData,
    onlineData: onlineData || { categories: [], expenses: [], recurring: [] }
  };
}

/**
 * Merges local and online data, preferring the most recent version of each item
 */
export function mergeData(
  localData: { categories: Category[]; expenses: Expense[]; recurring: RecurringExpense[] },
  onlineData: { categories: Category[]; expenses: Expense[]; recurring: RecurringExpense[] }
): { categories: Category[]; expenses: Expense[]; recurring: RecurringExpense[] } {
  // Merge categories - prefer the one with the latest createdAt
  const mergedCategories = mergeArraysByTimestamp(
    localData.categories,
    onlineData.categories || [],
    'createdAt'
  );

  // Merge expenses - prefer the one with the latest createdAt
  const mergedExpenses = mergeArraysByTimestamp(
    localData.expenses,
    onlineData.expenses || [],
    'createdAt'
  );

  // Merge recurring expenses - prefer the one with the latest createdAt
  const mergedRecurring = mergeArraysByTimestamp(
    localData.recurring,
    onlineData.recurring || [],
    'createdAt'
  );

  return {
    categories: mergedCategories,
    expenses: mergedExpenses,
    recurring: mergedRecurring
  };
}

/**
 * Applies the user's conflict resolution choice
 */
export function applyConflictResolution(
  resolution: ConflictResolution,
  localData: { categories: Category[]; expenses: Expense[]; recurring: RecurringExpense[] },
  onlineData: { categories: Category[]; expenses: Expense[]; recurring: RecurringExpense[] } | null
): { categories: Category[]; expenses: Expense[]; recurring: RecurringExpense[] } {
  switch (resolution) {
    case 'merge':
      if (!onlineData) return localData;
      return mergeData(localData, onlineData);
    
    case 'overwrite-local':
      return localData;
    
    case 'overwrite-online':
      return onlineData || localData;
    
    default:
      return localData;
  }
}

/**
 * Helper function to check if two arrays are equal (deep comparison)
 */
function areArraysEqual<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) return false;
  
  // If both arrays are empty, they're equal
  if (arr1.length === 0 && arr2.length === 0) return true;
  
  // Create maps for efficient comparison
  const map1 = new Map<string, string>();
  const map2 = new Map<string, string>();
  
  // Normalize and store items from both arrays
  arr1.forEach(item => {
    const key = (item as any).id || JSON.stringify(item);
    const normalized = JSON.stringify(item);
    map1.set(key, normalized);
  });
  
  arr2.forEach(item => {
    const key = (item as any).id || JSON.stringify(item);
    const normalized = JSON.stringify(item);
    map2.set(key, normalized);
  });
  
  // Compare maps
  if (map1.size !== map2.size) return false;
  
  // Use forEach instead of for...of to avoid iteration issues
  let isEqual = true;
  map1.forEach((value, key) => {
    if (map2.get(key) !== value) {
      isEqual = false;
    }
  });
  
  return isEqual;
}

/**
 * Helper function to merge arrays by timestamp, preferring the most recent
 */
function mergeArraysByTimestamp<T extends { id: string; createdAt: string }>(
  local: T[],
  online: T[],
  timestampKey: keyof T
): T[] {
  const merged = new Map<string, T>();
  
  // Add local items
  local.forEach(item => {
    merged.set(item.id, item);
  });
  
  // Add/override with online items if they're newer
  online.forEach(item => {
    const existing = merged.get(item.id);
    if (!existing || new Date(item[timestampKey] as string) > new Date(existing[timestampKey] as string)) {
      merged.set(item.id, item);
    }
  });
  
  return Array.from(merged.values());
}

/**
 * Gets current local data for conflict analysis
 */
export function getCurrentLocalData() {
  return {
    categories: getCategories(),
    expenses: getExpenses(),
    recurring: getRecurringExpenses()
  };
}
