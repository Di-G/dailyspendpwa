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
  // Categories: treat as equal when the sets of (name+color) match, ignoring id/createdAt
  const categoriesEquivalent = areCategoriesSemanticallyEqual(localData.categories, onlineData.categories || []);
  const categoriesConflict = !categoriesEquivalent;

  // If categories are equivalent, compare expenses/recurring after remapping online categoryId -> local categoryId
  let expensesConflict: boolean;
  let recurringConflict: boolean;

  if (categoriesEquivalent) {
    const key = (c: Category) => `${c.name.toLowerCase()}|${c.color.toLowerCase()}`;
    const localKeyToId = new Map<string, string>();
    localData.categories.forEach(c => localKeyToId.set(key(c), c.id));
    const onlineIdToLocalId = new Map<string, string>();
    (onlineData.categories || []).forEach(c => {
      const k = key(c);
      const localId = localKeyToId.get(k);
      if (localId && localId !== c.id) {
        onlineIdToLocalId.set(c.id, localId);
      }
    });

    const remapExpenseCategoryId = (e: Expense): Expense => {
      if (!e.categoryId) return e;
      const mapped = onlineIdToLocalId.get(e.categoryId);
      return mapped ? { ...e, categoryId: mapped } : e;
    };
    const remapRecurringCategoryId = (r: RecurringExpense): RecurringExpense => {
      if (!r.categoryId) return r;
      const mapped = onlineIdToLocalId.get(r.categoryId);
      return mapped ? { ...r, categoryId: mapped } : r;
    };

    const onlineExpensesRemapped = (onlineData.expenses || []).map(remapExpenseCategoryId);
    const onlineRecurringRemapped = (onlineData.recurring || []).map(remapRecurringCategoryId);

    expensesConflict = !areArraysEqual(localData.expenses, onlineExpensesRemapped);
    recurringConflict = !areArraysEqual(localData.recurring, onlineRecurringRemapped);
  } else {
    expensesConflict = !areArraysEqual(localData.expenses, onlineData.expenses || []);
    recurringConflict = !areArraysEqual(localData.recurring, onlineData.recurring || []);
  }

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
  // If categories are semantically equal (same name+color pairs), keep local categories
  // and remap online expenses/recurring categoryId to local ids to preserve references.
  const categoriesEquivalent = areCategoriesSemanticallyEqual(localData.categories, onlineData.categories || []);

  let mergedCategories: Category[];
  let mergedExpenses: Expense[];
  let mergedRecurring: RecurringExpense[];

  if (categoriesEquivalent) {
    // Build a map from online category id -> local category id based on name+color matching
    const key = (c: Category) => `${c.name.toLowerCase()}|${c.color.toLowerCase()}`;
    const localKeyToId = new Map<string, string>();
    localData.categories.forEach(c => localKeyToId.set(key(c), c.id));

    const onlineIdToLocalId = new Map<string, string>();
    (onlineData.categories || []).forEach(c => {
      const k = key(c);
      const localId = localKeyToId.get(k);
      if (localId && localId !== c.id) {
        onlineIdToLocalId.set(c.id, localId);
      }
    });

    // Keep local categories as source of truth to avoid breaking local references
    mergedCategories = localData.categories;

    // Remap online expenses/recurring to local category ids when needed
    const remapExpenseCategoryId = (e: Expense): Expense => {
      if (!e.categoryId) return e;
      const mapped = onlineIdToLocalId.get(e.categoryId);
      return mapped ? { ...e, categoryId: mapped } : e;
    };
    const remapRecurringCategoryId = (r: RecurringExpense): RecurringExpense => {
      if (!r.categoryId) return r;
      const mapped = onlineIdToLocalId.get(r.categoryId);
      return mapped ? { ...r, categoryId: mapped } : r;
    };

    const onlineExpensesRemapped = (onlineData.expenses || []).map(remapExpenseCategoryId);
    const onlineRecurringRemapped = (onlineData.recurring || []).map(remapRecurringCategoryId);

    // Merge expenses/recurring by timestamp as usual
    mergedExpenses = mergeArraysByTimestamp(
      localData.expenses,
      onlineExpensesRemapped,
      'createdAt'
    );

    mergedRecurring = mergeArraysByTimestamp(
      localData.recurring,
      onlineRecurringRemapped,
      'createdAt'
    );
  } else {
    // Categories are not fully equivalent. Deduplicate by name+color and build an ID remap
    const { finalCategories, idRemap } = buildCategoryDeduplication(localData.categories, onlineData.categories || []);
    mergedCategories = finalCategories;

    const remapExpenseCategoryId = (e: Expense): Expense => {
      if (!e.categoryId) return e;
      const mapped = idRemap.get(e.categoryId);
      return mapped ? { ...e, categoryId: mapped } : e;
    };
    const remapRecurringCategoryId = (r: RecurringExpense): RecurringExpense => {
      if (!r.categoryId) return r;
      const mapped = idRemap.get(r.categoryId);
      return mapped ? { ...r, categoryId: mapped } : r;
    };

    const localExpensesRemapped = localData.expenses.map(remapExpenseCategoryId);
    const onlineExpensesRemapped = (onlineData.expenses || []).map(remapExpenseCategoryId);
    const localRecurringRemapped = localData.recurring.map(remapRecurringCategoryId);
    const onlineRecurringRemapped = (onlineData.recurring || []).map(remapRecurringCategoryId);

    // Merge expenses/recurring by timestamp as usual
    mergedExpenses = mergeArraysByTimestamp(
      localExpensesRemapped,
      onlineExpensesRemapped,
      'createdAt'
    );
    mergedRecurring = mergeArraysByTimestamp(
      localRecurringRemapped,
      onlineRecurringRemapped,
      'createdAt'
    );
  }

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
 * Build a deduplicated category set by semantic key (name+color), preferring local items.
 * Also returns a mapping from any old category id (local or online) to the final kept id.
 */
function buildCategoryDeduplication(local: Category[], online: Category[]): { finalCategories: Category[]; idRemap: Map<string, string> } {
  const normalizeKey = (c: Category) => `${c.name.trim().toLowerCase()}|${c.color.trim().toLowerCase()}`;
  const keyToFinal = new Map<string, Category>();
  const idRemap = new Map<string, string>();

  // Prefer local categories when keys collide
  for (const c of local) {
    const key = normalizeKey(c);
    if (!keyToFinal.has(key)) {
      keyToFinal.set(key, c);
    } else {
      // If duplicate keys exist locally, keep the newest
      const existing = keyToFinal.get(key)!;
      const winner = new Date(c.createdAt) > new Date(existing.createdAt) ? c : existing;
      keyToFinal.set(key, winner);
    }
  }

  for (const c of online) {
    const key = normalizeKey(c);
    const existing = keyToFinal.get(key);
    if (!existing) {
      keyToFinal.set(key, c);
    }
  }

  // Build id remap from all seen ids to the final id per key
  const collectIds = (arr: Category[]) => {
    for (const c of arr) {
      const key = normalizeKey(c);
      const final = keyToFinal.get(key)!;
      idRemap.set(c.id, final.id);
    }
  };
  collectIds(local);
  collectIds(online);

  return { finalCategories: Array.from(keyToFinal.values()), idRemap };
}

/**
 * Helper to compare categories semantically (by name+color only)
 */
function areCategoriesSemanticallyEqual(local: Category[], online: Category[]): boolean {
  if (local.length !== online.length) return false;
  const normalize = (c: Category) => `${c.name.trim().toLowerCase()}|${c.color.trim().toLowerCase()}`;
  const localSet = new Set(local.map(normalize));
  for (const c of online) {
    if (!localSet.has(normalize(c))) return false;
  }
  return true;
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
