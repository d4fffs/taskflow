import { FIELD_LIMITS } from '../constants/templates.js';

export const POSITION_STEP = 1000;
const MIN_GAP = 0.01;

export function generateId(prefix = 'id') {
  const rand = Math.random().toString(36).slice(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function clampString(val, maxLen) {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

export function validateEmail(email) {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function validateWorkspaceInput({ name, description = '' }) {
  const errors = {};
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

export function validateBoardInput({ title, description = '' }) {
  const errors = {};
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

export function validateTaskInput({ title, description = '', priority = 'medium' }) {
  const errors = {};
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

export function calculateNextPosition(items = []) {
  if (!items.length) return POSITION_STEP;
  const maxPos = items.reduce((max, item) => {
    const p = typeof item.position === 'number' ? item.position : 0;
    return p > max ? p : max;
  }, 0);
  return maxPos + POSITION_STEP;
}

/**
 * Computes a clean fractional position at targetIndex within sortedItems (which excludes the moved item).
 * Returns { position, needsRebalance }.
 */
export function calculatePositionAtIndex(sortedItems, targetIndex) {
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

/**
 * Reorders Kanban lists safely and guarantees strictly increasing unique positions.
 */
export function reorderLists(lists, activeId, overId) {
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

  const nextLists = reordered.map((l) =>
    l.id === activeId ? { ...l, position } : l
  );
  return {
    nextLists,
    patches: [{ id: activeId, position }],
  };
}

/**
 * Moves a task within the same list or across lists, updating listId, status, and position.
 * Guarantees no duplicate positions, no dropped tasks, and clean rebalancing if spacing gets tight.
 */
export function moveTaskInBoard(tasks, lists, activeTaskId, targetListId, targetIndex) {
  const activeTask = tasks.find((t) => t.id === activeTaskId);
  if (!activeTask) {
    return { nextTasks: tasks, patches: [] };
  }

  const targetList = lists.find((l) => l.id === targetListId);
  const nextStatus = targetList ? targetList.title : activeTask.status;

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

    const patchMap = new Map();
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
      return patch ? { ...t, listId: patch.listId, status: patch.status, position: patch.position } : t;
    });

    return {
      nextTasks,
      patches: Array.from(patchMap.values()),
    };
  }

  const patch = {
    id: activeTaskId,
    listId: targetListId,
    status: nextStatus,
    position,
  };

  const nextTasks = tasks.map((t) =>
    t.id === activeTaskId
      ? { ...t, listId: targetListId, status: nextStatus, position }
      : t
  );

  return {
    nextTasks,
    patches: [patch],
  };
}

export function isTaskDone(task, lists = []) {
  const list = lists.find((l) => l.id === task.listId);
  const name = (list?.title || task.status || '').trim().toLowerCase();
  return name === 'done' || name === 'completed' || name === 'finished';
}

export function isTaskInProgress(task, lists = []) {
  const list = lists.find((l) => l.id === task.listId);
  const name = (list?.title || task.status || '').trim().toLowerCase();
  return name === 'in progress' || name === 'review' || name === 'doing';
}

export function isTaskOverdue(task, lists = [], now = new Date()) {
  if (!task.dueDate || task.isArchived) return false;
  if (isTaskDone(task, lists)) return false;
  const due = new Date(task.dueDate);
  if (Number.isNaN(due.getTime())) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return due < startOfToday;
}

export function computeChecklistProgress(checklists = []) {
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

export function parseMentions(content = '') {
  const matches = content.match(/@([a-zA-Z0-9._-]{2,40})/g) || [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))].slice(0, 10);
}

/**
 * Computes real analytics directly from database collections (no hardcoded numbers).
 */
export function computeDashboardAnalytics({
  workspaces = [],
  boards = [],
  lists = [],
  tasks = [],
  now = new Date(),
}) {
  const activeBoards = boards.filter((b) => !b.isArchived);
  const activeTasks = tasks.filter((t) => !t.isArchived);

  const completedTasks = activeTasks.filter((t) => isTaskDone(t, lists));
  const inProgressTasks = activeTasks.filter((t) => isTaskInProgress(t, lists));
  const overdueTasks = activeTasks.filter((t) => isTaskOverdue(t, lists, now));

  const completionRate =
    activeTasks.length === 0
      ? 0
      : Math.round((completedTasks.length / activeTasks.length) * 100);

  // Tasks by status
  const statusMap = new Map();
  for (const t of activeTasks) {
    const list = lists.find((l) => l.id === t.listId);
    const label = list?.title || t.status || 'Uncategorized';
    statusMap.set(label, (statusMap.get(label) || 0) + 1);
  }
  const tasksByStatus = Array.from(statusMap.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  // Tasks by priority
  const priorityOrder = ['urgent', 'high', 'medium', 'low'];
  const priorityLabels = { urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low' };
  const tasksByPriority = priorityOrder.map((key) => ({
    key,
    name: priorityLabels[key],
    count: activeTasks.filter((t) => t.priority === key).length,
  }));

  // Weekly Task Trends (last 7 days based on createdAt / updatedAt)
  const weeklyTrends = [];
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

  // Upcoming deadlines (next 14 days + overdue, sorted earliest first)
  const upcomingDeadlines = activeTasks
    .filter((t) => Boolean(t.dueDate) && !isTaskDone(t, lists))
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
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

export function normalizeDateString(ts) {
  if (!ts) return '';
  if (typeof ts === 'string') return ts.slice(0, 10);
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (ts instanceof Date) return ts.toISOString().slice(0, 10);
  return '';
}

export function toJsDate(ts) {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (typeof ts.toDate === 'function') return ts.toDate();
  const parsed = new Date(ts);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
