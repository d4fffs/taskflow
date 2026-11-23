import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  signOut,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, googleProvider, OperationType, handleFirestoreError } from '../firebase/config.js';
import { clampString } from '../../utils/kanban.js';
import { FIELD_LIMITS } from '../../constants/templates.js';

export function formatAuthError(error) {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user') return 'Sign-in popup was closed before completing.';
  if (code === 'auth/popup-blocked') return 'Browser blocked the sign-in popup. Please allow popups for this site.';
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid email or password. Please check your credentials.';
  }
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters long.';
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not enabled in Firebase Console yet. Please use Sign in with Google, or enable Email/Password under Firebase Console → Authentication → Sign-in method.';
  }
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.';
  return error?.message || 'Authentication failed. Please try again.';
}

export async function syncUserProfileDocs(firebaseUser, extra = {}) {
  if (!firebaseUser) return null;
  const uid = firebaseUser.uid;
  const userRef = doc(db, 'users', uid);
  const publicRef = doc(db, 'publicProfiles', uid);

  const fullName = clampString(
    extra.fullName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'TaskFlow User',
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
    return updatedSnap.exists() ? { id: updatedSnap.id, ...updatedSnap.data() } : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    return null;
  }
}

export async function loginWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  const profile = await syncUserProfileDocs(credential.user);
  return { user: credential.user, profile };
}

export async function loginWithEmail(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = credential.user.emailVerified
    ? await syncUserProfileDocs(credential.user)
    : {
        uid: credential.user.uid,
        email: credential.user.email,
        fullName: credential.user.displayName || email.split('@')[0],
        avatarUrl: credential.user.photoURL || '',
        bio: '',
        roleTitle: 'Member',
      };
  return { user: credential.user, profile };
}

export async function registerWithEmail({ fullName, email, password }) {
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
      email: credential.user.email,
      fullName: fullName.trim(),
      avatarUrl: '',
      bio: '',
      roleTitle: 'Member',
    },
  };
}

export async function sendResetPassword(email) {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function logoutUser() {
  await signOut(auth);
}

export async function updateUserProfile(uid, updates) {
  const safePrivate = {
    fullName: clampString(updates.fullName, FIELD_LIMITS.fullName),
    avatarUrl: clampString(updates.avatarUrl || '', 512),
    bio: clampString(updates.bio || '', FIELD_LIMITS.bio),
    roleTitle: clampString(updates.roleTitle || '', FIELD_LIMITS.roleTitle),
    theme: ['light', 'dark', 'system'].includes(updates.theme) ? updates.theme : 'light',
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
    return null;
  }
}

export async function fetchUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `users/${uid}`);
    return null;
  }
}
