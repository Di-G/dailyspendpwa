import React, { createContext, useContext, useEffect, useMemo, useState, useRef } from "react";
import { auth } from "@/lib/firebase";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  reload,
  type User,
} from "firebase/auth";
import { clearAllData } from "./localStorage";

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isVerified: boolean;
  displayName: string;
  emailForSignIn: string;
  setDisplayName: (name: string) => void;
  setEmailForSignIn: (email: string) => void;
  saveDisplayName: () => Promise<void>;
  signUpWithEmailPassword: (email: string, password: string) => Promise<void>;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshUser: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [emailForSignIn, setEmailForSignIn] = useState<string>(() => localStorage.getItem("dailyspend_emailForSignIn") || "");
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      // Check if this is a different user (account switching)
      if (u && previousUserId.current && u.uid !== previousUserId.current) {
        console.log('[Auth] User account switched from', previousUserId.current, 'to', u.uid);
        // Clear local data from previous user to force fresh start
        clearAllData(previousUserId.current);
      }
      
      setUser(u);
      setDisplayName(u?.displayName || localStorage.getItem("dailyspend_displayName") || "");
      setIsLoading(false);
      
      // Update previous user ID
      if (u) {
        previousUserId.current = u.uid;
      } else {
        previousUserId.current = null;
      }
    });
    return () => unsub();
  }, []);

  const isVerified = user?.emailVerified === true;

  const saveDisplayName = async () => {
    if (user && displayName) {
      await updateProfile(user, { displayName });
    } else {
      localStorage.setItem("dailyspend_displayName", displayName);
    }
  };

  const signUpWithEmailPassword = async (email: string, password: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(cred.user, { displayName });
    }
    try {
      await sendEmailVerification(cred.user);
    } catch {}
    setEmailForSignIn(email);
  };

  const signInWithEmailPassword = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
    setEmailForSignIn(email);
  };

  const sendVerificationEmail = async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const refreshUser = async () => {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    setUser({ ...auth.currentUser });
  };

  const signOutUser = async () => {
    // Clear local data for current user before signing out
    if (user) {
      clearAllData(user.uid);
    }
    await signOut(auth);
  };

  const value = useMemo(
    () => ({
      user,
      isLoading,
      isVerified,
      displayName,
      emailForSignIn,
      setDisplayName,
      setEmailForSignIn,
      saveDisplayName,
      signUpWithEmailPassword,
      signInWithEmailPassword,
      sendVerificationEmail,
      sendPasswordReset,
      refreshUser,
      signOutUser,
    }),
    [user, isLoading, isVerified, displayName, emailForSignIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


