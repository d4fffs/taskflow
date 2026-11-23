import { FIELD_LIMITS } from '../constants/templates';
import type {
  Board,
  Checklist,
  DashboardAnalytics,
  DateLike,
  KanbanList,
  ListPositionPatch,
  Task,
  TaskPositionPatch,
  TaskPriority,
  ValidationResult,
  Workspace,
} from '../types';

export const POSITION_STEP = 1000;
const MIN_GAP = 0.01;

export function generateId(prefix = 'id'): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function clampString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function validateEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validateWorkspaceInput({
  name,
  description = '',
}: {
  name?: string;
  description?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  const trimmedName = (name || '').trim();
  if (!trimmedName) errors.name = 'Workspace name is required.';
  else if (trimmedName.length > FIELD_LIMITS.workspaceName) {
    errors.name = `Workspace name must be under ${FIELD_LIMITS.workspaceName} characters.`;
  }
  if ((description || '').length > FIELD_LIMITS.workspaceDesc) {
    errors.description = `Description must be under ${FIELD_LIMITS.workspaceDesc} characters.`;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateBoardInput({
  title,
  description = '',
}: {
  title?: string;
  description?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  const trimmed = (title || '').trim();
  if (!trimmed) errors.title = 'Board title is required.';
  else if (trimmed.length > FIELD_LIMITS.boardTitle) {
    errors.title = `Board title must be under ${FIELD_LIMITS.boardTitle} characters.`;
  }
  if ((description || '').length > FIELD_LIMITS.boardDesc) {
    errors.description = `Description must be under ${FIELD_LIMITS.boardDesc} characters.`;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateTaskInput({
  title,
  description = '',
  priority = 'medium',
}: {
  title?: string;
  description?: string;
  priority?: string;
}): ValidationResult {
  const errors: Record<string, string> = {};
  const trimmed = (title || '').trim();
  if (!trimmed) errors.title = 'Task title is required.';
  else if (trimmed.length > FIELD_LIMITS.taskTitle) {
    errors.title = `Task title must be under ${FIELD_LIMITS.taskTitle} characters.`;
  }
  if ((description || '').length > FIELD_LIMITS.taskDesc) {
    errors.description = `Description must be under ${FIELD_LIMITS.taskDesc} characters.`;
  }
  if (!['low', 'medium', 'high', 'urgent'].includes(priority)) {
    errors.priority = 'Invalid priority value.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function calculateNextPosition(items: Array<{ position?: number }> = []): number {
  if (!items.length) return POSITION_STEP;
  const maxPos = items.reduce((max, item) => {
    const p = typeof item.position === 'number' ? item.position : 0;
    return p > max ? p : max;
  }, 0);
  return maxPos + POSITION_STEP;
}

export function calculatePositionAtIndex(
  sortedItems: Array<{ position?: number }>,
  targetIndex: number
): { position: number; needsRebalance: boolean } {
  const clamped = Math.max(0, Math.min(targetIndex, sortedItems.length));
  if (sortedItems.length === 0) {
    return { position: POSITION_STEP, needsRebalance: false };
  }
  if (clamped === 0) {
    const firstPos = sortedItems[0].position ?? POSITION_STEP;
    const nextPos = firstPos / 2;
    return {
      position: nextPos,
      needsRebalance: nextPos < MIN_GAP,
    };
  }
  if (clamped >= sortedItems.length) {
    const lastPos = sortedItems[sortedItems.length - 1].position ?? POSITION_STEP;
    return { position: lastPos + POSITION_STEP, needsRebalance: false };
  }
  const prevPos = sortedItems[clamped - 1].position ?? 0;
  const nextPos = sortedItems[clamped].position ?? prevPos + POSITION_STEP;
  const gap = nextPos - prevPos;
  if (gap <= MIN_GAP) {
    return { position: prevPos + gap / 2, needsRebalance: true };
  }
  return { position: prevPos + gap / 2, needsRebalance: false };
}

export function reorderLists<T extends { id: string; position: number }>(
  lists: T[],
  activeId: string,
  overId: string
): { nextLists: T[]; patches: ListPositionPatch[] } {
  const sorted = [...lists].sort((a, b) => a.position - b.position);
  const oldIndex = sorted.findIndex((l) => l.id === activeId);
  const newIndex = sorted.findIndex((l) => l.id === overId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return { nextLists: sorted, patches: [] };
  }

  const reordered = [...sorted];
  const [moved] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, moved);

  const withoutMoved = reordered.filter((l) => l.id !== activeId);
  const { position, needsRebalance } = calculatePositionAtIndex(withoutMoved, newIndex);

  if (needsRebalance) {
    const rebalanced = reordered.map((l, idx) => ({
      ...l,
      position: (idx + 1) * POSITION_STEP,
    }));
    return {
      nextLists: rebalanced,
      patches: rebalanced.map((l) => ({ id: l.id, position: l.position })),
    };
  }

  const nextLists = reordered.map((l) => (l.id === activeId ? { ...l, position } : l));
  return {
    nextLists,
    patches: [{ id: activeId, position }],
  };
}

export function moveTaskInBoard<
  TTask extends { id: string; listId: string; status?: string; position: number; isArchived?: boolean },
  TList extends { id: string; title: string }
>(
  tasks: TTask[],
  lists: TList[],
  activeTaskId: string,
  targetListId: string,
  targetIndex?: number
): { nextTasks: TTask[]; patches: TaskPositionPatch[] } {
  const activeTask = tasks.find((t) => t.id === activeTaskId);
  if (!activeTask) {
    return { nextTasks: tasks, patches: [] };
  }

  const targetList = lists.find((l) => l.id === targetListId);
  const nextStatus = targetList ? targetList.title : activeTask.status || '';

  const targetSiblings = tasks
    .filter((t) => t.listId === targetListId && !t.isArchived && t.id !== activeTaskId)
    .sort((a, b) => a.position - b.position);

  const safeIndex =
    typeof targetIndex === 'number'
      ? Math.max(0, Math.min(targetIndex, targetSiblings.length))
      : targetSiblings.length;

  const { position, needsRebalance } = calculatePositionAtIndex(targetSiblings, safeIndex);

  if (needsRebalance) {
    const orderedTarget = [...targetSiblings];
    orderedTarget.splice(safeIndex, 0, {
      ...activeTask,
      listId: targetListId,
      status: nextStatus,
    });

    const patchMap = new Map<string, TaskPositionPatch>();
    orderedTarget.forEach((item, idx) => {
      const pos = (idx + 1) * POSITION_STEP;
      patchMap.set(item.id, {
        id: item.id,
        listId: targetListId,
        status: nextStatus,
        position: pos,
      });
    });

    const nextTasks = tasks.map((t) => {
      const patch = patchMap.get(t.id);
      return patch
        ? { ...t, listId: patch.listId, status: patch.status, position: patch.position }
        : t;
    });

    return {
      nextTasks,
      patches: Array.from(patchMap.values()),
    };
  }

  const patch: TaskPositionPatch = {
    id: activeTaskId,
    listId: targetListId,
    status: nextStatus,
    position,
  };

  const nextTasks = tasks.map((t) =>
    t.id === activeTaskId ? { ...t, listId: targetListId, status: nextStatus, position } : t
  );

  return {
    nextTasks,
    patches: [patch],
  };
}

export function isTaskDone(
  task: Pick<Task, 'listId' | 'status'>,
  lists: Array<Pick<KanbanList, 'id' | 'title'>> = []
): boolean {
  const list = lists.find((l) => l.id === task.listId);
  const name = (list?.title || task.status || '').trim().toLowerCase();
  return name === 'done' || name === 'completed' || name === 'finished';
}

export function isTaskInProgress(
  task: Pick<Task, 'listId' | 'status'>,
  lists: Array<Pick<KanbanList, 'id' | 'title'>> = []
): boolean {
  const list = lists.find((l) => l.id === task.listId);
  const name = (list?.title || task.status || '').trim().toLowerCase();
  return name === 'in progress' || name === 'review' || name === 'doing';
}

export function isTaskOverdue(
  task: Pick<Task, 'listId' | 'status' | 'dueDate' | 'isArchived'>,
  lists: Array<Pick<KanbanList, 'id' | 'title'>> = [],
  now = new Date()
): boolean {
  if (!task.dueDate || task.isArchived) return false;
  if (isTaskDone(task, lists)) return false;
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due < startOfToday;
}

export function computeChecklistProgress(
  checklists: Array<Pick<Checklist, 'items'>> = []
): { total: number; completed: number; percent: number } {
  let total = 0;
  let completed = 0;
  for (const cl of checklists) {
    const items = Array.isArray(cl.items) ? cl.items : [];
    total += items.length;
    completed += items.filter((i) => i.isCompleted).length;
  }
  return {
    total,
    completed,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function parseMentions(content = ''): string[] {
  const matches = content.match(/@([a-zA-Z0-9._-]{2,40})/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))].slice(0, 10);
}

export function computeDashboardAnalytics({
  workspaces = [],
  boards = [],
  lists = [],
  tasks = [],
  now = new Date(),
}: {
  workspaces?: Array<Pick<Workspace, 'id'>>;
  boards?: Array<Pick<Board, 'id' | 'isArchived'>>;
  lists?: Array<Pick<KanbanList, 'id' | 'title'>>;
  tasks?: Task[];
  now?: Date;
}): DashboardAnalytics {
  const activeBoards = boards.filter((b) => !b.isArchived);
  const activeTasks = tasks.filter((t) => !t.isArchived);

  const completedTasks = activeTasks.filter((t) => isTaskDone(t, lists));
  const inProgressTasks = activeTasks.filter((t) => isTaskInProgress(t, lists));
  const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t, lists, now));

  const completionRate =
    activeTasks.length === 0
      ? 0
      : Math.round((completedTasks.length / activeTasks.length) * 100);

  const statusMap = new Map<string, number>();
  for (const t of activeTasks) {
    const list = lists.find((l) => l.id === t.listId);
    const label = list?.title || t.status || 'Uncategorized';
    statusMap.set(label, (statusMap.get(label) || 0) + 1);
  }
  const tasksByStatus = Array.from(statusMap.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  const priorityOrder: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
  const priorityLabels: Record<TaskPriority, string> = {
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  const tasksByPriority = priorityOrder.map((key) => ({
    key,
    name: priorityLabels[key],
    count: activeTasks.filter((t) => t.priority === key).length,
  }));

  const weeklyTrends: Array<{ day: string; date: string; created: number; completed: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const dayStr = day.toISOString().slice(0, 10);
    const label = day.toLocaleDateString('en-US', { weekday: 'short' });

    let created = 0;
    let completed = 0;

    for (const t of activeTasks) {
      const cDate = normalizeDateString(t.createdAt);
      const uDate = normalizeDateString(t.updatedAt);
      if (cDate === dayStr) created += 1;
      if (isTaskDone(t, lists) && uDate === dayStr) completed += 1;
    }

    weeklyTrends.push({
      day: label,
      date: dayStr,
      created,
      completed,
    });
  }

  const upcomingDeadlines = activeTasks
    .filter((t) => Boolean(t.dueDate) && !isTaskDone(t, lists))
    .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
    .slice(0, 8);

  return {
    summary: {
      totalWorkspaces: workspaces.length,
      totalBoards: activeBoards.length,
      totalTasks: activeTasks.length,
      completedTasks: completedTasks.length,
      inProgressTasks: inProgressTasks.length,
      overdueTasks: overdueTasks.length,
      completionRate,
    },
    tasksByStatus,
    tasksByPriority,
    weeklyTrends,
    upcomingDeadlines,
  };
}

export function normalizeDateString(ts: DateLike): string {
  if (!ts) return '';
  if (typeof ts === 'string') return ts.slice(0, 10);
  if (ts instanceof Date) return ts.toISOString().slice(0, 10);
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate().toISOString().slice(0, 10);
  }
  return '';
}

export function toJsDate(ts: DateLike): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'object' && 'toDate' in ts && typeof ts.toDate === 'function') {
    return ts.toDate();
  }
  if (typeof ts === 'string') {
    const parsed = new Date(ts);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
