import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateNextPosition,
  calculatePositionAtIndex,
  reorderLists,
  moveTaskInBoard,
  computeDashboardAnalytics,
  computeChecklistProgress,
  parseMentions,
  validateWorkspaceInput,
  validateTaskInput,
  validateEmail,
} from './kanban';
import type { Task } from '../types';

test('calculateNextPosition appends cleanly with 1000 step', () => {
  assert.equal(calculateNextPosition([]), 1000);
  assert.equal(calculateNextPosition([{ position: 1000 }, { position: 2500 }]), 3500);
});

test('reorderLists moves list and keeps unique strictly increasing positions', () => {
  const lists = [
    { id: 'l1', title: 'Backlog', position: 1000 },
    { id: 'l2', title: 'To Do', position: 2000 },
    { id: 'l3', title: 'Done', position: 3000 },
  ];

  const { nextLists, patches } = reorderLists(lists, 'l3', 'l1');
  assert.deepEqual(
    nextLists.map((l) => l.id),
    ['l3', 'l1', 'l2']
  );
  assert.equal(patches.length, 1);
  assert.equal(patches[0].id, 'l3');
  assert.ok(nextLists[0].position < nextLists[1].position);
  assert.ok(nextLists[1].position < nextLists[2].position);
});

test('moveTaskInBoard moves task across lists without duplicates or lost tasks', () => {
  const lists = [
    { id: 'l1', title: 'To Do', position: 1000 },
    { id: 'l2', title: 'In Progress', position: 2000 },
  ];
  const tasks = [
    { id: 't1', listId: 'l1', status: 'To Do', position: 1000, isArchived: false },
    { id: 't2', listId: 'l1', status: 'To Do', position: 2000, isArchived: false },
    { id: 't3', listId: 'l2', status: 'In Progress', position: 1000, isArchived: false },
    { id: 't4', listId: 'l2', status: 'In Progress', position: 2000, isArchived: false },
  ];

  const { nextTasks, patches } = moveTaskInBoard(tasks, lists, 't1', 'l2', 1);
  assert.equal(nextTasks.length, 4);
  const moved = nextTasks.find((t) => t.id === 't1');
  assert.ok(moved);
  assert.equal(moved.listId, 'l2');
  assert.equal(moved.status, 'In Progress');
  assert.equal(moved.position, 1500);
  assert.equal(patches.length, 1);

  const l2Tasks = nextTasks.filter((t) => t.listId === 'l2').sort((a, b) => a.position - b.position);
  assert.deepEqual(
    l2Tasks.map((t) => t.id),
    ['t3', 't1', 't4']
  );
});

test('moveTaskInBoard rebalances positions cleanly when gap collapses below MIN_GAP', () => {
  const lists = [{ id: 'l1', title: 'To Do', position: 1000 }];
  const tasks = [
    { id: 't1', listId: 'l1', status: 'To Do', position: 1000, isArchived: false },
    { id: 't2', listId: 'l1', status: 'To Do', position: 1000.004, isArchived: false },
    { id: 't3', listId: 'l1', status: 'To Do', position: 2000, isArchived: false },
  ];

  const { nextTasks, patches } = moveTaskInBoard(tasks, lists, 't3', 'l1', 1);
  assert.equal(patches.length, 3);
  const sorted = [...nextTasks].sort((a, b) => a.position - b.position);
  assert.deepEqual(sorted.map((t) => t.id), ['t1', 't3', 't2']);
  assert.deepEqual(sorted.map((t) => t.position), [1000, 2000, 3000]);
});

test('computeDashboardAnalytics calculates accurate KPI metrics and overdue detection', () => {
  const now = new Date('2026-11-23T12:00:00Z');
  const workspaces = [{ id: 'w1' }];
  const boards = [
    { id: 'b1', isArchived: false },
    { id: 'b2', isArchived: true },
  ];
  const lists = [
    { id: 'l1', title: 'To Do' },
    { id: 'l2', title: 'In Progress' },
    { id: 'l3', title: 'Done' },
  ];
  const tasks: Task[] = [
    { id: 't1', boardId: 'b1', workspaceId: 'w1', listId: 'l1', title: 'T1', position: 1000, priority: 'urgent', dueDate: '2026-11-20', isArchived: false, createdAt: '2026-11-23', updatedAt: '2026-11-23' },
    { id: 't2', boardId: 'b1', workspaceId: 'w1', listId: 'l2', title: 'T2', position: 1000, priority: 'high', dueDate: '2026-11-25', isArchived: false, createdAt: '2026-11-22', updatedAt: '2026-11-22' },
    { id: 't3', boardId: 'b1', workspaceId: 'w1', listId: 'l3', title: 'T3', position: 1000, priority: 'medium', dueDate: '2026-11-18', isArchived: false, createdAt: '2026-11-21', updatedAt: '2026-11-23' },
    { id: 't4', boardId: 'b1', workspaceId: 'w1', listId: 'l1', title: 'T4', position: 2000, priority: 'low', dueDate: null, isArchived: true, createdAt: '2026-11-21', updatedAt: '2026-11-21' },
  ];

  const analytics = computeDashboardAnalytics({ workspaces, boards, lists, tasks, now });
  assert.equal(analytics.summary.totalWorkspaces, 1);
  assert.equal(analytics.summary.totalBoards, 1);
  assert.equal(analytics.summary.totalTasks, 3);
  assert.equal(analytics.summary.completedTasks, 1);
  assert.equal(analytics.summary.inProgressTasks, 1);
  assert.equal(analytics.summary.overdueTasks, 1);
  assert.equal(analytics.summary.completionRate, 33);
  assert.equal(analytics.weeklyTrends.length, 7);
});

test('computeChecklistProgress, parseMentions, and form validators work strictly', () => {
  const prog = computeChecklistProgress([
    {
      items: [
        { id: 'i1', title: 'One', isCompleted: true },
        { id: 'i2', title: 'Two', isCompleted: false },
        { id: 'i3', title: 'Three', isCompleted: true },
      ],
    },
  ]);
  assert.deepEqual(prog, { total: 3, completed: 2, percent: 67 });

  assert.deepEqual(parseMentions('Hey @nadia and @bima please check @nadia!'), ['nadia', 'bima']);

  assert.equal(validateEmail('team@taskflow.app'), true);
  assert.equal(validateEmail('invalid-email'), false);
  assert.equal(validateWorkspaceInput({ name: '   ' }).valid, false);
  assert.equal(validateTaskInput({ title: 'Ship MVP', priority: 'high' }).valid, true);
  assert.equal(validateTaskInput({ title: 'Ship MVP', priority: 'invalid' }).valid, false);
  assert.equal(calculatePositionAtIndex([], 0).position, 1000);
});
