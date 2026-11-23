import { create } from 'zustand';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../services/firebase/config.js';
import {
  syncUserProfileDocs,
  updateUserProfile,
  logoutUser,
} from '../services/auth/authService.js';
import { createGuestSeedState } from '../services/sandbox/guestSeed.js';

function applyThemeToDom(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

function getInitialTheme() {
  try {
    const stored = window.localStorage.getItem('taskflow_theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore storage access issues
  }
  return 'light';
}

const PREVIEW_MODE_KEY = 'taskflow_preview_mode';

function setPreviewFlag(enabled) {
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

function getPreviewFlag() {
  try {
    return window.sessionStorage.getItem(PREVIEW_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export const useAuthStore = create((set, get) => ({
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
        try {
          const profile = firebaseUser.emailVerified
            ? await syncUserProfileDocs(firebaseUser)
            : {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                fullName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'TaskFlow User',
                avatarUrl: firebaseUser.photoURL || '',
                bio: '',
                roleTitle: 'Member',
                theme: get().theme,
              };
          set({
            user: firebaseUser,
            profile,
            authReady: true,
            isGuestMode: false,
          });
        } catch (err) {
          console.error('Failed syncing user profile:', err);
          set({
            user: firebaseUser,
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
    const merged = {
      ...profile,
      ...updates,
    };
    set({ profile: merged });
    if (!isGuestMode && user.emailVerified) {
      await updateUserProfile(user.uid, merged);
    }
  },

  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    applyThemeToDom(next);
    try {
      window.localStorage.setItem('taskflow_theme', next);
    } catch {
      // ignore
    }
    set({ theme: next });
  },

  setTheme: (next) => {
    const resolved = next === 'dark' ? 'dark' : 'light';
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
