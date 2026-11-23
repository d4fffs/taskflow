import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  writeBatch,
  updateDoc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  getDocs,
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase/config.js';
import { clampString, generateId } from '../../utils/kanban.js';
import { FIELD_LIMITS } from '../../constants/templates.js';

export function subscribeUserWorkspaces(uid, callback, onError) {
  const q = query(collection(db, 'workspaces'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'workspaces');
    }
  );
}

export function subscribeWorkspaceMembers(workspaceId, uid, callback, onError) {
  const path = `workspaces/${workspaceId}/members`;
  const q = query(collection(db, path), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserInvitations(uid, email, callback) {
  const q = query(collection(db, 'invitations'), where('inviterId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(items);
    },
    (error) => {
      console.warn('Invitations listener warning:', error.message);
      callback([]);
    }
  );
}

export async function createWorkspace({ user, profile, name, description = '', avatarColor = '#635BFF' }) {
  const workspaceId = generateId('ws');
  const safeName = clampString(name, FIELD_LIMITS.workspaceName);
  const safeDesc = clampString(description, FIELD_LIMITS.workspaceDesc);
  const fullName = clampString(profile?.fullName || user.displayName || 'Owner', FIELD_LIMITS.fullName);
  const avatarUrl = clampString(profile?.avatarUrl || user.photoURL || '', 512);

  const batch = writeBatch(db);
  const wsRef = doc(db, 'workspaces', workspaceId);
  const memberRef = doc(db, `workspaces/${workspaceId}/members`, user.uid);

  batch.set(wsRef, {
    name: safeName,
    description: safeDesc,
    avatarColor: clampString(avatarColor, 32),
    ownerId: user.uid,
    memberIds: [user.uid],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  batch.set(memberRef, {
    workspaceId,
    userId: user.uid,
    fullName,
    avatarUrl,
    role: 'owner',
    memberIds: [user.uid],
    joinedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return {
      id: workspaceId,
      name: safeName,
      description: safeDesc,
      avatarColor,
      ownerId: user.uid,
      memberIds: [user.uid],
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `workspaces/${workspaceId}`);
    return null;
  }
}

export async function updateWorkspace(workspaceId, { name, description, avatarColor }) {
  const patch = { updatedAt: serverTimestamp() };
  if (name !== undefined) patch.name = clampString(name, FIELD_LIMITS.workspaceName);
  if (description !== undefined) patch.description = clampString(description, FIELD_LIMITS.workspaceDesc);
  if (avatarColor !== undefined) patch.avatarColor = clampString(avatarColor, 32);

  try {
    await updateDoc(doc(db, 'workspaces', workspaceId), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspaceId}`);
  }
}

export async function deleteWorkspace(workspaceId) {
  try {
    await deleteDoc(doc(db, 'workspaces', workspaceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `workspaces/${workspaceId}`);
  }
}

export async function inviteMemberToWorkspace({ workspace, inviter, profile, email, role = 'member' }) {
  const invitationId = generateId('inv');
  const safeEmail = clampString(email.toLowerCase(), 254);
  const safeRole = ['admin', 'member', 'viewer'].includes(role) ? role : 'member';
  const inviterName = clampString(profile?.fullName || inviter.displayName || 'Team Member', FIELD_LIMITS.fullName);

  try {
    await setDoc(doc(db, 'invitations', invitationId), {
      workspaceId: workspace.id,
      workspaceName: clampString(workspace.name, FIELD_LIMITS.workspaceName),
      inviterId: inviter.uid,
      inviterName,
      inviteeEmail: safeEmail,
      role: safeRole,
      status: 'pending',
      createdAt: serverTimestamp(),
    });
    return {
      id: invitationId,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      inviterId: inviter.uid,
      inviterName,
      inviteeEmail: safeEmail,
      role: safeRole,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `invitations/${invitationId}`);
    return null;
  }
}

export async function updateWorkspaceMemberRole(workspaceId, memberId, role) {
  if (!['admin', 'member', 'viewer'].includes(role)) {
    throw new Error('Invalid member role.');
  }
  const path = `workspaces/${workspaceId}/members/${memberId}`;
  try {
    await updateDoc(doc(db, path), { role });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeWorkspaceMember(workspace, memberId) {
  const path = `workspaces/${workspace.id}/members/${memberId}`;
  const nextMemberIds = (workspace.memberIds || []).filter((id) => id !== memberId);
  try {
    await deleteDoc(doc(db, path));
    await updateDoc(doc(db, 'workspaces', workspace.id), {
      memberIds: nextMemberIds,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchWorkspaceMembersOnce(workspaceId, uid) {
  const path = `workspaces/${workspaceId}/members`;
  try {
    const q = query(collection(db, path), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}
