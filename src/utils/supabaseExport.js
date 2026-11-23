/**
 * Pure Supabase PostgreSQL export & deterministic UUID mapping utilities.
 * Keeps all SQL generation, escaping, and schema mapping decoupled from UI/DOM
 * so it can be unit-tested directly with node:test.
 */

const ALLOWED_PRIORITIES = new Set(['low', 'medium', 'high', 'urgent']);
const ALLOWED_VISIBILITIES = new Set(['workspace', 'private', 'public']);
const ALLOWED_ROLES = new Set(['owner', 'admin', 'member', 'viewer']);
const ALLOWED_NOTIFICATION_TYPES = new Set([
  'assignment',
  'mention',
  'deadline',
  'invitation',
  'member_joined',
  'task_update',
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

/**
 * Deterministic 128-bit hash formatted as an RFC 4122 UUID (version 5 variant 1)
 * so non-UUID Firestore / sandbox IDs map consistently across foreign keys.
 */
export function toDeterministicUuid(rawId, namespace = 'taskflow') {
  const input = String(rawId || '').trim();
  if (UUID_REGEX.test(input)) {
    return input.toLowerCase();
  }

  const seed = `${namespace}:${input || 'empty'}`;
  // 4 independent 32-bit FNV-1a style lanes for 128 deterministic bits
  const seeds = [0x811c9dc5, 0x9e3779b1, 0x85ebca77, 0xc2b2ae3d];
  const hashes = seeds.map((init, lane) => {
    let h = init >>> 0;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= seed.charCodeAt(i) + lane * 31 + i;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    // Avalanche mix
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
    return h >>> 0;
  });

  const hex = hashes.map((n) => n.toString(16).padStart(8, '0')).join('');
  // Set version 5 (bits 48..51 = 0101) and RFC 4122 variant (bits 64..65 = 10)
  const versionChar = '5';
  const variantNibble = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    versionChar + hex.slice(13, 16),
    variantNibble + hex.slice(17, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Safely format a string literal for PostgreSQL standard_conforming_strings.
 */
export function escapeSqlString(value, maxLength = 5000) {
  if (value === null || value === undefined) return 'NULL';
  const normalized = String(value)
    .replace(/\u0000/g, '')
    .slice(0, maxLength);
  const escaped = normalized.replace(/'/g, "''");
  return `'${escaped}'`;
}

export function formatSqlTimestamp(value) {
  if (!value) return 'NULL';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'NULL';
  return `'${date.toISOString()}'::timestamptz`;
}

export function formatSqlNumber(value, fallback = 1000) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return String(fallback);
  return String(num);
}

export function formatSqlBoolean(value) {
  return value ? 'TRUE' : 'FALSE';
}

export function sanitizeEnum(value, allowedSet, fallback) {
  const normalized = String(value || '').trim().toLowerCase();
  return allowedSet.has(normalized) ? normalized : fallback;
}

export function sanitizeHexColor(value, fallback = '#635BFF') {
  const trimmed = String(value || '').trim();
  return HEX_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
}

export function sanitizeUrl(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/')) return trimmed.slice(0, 500);
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString().slice(0, 500);
    }
  } catch {
    // reject malformed URLs
  }
  return '';
}

/**
 * Normalize live TaskFlow Zustand/Firestore state into relational rows
 * matching the 16 Supabase tables in supabase/migrations/001_initial_schema.sql.
 */
export function buildSupabaseExportPayload({
  user,
  profile,
  workspaces = [],
  boards = [],
  lists = [],
  tasks = [],
  comments = [],
  activities = [],
  notifications = [],
} = {}) {
  const ownerEmail = String(user?.email || profile?.email || '').trim().toLowerCase();
  const ownerName = String(profile?.fullName || user?.displayName || 'TaskFlow Owner')
    .trim()
    .slice(0, 120) || 'TaskFlow Owner';

  const workspaceIdMap = new Map();
  const boardIdMap = new Map();
  const listIdMap = new Map();
  const taskIdMap = new Map();
  const labelIdMap = new Map();

  const mappedWorkspaces = workspaces.map((ws) => {
    const id = toDeterministicUuid(ws.id, 'workspace');
    workspaceIdMap.set(ws.id, id);
    return {
      id,
      name: String(ws.name || 'Untitled Workspace').trim().slice(0, 100) || 'Untitled Workspace',
      description: String(ws.description || '').trim().slice(0, 500),
      avatar_color: sanitizeHexColor(ws.avatarColor, '#635BFF'),
      created_at: ws.createdAt || new Date().toISOString(),
      updated_at: ws.updatedAt || new Date().toISOString(),
    };
  });

  const mappedBoards = boards
    .filter((b) => workspaceIdMap.has(b.workspaceId))
    .map((b) => {
      const id = toDeterministicUuid(b.id, 'board');
      boardIdMap.set(b.id, id);
      return {
        id,
        workspace_id: workspaceIdMap.get(b.workspaceId),
        title: String(b.title || 'Untitled Board').trim().slice(0, 120) || 'Untitled Board',
        description: String(b.description || '').trim().slice(0, 500),
        background: String(b.background || 'indigo').trim().slice(0, 40) || 'indigo',
        visibility: sanitizeEnum(b.visibility, ALLOWED_VISIBILITIES, 'workspace'),
        is_archived: Boolean(b.isArchived),
        created_at: b.createdAt || new Date().toISOString(),
        updated_at: b.updatedAt || new Date().toISOString(),
      };
    });

  const mappedLabels = [];
  boards.forEach((b) => {
    const boardUuid = boardIdMap.get(b.id);
    if (!boardUuid) return;
    (b.labels || []).forEach((lbl) => {
      const compositeKey = `${b.id}:${lbl.id}`;
      const id = toDeterministicUuid(compositeKey, 'label');
      labelIdMap.set(compositeKey, id);
      mappedLabels.push({
        id,
        board_id: boardUuid,
        name: String(lbl.name || 'Label').trim().slice(0, 40) || 'Label',
        color: sanitizeHexColor(lbl.color, '#635BFF'),
      });
    });
  });

  const mappedLists = lists
    .filter((l) => boardIdMap.has(l.boardId))
    .map((l, idx) => {
      const id = toDeterministicUuid(l.id, 'list');
      listIdMap.set(l.id, id);
      return {
        id,
        board_id: boardIdMap.get(l.boardId),
        title: String(l.title || 'List').trim().slice(0, 80) || 'List',
        position: Number.isFinite(Number(l.position)) && Number(l.position) >= 0
          ? Number(l.position)
          : (idx + 1) * 1000,
        created_at: l.createdAt || new Date().toISOString(),
        updated_at: l.updatedAt || new Date().toISOString(),
      };
    });

  const mappedTasks = [];
  const mappedTaskLabels = [];
  const mappedChecklists = [];
  const mappedChecklistItems = [];
  const mappedAttachments = [];

  tasks.forEach((t, idx) => {
    const boardUuid = boardIdMap.get(t.boardId);
    const listUuid = listIdMap.get(t.listId);
    if (!boardUuid || !listUuid) return;

    const id = toDeterministicUuid(t.id, 'task');
    taskIdMap.set(t.id, id);

    mappedTasks.push({
      id,
      list_id: listUuid,
      board_id: boardUuid,
      title: String(t.title || 'Untitled Task').trim().slice(0, 200) || 'Untitled Task',
      description: String(t.description || '').trim().slice(0, 5000),
      priority: sanitizeEnum(t.priority, ALLOWED_PRIORITIES, 'medium'),
      status: String(t.status || 'To Do').trim().slice(0, 80) || 'To Do',
      due_date: t.dueDate || null,
      position: Number.isFinite(Number(t.position)) && Number(t.position) >= 0
        ? Number(t.position)
        : (idx + 1) * 1000,
      is_archived: Boolean(t.isArchived),
      created_at: t.createdAt || new Date().toISOString(),
      updated_at: t.updatedAt || new Date().toISOString(),
    });

    const seenLabelIds = new Set();
    (t.labelIds || []).forEach((lid) => {
      const labelUuid = labelIdMap.get(`${t.boardId}:${lid}`);
      if (!labelUuid || seenLabelIds.has(labelUuid)) return;
      seenLabelIds.add(labelUuid);
      mappedTaskLabels.push({
        id: toDeterministicUuid(`${t.id}:${lid}`, 'task_label'),
        task_id: id,
        label_id: labelUuid,
      });
    });

    (t.checklists || []).forEach((cl, clIdx) => {
      const checklistUuid = toDeterministicUuid(`${t.id}:${cl.id || clIdx}`, 'checklist');
      mappedChecklists.push({
        id: checklistUuid,
        task_id: id,
        title: String(cl.title || 'Checklist').trim().slice(0, 120) || 'Checklist',
        position: (clIdx + 1) * 1000,
      });

      (cl.items || []).forEach((item, itemIdx) => {
        mappedChecklistItems.push({
          id: toDeterministicUuid(`${checklistUuid}:${item.id || itemIdx}`, 'checklist_item'),
          checklist_id: checklistUuid,
          title: String(item.title || 'Item').trim().slice(0, 200) || 'Item',
          is_completed: Boolean(item.isCompleted),
          position: (itemIdx + 1) * 1000,
        });
      });
    });

    (t.attachments || []).forEach((att, attIdx) => {
      const safeUrl = sanitizeUrl(att.url || att.fileUrl);
      if (!safeUrl) return;
      mappedAttachments.push({
        id: toDeterministicUuid(`${t.id}:${att.id || attIdx}`, 'attachment'),
        task_id: id,
        file_name: String(att.name || att.fileName || 'Attachment').trim().slice(0, 255) || 'Attachment',
        file_url: safeUrl,
        created_at: att.createdAt || new Date().toISOString(),
      });
    });
  });

  const mappedComments = comments
    .filter((c) => taskIdMap.has(c.taskId) && String(c.content || '').trim())
    .map((c) => ({
      id: toDeterministicUuid(c.id, 'comment'),
      task_id: taskIdMap.get(c.taskId),
      content: String(c.content || '').trim().slice(0, 2000),
      created_at: c.createdAt || new Date().toISOString(),
    }));

  const mappedActivities = activities
    .filter((a) => boardIdMap.has(a.boardId) && String(a.action || '').trim())
    .map((a) => ({
      id: toDeterministicUuid(a.id, 'activity'),
      board_id: boardIdMap.get(a.boardId),
      action: String(a.action || '').trim().slice(0, 240),
      metadata: a.metadata && typeof a.metadata === 'object' ? a.metadata : {},
      created_at: a.createdAt || new Date().toISOString(),
    }));

  const mappedNotifications = notifications
    .filter((n) => String(n.title || '').trim() && String(n.message || '').trim())
    .map((n) => ({
      id: toDeterministicUuid(n.id, 'notification'),
      title: String(n.title || '').trim().slice(0, 160),
      message: String(n.message || '').trim().slice(0, 500),
      type: sanitizeEnum(n.type, ALLOWED_NOTIFICATION_TYPES, 'task_update'),
      is_read: Boolean(n.isRead),
      link: sanitizeUrl(n.link),
      created_at: n.createdAt || new Date().toISOString(),
    }));

  return {
    exportedAt: new Date().toISOString(),
    source: 'TaskFlow',
    owner: {
      email: ownerEmail,
      full_name: ownerName,
      avatar_url: sanitizeUrl(profile?.avatarUrl || user?.photoURL || ''),
      role_title: String(profile?.roleTitle || 'Product Lead').trim().slice(0, 80),
      bio: String(profile?.bio || '').trim().slice(0, 300),
    },
    counts: {
      workspaces: mappedWorkspaces.length,
      boards: mappedBoards.length,
      lists: mappedLists.length,
      tasks: mappedTasks.length,
      labels: mappedLabels.length,
      checklists: mappedChecklists.length,
      checklist_items: mappedChecklistItems.length,
      comments: mappedComments.length,
      attachments: mappedAttachments.length,
      activities: mappedActivities.length,
      notifications: mappedNotifications.length,
    },
    tables: {
      workspaces: mappedWorkspaces,
      boards: mappedBoards,
      labels: mappedLabels,
      lists: mappedLists,
      tasks: mappedTasks,
      task_labels: mappedTaskLabels,
      checklists: mappedChecklists,
      checklist_items: mappedChecklistItems,
      comments: mappedComments,
      attachments: mappedAttachments,
      activities: mappedActivities,
      notifications: mappedNotifications,
    },
  };
}

/**
 * Generates an idempotent PostgreSQL DO $$ ... END $$; data migration script
 * ready to execute directly in the Supabase SQL Editor.
 */
export function generateSupabaseDataSql(payload) {
  const { owner, tables } = payload;
  const lines = [
    '-- ============================================================================',
    '-- TaskFlow Data Export for Supabase PostgreSQL',
    `-- Generated at: ${payload.exportedAt}`,
    '-- Note: Automatically binds imported records to your matching Supabase auth.users',
    '-- account (or the first registered user in auth.users). Safe to re-run (idempotent).',
    '-- ============================================================================',
    '',
    'DO $$',
    'DECLARE',
    '  v_owner_id UUID;',
    'BEGIN',
    owner.email
      ? `  SELECT id INTO v_owner_id FROM auth.users WHERE lower(email) = ${escapeSqlString(owner.email, 255)} LIMIT 1;`
      : '  v_owner_id := NULL;',
    '  IF v_owner_id IS NULL THEN',
    '    SELECT id INTO v_owner_id FROM auth.users ORDER BY created_at ASC LIMIT 1;',
    '  END IF;',
    '',
    '  IF v_owner_id IS NULL THEN',
    "    RAISE EXCEPTION 'No user found in auth.users yet. Create or sign in to at least one account in Supabase Auth first, then re-run this script.';",
    '  END IF;',
    '',
    '  -- Ensure owner profile exists',
    '  INSERT INTO public.profiles (id, full_name, avatar_url, role_title, bio)',
    `  VALUES (v_owner_id, ${escapeSqlString(owner.full_name, 120)}, ${escapeSqlString(owner.avatar_url, 500)}, ${escapeSqlString(owner.role_title, 80)}, ${escapeSqlString(owner.bio, 300)})`,
    '  ON CONFLICT (id) DO NOTHING;',
    '',
  ];

  // Workspaces + owner membership
  if (tables.workspaces.length) {
    lines.push('  -- 1. Workspaces & Owner Membership');
    tables.workspaces.forEach((w) => {
      lines.push(
        `  INSERT INTO public.workspaces (id, name, description, avatar_color, owner_id, created_at, updated_at)` +
          ` VALUES ('${w.id}', ${escapeSqlString(w.name, 100)}, ${escapeSqlString(w.description, 500)}, ${escapeSqlString(w.avatar_color, 16)}, v_owner_id, ${formatSqlTimestamp(w.created_at)}, ${formatSqlTimestamp(w.updated_at)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
      lines.push(
        `  INSERT INTO public.workspace_members (workspace_id, user_id, role)` +
          ` VALUES ('${w.id}', v_owner_id, 'owner')` +
          ` ON CONFLICT (workspace_id, user_id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  // Boards + owner board membership
  if (tables.boards.length) {
    lines.push('  -- 2. Boards & Board Membership');
    tables.boards.forEach((b) => {
      lines.push(
        `  INSERT INTO public.boards (id, workspace_id, title, description, background, visibility, is_archived, created_by, created_at, updated_at)` +
          ` VALUES ('${b.id}', '${b.workspace_id}', ${escapeSqlString(b.title, 120)}, ${escapeSqlString(b.description, 500)}, ${escapeSqlString(b.background, 40)}, '${b.visibility}'::public.board_visibility, ${formatSqlBoolean(b.is_archived)}, v_owner_id, ${formatSqlTimestamp(b.created_at)}, ${formatSqlTimestamp(b.updated_at)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
      lines.push(
        `  INSERT INTO public.board_members (board_id, user_id, role)` +
          ` VALUES ('${b.id}', v_owner_id, 'owner')` +
          ` ON CONFLICT (board_id, user_id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  // Labels
  if (tables.labels.length) {
    lines.push('  -- 3. Labels');
    tables.labels.forEach((l) => {
      lines.push(
        `  INSERT INTO public.labels (id, board_id, name, color)` +
          ` VALUES ('${l.id}', '${l.board_id}', ${escapeSqlString(l.name, 40)}, ${escapeSqlString(l.color, 16)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  // Lists
  if (tables.lists.length) {
    lines.push('  -- 4. Kanban Lists');
    tables.lists.forEach((l) => {
      lines.push(
        `  INSERT INTO public.lists (id, board_id, title, position, created_at, updated_at)` +
          ` VALUES ('${l.id}', '${l.board_id}', ${escapeSqlString(l.title, 80)}, ${formatSqlNumber(l.position)}, ${formatSqlTimestamp(l.created_at)}, ${formatSqlTimestamp(l.updated_at)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  // Tasks + owner assignment
  if (tables.tasks.length) {
    lines.push('  -- 5. Tasks & Assignees');
    tables.tasks.forEach((t) => {
      lines.push(
        `  INSERT INTO public.tasks (id, list_id, board_id, title, description, priority, status, due_date, position, is_archived, created_by, created_at, updated_at)` +
          ` VALUES ('${t.id}', '${t.list_id}', '${t.board_id}', ${escapeSqlString(t.title, 200)}, ${escapeSqlString(t.description, 5000)}, '${t.priority}'::public.task_priority, ${escapeSqlString(t.status, 80)}, ${formatSqlTimestamp(t.due_date)}, ${formatSqlNumber(t.position)}, ${formatSqlBoolean(t.is_archived)}, v_owner_id, ${formatSqlTimestamp(t.created_at)}, ${formatSqlTimestamp(t.updated_at)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
      lines.push(
        `  INSERT INTO public.task_assignees (task_id, user_id)` +
          ` VALUES ('${t.id}', v_owner_id)` +
          ` ON CONFLICT (task_id, user_id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  // Task Labels
  if (tables.task_labels.length) {
    lines.push('  -- 6. Task Labels');
    tables.task_labels.forEach((tl) => {
      lines.push(
        `  INSERT INTO public.task_labels (id, task_id, label_id)` +
          ` VALUES ('${tl.id}', '${tl.task_id}', '${tl.label_id}')` +
          ` ON CONFLICT (task_id, label_id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  // Checklists & Checklist Items
  if (tables.checklists.length) {
    lines.push('  -- 7. Checklists & Items');
    tables.checklists.forEach((cl) => {
      lines.push(
        `  INSERT INTO public.checklists (id, task_id, title, position)` +
          ` VALUES ('${cl.id}', '${cl.task_id}', ${escapeSqlString(cl.title, 120)}, ${formatSqlNumber(cl.position)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
    });
    tables.checklist_items.forEach((ci) => {
      lines.push(
        `  INSERT INTO public.checklist_items (id, checklist_id, title, is_completed, position)` +
          ` VALUES ('${ci.id}', '${ci.checklist_id}', ${escapeSqlString(ci.title, 200)}, ${formatSqlBoolean(ci.is_completed)}, ${formatSqlNumber(ci.position)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  // Comments
  if (tables.comments.length) {
    lines.push('  -- 8. Comments');
    tables.comments.forEach((c) => {
      lines.push(
        `  INSERT INTO public.comments (id, task_id, user_id, content, created_at)` +
          ` VALUES ('${c.id}', '${c.task_id}', v_owner_id, ${escapeSqlString(c.content, 2000)}, ${formatSqlTimestamp(c.created_at)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  // Attachments
  if (tables.attachments.length) {
    lines.push('  -- 9. Attachments');
    tables.attachments.forEach((a) => {
      lines.push(
        `  INSERT INTO public.attachments (id, task_id, file_name, file_url, uploaded_by, created_at)` +
          ` VALUES ('${a.id}', '${a.task_id}', ${escapeSqlString(a.file_name, 255)}, ${escapeSqlString(a.file_url, 500)}, v_owner_id, ${formatSqlTimestamp(a.created_at)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  // Activities
  if (tables.activities.length) {
    lines.push('  -- 10. Activities');
    tables.activities.forEach((a) => {
      const metaJson = escapeSqlString(JSON.stringify(a.metadata || {}), 2000);
      lines.push(
        `  INSERT INTO public.activities (id, board_id, user_id, action, metadata, created_at)` +
          ` VALUES ('${a.id}', '${a.board_id}', v_owner_id, ${escapeSqlString(a.action, 240)}, ${metaJson}::jsonb, ${formatSqlTimestamp(a.created_at)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  // Notifications
  if (tables.notifications.length) {
    lines.push('  -- 11. Notifications');
    tables.notifications.forEach((n) => {
      lines.push(
        `  INSERT INTO public.notifications (id, user_id, title, message, type, is_read, link, created_at)` +
          ` VALUES ('${n.id}', v_owner_id, ${escapeSqlString(n.title, 160)}, ${escapeSqlString(n.message, 500)}, '${n.type}'::public.notification_type, ${formatSqlBoolean(n.is_read)}, ${escapeSqlString(n.link, 500)}, ${formatSqlTimestamp(n.created_at)})` +
          ` ON CONFLICT (id) DO NOTHING;`
      );
    });
    lines.push('');
  }

  lines.push('END $$;');
  return lines.join('\n');
}

export function combineFullSupabaseSql({ schemaSql = '', rlsSql = '', dataSql = '' }) {
  return [schemaSql.trim(), rlsSql.trim(), dataSql.trim()]
    .filter(Boolean)
    .join('\n\n-- ============================================================================\n\n') + '\n';
}

export const SUPABASE_ALLOWED_ROLES = ALLOWED_ROLES;
