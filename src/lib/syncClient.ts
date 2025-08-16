import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { downloadAllForUser, uploadAllForUser, manualUploadData, forceOverwriteOnlineData } from "@/lib/sync";
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
  const [uploadPromptOpen, setUploadPromptOpen] = useState(false);

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
      
      // Scenario 1: No local data, but online data exists - automatically download all online data
      if (!conflict.hasLocalData && conflict.hasOnlineData) {
        console.log('[Sync] No local data found, automatically downloading online data');
        showToast(
          "Data Restored", 
          "Your online data has been automatically downloaded to your device."
        );
        await performSync(conflict, 'replace-local-with-online');
        return;
      }
      
      // Scenario 2: Some local data, but no online data - ask user to upload local data
      if (conflict.hasLocalData && !conflict.hasOnlineData) {
        console.log('[Sync] Local data exists but no online data, prompting user to upload');
        setUploadPromptOpen(true);
        return;
      }
      
      // Scenario 3: Both local and online data exist
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
        
        // Check if there are actual conflicts OR if local data differs from online data
        const hasConflicts = conflict.conflicts.categories || 
                           conflict.conflicts.expenses || 
                           conflict.conflicts.recurring ||
                           conflict.conflicts.friends;
        
        // Show conflict resolution dialog if there are differences
        if (hasConflicts) {
          console.log('[Sync] Differences detected, showing conflict resolution dialog');
          setPendingConflict(conflict);
          setConflictDialogOpen(true);
          return;
        }
        
        // No conflicts, data is already in sync
        console.log('[Sync] No conflicts detected, data is already in sync');
      }
      
    } catch (e) {
      console.error('[Sync] Initial sync failed:', e);
      // Non-blocking; user can continue offline
    }
  };

  const performSync = async (conflict: DataConflict, resolution: ConflictResolution) => {
    try {
      const resolvedData = applyConflictResolution(resolution, conflict.localData, conflict.onlineData);
      
      // Update local storage with resolved data
      updateAllData(
        resolvedData.categories,
        resolvedData.expenses,
        resolvedData.recurring,
        resolvedData.friends,
        user!.uid
      );
      
      // Upload resolved data to cloud
      if (resolution === 'overwrite-online') {
        // Force overwrite online data completely
        await forceOverwriteOnlineData(user!.uid, resolvedData);
      } else {
        // Normal upload
        await uploadAllForUser(user!.uid, resolvedData);
      }
      
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

  const handleUploadLocalData = async () => {
    try {
      const localData = getCurrentLocalData(user!.uid);
      await forceOverwriteOnlineData(user!.uid, localData);
      showToast(
        "Data Uploaded", 
        "Your local data has been successfully uploaded to the cloud."
      );
      setUploadPromptOpen(false);
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  };

  return {
    conflictDialogOpen,
    pendingConflict,
    uploadPromptOpen,
    onConflictResolve: handleConflictResolution,
    onConflictDialogClose: () => setConflictDialogOpen(false),
    onUploadPromptClose: () => setUploadPromptOpen(false),
    onUploadLocalData: handleUploadLocalData
  };
}


