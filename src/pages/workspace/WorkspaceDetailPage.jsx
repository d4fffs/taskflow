import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Plus,
  UserPlus,
  Pencil,
  Trash2,
  Kanban,
  Mail,
} from 'lucide-react';
import { useDataStore } from '../../stores/useDataStore.js';
import { BOARD_BACKGROUNDS, WORKSPACE_ROLES } from '../../constants/templates.js';
import { Avatar, ConfirmDialog, EmptyState, Modal } from '../../components/common/UIPrimitives.jsx';
import { WorkspaceModal } from '../../components/workspace/WorkspaceModal.jsx';
import { CreateBoardModal } from '../../components/board/CreateBoardModal.jsx';
import { validateEmail } from '../../utils/kanban.js';

export function WorkspaceDetailPage() {
  const { id: workspaceId } = useParams();
  const navigate = useNavigate();
  const {
    workspaces,
    boards,
    tasks,
    workspaceMembers,
    invitations,
    getWorkspaceRole,
    inviteMember,
    updateMemberRole,
    removeMember,
    deleteWorkspace,
  } = useDataStore();

  const workspace = workspaces.find((w) => w.id === workspaceId);
  const [editWsOpen, setEditWsOpen] = useState(false);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteError, setInviteError] = useState('');

  if (!workspace) {
    return (
      <div className="p-6 max-w-2xl mx-auto mt-10">
        <EmptyState
          title="Workspace not found"
          description="Select an existing workspace or create a new one."
          actionLabel="Back to Workspaces"
          onAction={() => navigate('/workspaces')}
        />
      </div>
    );
  }

  const role = getWorkspaceRole(workspace.id);
  const roleMeta = WORKSPACE_ROLES[role] || WORKSPACE_ROLES.viewer;
  const wsBoards = boards.filter((b) => b.workspaceId === workspace.id && !b.isArchived);
  const members = workspaceMembers[workspace.id] || [];
  const wsInvites = invitations.filter((i) => i.workspaceId === workspace.id);

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !validateEmail(inviteEmail)) {
      setInviteError('Please enter a valid email address.');
      return;
    }
    setInviteError('');
    await inviteMember(workspace.id, inviteEmail, inviteRole);
    setInviteEmail('');
    setInviteRole('member');
    setInviteOpen(false);
  };

  return (
    <div className="p-5 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Workspace Header */}
      <div className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <span
            className="w-12 h-12 rounded-xl text-white font-display font-bold text-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: workspace.avatarColor || '#635BFF' }}
          >
            {workspace.name[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-[#20212B] dark:text-[#F4F5FA] truncate">
              {workspace.name}
            </h1>
            <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1">
              {workspace.description || 'Collaborative project workspace'}
            </p>
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-2">
              Your role: <strong className="text-[#20212B] dark:text-[#F4F5FA]">{roleMeta.label}</strong> ·{' '}
              <span className="font-mono tabular-nums">{wsBoards.length}</span> boards ·{' '}
              <span className="font-mono tabular-nums">{members.length}</span> members
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {roleMeta.canManageMembers && (
            <>
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5 text-[#635BFF]" />
                <span>Invite Member</span>
              </button>
              <button
                type="button"
                onClick={() => setEditWsOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5 text-[#6B7085]" />
                <span>Edit</span>
              </button>
            </>
          )}
          {roleMeta.canWrite && (
            <button
              type="button"
              onClick={() => setCreateBoardOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg text-white bg-[#635BFF] hover:bg-[#5249E8] whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Board</span>
            </button>
          )}
          {roleMeta.canDeleteWorkspace && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              aria-label="Delete workspace"
              className="p-2 rounded-lg border border-red-200 dark:border-red-900/50 text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Boards Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[#20212B] dark:text-[#F4F5FA]">
            Boards
          </h2>
          <span className="text-xs font-mono tabular-nums text-[#6B7085] dark:text-[#9EA3B8]">
            {wsBoards.length} active
          </span>
        </div>

        {wsBoards.length === 0 ? (
          <EmptyState
            icon={Kanban}
            title="No boards in this workspace"
            description="Create a Kanban board from scratch or pick a ready-made workflow template."
            actionLabel={roleMeta.canWrite ? 'Create First Board' : undefined}
            onAction={roleMeta.canWrite ? () => setCreateBoardOpen(true) : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {wsBoards.map((board) => {
              const bg =
                BOARD_BACKGROUNDS.find((b) => b.id === board.background) || BOARD_BACKGROUNDS[0];
              const taskCount = tasks.filter((t) => t.boardId === board.id && !t.isArchived).length;
              return (
                <button
                  key={board.id}
                  type="button"
                  onClick={() => navigate(`/board/${board.id}`)}
                  className="text-left bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] hover:border-[#635BFF] rounded-xl overflow-hidden transition-colors flex flex-col"
                >
                  <div
                    className="h-2 w-full"
                    style={{ backgroundColor: bg.headerAccent }}
                    aria-hidden="true"
                  />
                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                        {board.title}
                      </h3>
                      <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-1 line-clamp-2">
                        {board.description || 'Kanban project workflow'}
                      </p>
                    </div>
                    <div className="text-xs text-[#6B7085] dark:text-[#9EA3B8] font-mono tabular-nums">
                      {taskCount} tasks · {board.visibility}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Members & Invitations Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#20212B] dark:text-[#F4F5FA]">
              Members & Access Control
            </h2>
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
              Role permissions are enforced across boards, lists, and tasks.
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl overflow-hidden">
          <div className="divide-y divide-[#E6E8F0] dark:divide-[#262A3D]">
            {members.map((m) => {
              const memberUid = m.userId || m.id;
              const isOwner = m.role === 'owner';
              return (
                <div
                  key={memberUid}
                  className="px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={m.avatarUrl} name={m.fullName} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#20212B] dark:text-[#F4F5FA] truncate">
                        {m.fullName}
                      </p>
                      <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                        {WORKSPACE_ROLES[m.role]?.description || 'Workspace collaborator'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {roleMeta.canManageMembers && !isOwner ? (
                      <>
                        <select
                          aria-label={`Change role for ${m.fullName}`}
                          value={m.role}
                          onChange={(e) => updateMemberRole(workspace.id, memberUid, e.target.value)}
                          className="px-2.5 py-1.5 text-xs rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA]"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => removeMember(workspace.id, memberUid)}
                          className="px-2.5 py-1.5 text-xs font-medium text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-[#635BFF]">
                        {WORKSPACE_ROLES[m.role]?.label || m.role}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pending Invitations */}
        {wsInvites.length > 0 && (
          <div className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E6E8F0] dark:border-[#262A3D] text-xs font-semibold text-[#6B7085] dark:text-[#9EA3B8]">
              Pending Email Invitations ({wsInvites.length})
            </div>
            <div className="divide-y divide-[#E6E8F0] dark:divide-[#262A3D]">
              {wsInvites.map((inv) => (
                <div
                  key={inv.id}
                  className="px-5 py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mail className="w-4 h-4 text-[#9295A5] shrink-0" />
                    <span className="text-[#20212B] dark:text-[#F4F5FA] truncate">
                      {inv.inviteeEmail}
                    </span>
                  </div>
                  <span className="text-xs text-[#6B7085] dark:text-[#9EA3B8] shrink-0">
                    {WORKSPACE_ROLES[inv.role]?.label || inv.role} · {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Modals */}
      <WorkspaceModal
        open={editWsOpen}
        onClose={() => setEditWsOpen(false)}
        workspace={workspace}
      />

      <CreateBoardModal
        open={createBoardOpen}
        onClose={() => setCreateBoardOpen(false)}
        defaultWorkspaceId={workspace.id}
        onCreated={(b) => b?.id && navigate(`/board/${b.id}`)}
      />

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite Workspace Member"
        subtitle={`Send a role-scoped invitation to join ${workspace.name}.`}
        size="sm"
      >
        <form onSubmit={handleInviteSubmit} className="space-y-4" noValidate>
          <div>
            <label
              htmlFor="invite-email"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Collaborator Email
            </label>
            <input
              id="invite-email"
              type="email"
              value={inviteEmail}
              onChange={(e) => {
                setInviteEmail(e.target.value);
                if (inviteError) setInviteError('');
              }}
              placeholder="teammate@company.com"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D]"
            />
            {inviteError && <p className="text-xs text-[#EF4444] mt-1">{inviteError}</p>}
          </div>

          <div>
            <label
              htmlFor="invite-role"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Role Permission
            </label>
            <select
              id="invite-role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D]"
            >
              <option value="admin">Admin — Manage workspace and members</option>
              <option value="member">Member — Create and edit boards and tasks</option>
              <option value="viewer">Viewer — Read-only access</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E6E8F0] dark:border-[#262A3D]">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="px-4 py-2 text-sm rounded-lg border border-[#E6E8F0] dark:border-[#262A3D]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg"
            >
              Send Invitation
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          await deleteWorkspace(workspace.id);
          navigate('/workspaces');
        }}
        title={`Delete "${workspace.name}"?`}
        description="This permanently removes the workspace and cannot be undone."
        confirmLabel="Delete Workspace"
      />
    </div>
  );
}
