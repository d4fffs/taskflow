import schemaSqlRaw from '../../../supabase/migrations/001_initial_schema.sql?raw';
import rlsSqlRaw from '../../../supabase/migrations/002_rls_policies.sql?raw';
import { supabase, isSupabaseConfigured } from './client.js';
import {
  buildSupabaseExportPayload,
  generateSupabaseDataSql,
  combineFullSupabaseSql,
} from '../../utils/supabaseExport.js';

export function buildTaskFlowSupabaseBundle(stateSnapshot) {
  const payload = buildSupabaseExportPayload(stateSnapshot);
  const dataSql = generateSupabaseDataSql(payload);
  const fullSql = combineFullSupabaseSql({
    schemaSql: schemaSqlRaw,
    rlsSql: rlsSqlRaw,
    dataSql,
  });
  return {
    payload,
    schemaSql: schemaSqlRaw,
    rlsSql: rlsSqlRaw,
    dataSql,
    fullSql,
  };
}

export function downloadTextFile(filename, content, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function getSupabaseSessionUser() {
  if (!isSupabaseConfigured() || !supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data?.user || null;
}

export async function signInSupabaseAccount(email, password) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase environment variables are not configured.');
  }
  const { data, error } = await supabase.auth.signInWithPassword({
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
  });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function signUpSupabaseAccount(email, password, fullName = 'TaskFlow User') {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error('Supabase environment variables are not configured.');
  }
  const { data, error } = await supabase.auth.signUp({
    email: String(email || '').trim().toLowerCase(),
    password: String(password || ''),
    options: {
      data: { full_name: String(fullName || 'TaskFlow User').trim().slice(0, 120) },
    },
  });
  if (error) throw new Error(error.message);
  return data;
}

export async function signOutSupabaseAccount() {
  if (!isSupabaseConfigured() || !supabase) return;
  await supabase.auth.signOut();
}

/**
 * Directly push exported records to a configured Supabase project when
 * VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are present and the user has
 * an active Supabase Auth session.
 */
export async function pushExportToSupabase(stateSnapshot) {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error(
      'Supabase credentials (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY) are not configured in this environment yet.'
    );
  }

  const { data: sessionData, error: sessionErr } = await supabase.auth.getUser();
  if (sessionErr || !sessionData?.user) {
    throw new Error(
      'Sign in to your Supabase account below first, then click Push to Supabase.'
    );
  }

  const ownerId = sessionData.user.id;
  const { payload } = buildTaskFlowSupabaseBundle(stateSnapshot);
  const { tables, owner } = payload;

  const upsertStep = async (table, rows, onConflict = 'id') => {
    if (!rows.length) return;
    const { error } = await supabase.from(table).upsert(rows, { onConflict });
    if (error) {
      throw new Error(`Supabase table "${table}": ${error.message}`);
    }
  };

  // Ensure owner profile row exists before foreign-key tables
  await upsertStep('profiles', [
    {
      id: ownerId,
      full_name: owner.full_name || 'TaskFlow Owner',
      avatar_url: owner.avatar_url || '',
      role_title: owner.role_title || 'Owner',
      bio: owner.bio || '',
    },
  ]);

  await upsertStep(
    'workspaces',
    tables.workspaces.map((w) => ({ ...w, owner_id: ownerId }))
  );
  await upsertStep(
    'workspace_members',
    tables.workspaces.map((w) => ({ workspace_id: w.id, user_id: ownerId, role: 'owner' })),
    'workspace_id,user_id'
  );
  await upsertStep(
    'boards',
    tables.boards.map((b) => ({ ...b, created_by: ownerId }))
  );
  await upsertStep(
    'board_members',
    tables.boards.map((b) => ({ board_id: b.id, user_id: ownerId, role: 'owner' })),
    'board_id,user_id'
  );
  await upsertStep('labels', tables.labels);
  await upsertStep('lists', tables.lists);
  await upsertStep(
    'tasks',
    tables.tasks.map((t) => ({ ...t, created_by: ownerId }))
  );
  await upsertStep(
    'task_assignees',
    tables.tasks.map((t) => ({ task_id: t.id, user_id: ownerId })),
    'task_id,user_id'
  );
  await upsertStep('task_labels', tables.task_labels, 'task_id,label_id');
  await upsertStep('checklists', tables.checklists);
  await upsertStep('checklist_items', tables.checklist_items);
  await upsertStep(
    'comments',
    tables.comments.map((c) => ({ ...c, user_id: ownerId }))
  );
  await upsertStep(
    'attachments',
    tables.attachments.map((a) => ({ ...a, uploaded_by: ownerId }))
  );
  await upsertStep(
    'activities',
    tables.activities.map((a) => ({ ...a, user_id: ownerId }))
  );
  await upsertStep(
    'notifications',
    tables.notifications.map((n) => ({ ...n, user_id: ownerId }))
  );

  return payload.counts;
}
