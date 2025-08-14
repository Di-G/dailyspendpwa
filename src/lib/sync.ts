import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

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

export async function uploadAllForUser(userId: string, payload: SyncPayload): Promise<void> {
  const ref = doc(db, "users", userId);
  await setDoc(ref, { ...payload, updatedAt: serverTimestamp() }, { merge: true });
}

export async function markUpdated(userId: string): Promise<void> {
  const ref = doc(db, "users", userId);
  await updateDoc(ref, { updatedAt: serverTimestamp() });
}


