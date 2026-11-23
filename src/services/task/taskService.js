import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase/config.js';
import { clampString, generateId } from '../../utils/kanban.js';
import { FIELD_LIMITS } from '../../constants/templates.js';

export function subscribeUserTasks(uid, callback, onError) {
  const q = query(collection(db, 'tasks'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    }
  );
}

export function subscribeTaskComments(taskId, uid, callback) {
  const q = query(
    collection(db, 'comments'),
    where('memberIds', 'array-contains', uid)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((c) => c.taskId === taskId)
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return ta - tb;
        });
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'comments');
    }
  );
}

export function subscribeUserActivities(uid, callback) {
  const q = query(collection(db, 'activities'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return tb - ta;
        })
        .slice(0, 60);
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activities');
    }
  );
}

export function subscribeUserNotifications(uid, callback) {
  const q = query(collection(db, 'notifications'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
          const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
          return tb - ta;
        });
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    }
  );
}

export async function logActivity({ boardId, workspaceId, taskId = null, user, profile, action, metadata = {}, memberIds }) {
  const activityId = generateId('act');
  try {
    await setDoc(doc(db, 'activities', activityId), {
      boardId,
      workspaceId,
      taskId,
      userId: user.uid,
      actorName: clampString(profile?.fullName || user.displayName || 'Member', FIELD_LIMITS.fullName),
      action: clampString(action, 240),
      metadata,
      memberIds: memberIds?.length ? memberIds.slice(0, FIELD_LIMITS.maxMembers) : [user.uid],
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Activity log skipped:', error?.message);
  }
}

export async function sendNotification({ userId, actorId, title, message, type = 'task_update', link = '' }) {
  const notifId = generateId('ntf');
  try {
    await setDoc(doc(db, 'notifications', notifId), {
      userId,
      actorId,
      title: clampString(title, 160),
      message: clampString(message, 500),
      type,
      isRead: false,
      link: clampString(link, 200),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Notification dispatch skipped:', error?.message);
  }
}

export async function createTask({ board, list, user, profile, data, position }) {
  const taskId = generateId('tsk');
  const memberIds = board.memberIds?.length ? board.memberIds : [user.uid];
  const safeTitle = clampString(data.title, FIELD_LIMITS.taskTitle);

  const payload = {
    boardId: board.id,
    workspaceId: board.workspaceId,
    listId: list.id,
    title: safeTitle,
    description: clampString(data.description || '', FIELD_LIMITS.taskDesc),
    priority: ['low', 'medium', 'high', 'urgent'].includes(data.priority) ? data.priority : 'medium',
    status: clampString(list.title, 60),
    dueDate: data.dueDate ? clampString(data.dueDate, 40) : null,
    position: Number(position),
    isArchived: false,
    assigneeIds: (data.assigneeIds || [user.uid]).slice(0, FIELD_LIMITS.maxAssignees),
    labelIds: (data.labelIds || []).slice(0, FIELD_LIMITS.maxLabels),
    checklists: (data.checklists || []).slice(0, FIELD_LIMITS.maxChecklists),
    attachments: (data.attachments || []).slice(0, FIELD_LIMITS.maxAttachments),
    commentCount: 0,
    ownerId: user.uid,
    memberIds,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'tasks', taskId), payload);
    await logActivity({
      boardId: board.id,
      workspaceId: board.workspaceId,
      taskId,
      user,
      profile,
      action: `created task "${safeTitle}" in ${list.title}`,
      memberIds,
    });
    return { id: taskId, ...payload };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tasks/${taskId}`);
    return null;
  }
}

export async function updateTask(taskId, updates) {
  const patch = { updatedAt: serverTimestamp() };
  if (updates.title !== undefined) patch.title = clampString(updates.title, FIELD_LIMITS.taskTitle);
  if (updates.description !== undefined) patch.description = clampString(updates.description, FIELD_LIMITS.taskDesc);
  if (updates.priority !== undefined) patch.priority = updates.priority;
  if (updates.status !== undefined) patch.status = clampString(updates.status, 60);
  if (updates.dueDate !== undefined) patch.dueDate = updates.dueDate ? clampString(updates.dueDate, 40) : null;
  if (updates.listId !== undefined) patch.listId = updates.listId;
  if (updates.position !== undefined) patch.position = Number(updates.position);
  if (updates.isArchived !== undefined) patch.isArchived = Boolean(updates.isArchived);
  if (updates.assigneeIds !== undefined) patch.assigneeIds = updates.assigneeIds.slice(0, FIELD_LIMITS.maxAssignees);
  if (updates.labelIds !== undefined) patch.labelIds = updates.labelIds.slice(0, FIELD_LIMITS.maxLabels);
  if (updates.checklists !== undefined) patch.checklists = updates.checklists.slice(0, FIELD_LIMITS.maxChecklists);
  if (updates.attachments !== undefined) patch.attachments = updates.attachments.slice(0, FIELD_LIMITS.maxAttachments);
  if (updates.commentCount !== undefined) patch.commentCount = Math.max(0, Number(updates.commentCount));

  try {
    await updateDoc(doc(db, 'tasks', taskId), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
  }
}

export async function deleteTask(taskId) {
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
  }
}

export async function batchPersistTaskPositions(patches) {
  if (!patches.length) return;
  const batch = writeBatch(db);
  for (const p of patches) {
    batch.update(doc(db, 'tasks', p.id), {
      listId: p.listId,
      status: clampString(p.status || '', 60),
      position: Number(p.position),
      updatedAt: serverTimestamp(),
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'tasks');
  }
}

export async function createComment({ task, user, profile, content, mentions = [] }) {
  const commentId = generateId('cmt');
  const safeContent = clampString(content, FIELD_LIMITS.commentContent);
  const memberIds = task.memberIds?.length ? task.memberIds : [user.uid];

  try {
    await setDoc(doc(db, 'comments', commentId), {
      taskId: task.id,
      boardId: task.boardId,
      workspaceId: task.workspaceId,
      userId: user.uid,
      authorName: clampString(profile?.fullName || user.displayName || 'Member', FIELD_LIMITS.fullName),
      authorAvatar: clampString(profile?.avatarUrl || user.photoURL || '', 512),
      content: safeContent,
      mentions: mentions.slice(0, 10),
      memberIds,
      createdAt: serverTimestamp(),
    });

    await updateDoc(doc(db, 'tasks', task.id), {
      commentCount: (task.commentCount || 0) + 1,
      updatedAt: serverTimestamp(),
    });

    await logActivity({
      boardId: task.boardId,
      workspaceId: task.workspaceId,
      taskId: task.id,
      user,
      profile,
      action: `commented on "${task.title}"`,
      memberIds,
    });

    return commentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `comments/${commentId}`);
    return null;
  }
}

export async function deleteComment(commentId, taskId, currentCount = 1) {
  try {
    await deleteDoc(doc(db, 'comments', commentId));
    await updateDoc(doc(db, 'tasks', taskId), {
      commentCount: Math.max(0, currentCount - 1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `comments/${commentId}`);
  }
}

export async function markNotificationRead(notificationId) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsRead(notifications = []) {
  const unread = notifications.filter((n) => !n.isRead);
  if (!unread.length) return;
  const batch = writeBatch(db);
  for (const n of unread) {
    batch.update(doc(db, 'notifications', n.id), { isRead: true });
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications');
  }
}
