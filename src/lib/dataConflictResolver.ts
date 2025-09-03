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

// Trips types (local only)
export type Trip = { id: string; name: string; friends: { name: string }[] };
export type TripExpense = { 
  id: string; 
  tripId: string; 
  friendIndex: number; 
  name: string; 
  amount: string; 
  details?: string | null; 
  categoryId?: string | null; 
  date: string; 
  createdAt: string;
  splitWith?: number[]; // Array of friend indices who should split this expense
};
export type TripRecurring = { 
  id: string; 
  tripId: string; 
  name: string; 
  amount: string; 
  details?: string | null; 
  friendIndex: number; 
  frequency: 'daily'|'weekly'|'monthly'|'custom'; 
  customDays?: number; 
  startDate: string; 
  endDate?: string | null; 
  isActive: boolean;
  splitWith?: number[]; // Array of friend indices who should split this expense
};

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

// ---- Trips conflict helpers (parallel to main data) ----
export type TripsConflict = {
  hasLocalData: boolean;
  hasOnlineData: boolean;
  conflicts: {
    trips: boolean;
    tripExpenses: boolean;
    tripRecurring: boolean;
  };
  localData: {
    trips: Trip[];
    tripExpenses: TripExpense[];
    tripRecurring: TripRecurring[];
  };
  onlineData: {
    trips: Trip[];
    tripExpenses: TripExpense[];
    tripRecurring: TripRecurring[];
  };
};

export function analyzeTripsConflicts(
  localData: { trips: Trip[]; tripExpenses: TripExpense[]; tripRecurring: TripRecurring[] },
  onlineData: { trips: Trip[]; tripExpenses: TripExpense[]; tripRecurring: TripRecurring[] } | null
): TripsConflict {
  // Consider trips as the primary data - if no trips exist, treat as no local data
  // This prevents orphaned expenses from being considered as "local data"
  const hasLocalTrips = localData.trips.length > 0;
  const hasOnlineTrips = !!onlineData && (onlineData.trips?.length || 0) > 0;
  
  // For conflict detection, we care about trips primarily
  const hasLocalData = hasLocalTrips;
  const hasOnlineData = hasOnlineTrips;
  
  console.log('[ConflictResolver] Trips conflict analysis:', {
    hasLocalTrips,
    hasOnlineTrips,
    hasLocalData,
    hasOnlineData,
    localTripsCount: localData.trips.length,
    onlineTripsCount: onlineData?.trips?.length || 0,
    localExpensesCount: localData.tripExpenses.length,
    onlineExpensesCount: onlineData?.tripExpenses?.length || 0,
  });

  // If neither local nor online has trips, no conflicts
  if (!hasLocalData && !hasOnlineData) {
    return {
      hasLocalData,
      hasOnlineData,
      conflicts: { trips: false, tripExpenses: false, tripRecurring: false },
      localData,
      onlineData: onlineData || { trips: [], tripExpenses: [], tripRecurring: [] },
    };
  }

  // If only one side has trips, there's a conflict
  if (!hasLocalData || !hasOnlineData) {
    return {
      hasLocalData,
      hasOnlineData,
      conflicts: { trips: true, tripExpenses: true, tripRecurring: true },
      localData,
      onlineData: onlineData || { trips: [], tripExpenses: [], tripRecurring: [] },
    };
  }

  // Both sides have trips, check for actual conflicts
  const tripsConflict = !areArraysEqual(localData.trips, onlineData!.trips || []);
  const tripExpensesConflict = !areArraysEqual(localData.tripExpenses, onlineData!.tripExpenses || []);
  const tripRecurringConflict = !areArraysEqual(localData.tripRecurring, onlineData!.tripRecurring || []);

  return {
    hasLocalData,
    hasOnlineData,
    conflicts: { trips: tripsConflict, tripExpenses: tripExpensesConflict, tripRecurring: tripRecurringConflict },
    localData,
    onlineData: onlineData || { trips: [], tripExpenses: [], tripRecurring: [] },
  };
}

export function mergeTripsData(
  localData: { trips: Trip[]; tripExpenses: TripExpense[]; tripRecurring: TripRecurring[] },
  onlineData: { trips: Trip[]; tripExpenses: TripExpense[]; tripRecurring: TripRecurring[] }
): { trips: Trip[]; tripExpenses: TripExpense[]; tripRecurring: TripRecurring[] } {
  // For trips array, merge by id preferring the most recent createdAt-like heuristic if exists; fallback to local
  const mergedTrips = mergeArraysByTimestamp(
    localData.trips.map(t => ({ ...t, createdAt: (t as any).createdAt || '1970-01-01T00:00:00.000Z' })) as any,
    (onlineData.trips || []).map(t => ({ ...t, createdAt: (t as any).createdAt || '1970-01-01T00:00:00.000Z' })) as any,
    'createdAt' as any,
  ).map((t: any) => ({ id: t.id, name: t.name, friends: t.friends } as Trip));

  const mergedTripExpenses = mergeArraysByTimestamp(localData.tripExpenses, onlineData.tripExpenses || [], 'createdAt');
  const mergedTripRecurring = mergeArraysByTimestamp(
    localData.tripRecurring.map(t => ({ ...t, createdAt: (t as any).createdAt || '1970-01-01T00:00:00.000Z' })) as any,
    (onlineData.tripRecurring || []).map(t => ({ ...t, createdAt: (t as any).createdAt || '1970-01-01T00:00:00.000Z' })) as any,
    'createdAt'
  ).map((t: any) => ({ 
    id: t.id, 
    tripId: t.tripId, 
    name: t.name, 
    amount: t.amount, 
    details: t.details, 
    friendIndex: t.friendIndex, 
    frequency: t.frequency, 
    customDays: t.customDays, 
    startDate: t.startDate, 
    endDate: t.endDate, 
    isActive: t.isActive 
  } as TripRecurring));

  return { trips: mergedTrips, tripExpenses: mergedTripExpenses, tripRecurring: mergedTripRecurring };
}

export function applyTripsConflictResolution(
  resolution: ConflictResolution,
  localData: { trips: Trip[]; tripExpenses: TripExpense[]; tripRecurring: TripRecurring[] },
  onlineData: { trips: Trip[]; tripExpenses: TripExpense[]; tripRecurring: TripRecurring[] } | null
): { trips: Trip[]; tripExpenses: TripExpense[]; tripRecurring: TripRecurring[] } {
  switch (resolution) {
    case 'merge':
      if (!onlineData) return localData;
      return mergeTripsData(localData, onlineData);
    case 'overwrite-local':
      return onlineData || { trips: [], tripExpenses: [], tripRecurring: [] };
    case 'overwrite-online':
      return localData;
    default:
      return localData;
  }
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

    // Merge expenses using specialized logic for category conflicts
    mergedExpenses = mergeExpensesByTimestamp(
      localData.expenses,
      onlineExpensesRemapped
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

    // Merge expenses using specialized logic for category conflicts
    mergedExpenses = mergeExpensesByTimestamp(
      localExpensesRemapped,
      onlineExpensesRemapped
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
    
    // Use Online Data: replace local with online snapshot
    case 'overwrite-local':
      return onlineData || { categories: [], expenses: [], recurring: [] };
    
    // Use Local Data: upload local snapshot to cloud (and keep it locally)
    case 'overwrite-online':
      return localData;
    
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

  // Stable stringify that ignores nullish fields and sorts keys to avoid
  // false mismatches from key ordering or presence of null vs missing
  const stableStringify = (value: unknown): string => {
    const normalize = (val: unknown): unknown => {
      if (val === null || val === undefined) return undefined; // drop nullish
      if (Array.isArray(val)) return val.map(normalize);
      if (typeof val === 'object') {
        const obj = val as Record<string, unknown>;
        const keys = Object.keys(obj).sort();
        const out: Record<string, unknown> = {};
        for (const k of keys) {
          const normalized = normalize(obj[k]);
          if (normalized !== undefined) {
            out[k] = normalized;
          }
        }
        return out;
      }
      return val;
    };
    return JSON.stringify(normalize(value));
  };

  const map1 = new Map<string, string>();
  const map2 = new Map<string, string>();

  arr1.forEach(item => {
    const id = (item as any).id ?? stableStringify(item);
    map1.set(id, stableStringify(item));
  });

  arr2.forEach(item => {
    const id = (item as any).id ?? stableStringify(item);
    map2.set(id, stableStringify(item));
  });

  if (map1.size !== map2.size) return false;

  let equal = true;
  map1.forEach((value, key) => {
    if (map2.get(key) !== value) {
      equal = false;
    }
  });
  return equal;
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
 * Specialized merge function for expenses that handles category conflicts intelligently
 * When the same expense (same name and amount) exists with different categories,
 * prefer the local version with a specific category over the online version with "uncategorized"
 */
function mergeExpensesByTimestamp(
  local: Expense[],
  online: Expense[]
): Expense[] {
  const merged = new Map<string, Expense>();
  
  // Add local items
  local.forEach(item => {
    merged.set(item.id, item);
  });
  
  // Add/override with online items, but with special logic for category conflicts
  online.forEach(onlineItem => {
    const existing = merged.get(onlineItem.id);
    if (!existing) {
      // No local version exists, use online version
      merged.set(onlineItem.id, onlineItem);
    } else {
      // Both local and online versions exist - apply smart conflict resolution
      const onlineDate = new Date((onlineItem as any).lastModified || onlineItem.createdAt);
      const localDate = new Date((existing as any).lastModified || existing.createdAt);
      
      // If online is significantly newer (more than 1 minute), use online
      if (onlineDate.getTime() - localDate.getTime() > 60000) {
        merged.set(onlineItem.id, onlineItem);
      } else {
        // Times are close or local is newer - check for category conflict
        const isOnlineUncategorized = !onlineItem.categoryId || onlineItem.categoryId === 'uncategorized';
        const isLocalCategorized = existing.categoryId && existing.categoryId !== 'uncategorized';
        
        // If online is uncategorized and local has a specific category, prefer local
        if (isOnlineUncategorized && isLocalCategorized) {
          // Keep local version (with specific category)
          merged.set(onlineItem.id, existing);
        } else {
          // Use timestamp-based resolution for other cases
          if (onlineDate > localDate) {
            merged.set(onlineItem.id, onlineItem);
          } else {
            merged.set(onlineItem.id, existing);
          }
        }
      }
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
