import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toDeterministicUuid,
  escapeSqlString,
  buildSupabaseExportPayload,
  generateSupabaseDataSql,
  combineFullSupabaseSql,
} from './supabaseExport.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('toDeterministicUuid produces consistent valid RFC 4122 UUIDs', () => {
  const a1 = toDeterministicUuid('ws_studio', 'workspace');
  const a2 = toDeterministicUuid('ws_studio', 'workspace');
  const b = toDeterministicUuid('ws_campus', 'workspace');

  assert.equal(a1, a2);
  assert.notEqual(a1, b);
  assert.match(a1, UUID_RE);
  assert.match(b, UUID_RE);

  const existing = '123e4567-e89b-12d3-a456-426614174000';
  assert.equal(toDeterministicUuid(existing, 'task'), existing);
});

test('escapeSqlString neutralizes single quotes and SQL injection payloads', () => {
  const payload = "O'Brien'; DROP TABLE public.tasks; --";
  const escaped = escapeSqlString(payload);
  assert.equal(escaped, "'O''Brien''; DROP TABLE public.tasks; --'");
  assert.equal(escapeSqlString(null), 'NULL');
  assert.equal(escapeSqlString('abc\u0000def'), "'abcdef'");
});

test('buildSupabaseExportPayload maps all entities with referential integrity', () => {
  const payload = buildSupabaseExportPayload({
    user: { uid: 'u1', email: 'faiq@example.com', displayName: 'Faiq Daffa' },
    profile: { fullName: 'Faiq Daffa', roleTitle: 'Owner', bio: 'Lead' },
    workspaces: [{ id: 'ws_1', name: 'Core Studio', avatarColor: '#635BFF' }],
    boards: [
      {
        id: 'brd_1',
        workspaceId: 'ws_1',
        title: 'Sprint 1',
        visibility: 'invalid_enum',
        labels: [{ id: 'lbl_1', name: 'Backend', color: '#22C55E' }],
      },
      {
        id: 'brd_orphan',
        workspaceId: 'missing_ws',
        title: 'Orphan Board',
      },
    ],
    lists: [{ id: 'lst_1', boardId: 'brd_1', title: 'To Do', position: 1000 }],
    tasks: [
      {
        id: 'tsk_1',
        boardId: 'brd_1',
        listId: 'lst_1',
        title: "Fix 'quotes' in SQL export",
        priority: 'URGENT',
        labelIds: ['lbl_1'],
        checklists: [
          {
            id: 'cl_1',
            title: 'QA',
            items: [{ id: 'ci_1', title: 'Run tests', isCompleted: true }],
          },
        ],
        attachments: [
          { id: 'att_1', name: 'Spec', url: 'https://example.com/spec.pdf' },
          { id: 'att_bad', name: 'XSS', url: 'javascript:alert(1)' },
        ],
      },
    ],
    comments: [{ id: 'cmt_1', taskId: 'tsk_1', content: 'Looks good!' }],
    activities: [{ id: 'act_1', boardId: 'brd_1', action: 'created task' }],
    notifications: [{ id: 'ntf_1', title: 'Assigned', message: 'Check task', type: 'assignment' }],
  });

  // Orphan board excluded, bad URL excluded, enums normalized
  assert.equal(payload.counts.workspaces, 1);
  assert.equal(payload.counts.boards, 1);
  assert.equal(payload.tables.boards[0].visibility, 'workspace');
  assert.equal(payload.tables.tasks[0].priority, 'urgent');
  assert.equal(payload.counts.attachments, 1);
  assert.equal(payload.tables.tasks[0].board_id, payload.tables.boards[0].id);
  assert.equal(payload.tables.tasks[0].list_id, payload.tables.lists[0].id);
  assert.equal(payload.tables.task_labels.length, 1);
  assert.equal(payload.tables.checklist_items[0].is_completed, true);

  const sql = generateSupabaseDataSql(payload);
  assert.match(sql, /INSERT INTO public\.workspaces/);
  assert.match(sql, /INSERT INTO public\.tasks/);
  assert.match(sql, /'Fix ''quotes'' in SQL export'/);
  assert.match(sql, /ON CONFLICT \(id\) DO NOTHING/);
  assert.doesNotMatch(sql, /javascript:alert/);

  const fullSql = combineFullSupabaseSql({
    schemaSql: '-- SCHEMA',
    rlsSql: '-- RLS',
    dataSql: sql,
  });
  assert.match(fullSql, /^-- SCHEMA/);
  assert.match(fullSql, /-- RLS/);
  assert.match(fullSql, /DO \$\$/);
});
