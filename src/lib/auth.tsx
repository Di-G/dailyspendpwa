import React, { createContext, useContext, useEffect, useMemo, useState, useRef, useCallback } from "react";
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
  setRefreshingState: (isRefreshing: boolean) => void; // Add this to the type
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [emailForSignIn, setEmailForSignIn] = useState<string>(() => localStorage.getItem("dailyspend_emailForSignIn") || "");
  const previousUserId = useRef<string | null>(null);
  const authStateChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastAuthStateRef = useRef<User | null>(null);
  const isRefreshingRef = useRef<boolean>(false); // Track if a refresh operation is in progress
  const networkRetryCountRef = useRef<number>(0); // Track network retry attempts
  const lastStableUserRef = useRef<User | null>(null); // Track the last stable user state
  const protectedUserRef = useRef<User | null>(null); // Protected user state during refresh
  const authListenerRef = useRef<(() => void) | null>(null); // Reference to the auth listener

  // Function to temporarily disable auth state changes during refresh operations
  const setRefreshingState = (isRefreshing: boolean) => {
    isRefreshingRef.current = isRefreshing;
    if (import.meta.env.DEV) {
      console.log('[Auth] Refresh state changed:', isRefreshing);
    }
    
    // When starting refresh, protect the current user state
    if (isRefreshing && user) {
      protectedUserRef.current = user;
      if (import.meta.env.DEV) {
        console.log('[Auth] Protecting user state during refresh:', user.uid);
      }
      
      // Temporarily disable the auth listener during refresh
      if (authListenerRef.current) {
        if (import.meta.env.DEV) {
          console.log('[Auth] Temporarily disabling Firebase auth listener during refresh');
        }
        authListenerRef.current();
        authListenerRef.current = null;
      }
    } else if (!isRefreshing) {
      // When refresh ends, clear the protected state and re-enable the listener
      protectedUserRef.current = null;
      if (import.meta.env.DEV) {
        console.log('[Auth] Clearing protected user state after refresh');
      }
      
      // Re-enable the auth listener after refresh
      if (!authListenerRef.current) {
        if (import.meta.env.DEV) {
          console.log('[Auth] Re-enabling Firebase auth listener after refresh');
        }
        setupAuthListener();
      }
    }
  };

  // Helper function to process auth state changes
  const processAuthStateChange = useCallback((u: User | null) => {
    if (import.meta.env.DEV) {
      console.log('[Auth] Processing meaningful auth state change');
    }
    
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
      lastStableUserRef.current = u; // Update stable user reference
    } else {
      previousUserId.current = null;
      lastStableUserRef.current = null;
    }

    // Update the last known auth state
    lastAuthStateRef.current = u;
  }, []);

  // Helper function to setup the auth listener
  const setupAuthListener = useCallback(() => {
    if (authListenerRef.current) {
      return; // Already set up
    }

    const unsub = onAuthStateChanged(auth, (u) => {
      // If we're in the middle of a refresh operation, ignore auth state changes
      if (isRefreshingRef.current) {
        if (import.meta.env.DEV) {
          console.log('[Auth] Ignoring auth state change during refresh operation');
        }
        return;
      }

      // Clear any pending timeout
      if (authStateChangeTimeoutRef.current) {
        clearTimeout(authStateChangeTimeoutRef.current);
        authStateChangeTimeoutRef.current = null;
      }

      // Debounce auth state changes to prevent rapid logout/login during operations like pull-to-refresh
      authStateChangeTimeoutRef.current = setTimeout(() => {
        // Only process if the auth state actually changed meaningfully
        const currentUser = lastAuthStateRef.current;
        const newUser = u;
        const stableUser = lastStableUserRef.current;
        const protectedUser = protectedUserRef.current;
        
        // Debug logging for auth state changes
        if (import.meta.env.DEV) {
          console.log('[Auth] Auth state change detected:', {
            currentUser: currentUser?.uid || 'null',
            newUser: newUser?.uid || 'null',
            stableUser: stableUser?.uid || 'null',
            protectedUser: protectedUser?.uid || 'null',
            isLoading,
            timestamp: new Date().toISOString()
          });
        }
        
        // CRITICAL: If we have a protected user during refresh and the new user is null,
        // this is definitely a false logout - ignore it completely
        if (protectedUser && !newUser) {
          if (import.meta.env.DEV) {
            console.log('[Auth] CRITICAL: False logout detected during refresh, maintaining protected user state');
          }
          return;
        }
        
        // CRITICAL: If we have a stable user and the new user is null, 
        // this is likely a false logout during refresh - ignore it
        if (stableUser && !newUser && isRefreshingRef.current === false) {
          if (import.meta.env.DEV) {
            console.log('[Auth] CRITICAL: Potential false logout detected, checking Firebase state...');
          }
          
          // Double-check with Firebase directly
          if (auth.currentUser && auth.currentUser.uid === stableUser.uid) {
            if (import.meta.env.DEV) {
              console.log('[Auth] Firebase confirms user is still authenticated, ignoring false logout');
            }
            return;
          }
        }
        
        // Check if this is a meaningful change (not just a temporary token refresh)
        const isMeaningfulChange = 
          // User was logged out and is now logged in
          (!currentUser && newUser) ||
          // User was logged in and is now logged out
          (currentUser && !newUser) ||
          // User switched accounts
          (currentUser && newUser && currentUser.uid !== newUser.uid) ||
          // First time initialization
          (isLoading && newUser);

        // Additional check: if both users exist and have the same UID, 
        // this might just be a token refresh or metadata update
        if (currentUser && newUser && currentUser.uid === newUser.uid) {
          // Only update if there are significant changes (not just token refresh)
          const hasSignificantChanges = 
            currentUser.email !== newUser.email ||
            currentUser.displayName !== newUser.displayName ||
            currentUser.emailVerified !== newUser.emailVerified;
          
          if (!hasSignificantChanges) {
            // This is likely just a token refresh, don't trigger state changes
            if (import.meta.env.DEV) {
              console.log('[Auth] Ignoring token refresh - no significant changes');
            }
            return;
          }
        }

        // Additional protection: if the user object is essentially the same,
        // don't trigger state changes that could cause UI flicker
        if (currentUser && newUser && 
            currentUser.uid === newUser.uid &&
            currentUser.email === newUser.email &&
            currentUser.displayName === newUser.displayName &&
            currentUser.emailVerified === newUser.emailVerified) {
          if (import.meta.env.DEV) {
            console.log('[Auth] Ignoring identical user object update');
          }
          return;
        }

        // Network stability check: if we're getting rapid auth state changes,
        // this might indicate network issues - add additional debouncing
        if (currentUser && !newUser && networkRetryCountRef.current < 3) {
          // This might be a temporary network issue, wait a bit longer
          networkRetryCountRef.current++;
          if (import.meta.env.DEV) {
            console.log('[Auth] Potential network issue detected, retry count:', networkRetryCountRef.current);
          }
          
          // Wait longer before processing this change
          setTimeout(() => {
            // Re-check the current auth state
            if (auth.currentUser && auth.currentUser.uid === currentUser.uid) {
              // User is still authenticated, this was a false alarm
              if (import.meta.env.DEV) {
                console.log('[Auth] False logout detected, user still authenticated');
              }
              networkRetryCountRef.current = 0;
              return;
            }
            // User is actually logged out, process the change
            processAuthStateChange(u);
          }, 1000); // Wait 1 second to see if it's a temporary issue
          
          return;
        }

        // Reset network retry count if we have a stable user
        if (newUser) {
          networkRetryCountRef.current = 0;
        }

        if (isMeaningfulChange) {
          processAuthStateChange(u);
        } else if (import.meta.env.DEV) {
          console.log('[Auth] Ignoring non-meaningful auth state change');
        }
      }, 200); // Increased to 200ms debounce for better stability
      
      authListenerRef.current = unsub;
    });
  }, [isLoading, processAuthStateChange]);

  useEffect(() => {
    // Listen for global refresh events
    const handleRefreshStart = () => {
      if (import.meta.env.DEV) {
        console.log('[Auth] Global refresh event detected, protecting auth state');
      }
      setRefreshingState(true);
    };

    const handleRefreshEnd = () => {
      if (import.meta.env.DEV) {
        console.log('[Auth] Global refresh event ended, re-enabling auth state changes');
      }
      setRefreshingState(false);
    };

    // Listen for custom refresh events
    window.addEventListener('dailyspend:refresh-start', handleRefreshStart);
    window.addEventListener('dailyspend:refresh-end', handleRefreshEnd);

    // Setup the initial auth listener
    setupAuthListener();
    
    return () => {
      if (authStateChangeTimeoutRef.current) {
        clearTimeout(authStateChangeTimeoutRef.current);
      }
      if (authListenerRef.current) {
        authListenerRef.current();
      }
      window.removeEventListener('dailyspend:refresh-start', handleRefreshStart);
      window.removeEventListener('dailyspend:refresh-end', handleRefreshEnd);
    };
  }, [setupAuthListener]);

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
    setRefreshingState(true);
    try {
      await reload(auth.currentUser);
      setUser({ ...auth.currentUser });
    } finally {
      setRefreshingState(false);
    }
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
      user: protectedUserRef.current || user, // Return protected user during refresh, otherwise current user
      isLoading,
      isVerified: (protectedUserRef.current || user)?.emailVerified === true,
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
      setRefreshingState, // Expose this function for external use
    }),
    [user, isLoading, displayName, emailForSignIn]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}


