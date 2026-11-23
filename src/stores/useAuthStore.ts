import { create } from 'zustand';
import { onAuthStateChanged, type Unsubscribe } from 'firebase/auth';
import { auth } from '../services/firebase/config';
import { supabase, isSupabaseConfigured } from '../services/supabase/client';
import {
  syncUserProfileDocs,
  updateUserProfile,
  logoutUser,
  syncSupabaseUserProfile,
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

export type AuthProviderType = 'firebase' | 'supabase' | 'guest' | null;

export interface AuthState {
  user: AppUser | null;
  profile: UserProfile | null;
  authReady: boolean;
  isGuestMode: boolean;
  authProvider: AuthProviderType;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  initAuth: () => Unsubscribe;
  enterGuestMode: () => void;
  setSession: (
    user: AppUser,
    profile: UserProfile | null,
    provider?: Exclude<AuthProviderType, 'guest' | null>
  ) => void;
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
  authProvider: null,
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
        authProvider: 'guest',
      });
      return () => {};
    }

    let unsubSupabase = () => {};

    // 1. Supabase Auth Listener & Session Check
    if (isSupabaseConfigured() && supabase) {
      // Check active or returning OAuth session
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user && !get().user) {
          setPreviewFlag(false);
          const sbUser = session.user;
          const mappedUser: AppUser = {
            uid: sbUser.id,
            email: sbUser.email || null,
            displayName:
              (sbUser.user_metadata?.full_name as string) ||
              (sbUser.user_metadata?.name as string) ||
              sbUser.email?.split('@')[0] ||
              'TaskFlow User',
            photoURL:
              (sbUser.user_metadata?.avatar_url as string) ||
              (sbUser.user_metadata?.picture as string) ||
              null,
            emailVerified: Boolean(sbUser.confirmed_at || sbUser.email_confirmed_at),
          };

          try {
            const profile = await syncSupabaseUserProfile(sbUser);
            set({
              user: mappedUser,
              profile,
              authReady: true,
              isGuestMode: false,
              authProvider: 'supabase',
            });
          } catch (err) {
            console.error('Failed syncing initial Supabase profile:', err);
            set({
              user: mappedUser,
              profile: {
                uid: sbUser.id,
                email: sbUser.email || '',
                fullName: mappedUser.displayName || 'TaskFlow User',
                avatarUrl: mappedUser.photoURL || '',
                bio: '',
                roleTitle: 'Member',
              },
              authReady: true,
              isGuestMode: false,
              authProvider: 'supabase',
            });
          }
        }
      });

      // Listen to auth changes in Supabase (OAuth redirect return, sign-in, sign-out)
      const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
          if (get().authProvider === 'supabase') {
            set({
              user: null,
              profile: null,
              authReady: true,
              isGuestMode: false,
              authProvider: null,
            });
          }
          return;
        }

        if (session?.user) {
          setPreviewFlag(false);
          const sbUser = session.user;
          const mappedUser: AppUser = {
            uid: sbUser.id,
            email: sbUser.email || null,
            displayName:
              (sbUser.user_metadata?.full_name as string) ||
              (sbUser.user_metadata?.name as string) ||
              sbUser.email?.split('@')[0] ||
              'TaskFlow User',
            photoURL:
              (sbUser.user_metadata?.avatar_url as string) ||
              (sbUser.user_metadata?.picture as string) ||
              null,
            emailVerified: Boolean(sbUser.confirmed_at || sbUser.email_confirmed_at),
          };

          try {
            const profile = await syncSupabaseUserProfile(sbUser);
            set({
              user: mappedUser,
              profile,
              authReady: true,
              isGuestMode: false,
              authProvider: 'supabase',
            });
          } catch (err) {
            console.error('Failed syncing Supabase profile on state change:', err);
            set({
              user: mappedUser,
              profile: {
                uid: sbUser.id,
                email: sbUser.email || '',
                fullName: mappedUser.displayName || 'TaskFlow User',
                avatarUrl: mappedUser.photoURL || '',
                bio: '',
                roleTitle: 'Member',
              },
              authReady: true,
              isGuestMode: false,
              authProvider: 'supabase',
            });
          }
        }
      });

      unsubSupabase = () => {
        listener?.subscription?.unsubscribe();
      };
    }

    // 2. Firebase Auth Listener
    const unsubFirebase = onAuthStateChanged(auth, async (firebaseUser) => {
      if (get().isGuestMode && !firebaseUser) {
        set({ authReady: true });
        return;
      }

      // If user is already authenticated via Supabase, do not overwrite with Firebase null
      if (get().authProvider === 'supabase' && get().user) {
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
            authProvider: 'firebase',
          });
        } catch (err) {
          console.error('Failed syncing Firebase user profile:', err);
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
            authProvider: 'firebase',
          });
        }
      } else if (get().authProvider === 'firebase') {
        set({
          user: null,
          profile: null,
          authReady: true,
          isGuestMode: false,
          authProvider: null,
        });
      } else if (!get().user) {
        set({ authReady: true });
      }
    });

    return () => {
      unsubFirebase();
      unsubSupabase();
    };
  },

  enterGuestMode: () => {
    setPreviewFlag(true);
    const seed = createGuestSeedState();
    set({
      user: seed.user,
      profile: seed.profile,
      authReady: true,
      isGuestMode: true,
      authProvider: 'guest',
    });
  },

  setSession: (user, profile, provider = 'firebase') => {
    setPreviewFlag(false);
    set({ user, profile, authReady: true, isGuestMode: false, authProvider: provider });
  },

  saveProfile: async (updates) => {
    const { user, profile, isGuestMode, authProvider } = get();
    if (!user) return;
    const merged: UserProfile = {
      uid: user.uid,
      email: profile?.email || user.email || '',
      fullName: profile?.fullName || user.displayName || 'TaskFlow User',
      ...profile,
      ...updates,
    };
    set({ profile: merged });
    if (!isGuestMode) {
      if (authProvider === 'supabase' && isSupabaseConfigured() && supabase) {
        try {
          await supabase
            .from('profiles')
            .update({
              full_name: merged.fullName,
              avatar_url: merged.avatarUrl || '',
              role_title: merged.roleTitle || '',
              bio: merged.bio || '',
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.uid);
        } catch (err) {
          console.warn('Failed to update Supabase profile:', err);
        }
      } else if (user.emailVerified) {
        await updateUserProfile(user.uid, merged);
      }
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
    set({ user: null, profile: null, isGuestMode: false, authProvider: null });
    if (!wasGuest) {
      try {
        if (isSupabaseConfigured() && supabase) {
          await supabase.auth.signOut();
        }
      } catch (err) {
        console.warn('Supabase sign out error:', err);
      }
      try {
        await logoutUser();
      } catch (err) {
        console.warn('Firebase sign out error:', err);
      }
    }
  },
}));
