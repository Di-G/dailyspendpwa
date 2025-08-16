import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

type SyncPayload = {
  categories: unknown;
  expenses: unknown;
  recurring: unknown;
  friends: unknown;
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

export async function downloadFriendData(friendUserId: string): Promise<SyncPayload | null> {
  const ref = doc(db, "users", friendUserId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as SyncPayload;
}

export async function uploadFriendsForUser(userId: string, friends: unknown): Promise<void> {
  const ref = doc(db, "users", userId);
  await updateDoc(ref, { friends, updatedAt: serverTimestamp() });
}

// Manual sync functions for user control
export async function manualDownloadData(userId: string): Promise<SyncPayload | null> {
  try {
    console.log('[Manual Sync] Downloading data for user:', userId);
    const data = await downloadAllForUser(userId);
    if (data) {
      console.log('[Manual Sync] Download successful');
    } else {
      console.log('[Manual Sync] No online data found');
    }
    return data;
  } catch (error) {
    console.error('[Manual Sync] Download failed:', error);
    throw error;
  }
}

export async function manualUploadData(userId: string, payload: SyncPayload): Promise<void> {
  try {
    console.log('[Manual Sync] Uploading data for user:', userId);
    await uploadAllForUser(userId, payload);
    console.log('[Manual Sync] Upload successful');
  } catch (error) {
    console.error('[Manual Sync] Upload failed:', error);
    throw error;
  }
}

// Force overwrite online data (completely replace)
export async function forceOverwriteOnlineData(userId: string, payload: SyncPayload): Promise<void> {
  try {
    console.log('[Manual Sync] Force overwriting online data for user:', userId);
    const ref = doc(db, "users", userId);
    // Use setDoc without merge to completely replace the document
    await setDoc(ref, { ...payload, updatedAt: serverTimestamp() });
    console.log('[Manual Sync] Force overwrite successful');
  } catch (error) {
    console.error('[Manual Sync] Force overwrite failed:', error);
    throw error;
  }
}


