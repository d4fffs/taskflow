import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Kanban, Plus, Search, ArchiveRestore } from 'lucide-react';
import { useDataStore } from '../../stores/useDataStore.js';
import { BOARD_BACKGROUNDS } from '../../constants/templates.js';
import { EmptyState } from '../../components/common/UIPrimitives.jsx';
import { CreateBoardModal } from '../../components/board/CreateBoardModal.jsx';

export function BoardsPage() {
  const navigate = useNavigate();
  const { workspaces, boards, tasks, updateBoard } = useDataStore();

  const [search, setSearch] = useState('');
  const [workspaceFilter, setWorkspaceFilter] = useState('all');
  const [tab, setTab] = useState('active');
  const [createOpen, setCreateOpen] = useState(false);

  const filteredBoards = useMemo(() => {
    const q = search.trim().toLowerCase();
    return boards.filter((b) => {
      if (tab === 'active' && b.isArchived) return false;
      if (tab === 'archived' && !b.isArchived) return false;
      if (workspaceFilter !== 'all' && b.workspaceId !== workspaceFilter) return false;
      if (q && !b.title.toLowerCase().includes(q) && !(b.description || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [boards, search, workspaceFilter, tab]);

  return (
    <div className="p-5 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#20212B] dark:text-[#F4F5FA] tracking-tight">
            Boards
          </h1>
          <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1">
            Browse all Kanban boards across your workspaces or launch a new template.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg transition-colors whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Board</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFF1F8] dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D]">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'active'
                ? 'bg-white dark:bg-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] shadow-xs'
                : 'text-[#6B7085] dark:text-[#9EA3B8]'
            }`}
          >
            Active
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'archived'
                ? 'bg-white dark:bg-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] shadow-xs'
                : 'text-[#6B7085] dark:text-[#9EA3B8]'
            }`}
          >
            Archived
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#9295A5] absolute left-3 top-2.5" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search boards..."
              aria-label="Search boards"
              className="pl-8 pr-3 py-2 text-xs rounded-lg bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] w-48 sm:w-56"
            />
          </div>
          <select
            value={workspaceFilter}
            onChange={(e) => setWorkspaceFilter(e.target.value)}
            aria-label="Filter by workspace"
            className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA]"
          >
            <option value="all">All workspaces</option>
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filteredBoards.length === 0 ? (
        <EmptyState
          icon={Kanban}
          title={tab === 'archived' ? 'No archived boards' : 'No matching boards'}
          description={
            tab === 'archived'
              ? 'Boards you archive will be stored safely here.'
              : 'Create a new Kanban board or adjust your workspace filter.'
          }
          actionLabel={tab === 'active' ? 'Create Board' : undefined}
          onAction={tab === 'active' ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBoards.map((board) => {
            const ws = workspaces.find((w) => w.id === board.workspaceId);
            const bg =
              BOARD_BACKGROUNDS.find((b) => b.id === board.background) || BOARD_BACKGROUNDS[0];
            const count = tasks.filter((t) => t.boardId === board.id && !t.isArchived).length;
            return (
              <article
                key={board.id}
                className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] hover:border-[#635BFF] rounded-xl overflow-hidden transition-colors flex flex-col"
              >
                <div
                  className="h-2 w-full"
                  style={{ backgroundColor: bg.headerAccent }}
                  aria-hidden="true"
                />
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => navigate(`/board/${board.id}`)}
                    className="text-left focus-visible:outline-none"
                  >
                    <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mb-1 truncate">
                      {ws?.name || 'Workspace'}
                    </p>
                    <h2 className="text-base font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                      {board.title}
                    </h2>
                    <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-1.5 line-clamp-2 leading-relaxed">
                      {board.description || 'Collaborative Kanban board'}
                    </p>
                  </button>

                  <div className="pt-3 border-t border-[#F0F1F6] dark:border-[#202436] flex items-center justify-between text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                    <span className="font-mono tabular-nums">
                      {count} tasks · {board.visibility}
                    </span>
                    {board.isArchived ? (
                      <button
                        type="button"
                        onClick={() => updateBoard(board.id, { isArchived: false })}
                        className="inline-flex items-center gap-1 text-[#635BFF] font-medium hover:underline"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                        Restore
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => navigate(`/board/${board.id}`)}
                        className="text-[#635BFF] font-medium hover:underline"
                      >
                        Open board
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <CreateBoardModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(b) => b?.id && navigate(`/board/${b.id}`)}
      />
    </div>
  );
}
