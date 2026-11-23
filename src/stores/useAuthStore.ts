import { create } from 'zustand';
import { onAuthStateChanged, type Unsubscribe } from 'firebase/auth';
import { auth } from '../services/firebase/config';
import {
  syncUserProfileDocs,
  updateUserProfile,
  logoutUser,
} from '../services/auth/authService';
import { createGuestSeedState } from '../services/sandbox/guestSeed';
import type { AppUser, ThemeMode, UserProfile } from '../types';

function applyThemeToDom(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function getInitialTheme(): 'light' | 'dark' {
  try {
    const stored = window.localStorage.getItem('taskflow_theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore storage access issues
  }
  return 'light';
}

const PREVIEW_MODE_KEY = 'taskflow_preview_mode';

function setPreviewFlag(enabled: boolean): void {
  try {
    if (enabled) {
      window.sessionStorage.setItem(PREVIEW_MODE_KEY, '1');
    } else {
      window.sessionStorage.removeItem(PREVIEW_MODE_KEY);
    }
  } catch {
    // ignore storage access issues
  }
}

function getPreviewFlag(): boolean {
  try {
    return window.sessionStorage.getItem(PREVIEW_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export interface AuthState {
  user: AppUser | null;
  profile: UserProfile | null;
  authReady: boolean;
  isGuestMode: boolean;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  initAuth: () => Unsubscribe;
  enterGuestMode: () => void;
  setSession: (user: AppUser, profile: UserProfile | null) => void;
  saveProfile: (updates: Partial<UserProfile>) => Promise<void>;
  toggleTheme: () => void;
  setTheme: (next: ThemeMode) => void;
  toggleSidebar: () => void;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  authReady: false,
  isGuestMode: false,
  theme: getInitialTheme(),
  sidebarCollapsed: false,

  initAuth: () => {
    applyThemeToDom(get().theme);

    // Support ?autostart=1 or active tab preview session
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' || getPreviewFlag()) {
      setPreviewFlag(true);
      const seed = createGuestSeedState();
      set({
        user: seed.user,
        profile: seed.profile,
        authReady: true,
        isGuestMode: true,
      });
      return () => {};
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (get().isGuestMode && !firebaseUser) {
        set({ authReady: true });
        return;
      }

      if (firebaseUser) {
        setPreviewFlag(false);
        const mappedUser: AppUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          emailVerified: firebaseUser.emailVerified,
        };
        try {
          const profile: UserProfile | null = firebaseUser.emailVerified
            ? await syncUserProfileDocs(firebaseUser)
            : {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                fullName:
                  firebaseUser.displayName ||
                  firebaseUser.email?.split('@')[0] ||
                  'TaskFlow User',
                avatarUrl: firebaseUser.photoURL || '',
                bio: '',
                roleTitle: 'Member',
                theme: get().theme,
              };
          set({
            user: mappedUser,
            profile,
            authReady: true,
            isGuestMode: false,
          });
        } catch (err) {
          console.error('Failed syncing user profile:', err);
          set({
            user: mappedUser,
            profile: {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              fullName: firebaseUser.displayName || 'TaskFlow User',
              avatarUrl: firebaseUser.photoURL || '',
              bio: '',
              roleTitle: 'Member',
            },
            authReady: true,
            isGuestMode: false,
          });
        }
      } else {
        set({
          user: null,
          profile: null,
          authReady: true,
          isGuestMode: false,
        });
      }
    });

    return unsubscribe;
  },

  enterGuestMode: () => {
    setPreviewFlag(true);
    const seed = createGuestSeedState();
    set({
      user: seed.user,
      profile: seed.profile,
      authReady: true,
      isGuestMode: true,
    });
  },

  setSession: (user, profile) => {
    setPreviewFlag(false);
    set({ user, profile, authReady: true, isGuestMode: false });
  },

  saveProfile: async (updates) => {
    const { user, profile, isGuestMode } = get();
    if (!user) return;
    const merged: UserProfile = {
      uid: user.uid,
      email: profile?.email || user.email || '',
      fullName: profile?.fullName || user.displayName || 'TaskFlow User',
      ...profile,
      ...updates,
    };
    set({ profile: merged });
    if (!isGuestMode && user.emailVerified) {
      await updateUserProfile(user.uid, merged);
    }
  },

  toggleTheme: () => {
    const next: 'light' | 'dark' = get().theme === 'dark' ? 'light' : 'dark';
    applyThemeToDom(next);
    try {
      window.localStorage.setItem('taskflow_theme', next);
    } catch {
      // ignore
    }
    set({ theme: next });
  },

  setTheme: (next) => {
    const resolved: 'light' | 'dark' = next === 'dark' ? 'dark' : 'light';
    applyThemeToDom(resolved);
    try {
      window.localStorage.setItem('taskflow_theme', resolved);
    } catch {
      // ignore
    }
    set({ theme: resolved });
  },

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  logout: async () => {
    const wasGuest = get().isGuestMode;
    setPreviewFlag(false);
    set({ user: null, profile: null, isGuestMode: false });
    if (!wasGuest) {
      await logoutUser();
    }
  },
}));
