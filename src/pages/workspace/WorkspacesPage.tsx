import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, Plus, ArrowRight, Pencil, Trash2 } from 'lucide-react';
import { useDataStore } from '../../stores/useDataStore';
import { EmptyState, ConfirmDialog } from '../../components/common/UIPrimitives';
import { WorkspaceModal } from '../../components/workspace/WorkspaceModal';
import { WORKSPACE_ROLES } from '../../constants/templates';
import type { Workspace } from '../../types';

export function WorkspacesPage() {
  const navigate = useNavigate();
  const {
    workspaces,
    boards,
    getWorkspaceRole,
    deleteWorkspace,
    setActiveWorkspaceId,
  } = useDataStore();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingWs, setEditingWs] = useState<Workspace | null>(null);
  const [deletingWs, setDeletingWs] = useState<Workspace | null>(null);

  return (
    <div className="p-5 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#20212B] dark:text-[#F4F5FA] tracking-tight">
            Workspaces
          </h1>
          <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1">
            Organize teams, role permissions, and project boards inside dedicated workspaces.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingWs(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Workspace</span>
        </button>
      </div>

      {workspaces.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No workspaces yet"
          description="Create your first workspace to invite collaborators and organize Kanban boards."
          actionLabel="Create Workspace"
          onAction={() => {
            setEditingWs(null);
            setModalOpen(true);
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((ws) => {
            const wsBoards = boards.filter((b) => b.workspaceId === ws.id && !b.isArchived);
            const role = getWorkspaceRole(ws.id);
            const roleMeta = WORKSPACE_ROLES[role] || WORKSPACE_ROLES.viewer;
            return (
              <article
                key={ws.id}
                className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-5 flex flex-col justify-between gap-5 hover:border-[#C7CBE0] dark:hover:border-[#3A405C] transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className="w-10 h-10 rounded-xl text-white font-display font-bold text-base flex items-center justify-center shrink-0"
                        style={{ backgroundColor: ws.avatarColor || '#635BFF' }}
                      >
                        {ws.name[0].toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-base font-semibold text-[#20212B] dark:text-[#F4F5FA] truncate">
                          {ws.name}
                        </h2>
                        <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                          {roleMeta.label} ·{' '}
                          <span className="font-mono tabular-nums">{wsBoards.length}</span> boards ·{' '}
                          <span className="font-mono tabular-nums">
                            {(ws.memberIds || []).length}
                          </span>{' '}
                          members
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {roleMeta.canManageMembers && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingWs(ws);
                            setModalOpen(true);
                          }}
                          aria-label={`Edit workspace ${ws.name}`}
                          className="p-1.5 rounded-lg text-[#6B7085] hover:text-[#20212B] dark:hover:text-white hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {roleMeta.canDeleteWorkspace && (
                        <button
                          type="button"
                          onClick={() => setDeletingWs(ws)}
                          aria-label={`Delete workspace ${ws.name}`}
                          className="p-1.5 rounded-lg text-[#6B7085] hover:text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-3 line-clamp-2 leading-relaxed">
                    {ws.description || 'No workspace description added yet.'}
                  </p>
                </div>

                <div className="pt-3.5 border-t border-[#F0F1F6] dark:border-[#202436] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      navigate(`/workspace/${ws.id}`);
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#635BFF] hover:underline"
                  >
                    <span>Open workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <WorkspaceModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        workspace={editingWs}
      />

      <ConfirmDialog
        open={Boolean(deletingWs)}
        onClose={() => setDeletingWs(null)}
        onConfirm={() => {
          if (deletingWs) void deleteWorkspace(deletingWs.id);
        }}
        title={`Delete "${deletingWs?.name || ''}"?`}
        description="This permanently removes the workspace and its access settings."
        confirmLabel="Delete Workspace"
      />
    </div>
  );
}
