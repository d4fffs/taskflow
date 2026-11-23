import React, { useEffect, useMemo, useState } from 'react';
import type { User as SupabaseAuthUser } from '@supabase/supabase-js';
import {
  Sun,
  Moon,
  Keyboard,
  Database,
  Download,
  Copy,
  Check,
  FileJson,
  UploadCloud,
} from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDataStore } from '../../stores/useDataStore';
import { useToastStore } from '../../stores/useToastStore';
import { WORKSPACE_COLORS } from '../../constants/templates';
import { isSupabaseConfigured } from '../../services/supabase/client';
import {
  buildTaskFlowSupabaseBundle,
  downloadTextFile,
  getSupabaseSessionUser,
  pushExportToSupabase,
  signInSupabaseAccount,
  signOutSupabaseAccount,
  signUpSupabaseAccount,
} from '../../services/supabase/exportService';
import type { SupabaseExportInput } from '../../utils/supabaseExport';

export function SettingsPage() {
  const { user, profile, theme, setTheme } = useAuthStore();
  const {
    workspaces,
    boards,
    lists,
    tasks,
    comments,
    activities,
    notifications,
    activeWorkspaceId,
    updateWorkspace,
    getWorkspaceRole,
  } = useDataStore();
  const addToast = useToastStore((s) => s.addToast);

  const activeWorkspace =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0] || null;
  const role = activeWorkspace ? getWorkspaceRole(activeWorkspace.id) : 'viewer';
  const canEditWorkspace = role === 'owner' || role === 'admin';

  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');
  const [wsColor, setWsColor] = useState<string>(WORKSPACE_COLORS[0]);
  const [copiedSql, setCopiedSql] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [supabaseUser, setSupabaseUser] = useState<SupabaseAuthUser | null>(null);
  const [sbEmail, setSbEmail] = useState('');
  const [sbPassword, setSbPassword] = useState('');
  const [sbAuthBusy, setSbAuthBusy] = useState(false);

  const supabaseReady = isSupabaseConfigured();

  useEffect(() => {
    if (!supabaseReady) return;
    getSupabaseSessionUser().then(setSupabaseUser).catch(() => {});
  }, [supabaseReady]);

  const exportState = useMemo<SupabaseExportInput>(
    () => ({
      user,
      profile,
      workspaces,
      boards,
      lists,
      tasks,
      comments,
      activities,
      notifications,
    }),
    [user, profile, workspaces, boards, lists, tasks, comments, activities, notifications]
  );

  const exportCounts = useMemo(
    () => ({
      workspaces: workspaces.length,
      boards: boards.length,
      lists: lists.length,
      tasks: tasks.length,
      comments: comments.length,
      activities: activities.length,
    }),
    [workspaces.length, boards.length, lists.length, tasks.length, comments.length, activities.length]
  );

  useEffect(() => {
    if (activeWorkspace) {
      setWsName(activeWorkspace.name || '');
      setWsDesc(activeWorkspace.description || '');
      setWsColor(activeWorkspace.avatarColor || WORKSPACE_COLORS[0]);
    }
  }, [activeWorkspace?.id]);

  const handleSaveWorkspace = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeWorkspace || !canEditWorkspace || !wsName.trim()) return;
    await updateWorkspace(activeWorkspace.id, {
      name: wsName.trim(),
      description: wsDesc.trim(),
      avatarColor: wsColor,
    });
  };

  const handleDownloadFullSql = () => {
    const bundle = buildTaskFlowSupabaseBundle(exportState);
    downloadTextFile('taskflow-supabase-full-export.sql', bundle.fullSql, 'application/sql;charset=utf-8');
    addToast({
      title: 'Supabase SQL downloaded',
      message: 'Includes 16-table schema, RLS policies, and your live data.',
      variant: 'success',
    });
  };

  const handleDownloadDataSql = () => {
    const bundle = buildTaskFlowSupabaseBundle(exportState);
    downloadTextFile('taskflow-supabase-data-only.sql', bundle.dataSql, 'application/sql;charset=utf-8');
    addToast({
      title: 'Data-only SQL downloaded',
      message: 'Ready to run in Supabase SQL Editor after initial schema migrations.',
      variant: 'success',
    });
  };

  const handleCopySql = async () => {
    const bundle = buildTaskFlowSupabaseBundle(exportState);
    try {
      await navigator.clipboard.writeText(bundle.fullSql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
      addToast({
        title: 'SQL copied to clipboard',
        message: 'Paste directly into your Supabase SQL Editor and click Run.',
        variant: 'success',
      });
    } catch {
      downloadTextFile('taskflow-supabase-full-export.sql', bundle.fullSql, 'application/sql;charset=utf-8');
      addToast({
        title: 'Downloaded SQL file instead',
        message: 'Clipboard access was blocked by the browser.',
        variant: 'info',
      });
    }
  };

  const handleDownloadJson = () => {
    const bundle = buildTaskFlowSupabaseBundle(exportState);
    downloadTextFile(
      'taskflow-supabase-data.json',
      JSON.stringify(bundle.payload, null, 2),
      'application/json;charset=utf-8'
    );
    addToast({
      title: 'JSON snapshot downloaded',
      message: 'Compatible with scripts/export-to-supabase.mjs.',
      variant: 'success',
    });
  };

  const handleSupabaseSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sbEmail.trim() || !sbPassword) {
      addToast({
        title: 'Missing credentials',
        message: 'Enter your Supabase account email and password.',
        variant: 'error',
      });
      return;
    }
    setSbAuthBusy(true);
    try {
      const signedIn = await signInSupabaseAccount(sbEmail, sbPassword);
      setSupabaseUser(signedIn);
      setSbPassword('');
      addToast({
        title: 'Supabase account connected',
        message: `Signed in as ${signedIn?.email ?? sbEmail}. Ready to push data.`,
        variant: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Supabase sign-in failed',
        message: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setSbAuthBusy(false);
    }
  };

  const handleSupabaseSignUp = async () => {
    if (!sbEmail.trim() || sbPassword.length < 6) {
      addToast({
        title: 'Invalid sign-up input',
        message: 'Provide a valid email and a password of at least 6 characters.',
        variant: 'error',
      });
      return;
    }
    setSbAuthBusy(true);
    try {
      const res = await signUpSupabaseAccount(sbEmail, sbPassword, profile?.fullName || 'TaskFlow Owner');
      if (res.session?.user) {
        setSupabaseUser(res.session.user);
        setSbPassword('');
        addToast({
          title: 'Supabase account created',
          message: 'Signed in and ready to push data.',
          variant: 'success',
        });
      } else {
        addToast({
          title: 'Confirmation email sent',
          message: 'Confirm your email in Supabase Auth, then sign in here to push data.',
          variant: 'info',
        });
      }
    } catch (err) {
      addToast({
        title: 'Supabase sign-up failed',
        message: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setSbAuthBusy(false);
    }
  };

  const handleSupabaseSignOut = async () => {
    await signOutSupabaseAccount();
    setSupabaseUser(null);
    addToast({ title: 'Disconnected Supabase session', variant: 'info' });
  };

  const handleDirectPush = async () => {
    setPushing(true);
    try {
      const counts = await pushExportToSupabase(exportState);
      addToast({
        title: 'Exported to Supabase',
        message: `Synced ${counts.workspaces} workspaces, ${counts.boards} boards, and ${counts.tasks} tasks.`,
        variant: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Direct Supabase push failed',
        message: err instanceof Error ? err.message : String(err),
        variant: 'error',
      });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#20212B] dark:text-[#F4F5FA] tracking-tight">
          Settings
        </h1>
        <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1">
          Configure appearance preferences, active workspace details, and Supabase database export.
        </p>
      </div>

      {/* Appearance */}
      <section className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[#20212B] dark:text-[#F4F5FA]">
            Appearance
          </h2>
          <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-0.5">
            Switch between Light Mode and Dark Mode across all workspaces and boards.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-md">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
              theme === 'light'
                ? 'border-[#635BFF] bg-[#635BFF]/[0.06]'
                : 'border-[#E6E8F0] dark:border-[#262A3D] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]'
            }`}
          >
            <Sun className="w-5 h-5 text-[#F59E0B]" />
            <div>
              <p className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                Light Mode
              </p>
              <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                High-clarity off-white canvas
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-3 p-4 rounded-xl border text-left transition-colors ${
              theme === 'dark'
                ? 'border-[#635BFF] bg-[#635BFF]/15'
                : 'border-[#E6E8F0] dark:border-[#262A3D] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]'
            }`}
          >
            <Moon className="w-5 h-5 text-[#635BFF]" />
            <div>
              <p className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                Dark Mode
              </p>
              <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                Deep obsidian low-glare studio
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Export Database to Supabase */}
      <section className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#635BFF]" />
              <h2 className="text-base font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                Export Database to Supabase
              </h2>
            </div>
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-1 leading-relaxed">
              Download or copy a complete idempotent PostgreSQL script (16 tables, indexes, RLS policies, Realtime, and live records) for Supabase SQL Editor, or push records directly into your linked Supabase project.
            </p>
          </div>
          <span
            className={`text-xs font-medium shrink-0 ${
              supabaseReady
                ? 'text-[#16A34A] dark:text-[#4ADE80]'
                : 'text-[#6B7085] dark:text-[#9EA3B8]'
            }`}
          >
            {supabaseReady ? 'Supabase project linked' : 'SQL / CLI export ready'}
          </span>
        </div>

        {/* Live Record Summary */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
          {[
            { label: 'Workspaces', value: exportCounts.workspaces },
            { label: 'Boards', value: exportCounts.boards },
            { label: 'Lists', value: exportCounts.lists },
            { label: 'Tasks', value: exportCounts.tasks },
            { label: 'Comments', value: exportCounts.comments },
            { label: 'Activities', value: exportCounts.activities },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] px-3 py-2.5"
            >
              <p className="text-[11px] text-[#6B7085] dark:text-[#9EA3B8]">{item.label}</p>
              <p className="font-mono text-base font-semibold tabular-nums text-[#20212B] dark:text-[#F4F5FA] mt-0.5">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {/* SQL & JSON Export Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleDownloadFullSql}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Full SQL
          </button>

          <button
            type="button"
            onClick={handleCopySql}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-[#20212B] dark:text-[#F4F5FA] bg-[#F7F8FC] dark:bg-[#1C1F2E] hover:bg-[#ECEEF6] dark:hover:bg-[#262A3D] border border-[#E6E8F0] dark:border-[#262A3D] rounded-lg transition-colors"
          >
            {copiedSql ? (
              <Check className="w-4 h-4 text-[#22C55E]" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copiedSql ? 'Copied SQL' : 'Copy SQL'}
          </button>

          <button
            type="button"
            onClick={handleDownloadDataSql}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-[#20212B] dark:text-[#F4F5FA] bg-white dark:bg-[#151722] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] border border-[#E6E8F0] dark:border-[#262A3D] rounded-lg transition-colors"
          >
            <Download className="w-4 h-4" />
            Data-Only SQL
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-[#20212B] dark:text-[#F4F5FA] bg-white dark:bg-[#151722] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] border border-[#E6E8F0] dark:border-[#262A3D] rounded-lg transition-colors"
          >
            <FileJson className="w-4 h-4" />
            JSON Snapshot
          </button>
        </div>

        {/* Direct Live Sync Box when Supabase Env is Linked */}
        {supabaseReady ? (
          <div className="rounded-xl bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                  Direct Push to Linked Supabase Project
                </h3>
                <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-0.5">
                  Run the schema migration once in Supabase SQL Editor, then sign in with your Supabase account to upsert live records directly.
                </p>
              </div>
              {supabaseUser && (
                <button
                  type="button"
                  onClick={handleSupabaseSignOut}
                  className="text-xs font-medium text-[#6B7085] hover:text-[#20212B] dark:hover:text-[#F4F5FA] shrink-0"
                >
                  Disconnect ({supabaseUser.email})
                </button>
              )}
            </div>

            {supabaseUser ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={pushing}
                  onClick={handleDirectPush}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 rounded-lg transition-colors"
                >
                  <UploadCloud className="w-4 h-4" />
                  {pushing ? 'Syncing to Supabase...' : 'Push Live Data to Supabase'}
                </button>
                <span className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                  Authenticated as <span className="font-mono text-[#20212B] dark:text-[#F4F5FA]">{supabaseUser.email}</span>
                </span>
              </div>
            ) : (
              <form onSubmit={handleSupabaseSignIn} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <input
                  type="email"
                  aria-label="Supabase account email"
                  placeholder="Supabase user email"
                  value={sbEmail}
                  onChange={(e) => setSbEmail(e.target.value)}
                  className="sm:col-span-4 px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D]"
                />
                <input
                  type="password"
                  aria-label="Supabase account password"
                  placeholder="Supabase password"
                  value={sbPassword}
                  onChange={(e) => setSbPassword(e.target.value)}
                  className="sm:col-span-4 px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D]"
                />
                <div className="sm:col-span-4 flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={sbAuthBusy}
                    className="flex-1 px-3 py-2 text-xs font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] disabled:opacity-60 rounded-lg transition-colors"
                  >
                    {sbAuthBusy ? 'Connecting...' : 'Sign In'}
                  </button>
                  <button
                    type="button"
                    disabled={sbAuthBusy}
                    onClick={handleSupabaseSignUp}
                    className="px-3 py-2 text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] bg-white dark:bg-[#151722] hover:bg-[#ECEEF6] dark:hover:bg-[#1C1F2E] border border-[#E6E8F0] dark:border-[#262A3D] rounded-lg transition-colors"
                  >
                    Sign Up
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] leading-relaxed">
            To enable direct push from the app, configure <span className="font-mono text-[#20212B] dark:text-[#F4F5FA]">VITE_SUPABASE_URL</span> and <span className="font-mono text-[#20212B] dark:text-[#F4F5FA]">VITE_SUPABASE_ANON_KEY</span> in project secrets, or run <span className="font-mono text-[#20212B] dark:text-[#F4F5FA]">node scripts/export-to-supabase.mjs</span> with server-side <span className="font-mono text-[#20212B] dark:text-[#F4F5FA]">SUPABASE_URL</span> and <span className="font-mono text-[#20212B] dark:text-[#F4F5FA]">SUPABASE_SERVICE_ROLE_KEY</span>.
          </p>
        )}
      </section>

      {/* Active Workspace Configuration */}
      {activeWorkspace && (
        <section className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-[#20212B] dark:text-[#F4F5FA]">
              Active Workspace
            </h2>
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-0.5">
              {canEditWorkspace
                ? 'Update name, description, and brand accent for your active workspace.'
                : 'Only Owners and Admins can modify workspace settings.'}
            </p>
          </div>

          <form onSubmit={handleSaveWorkspace} className="space-y-4 max-w-lg">
            <div>
              <label
                htmlFor="settings-ws-name"
                className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
              >
                Workspace Name
              </label>
              <input
                id="settings-ws-name"
                type="text"
                disabled={!canEditWorkspace}
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="settings-ws-desc"
                className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
              >
                Description
              </label>
              <textarea
                id="settings-ws-desc"
                rows={3}
                disabled={!canEditWorkspace}
                value={wsDesc}
                onChange={(e) => setWsDesc(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] disabled:opacity-60 resize-none"
              />
            </div>

            <div className="flex items-center gap-2">
              {WORKSPACE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={!canEditWorkspace}
                  onClick={() => setWsColor(c)}
                  aria-label={`Workspace accent ${c}`}
                  className={`w-7 h-7 rounded-lg ${
                    wsColor === c ? 'ring-2 ring-offset-2 ring-[#635BFF] dark:ring-offset-[#151722]' : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            {canEditWorkspace && (
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg"
              >
                Save Workspace Settings
              </button>
            )}
          </form>
        </section>
      )}

      {/* Keyboard Accessibility */}
      <section className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Keyboard className="w-4 h-4 text-[#635BFF]" />
          <h2 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
            Keyboard Navigation
          </h2>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#6B7085] dark:text-[#9EA3B8]">
          <li className="flex items-center justify-between bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] rounded-lg px-3 py-2">
            <span>Close modal</span>
            <kbd className="font-mono text-[#20212B] dark:text-[#F4F5FA]">Esc</kbd>
          </li>
          <li className="flex items-center justify-between bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] rounded-lg px-3 py-2">
            <span>Drag card / list</span>
            <kbd className="font-mono text-[#20212B] dark:text-[#F4F5FA]">Space + Arrows</kbd>
          </li>
          <li className="flex items-center justify-between bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] rounded-lg px-3 py-2">
            <span>Submit form</span>
            <kbd className="font-mono text-[#20212B] dark:text-[#F4F5FA]">Enter</kbd>
          </li>
        </ul>
      </section>
    </div>
  );
}
