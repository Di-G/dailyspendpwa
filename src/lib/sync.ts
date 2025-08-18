import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  collection,
  deleteDoc,
  query,
  where,
  type Unsubscribe,
  type DocumentData,
} from "firebase/firestore";

type SyncPayload = {
  categories: unknown;
  expenses: unknown;
  recurring: unknown;
  updatedAt?: unknown;
};

export async function downloadAllForUser(userId: string): Promise<SyncPayload | null> {
  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as SyncPayload;
}

export async function uploadAllForUser(userId: string, payload: SyncPayload, bySessionId?: string): Promise<void> {
  const ref = doc(db, "users", userId);
  await setDoc(
    ref,
    { ...payload, updatedAt: serverTimestamp(), lastUpdatedBy: bySessionId || null },
    { merge: true }
  );
}

export async function markUpdated(userId: string): Promise<void> {
  const ref = doc(db, "users", userId);
  await updateDoc(ref, { updatedAt: serverTimestamp() });
}

/**
 * Presence: Track active sessions per user under users/{userId}/sessions/{sessionId}
 * We write a heartbeat and clean up on unload. Returns a stop function.
 */
export function startSessionPresence(userId: string, sessionId: string, metadata?: Record<string, unknown>): () => void {
  const ref = doc(db, "users", userId, "sessions", sessionId);
  let stopped = false;
  const heartbeat = async () => {
    try {
      await setDoc(
        ref,
        {
          sessionId,
          updatedAt: serverTimestamp(),
          ...(metadata || {}),
        },
        { merge: true }
      );
    } catch {
      // non-blocking
    }
  };

  // Initial write
  void heartbeat();
  const intervalId = setInterval(heartbeat, 25_000);

  const onUnload = async () => {
    if (stopped) return;
    try { await deleteDoc(ref); } catch {}
  };
  // Best-effort cleanup on tab close
  window.addEventListener("beforeunload", onUnload);
  window.addEventListener("pagehide", onUnload);

  // Return stop function
  return () => {
    if (stopped) return;
    stopped = true;
    clearInterval(intervalId);
    window.removeEventListener("beforeunload", onUnload);
    window.removeEventListener("pagehide", onUnload);
    void (async () => { try { await deleteDoc(ref); } catch {} })();
  };
}

/**
 * Subscribe to active session count for the user. Active = heartbeat within last 60s.
 */
export function subscribeToActiveSessions(
  userId: string,
  onCount: (activeCount: number) => void
): Unsubscribe {
  const sessionsRef = collection(db, "users", userId, "sessions");
  // Listen to all sessions under this user
  return onSnapshot(sessionsRef, (snap) => {
    const now = Date.now();
    let active = 0;
    snap.forEach((docSnap) => {
      const data = docSnap.data() as DocumentData & { updatedAt?: { toDate: () => Date } };
      const updatedAt = data?.updatedAt?.toDate?.();
      if (updatedAt && now - updatedAt.getTime() <= 60_000) {
        active += 1;
      }
    });
    onCount(active);
  });
}

/**
 * Subscribe to user's root document for realtime changes.
 */
export function subscribeToUserDoc(
  userId: string,
  onChange: (data: (SyncPayload & { lastUpdatedBy?: string | null }) | null) => void
): Unsubscribe {
  const ref = doc(db, "users", userId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      onChange(null);
      return;
    }
    onChange(snap.data() as SyncPayload & { lastUpdatedBy?: string | null });
  });
}


