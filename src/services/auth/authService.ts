import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from '../firebase/config';
import { clampString } from '../../utils/kanban';
import { FIELD_LIMITS } from '../../constants/templates';
import type { ThemeMode, UserProfile } from '../../types';

interface ProfileSyncExtra {
  fullName?: string;
  avatarUrl?: string;
  roleTitle?: string;
}

interface AuthResult {
  user: FirebaseUser;
  profile: UserProfile | null;
}

export function formatAuthError(error: unknown): string {
  const errObj = error as { code?: string; message?: string } | null | undefined;
  const code = errObj?.code || '';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in popup was closed before completing.';
  if (code === 'auth/popup-blocked') {
    return 'Browser blocked the sign-in popup. Please allow popups for this site.';
  }
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    return 'Invalid email or password. Please check your credentials.';
  }
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters long.';
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not enabled in Firebase Console yet. Please use Sign in with Google, or enable Email/Password under Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return errObj?.message || 'Authentication failed. Please try again.';
}

export async function syncUserProfileDocs(
  firebaseUser: FirebaseUser | null,
  extra: ProfileSyncExtra = {}
): Promise<UserProfile | null> {
  if (!firebaseUser) return null;
  const uid = firebaseUser.uid;
  const userRef = doc(db, 'users', uid);
  const publicRef = doc(db, 'publicProfiles', uid);

  const fullName = clampString(
    extra.fullName ||
      firebaseUser.displayName ||
      firebaseUser.email?.split('@')[0] ||
      'TaskFlow User',
    FIELD_LIMITS.fullName
  );
  const avatarUrl = clampString(extra.avatarUrl ?? firebaseUser.photoURL ?? '', 512);
  const email = clampString(firebaseUser.email || '', 254);

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid,
        email,
        fullName,
        avatarUrl,
        bio: '',
        roleTitle: 'Product Member',
        theme: 'light',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  try {
    await setDoc(
      publicRef,
      {
        uid,
        fullName,
        avatarUrl,
        roleTitle: clampString(extra.roleTitle || 'Product Member', FIELD_LIMITS.roleTitle),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `publicProfiles/${uid}`);
  }

  try {
    const updatedSnap = await getDoc(userRef);
    return updatedSnap.exists()
      ? ({ id: updatedSnap.id, ...(updatedSnap.data() as Omit<UserProfile, 'id'>) } as UserProfile)
      : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }
}

export async function loginWithGoogle(): Promise<AuthResult> {
  const credential = await signInWithPopup(auth, googleProvider);
  const profile = await syncUserProfileDocs(credential.user);
  return { user: credential.user, profile };
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResult> {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile: UserProfile | null = credential.user.emailVerified
    ? await syncUserProfileDocs(credential.user)
    : {
        uid: credential.user.uid,
        email: credential.user.email || email.trim(),
        fullName: credential.user.displayName || email.split('@')[0] || 'TaskFlow User',
        avatarUrl: credential.user.photoURL || '',
        bio: '',
        roleTitle: 'Member',
      };
  return { user: credential.user, profile };
}

export async function registerWithEmail({
  fullName,
  email,
  password,
}: {
  fullName: string;
  email: string;
  password: string;
}): Promise<AuthResult> {
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(credential.user, { displayName: fullName.trim() });
  try {
    await sendEmailVerification(credential.user);
  } catch {
    // Email verification dispatch is best-effort if email provider isn't customized
  }
  return {
    user: credential.user,
    profile: {
      uid: credential.user.uid,
      email: credential.user.email || email.trim(),
      fullName: fullName.trim(),
      avatarUrl: '',
      bio: '',
      roleTitle: 'Member',
    },
  };
}

export async function sendResetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function updateUserProfile(
  uid: string,
  updates: Partial<UserProfile>
): Promise<Partial<UserProfile> | null> {
  const validThemes: ThemeMode[] = ['light', 'dark', 'system'];
  const theme: ThemeMode =
    updates.theme && validThemes.includes(updates.theme) ? updates.theme : 'light';

  const safePrivate = {
    fullName: clampString(updates.fullName || '', FIELD_LIMITS.fullName),
    avatarUrl: clampString(updates.avatarUrl || '', 512),
    bio: clampString(updates.bio || '', FIELD_LIMITS.bio),
    roleTitle: clampString(updates.roleTitle || '', FIELD_LIMITS.roleTitle),
    theme,
    updatedAt: serverTimestamp(),
  };

  try {
    await updateDoc(doc(db, 'users', uid), safePrivate);
    await updateDoc(doc(db, 'publicProfiles', uid), {
      fullName: safePrivate.fullName,
      avatarUrl: safePrivate.avatarUrl,
      roleTitle: safePrivate.roleTitle,
      updatedAt: serverTimestamp(),
    });
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, {
        displayName: safePrivate.fullName,
        photoURL: safePrivate.avatarUrl,
      });
    }
    return safePrivate;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists()
      ? ({ id: snap.id, ...(snap.data() as Omit<UserProfile, 'id'>) } as UserProfile)
      : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
  }
}
