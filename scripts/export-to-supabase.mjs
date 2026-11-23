/**
 * Server-side CLI script to push an exported TaskFlow JSON snapshot
 * directly into your linked Supabase PostgreSQL database.
 *
 * Usage:
 *   1. Run supabase/migrations/001_initial_schema.sql and 002_rls_policies.sql in Supabase SQL Editor.
 *   2. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment (.env).
 *   3. Export taskflow-supabase-data.json from TaskFlow Settings -> Export Database to Supabase.
 *   4. Run: node scripts/export-to-supabase.mjs ./taskflow-supabase-data.json
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment variables.'
  );
  process.exit(1);
}

const inputArg = process.argv[2] || 'taskflow-supabase-data.json';
const baseDir = process.cwd();
const resolvedPath = path.resolve(baseDir, inputArg);
if (!resolvedPath.startsWith(baseDir + path.sep)) {
  console.error('Export JSON file must reside inside the current workspace directory.');
  process.exit(1);
}

if (!fs.existsSync(resolvedPath)) {
  console.error(`Snapshot file not found: ${resolvedPath}`);
  process.exit(1);
}

const snapshot = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolveOwnerUserId(ownerEmail) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
  if (error) throw new Error(`Failed listing Supabase auth users: ${error.message}`);
  const users = data?.users || [];
  const matched =
    (ownerEmail && users.find((u) => u.email?.toLowerCase() === ownerEmail.toLowerCase())) ||
    users[0];
  if (!matched) {
    throw new Error(
      'No user exists in Supabase auth.users yet. Create at least one user in Supabase Authentication first.'
    );
  }
  return matched.id;
}

async function upsertTable(table, rows, onConflict = 'id') {
  if (!rows?.length) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`Failed upserting "${table}": ${error.message}`);
  console.log(`✓ ${table}: ${rows.length} row(s) synced`);
}

async function main() {
  const ownerId = await resolveOwnerUserId(snapshot.owner?.email);
  const { tables, owner } = snapshot;

  await upsertTable('profiles', [
    {
      id: ownerId,
      full_name: owner?.full_name || 'TaskFlow Owner',
      avatar_url: owner?.avatar_url || '',
      role_title: owner?.role_title || 'Owner',
      bio: owner?.bio || '',
    },
  ]);

  await upsertTable(
    'workspaces',
    (tables.workspaces || []).map((w) => ({ ...w, owner_id: ownerId }))
  );
  await upsertTable(
    'workspace_members',
    (tables.workspaces || []).map((w) => ({ workspace_id: w.id, user_id: ownerId, role: 'owner' })),
    'workspace_id,user_id'
  );
  await upsertTable(
    'boards',
    (tables.boards || []).map((b) => ({ ...b, created_by: ownerId }))
  );
  await upsertTable(
    'board_members',
    (tables.boards || []).map((b) => ({ board_id: b.id, user_id: ownerId, role: 'owner' })),
    'board_id,user_id'
  );
  await upsertTable('labels', tables.labels || []);
  await upsertTable('lists', tables.lists || []);
  await upsertTable(
    'tasks',
    (tables.tasks || []).map((t) => ({ ...t, created_by: ownerId }))
  );
  await upsertTable(
    'task_assignees',
    (tables.tasks || []).map((t) => ({ task_id: t.id, user_id: ownerId })),
    'task_id,user_id'
  );
  await upsertTable('task_labels', tables.task_labels || [], 'task_id,label_id');
  await upsertTable('checklists', tables.checklists || []);
  await upsertTable('checklist_items', tables.checklist_items || []);
  await upsertTable(
    'comments',
    (tables.comments || []).map((c) => ({ ...c, user_id: ownerId }))
  );
  await upsertTable(
    'attachments',
    (tables.attachments || []).map((a) => ({ ...a, uploaded_by: ownerId }))
  );
  await upsertTable(
    'activities',
    (tables.activities || []).map((a) => ({ ...a, user_id: ownerId }))
  );
  await upsertTable(
    'notifications',
    (tables.notifications || []).map((n) => ({ ...n, user_id: ownerId }))
  );

  console.log('\nTaskFlow export to Supabase completed successfully.');
}

main().catch((err) => {
  console.error('Export failed:', err.message);
  process.exit(1);
});
