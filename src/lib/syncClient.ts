import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { downloadAllForUser, uploadAllForUser } from "@/lib/sync";
import { getCategories, getExpenses, getRecurringExpenses, updateAllData } from "@/lib/localStorage";
import { 
  analyzeDataConflicts, 
  applyConflictResolution, 
  getCurrentLocalData,
  type DataConflict,
  type ConflictResolution 
} from "./dataConflictResolver";

export function useRealtimeSync() {
  const { user, isVerified } = useAuth();
  const hasInitialized = useRef(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<DataConflict | null>(null);

  useEffect(() => {
    if (!user || !isVerified) return;
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Initial sync with conflict resolution
    handleInitialSync();

    // Listen for local changes and handle conflicts before uploading
    const onChanged = async () => {
      try {
        // If a conflict dialog is already open, skip background handling
        if (conflictDialogOpen || pendingConflict) return;

        const localSnapshot = getCurrentLocalData();
        const remoteSnapshot = await downloadAllForUser(user.uid);
        const conflict = analyzeDataConflicts(localSnapshot, remoteSnapshot as any);

        const hasConflicts = conflict.hasOnlineData && (
          conflict.conflicts.categories ||
          conflict.conflicts.expenses ||
          conflict.conflicts.recurring
        );

        if (hasConflicts) {
          // Show conflict dialog immediately; do not auto-upload
          setPendingConflict(conflict);
          setConflictDialogOpen(true);
          return;
        }

        // No conflicts with online; proceed with upload
        await uploadAllForUser(user.uid, {
          categories: getCategories(),
          expenses: getExpenses(),
          recurring: getRecurringExpenses(),
        });
      } catch (e) {
        console.error('Background upload failed', e);
      }
    };

    window.addEventListener('dailyspend:data-changed', onChanged);
    
    return () => {
      window.removeEventListener('dailyspend:data-changed', onChanged);
    };
  }, [user, isVerified]);

  const handleInitialSync = async () => {
    try {
      console.log('[Sync] Starting initial sync for user:', user!.uid);
      const localData = getCurrentLocalData();
      const remoteData = await downloadAllForUser(user!.uid);
      
      console.log('[Sync] Local data:', {
        categories: localData.categories.length,
        expenses: localData.expenses.length,
        recurring: localData.recurring.length
      });
      
      console.log('[Sync] Remote data:', remoteData ? {
        categories: (remoteData.categories as any[])?.length || 0,
        expenses: (remoteData.expenses as any[])?.length || 0,
        recurring: (remoteData.recurring as any[])?.length || 0
      } : 'No remote data');
      
      // Analyze potential conflicts
      const conflict = analyzeDataConflicts(localData, remoteData as any);
      
      console.log('[Sync] Conflict analysis:', {
        hasLocalData: conflict.hasLocalData,
        hasOnlineData: conflict.hasOnlineData,
        conflicts: conflict.conflicts
      });
      
      if (conflict.hasLocalData && conflict.hasOnlineData) {
        // Check if there are actual conflicts
        const hasConflicts = conflict.conflicts.categories || 
                           conflict.conflicts.expenses || 
                           conflict.conflicts.recurring;
        
        if (hasConflicts) {
          console.log('[Sync] Conflicts detected, showing resolution dialog');
          // Show conflict resolution dialog
          setPendingConflict(conflict);
          setConflictDialogOpen(true);
          return;
        }
      }
      
      console.log('[Sync] No conflicts, proceeding with normal sync');
      // No conflicts or no data overlap - proceed with normal sync
      await performSync(conflict, 'merge');
      
    } catch (e) {
      console.error('[Sync] Initial sync failed:', e);
      // Non-blocking; user can continue offline
    }
  };

  const performSync = async (conflict: DataConflict, resolution: ConflictResolution) => {
    try {
      const resolvedData = applyConflictResolution(resolution, conflict.localData, conflict.onlineData);
      
      // Update local storage with resolved data using the new function
      updateAllData(
        resolvedData.categories,
        resolvedData.expenses,
        resolvedData.recurring
      );
      
      // Upload resolved data to cloud
      await uploadAllForUser(user!.uid, resolvedData);
      
      // Emit change event to refresh UI
      window.dispatchEvent(new CustomEvent('dailyspend:data-changed'));
      
    } catch (error) {
      console.error('Sync failed:', error);
      throw error;
    }
  };

  const handleConflictResolution = async (resolution: ConflictResolution) => {
    if (!pendingConflict) return;
    
    try {
      await performSync(pendingConflict, resolution);
      setConflictDialogOpen(false);
      setPendingConflict(null);
    } catch (error) {
      console.error('Conflict resolution failed:', error);
      throw error;
    }
  };

  return {
    conflictDialogOpen,
    pendingConflict,
    onConflictResolve: handleConflictResolution,
    onConflictDialogClose: () => setConflictDialogOpen(false)
  };
}


