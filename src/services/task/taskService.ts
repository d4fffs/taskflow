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
  type Unsubscribe,
  type FirestoreError,
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from '../firebase/config';
import { clampString, generateId } from '../../utils/kanban';
import { FIELD_LIMITS } from '../../constants/templates';
import type {
  Activity,
  AppUser,
  Attachment,
  Board,
  Checklist,
  Comment,
  DateLike,
  KanbanList,
  NotificationItem,
  NotificationType,
  Task,
  TaskPositionPatch,
  TaskPriority,
  UserProfile,
} from '../../types';

function toMillis(value: DateLike): number {
  if (!value) return 0;
  if (typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') return new Date(value).getTime() || 0;
  return 0;
}

export function subscribeUserTasks(
  uid: string,
  callback: (items: Task[]) => void,
  onError?: (error: FirestoreError) => void
): Unsubscribe {
  const q = query(collection(db, 'tasks'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Task, 'id'>) }) as Task)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      callback(items);
    },
    (error) => {
      if (onError) onError(error);
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    }
  );
}

export function subscribeTaskComments(
  taskId: string,
  uid: string,
  callback: (items: Comment[]) => void
): Unsubscribe {
  const q = query(collection(db, 'comments'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, 'id'>) }) as Comment)
        .filter((c) => c.taskId === taskId)
        .sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'comments');
    }
  );
}

export function subscribeUserActivities(
  uid: string,
  callback: (items: Activity[]) => void
): Unsubscribe {
  const q = query(collection(db, 'activities'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Activity, 'id'>) }) as Activity)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt))
        .slice(0, 60);
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activities');
    }
  );
}

export function subscribeUserNotifications(
  uid: string,
  callback: (items: NotificationItem[]) => void
): Unsubscribe {
  const q = query(collection(db, 'notifications'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }) as NotificationItem)
        .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
      callback(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    }
  );
}

export async function logActivity({
  boardId,
  workspaceId,
  taskId = null,
  user,
  profile,
  action,
  metadata = {},
  memberIds,
}: {
  boardId: string;
  workspaceId: string;
  taskId?: string | null;
  user: AppUser;
  profile: UserProfile | null;
  action: string;
  metadata?: Record<string, unknown>;
  memberIds?: string[];
}): Promise<void> {
  const activityId = generateId('act');
  try {
    await setDoc(doc(db, 'activities', activityId), {
      boardId,
      workspaceId,
      taskId,
      userId: user.uid,
      actorName: clampString(
        profile?.fullName || user.displayName || 'Member',
        FIELD_LIMITS.fullName
      ),
      action: clampString(action, 240),
      metadata,
      memberIds: memberIds?.length ? memberIds.slice(0, FIELD_LIMITS.maxMembers) : [user.uid],
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Activity log skipped:', error instanceof Error ? error.message : String(error));
  }
}

export async function sendNotification({
  userId,
  actorId,
  title,
  message,
  type = 'task_update',
  link = '',
}: {
  userId: string;
  actorId?: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}): Promise<void> {
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
    console.warn(
      'Notification dispatch skipped:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeIds?: string[];
  labelIds?: string[];
  checklists?: Checklist[];
  attachments?: Attachment[];
}

export async function createTask({
  board,
  list,
  user,
  profile,
  data,
  position,
}: {
  board: Board;
  list: KanbanList;
  user: AppUser;
  profile: UserProfile | null;
  data: CreateTaskInput;
  position: number;
}): Promise<Task | null> {
  const taskId = generateId('tsk');
  const memberIds = board.memberIds?.length ? board.memberIds : [user.uid];
  const safeTitle = clampString(data.title, FIELD_LIMITS.taskTitle);
  const validPriorities: TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
  const safePriority: TaskPriority =
    data.priority && validPriorities.includes(data.priority) ? data.priority : 'medium';

  const payload: Omit<Task, 'id'> = {
    boardId: board.id,
    workspaceId: board.workspaceId,
    listId: list.id,
    title: safeTitle,
    description: clampString(data.description || '', FIELD_LIMITS.taskDesc),
    priority: safePriority,
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
  }
}

export async function updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (updates.title !== undefined) patch.title = clampString(updates.title, FIELD_LIMITS.taskTitle);
  if (updates.description !== undefined) {
    patch.description = clampString(updates.description, FIELD_LIMITS.taskDesc);
  }
  if (updates.priority !== undefined) patch.priority = updates.priority;
  if (updates.status !== undefined) patch.status = clampString(updates.status, 60);
  if (updates.dueDate !== undefined) {
    patch.dueDate = updates.dueDate ? clampString(updates.dueDate, 40) : null;
  }
  if (updates.listId !== undefined) patch.listId = updates.listId;
  if (updates.position !== undefined) patch.position = Number(updates.position);
  if (updates.isArchived !== undefined) patch.isArchived = Boolean(updates.isArchived);
  if (updates.assigneeIds !== undefined) {
    patch.assigneeIds = updates.assigneeIds.slice(0, FIELD_LIMITS.maxAssignees);
  }
  if (updates.labelIds !== undefined) {
    patch.labelIds = updates.labelIds.slice(0, FIELD_LIMITS.maxLabels);
  }
  if (updates.checklists !== undefined) {
    patch.checklists = updates.checklists.slice(0, FIELD_LIMITS.maxChecklists);
  }
  if (updates.attachments !== undefined) {
    patch.attachments = updates.attachments.slice(0, FIELD_LIMITS.maxAttachments);
  }
  if (updates.commentCount !== undefined) {
    patch.commentCount = Math.max(0, Number(updates.commentCount));
  }

  try {
    await updateDoc(doc(db, 'tasks', taskId), patch);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
  }
}

export async function deleteTask(taskId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
  }
}

export async function batchPersistTaskPositions(patches: TaskPositionPatch[]): Promise<void> {
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

export async function createComment({
  task,
  user,
  profile,
  content,
  mentions = [],
}: {
  task: Task;
  user: AppUser;
  profile: UserProfile | null;
  content: string;
  mentions?: string[];
}): Promise<string | null> {
  const commentId = generateId('cmt');
  const safeContent = clampString(content, FIELD_LIMITS.commentContent);
  const memberIds = task.memberIds?.length ? task.memberIds : [user.uid];

  try {
    await setDoc(doc(db, 'comments', commentId), {
      taskId: task.id,
      boardId: task.boardId,
      workspaceId: task.workspaceId,
      userId: user.uid,
      authorName: clampString(
        profile?.fullName || user.displayName || 'Member',
        FIELD_LIMITS.fullName
      ),
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
  }
}

export async function deleteComment(
  commentId: string,
  taskId: string,
  currentCount = 1
): Promise<void> {
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

export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

export async function markAllNotificationsRead(notifications: NotificationItem[] = []): Promise<void> {
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
