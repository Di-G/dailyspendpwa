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
  getDocs,
  type Unsubscribe,
  type DocumentData,
  orderBy,
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

export async function uploadAllForUser(
  userId: string,
  payload: SyncPayload,
  bySessionId?: string,
  options?: { overwrite?: boolean }
): Promise<void> {
  const ref = doc(db, "users", userId);
  await setDoc(
    ref,
    { ...payload, updatedAt: serverTimestamp(), lastUpdatedBy: bySessionId || null },
    { merge: !(options?.overwrite ?? false) }
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


// ----- Partner/Friend request helpers -----

export type PartnerRequest = {
  id: string; // generated request id
  fromUid: string;
  fromEmail: string;
  fromName: string;
  toUid: string;
  toEmail: string;
  toName: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt?: unknown;
  updatedAt?: unknown;
};

/** Lookup a verified user profile by emailLower; returns uid and displayName if found */
export async function findVerifiedUserByEmail(email: string): Promise<{ uid: string; displayName: string; email: string } | null> {
  const emailLower = email.trim().toLowerCase();
  if (!emailLower) return null;
  const q = query(collection(db, "profiles"), where("emailLower", "==", emailLower), where("isVerified", "==", true));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  const data = docSnap.data() as any;
  return { uid: data.uid, displayName: data.displayName || data.email || "User", email: data.email };
}

/** Create a partner request document under both users for easy querying. */
export async function createPartnerRequest(params: {
  fromUid: string;
  fromEmail: string;
  fromName: string;
  toUid: string;
  toEmail: string;
  toName: string;
}): Promise<PartnerRequest> {
  const id = crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const payload: PartnerRequest = {
    id,
    fromUid: params.fromUid,
    fromEmail: params.fromEmail,
    fromName: params.fromName,
    toUid: params.toUid,
    toEmail: params.toEmail,
    toName: params.toName,
    status: "pending",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  // Store under a shared collection keyed by request id (single write to avoid cross-user subcollection writes)
  await setDoc(doc(db, "partnerRequests", id), payload as any, { merge: true });
  return payload;
}

/** Subscribe to incoming partner requests for a user */
export function subscribeToIncomingRequests(userId: string, onChange: (requests: PartnerRequest[]) => void): Unsubscribe {
  const qIncoming = query(
    collection(db, "partnerRequests"),
    where("toUid", "==", userId),
    where("status", "==", "pending")
  );
  return onSnapshot(qIncoming, (snap) => {
    const list: PartnerRequest[] = [];
    snap.forEach((d) => list.push(d.data() as PartnerRequest));
    onChange(list);
  });
}

/** Subscribe to outgoing partner requests for a user */
export function subscribeToOutgoingRequests(userId: string, onChange: (requests: PartnerRequest[]) => void): Unsubscribe {
  const qOutgoing = query(
    collection(db, "partnerRequests"),
    where("fromUid", "==", userId)
  );
  return onSnapshot(qOutgoing, (snap) => {
    const list: PartnerRequest[] = [];
    snap.forEach((d) => {
      // Only include documents that exist and have valid data
      if (d.exists()) {
        const data = d.data() as PartnerRequest;
        // Ensure we have all required fields
        if (data.id && data.fromUid && data.toUid && data.status) {
          list.push(data);
        }
      }
    });
    onChange(list);
  }, (error) => {
    console.error('Error in outgoing requests subscription:', error);
    // Don't update the list on error, keep previous state
  });
}

/** Update a partner request's status and mirror to indexes */
export async function updatePartnerRequestStatus(id: string, status: PartnerRequest["status"]): Promise<void> {
  const ref = doc(db, "partnerRequests", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as PartnerRequest;
  const next = { ...data, status, updatedAt: serverTimestamp() } as any;
  await setDoc(ref, next, { merge: true });
}

/** Delete a partner request permanently */
export async function deletePartnerRequest(id: string): Promise<void> {
  const ref = doc(db, "partnerRequests", id);
  await deleteDoc(ref);
}


/** Subscribe to accepted partner relationships for a user (both directions) */
export function subscribeToAcceptedPartners(
  userId: string,
  onChange: (requests: PartnerRequest[]) => void
): Unsubscribe {
  const qFrom = query(
    collection(db, "partnerRequests"),
    where("fromUid", "==", userId),
    where("status", "==", "accepted")
  );
  const qTo = query(
    collection(db, "partnerRequests"),
    where("toUid", "==", userId),
    where("status", "==", "accepted")
  );

  let latestFrom: PartnerRequest[] = [];
  let latestTo: PartnerRequest[] = [];

  const emit = () => {
    const map = new Map<string, PartnerRequest>();
    [...latestFrom, ...latestTo].forEach((r) => map.set(r.id, r));
    onChange(Array.from(map.values()));
  };

  const stopFrom = onSnapshot(qFrom, (snap) => {
    const list: PartnerRequest[] = [];
    snap.forEach((d) => list.push(d.data() as PartnerRequest));
    latestFrom = list;
    emit();
  });

  const stopTo = onSnapshot(qTo, (snap) => {
    const list: PartnerRequest[] = [];
    snap.forEach((d) => list.push(d.data() as PartnerRequest));
    latestTo = list;
    emit();
  });

  return () => {
    try { stopFrom(); } catch {}
    try { stopTo(); } catch {}
  };
}

/** Subscribe to accepted partner requests where the current user is the toUid (people who added them as partners) */
export function subscribeToAcceptedIncomingPartners(
  userId: string,
  onChange: (requests: PartnerRequest[]) => void
): Unsubscribe {
  const qAcceptedIncoming = query(
    collection(db, "partnerRequests"),
    where("toUid", "==", userId),
    where("status", "==", "accepted")
  );
  return onSnapshot(qAcceptedIncoming, (snap) => {
    const list: PartnerRequest[] = [];
    snap.forEach((d) => list.push(d.data() as PartnerRequest));
    onChange(list);
  });
}


// ----- 1:1 Chat helpers -----

export type ChatMessage = {
  id: string;
  chatId: string;
  fromUid: string;
  text: string;
  createdAt?: unknown;
  fromName?: string | null;
};

export type ChatMeta = {
  chatId: string;
  participants: string[];
  clearedAtBy?: Record<string, unknown>;
  remindClearAtBy?: Record<string, unknown>;
  updatedAt?: unknown;
  lastMessage?: string;
  lastFromUid?: string;
};

/** Deterministic chat id for a pair of users */
export function getDirectChatId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join("_");
}

/** Ensure chat metadata document exists with participants */
export async function ensureDirectChat(chatId: string, uidA: string, uidB: string): Promise<void> {
  const chatRef = doc(db, "chats", chatId);
  await setDoc(
    chatRef,
    {
      chatId,
      participants: [uidA, uidB].sort(),
      updatedAt: serverTimestamp(),
    } as any,
    { merge: true }
  );
}

/** Subscribe to messages for a chat, ordered by createdAt asc */
export function subscribeToChatMessages(
  chatId: string,
  onChange: (messages: ChatMessage[]) => void
): Unsubscribe {
  const ref = collection(db, "chats", chatId, "messages");
  const qy = query(ref, orderBy("createdAt", "asc"));
  return onSnapshot(qy, (snap) => {
    const list: ChatMessage[] = [];
    snap.forEach((d) => {
      if (d.exists()) list.push(d.data() as ChatMessage);
    });
    onChange(list);
  });
}

/** Subscribe to chat metadata (participants, clearedAtBy, reminders, etc.) */
export function subscribeToChatMeta(
  chatId: string,
  onChange: (meta: ChatMeta | null) => void
): Unsubscribe {
  const ref = doc(db, "chats", chatId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return onChange(null);
    onChange(snap.data() as unknown as ChatMeta);
  });
}

/** Send a message to a chat */
export async function sendChatMessage(params: {
  chatId: string;
  fromUid: string;
  peerUid: string;
  text: string;
  fromName?: string;
}): Promise<void> {
  const { chatId, fromUid, peerUid, text, fromName } = params;
  // Ensure chat metadata exists first so message reads pass rules
  await ensureDirectChat(chatId, fromUid, peerUid);
  const messagesRef = collection(db, "chats", chatId, "messages");
  const msgRef = doc(messagesRef);
  const payload: ChatMessage = {
    id: msgRef.id,
    chatId,
    fromUid,
    text,
    fromName: fromName ?? null,
    createdAt: serverTimestamp(),
  } as any;
  await setDoc(msgRef, payload as any, { merge: true });
  // Upsert chat metadata (for future list views)
  await setDoc(
    doc(db, "chats", chatId),
    {
      chatId,
      participants: [fromUid, peerUid].sort(),
      lastMessage: text,
      lastFromUid: fromUid,
      updatedAt: serverTimestamp(),
    } as any,
    { merge: true }
  );
}

/** Update a user's clearedAt in chat metadata */
export async function updateChatClearedAt(chatId: string, uid: string): Promise<void> {
  const ref = doc(db, "chats", chatId);
  const field = `clearedAtBy.${uid}` as any;
  await setDoc(
    ref,
    {
      updatedAt: serverTimestamp(),
      clearedAtBy: { [uid]: serverTimestamp() },
    } as any,
    { merge: true }
  );
}

/** Send a reminder to the other user to clear chat (stored in chat meta) */
export async function sendChatReminder(chatId: string, toUid: string): Promise<void> {
  const ref = doc(db, "chats", chatId);
  await setDoc(
    ref,
    {
      updatedAt: serverTimestamp(),
      remindClearAtBy: { [toUid]: serverTimestamp() },
    } as any,
    { merge: true }
  );
}

