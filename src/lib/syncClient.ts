import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { downloadAllForUser, uploadAllForUser } from "@/lib/sync";
import { getCategories, getExpenses, getRecurringExpenses, getFriends, updateAllData } from "@/lib/localStorage";
import { 
  analyzeDataConflicts, 
  applyConflictResolution, 
  getCurrentLocalData,
  isLocalDataContinuation,
  isLocalDataOnlyDefaultCategories,
  type DataConflict,
  type ConflictResolution 
} from "./dataConflictResolver";

export function useRealtimeSync() {
  const { user, isVerified } = useAuth();
  const hasInitialized = useRef(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<DataConflict | null>(null);

  // Function to show toast notifications
  const showToast = (title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    // Dispatch a custom event that the App component can listen to
    window.dispatchEvent(new CustomEvent('dailyspend:show-toast', {
      detail: { title, description, variant }
    }));
  };

  useEffect(() => {
    if (!user || !isVerified) return;
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Initial sync with conflict resolution
    handleInitialSync();

    // Listen for local changes and push immediately
    // COMMENTED OUT: This was causing continuous background sync without user choice
    // const onChanged = async () => {
    //   try {
    //     await uploadAllForUser(user.uid, {
    //       categories: getCategories(user.uid),
    //       expenses: getExpenses(user.uid),
    //       recurring: getRecurringExpenses(user.uid),
    //       friends: getFriends(user.uid),
    //     });
    //   } catch (e) {
    //     console.error('Background upload failed', e);
    //   }
    // };

    // window.addEventListener('dailyspend:data-changed', onChanged);
    
    // return () => {
    //   window.removeEventListener('dailyspend:data-changed', onChanged);
    // };
  }, [user, isVerified]);

  const handleInitialSync = async () => {
    try {
      console.log('[Sync] Starting initial sync for user:', user!.uid);
      const localData = getCurrentLocalData(user!.uid);
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
      
      // Special case: No local data, but online data exists - automatically download all online data
      if (!conflict.hasLocalData && conflict.hasOnlineData) {
        console.log('[Sync] No local data found, automatically downloading online data');
        showToast(
          "Data Restored", 
          "Your online data has been automatically downloaded to your device."
        );
        await performSync(conflict, 'overwrite-local');
        return;
      }
      
      if (conflict.hasLocalData && conflict.hasOnlineData) {
        // Check if local data consists only of default categories and should be replaced
        if (isLocalDataOnlyDefaultCategories(localData)) {
          console.log('[Sync] Local data consists only of default categories, replacing with online data');
          showToast(
            "Data Restored", 
            "Your online data has been automatically downloaded to your device."
          );
          await performSync(conflict, 'replace-local-with-online');
          return;
        }
        
        // Check if local data is a continuation of online data (offline additions)
        // COMMENTED OUT: This was automatically syncing without user choice
        // if (isLocalDataContinuation(localData, remoteData as any)) {
        //   console.log('[Sync] Local data is continuation of online data, auto-syncing');
        //   console.log('[Sync] Local data counts:', {
        //     categories: localData.categories.length,
        //     expenses: localData.expenses.length,
        //     recurring: localData.recurring.length,
        //     friends: localData.friends.length
        //   });
        //   console.log('[Sync] Online data counts:', {
        //     categories: (remoteData as any)?.categories?.length || 0,
        //     expenses: (remoteData as any)?.expenses?.length || 0,
        //     recurring: (remoteData as any)?.recurring?.length || 0,
        //     friends: (remoteData as any)?.friends?.length || 0
        //   });
        //   // Local data contains all online data plus new additions - auto-sync
        //   showToast(
        //     "Smart Sync Complete", 
        //     "Your offline additions have been automatically synced to the cloud."
        //   );
        //   await performSync(conflict, 'overwrite-online');
        //   return;
        // }

        // Check if there are actual conflicts OR if local data differs from online data
        const hasConflicts = conflict.conflicts.categories || 
                           conflict.conflicts.expenses || 
                           conflict.conflicts.recurring;
        
        // Show conflict dialog if there are differences OR if both local and online data exist
        if (hasConflicts || (conflict.hasLocalData && conflict.hasOnlineData)) {
          console.log('[Sync] Differences detected, showing conflict resolution dialog');
          // Show conflict resolution dialog for user to choose
          setPendingConflict(conflict);
          setConflictDialogOpen(true);
          return;
        }
      }
      
      // No automatic sync - user must choose how to handle any differences
      console.log('[Sync] No automatic sync - user must choose resolution method');
      
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
        resolvedData.recurring,
        resolvedData.friends,
        user!.uid
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


