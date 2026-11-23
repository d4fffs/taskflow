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
  type Unsubscribe,
  type FirestoreError,
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase/config';
import { clampString, generateId } from '../../utils/kanban';
import { FIELD_LIMITS } from '../../constants/templates';
import type {
  AppUser,
  Invitation,
  UserProfile,
  Workspace,
  WorkspaceMember,
  WorkspaceRole,
} from '../../types';

export function subscribeUserWorkspaces(
  uid: string,
  callback: (items: Workspace[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'workspaces'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<Workspace, 'id'>) }) as Workspace
      );
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'workspaces');
    }
  );
}

export function subscribeWorkspaceMembers(
  workspaceId: string,
  uid: string,
  callback: (items: WorkspaceMember[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const path = `workspaces/${workspaceId}/members`;
  const q = query(collection(db, path), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<WorkspaceMember, 'id'>) }) as WorkspaceMember
      );
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeUserInvitations(
  uid: string,
  _email: string,
  callback: (items: Invitation[]) => void
): Unsubscribe {
  const q = query(collection(db, 'invitations'), where('inviterId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map(
        (d) => ({ id: d.id, ...(d.data() as Omit<Invitation, 'id'>) }) as Invitation
      );
      callback(items);
    },
    (error) => {
      console.warn('Invitations listener warning:', error.message);
      callback([]);
    }
  );
}

export async function createWorkspace({
  user,
  profile,
  name,
  description = '',
  avatarColor = '#635BFF',
}: {
  user: AppUser;
  profile: UserProfile | null;
  name: string;
  description?: string;
  avatarColor?: string;
}): Promise<Workspace | null> {
  const workspaceId = generateId('ws');
  const safeName = clampString(name, FIELD_LIMITS.workspaceName);
  const safeDesc = clampString(description, FIELD_LIMITS.workspaceDesc);
  const fullName = clampString(
    profile?.fullName || user.displayName || 'Owner',
    FIELD_LIMITS.fullName
  );
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
  }
}

export async function updateWorkspace(
  workspaceId: string,
  {
    name,
    description,
    avatarColor,
  }: {
    name?: string;
    description?: string;
    avatarColor?: string;
  }
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (name !== undefined) patch.name = clampString(name, FIELD_LIMITS.workspaceName);
  if (description !== undefined) patch.description = clampString(description, FIELD_LIMITS.workspaceDesc);
  if (avatarColor !== undefined) patch.avatarColor = clampString(avatarColor, 32);

  try {
    await updateDoc(doc(db, 'workspaces', workspaceId), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `workspaces/${workspaceId}`);
  }
}

export async function deleteWorkspace(workspaceId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'workspaces', workspaceId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `workspaces/${workspaceId}`);
  }
}

export async function inviteMemberToWorkspace({
  workspace,
  inviter,
  profile,
  email,
  role = 'member',
}: {
  workspace: Workspace;
  inviter: AppUser;
  profile: UserProfile | null;
  email: string;
  role?: Exclude<WorkspaceRole, 'owner'>;
}): Promise<Invitation | null> {
  const invitationId = generateId('inv');
  const safeEmail = clampString(email.toLowerCase(), 254);
  const validInviteRoles: Array<Exclude<WorkspaceRole, 'owner'>> = ['admin', 'member', 'viewer'];
  const safeRole: Exclude<WorkspaceRole, 'owner'> = validInviteRoles.includes(role)
    ? role
    : 'member';
  const inviterName = clampString(
    profile?.fullName || inviter.displayName || 'Team Member',
    FIELD_LIMITS.fullName
  );

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
  }
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  memberId: string,
  role: Exclude<WorkspaceRole, 'owner'>
): Promise<void> {
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

export async function removeWorkspaceMember(workspace: Workspace, memberId: string): Promise<void> {
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

export async function fetchWorkspaceMembersOnce(
  workspaceId: string,
  uid: string
): Promise<WorkspaceMember[]> {
  const path = `workspaces/${workspaceId}/members`;
  try {
    const q = query(collection(db, path), where('memberIds', 'array-contains', uid));
    const snap = await getDocs(q);
    return snap.docs.map(
      (d) => ({ id: d.id, ...(d.data() as Omit<WorkspaceMember, 'id'>) }) as WorkspaceMember
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}
