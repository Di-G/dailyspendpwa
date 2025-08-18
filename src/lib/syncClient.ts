import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  downloadAllForUser,
  uploadAllForUser,
  startSessionPresence,
  subscribeToActiveSessions,
  subscribeToUserDoc,
} from "@/lib/sync";
import { queryClient } from "@/lib/queryClient";
import { getCategories, getExpenses, getRecurringExpenses, updateAllData } from "@/lib/localStorage";
import { 
  analyzeDataConflicts, 
  applyConflictResolution, 
  getCurrentLocalData,
  mergeData,
  type DataConflict,
  type ConflictResolution 
} from "./dataConflictResolver";

export function useRealtimeSync() {
  const { user, isVerified, signOutUser } = useAuth();
  const hasInitialized = useRef(false);
  const lastUserId = useRef<string | null>(null);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [pendingConflict, setPendingConflict] = useState<DataConflict | null>(null);
  const conflictDialogOpenRef = useRef(false);
  const pendingConflictRef = useRef<DataConflict | null>(null);
  const suppressConflictsUntil = useRef<number>(0);
  const suppressUploadsUntil = useRef<number>(0);
  const sessionSynced = useRef<boolean>(false);
  const sessionIdRef = useRef<string>(
    (typeof crypto !== "undefined" && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  );
  const stopPresenceRef = useRef<null | (() => void)>(null);
  const stopActiveSessionsRef = useRef<null | (() => void)>(null);
  const stopUserDocRef = useRef<null | (() => void)>(null);
  const activeSessionsRef = useRef<number>(0);

  useEffect(() => {
    conflictDialogOpenRef.current = conflictDialogOpen;
  }, [conflictDialogOpen]);

  useEffect(() => {
    pendingConflictRef.current = pendingConflict;
  }, [pendingConflict]);

  useEffect(() => {
    // Reset initialization when user changes (including logout/login)
    const currentUserId = user?.uid ?? null;
    if (currentUserId !== lastUserId.current) {
      hasInitialized.current = false;
      lastUserId.current = currentUserId;
      sessionSynced.current = false;

      // Tear down listeners/presence for previous user
      try { stopPresenceRef.current?.(); } catch {}
      stopPresenceRef.current = null;
      try { stopActiveSessionsRef.current?.(); } catch {}
      stopActiveSessionsRef.current = null;
      try { stopUserDocRef.current?.(); } catch {}
      stopUserDocRef.current = null;
      activeSessionsRef.current = 0;
    }

    if (!user || !isVerified) return;
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Initial sync with conflict resolution
    handleInitialSync();

    // Listen for local changes and handle conflicts before uploading
    const onChanged = async () => {
      try {
        // If a conflict dialog is already open or recently resolved, skip background handling
        if (conflictDialogOpenRef.current || pendingConflictRef.current) return;
        if (Date.now() < suppressConflictsUntil.current) return;

        if (!sessionSynced.current) {
          // Before a session is confirmed in-sync, check for conflicts
          const localSnapshot = getCurrentLocalData();
          const remoteSnapshot = await downloadAllForUser(user.uid);
          const conflict = analyzeDataConflicts(localSnapshot, remoteSnapshot as any);

          const hasConflicts = conflict.hasOnlineData && (
            conflict.conflicts.categories ||
            conflict.conflicts.expenses ||
            conflict.conflicts.recurring
          );

          if (hasConflicts) {
            // Show conflict dialog; do not auto-upload
            setPendingConflict(conflict);
            setConflictDialogOpen(true);
            return;
          }
        }

        // Either session is in-sync or no conflicts detected; proceed with upload
        if (Date.now() < suppressUploadsUntil.current) return;
        await uploadAllForUser(user.uid, {
          categories: getCategories(),
          expenses: getExpenses(),
          recurring: getRecurringExpenses(),
        }, sessionIdRef.current);
      } catch (e) {
        console.error('Background upload failed', e);
      }
    };

    window.addEventListener('dailyspend:data-changed', onChanged);
    
    return () => {
      window.removeEventListener('dailyspend:data-changed', onChanged);
    };
  }, [user, isVerified]);

  // Start presence and realtime user doc listener when verified
  useEffect(() => {
    if (!user || !isVerified) return;
    // Start presence heartbeat
    stopPresenceRef.current = startSessionPresence(user.uid, sessionIdRef.current, {
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      platform: typeof navigator !== 'undefined' ? (navigator as any).platform : 'unknown',
    });

    // Attach realtime listener immediately; we process only when update is from another session
    stopUserDocRef.current = subscribeToUserDoc(user.uid, (data) => {
      if (!data) return;
      // Only skip when the update is known to be from this same session
      if (data.lastUpdatedBy && data.lastUpdatedBy === sessionIdRef.current) return;
      try {
        const local = getCurrentLocalData();
        const online = {
          categories: (data.categories as any[]) || [],
          expenses: (data.expenses as any[]) || [],
          recurring: (data.recurring as any[]) || [],
        };
        const merged = mergeData(local as any, online as any);
        // Suppress upload loop from local change event
        suppressUploadsUntil.current = Date.now() + 2000;
        updateAllData(merged.categories as any, merged.expenses as any, merged.recurring as any);
        // Proactively refresh UI queries immediately
        void queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/expenses"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/analytics/daily-total"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/analytics/category-totals"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/analytics/monthly-totals"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/analytics/weekly-totals"] });
        void queryClient.refetchQueries({ queryKey: ["/api/categories"], type: 'active' });
        void queryClient.refetchQueries({ queryKey: ["/api/expenses"], type: 'active' });
        void queryClient.refetchQueries({ queryKey: ["/api/analytics/daily-total"], type: 'active' });
        void queryClient.refetchQueries({ queryKey: ["/api/analytics/category-totals"], type: 'active' });
        void queryClient.refetchQueries({ queryKey: ["/api/analytics/monthly-totals"], type: 'active' });
        void queryClient.refetchQueries({ queryKey: ["/api/analytics/weekly-totals"], type: 'active' });
      } catch (err) {
        console.error('[Sync] Realtime merge failed', err);
      }
    });

    return () => {
      try { stopUserDocRef.current?.(); } catch {}
      stopUserDocRef.current = null;
      try { stopPresenceRef.current?.(); } catch {}
      stopPresenceRef.current = null;
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
      // Suppress conflict detection briefly to avoid flicker while remote catches up
      suppressConflictsUntil.current = Date.now() + 2000;
      const resolvedData = applyConflictResolution(resolution, conflict.localData, conflict.onlineData);
      const shouldOverwriteRemote = resolution === 'overwrite-online';
      
      // Update local storage with resolved data using the new function
      updateAllData(
        resolvedData.categories,
        resolvedData.expenses,
        resolvedData.recurring
      );
      
      // Upload resolved data to cloud
      await uploadAllForUser(
        user!.uid,
        resolvedData as any,
        sessionIdRef.current,
        { overwrite: shouldOverwriteRemote }
      );
      
      // Emit change event to refresh UI immediately
      window.dispatchEvent(new CustomEvent('dailyspend:data-changed'));

      // Mark this session as in-sync so future local changes auto-upload without dialog
      sessionSynced.current = true;
      
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
    onConflictDialogClose: async () => {
      try {
        await signOutUser();
      } catch {}
      setConflictDialogOpen(false);
      setPendingConflict(null);
      try {
        window.dispatchEvent(new CustomEvent('dailyspend:open-profile'));
      } catch {}
    }
  };
}


