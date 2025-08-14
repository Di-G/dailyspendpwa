import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { downloadAllForUser, uploadAllForUser } from "@/lib/sync";
import { getCategories, getExpenses, getRecurringExpenses } from "@/lib/localStorage";

export function useRealtimeSync() {
  const { user, isVerified } = useAuth();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!user || !isVerified) return;
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Initial download on first verified sign-in
    (async () => {
      try {
        const remote = await downloadAllForUser(user.uid);
        if (remote) {
          // Merge strategy: if remote exists, prefer remote (server as source of truth)
          try {
            if (remote.categories) localStorage.setItem('dailyspend_categories', JSON.stringify(remote.categories));
            if (remote.expenses) localStorage.setItem('dailyspend_expenses', JSON.stringify(remote.expenses));
            if (remote.recurring) localStorage.setItem('dailyspend_recurring_expenses', JSON.stringify(remote.recurring));
          } catch {}
        } else {
          // No remote data yet; push current local state as initial
          await uploadAllForUser(user.uid, {
            categories: getCategories(),
            expenses: getExpenses(),
            recurring: getRecurringExpenses(),
          });
        }
      } catch (e) {
        // Non-blocking; user can continue offline
        console.error('Initial sync failed', e);
      }
    })();

    // Listen for local changes and push immediately
    const onChanged = async () => {
      try {
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
    return () => window.removeEventListener('dailyspend:data-changed', onChanged);
  }, [user, isVerified]);
}


