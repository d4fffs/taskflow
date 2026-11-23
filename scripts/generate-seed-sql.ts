import fs from 'node:fs';
import path from 'node:path';
import { createGuestSeedState } from '../src/services/sandbox/guestSeed';
import { buildSupabaseExportPayload, generateSupabaseDataSql } from '../src/utils/supabaseExport';

const seedState = createGuestSeedState();
const payload = buildSupabaseExportPayload({
  user: seedState.user,
  profile: seedState.profile,
  workspaces: seedState.workspaces,
  boards: seedState.boards,
  lists: seedState.lists,
  tasks: seedState.tasks,
  comments: seedState.comments,
  activities: seedState.activities,
  notifications: seedState.notifications,
});

console.log('Payload counts:', JSON.stringify(payload.counts, null, 2));

const sql = generateSupabaseDataSql(payload);
const outPath = path.resolve(process.cwd(), 'seed-data.sql');
fs.writeFileSync(outPath, sql, 'utf8');
console.log(`Generated seed SQL at ${outPath} (${sql.length} bytes)`);
