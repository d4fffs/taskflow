import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
  Plus,
  Search,
  SlidersHorizontal,
  Activity as ActivityIcon,
  Archive,
  Trash2,
  X,
  ArrowLeft,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDataStore } from '../../stores/useDataStore.js';
import { BOARD_BACKGROUNDS } from '../../constants/templates.js';
import { KanbanColumn } from '../../components/board/KanbanColumn.jsx';
import { KanbanCard } from '../../components/board/KanbanCard.jsx';
import { TaskDetailModal } from '../../components/task/TaskDetailModal.jsx';
import { ConfirmDialog, EmptyState, Modal } from '../../components/common/UIPrimitives.jsx';
import { toJsDate } from '../../utils/kanban.js';

export function BoardDetailPage() {
  const { id: boardId } = useParams();
  const navigate = useNavigate();
  const {
    boards,
    lists,
    tasks,
    activities,
    workspaceMembers,
    canWriteWorkspace,
    createList,
    renameList,
    deleteList,
    reorderBoardLists,
    createTask,
    moveTask,
    updateBoard,
    deleteBoard,
  } = useDataStore();

  const board = boards.find((b) => b.id === boardId);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [addingList, setAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDeleteBoard, setConfirmDeleteBoard] = useState(false);

  // Settings draft state
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editBg, setEditBg] = useState('slate');
  const [editVisibility, setEditVisibility] = useState('workspace');

  // DnD active tracking
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [overColumnId, setOverColumnId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const boardLists = useMemo(
    () =>
      lists
        .filter((l) => l.boardId === boardId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [lists, boardId]
  );

  const boardTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.boardId === boardId && !t.isArchived)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [tasks, boardId]
  );

  const filteredTasks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return boardTasks.filter((t) => {
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (q && !t.title.toLowerCase().includes(q) && !(t.description || '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [boardTasks, searchQuery, priorityFilter]);

  const boardActivities = useMemo(
    () => activities.filter((a) => a.boardId === boardId).slice(0, 25),
    [activities, boardId]
  );

  if (!board) {
    return (
      <div className="p-6 max-w-2xl mx-auto mt-10">
        <EmptyState
          title="Board not found"
          description="This board may have been deleted or you no longer have workspace access."
          actionLabel="Back to Boards"
          onAction={() => navigate('/boards')}
        />
      </div>
    );
  }

  const canWrite = canWriteWorkspace(board.workspaceId);
  const members = workspaceMembers[board.workspaceId] || [];
  const bgTheme =
    BOARD_BACKGROUNDS.find((bg) => bg.id === board.background) || BOARD_BACKGROUNDS[0];

  const openBoardSettings = () => {
    setEditTitle(board.title);
    setEditDesc(board.description || '');
    setEditBg(board.background || 'slate');
    setEditVisibility(board.visibility || 'workspace');
    setSettingsOpen(true);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    await updateBoard(board.id, {
      title: editTitle.trim(),
      description: editDesc.trim(),
      background: editBg,
      visibility: editVisibility,
    });
    setSettingsOpen(false);
  };

  const handleCreateList = async (e) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    await createList(board.id, newListTitle.trim());
    setNewListTitle('');
    setAddingList(false);
  };

  // ==================== DND HANDLERS ====================
  const handleDragStart = (event) => {
    const { active } = event;
    const type = active.data.current?.type;
    if (type === 'list') {
      setActiveDragItem({ type: 'list', item: active.data.current.list });
    } else if (type === 'task') {
      setActiveDragItem({ type: 'task', item: active.data.current.task });
    }
  };

  const handleDragOver = (event) => {
    const { over } = event;
    if (!over) {
      setOverColumnId(null);
      return;
    }
    const overType = over.data.current?.type;
    if (overType === 'list') {
      setOverColumnId(over.id);
    } else if (overType === 'task') {
      setOverColumnId(over.data.current.task.listId);
    } else {
      setOverColumnId(null);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    setOverColumnId(null);

    if (!over || !canWrite) return;

    const activeType = active.data.current?.type;
    const overType = over.data.current?.type;

    if (activeType === 'list' && overType === 'list' && active.id !== over.id) {
      await reorderBoardLists(board.id, active.id, over.id);
      return;
    }

    if (activeType === 'task') {
      const activeTask = active.data.current.task;
      let targetListId = activeTask.listId;
      let targetIndex = 0;

      if (overType === 'list') {
        targetListId = over.id;
        const targetTasks = boardTasks.filter(
          (t) => t.listId === targetListId && t.id !== activeTask.id
        );
        targetIndex = targetTasks.length;
      } else if (overType === 'task') {
        const overTask = over.data.current.task;
        targetListId = overTask.listId;
        const targetTasks = boardTasks
          .filter((t) => t.listId === targetListId && t.id !== activeTask.id)
          .sort((a, b) => a.position - b.position);
        const overIdx = targetTasks.findIndex((t) => t.id === overTask.id);
        targetIndex = overIdx === -1 ? targetTasks.length : overIdx;
      }

      if (active.id === over.id && activeTask.listId === targetListId) return;
      await moveTask(activeTask.id, targetListId, targetIndex);
    }
  };

  return (
    <div className={`min-h-[calc(100vh-56px)] flex flex-col ${bgTheme.canvasClass}`}>
      {/* Board Toolbar */}
      <div className="px-4 lg:px-6 py-3.5 border-b border-[#E6E8F0] dark:border-[#262A3D] bg-white/80 dark:bg-[#151722]/85 backdrop-blur-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate(`/workspace/${board.workspaceId}`)}
            aria-label="Back to workspace"
            className="p-1.5 rounded-lg text-[#6B7085] hover:text-[#20212B] dark:text-[#9EA3B8] dark:hover:text-white hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold text-[#20212B] dark:text-[#F4F5FA] truncate">
              {board.title}
            </h1>
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] truncate">
              {boardTasks.length} tasks · {boardLists.length} lists · {board.visibility} visibility
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#9295A5] absolute left-3 top-2.5" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks..."
              aria-label="Filter board tasks"
              className="w-44 sm:w-52 pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            aria-label="Filter by priority"
            className="px-2.5 py-1.5 text-xs rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA]"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <button
            type="button"
            onClick={() => setShowActivityDrawer((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              showActivityDrawer
                ? 'border-[#635BFF] bg-[#635BFF]/10 text-[#635BFF]'
                : 'border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]'
            }`}
          >
            <ActivityIcon className="w-3.5 h-3.5" />
            <span>Activity</span>
          </button>

          {canWrite && (
            <button
              type="button"
              onClick={openBoardSettings}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Board Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Kanban Canvas + Optional Activity Drawer */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        <div className="flex-1 overflow-x-auto p-4 lg:p-6 kanban-scroll">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="flex items-start gap-4 min-h-full pb-4">
              <SortableContext
                items={boardLists.map((l) => l.id)}
                strategy={horizontalListSortingStrategy}
              >
                {boardLists.map((list) => {
                  const colTasks = filteredTasks
                    .filter((t) => t.listId === list.id)
                    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                  return (
                    <KanbanColumn
                      key={list.id}
                      list={list}
                      tasks={colTasks}
                      allLists={boardLists}
                      boardLabels={board.labels || []}
                      members={members}
                      canWrite={canWrite}
                      onAddTask={(listId, data) => createTask(board.id, listId, data)}
                      onRenameList={renameList}
                      onDeleteList={deleteList}
                      onOpenTask={setSelectedTaskId}
                      isOverColumn={overColumnId === list.id}
                    />
                  );
                })}
              </SortableContext>

              {/* Add Column Card */}
              {canWrite && (
                <div className="w-[280px] shrink-0">
                  {addingList ? (
                    <form
                      onSubmit={handleCreateList}
                      className="p-3.5 rounded-xl bg-white dark:bg-[#151722] border border-[#635BFF] space-y-2.5"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={newListTitle}
                        onChange={(e) => setNewListTitle(e.target.value)}
                        placeholder="Column title (e.g., QA Testing)"
                        aria-label="New column title"
                        className="w-full px-3 py-2 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAddingList(false);
                            setNewListTitle('');
                          }}
                          className="px-3 py-1.5 text-xs text-[#6B7085]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg"
                        >
                          Add List
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingList(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-[#C7CBE0] dark:border-[#2E334B] text-xs font-medium text-[#6B7085] dark:text-[#9EA3B8] hover:text-[#635BFF] hover:border-[#635BFF] hover:bg-white/60 dark:hover:bg-[#151722]/60 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add another list</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <DragOverlay dropAnimation={null}>
              {activeDragItem?.type === 'task' && (
                <div className="w-[284px]">
                  <KanbanCard
                    task={activeDragItem.item}
                    lists={boardLists}
                    boardLabels={board.labels || []}
                    members={members}
                    isOverlay
                  />
                </div>
              )}
              {activeDragItem?.type === 'list' && (
                <KanbanColumn
                  list={activeDragItem.item}
                  tasks={filteredTasks.filter((t) => t.listId === activeDragItem.item.id)}
                  allLists={boardLists}
                  boardLabels={board.labels || []}
                  members={members}
                  canWrite={false}
                  isOverlay
                />
              )}
            </DragOverlay>
          </DndContext>
        </div>

        {/* Board Activity Slide-over */}
        {showActivityDrawer && (
          <aside className="w-80 shrink-0 bg-white dark:bg-[#151722] border-l border-[#E6E8F0] dark:border-[#262A3D] flex flex-col">
            <div className="px-4 py-3.5 border-b border-[#E6E8F0] dark:border-[#262A3D] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                Board Activity
              </h2>
              <button
                type="button"
                onClick={() => setShowActivityDrawer(false)}
                aria-label="Close activity panel"
                className="p-1 text-[#9295A5] hover:text-[#20212B] dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {boardActivities.length === 0 ? (
                <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                  No activity logged on this board yet.
                </p>
              ) : (
                boardActivities.map((act) => {
                  const dt = toJsDate(act.createdAt);
                  return (
                    <div
                      key={act.id}
                      className="pb-3 border-b border-[#F0F1F6] dark:border-[#202436] last:border-0"
                    >
                      <p className="text-xs text-[#20212B] dark:text-[#F4F5FA] leading-relaxed">
                        <span className="font-semibold">{act.actorName}</span> {act.action}
                      </p>
                      {dt && (
                        <p className="text-[11px] text-[#9295A5] mt-1 font-mono tabular-nums">
                          {formatDistanceToNow(dt, { addSuffix: true })}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        taskId={selectedTaskId}
        open={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
      />

      {/* Board Settings Modal */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Board Settings"
        subtitle="Customize theme, visibility, or archive this board."
      >
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label
              htmlFor="edit-board-title"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Board Title
            </label>
            <input
              id="edit-board-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D]"
            />
          </div>

          <div>
            <label
              htmlFor="edit-board-desc"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Description
            </label>
            <textarea
              id="edit-board-desc"
              rows={2}
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] resize-none"
            />
          </div>

          <div>
            <span className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-2">
              Background Theme
            </span>
            <div className="flex flex-wrap gap-2">
              {BOARD_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setEditBg(bg.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    editBg === bg.id
                      ? 'border-[#635BFF] bg-[#635BFF]/10 text-[#635BFF] font-semibold'
                      : 'border-[#E6E8F0] dark:border-[#262A3D] text-[#6B7085]'
                  }`}
                >
                  {bg.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="edit-board-vis"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Visibility
            </label>
            <select
              id="edit-board-vis"
              value={editVisibility}
              onChange={(e) => setEditVisibility(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D]"
            >
              <option value="workspace">Workspace Members</option>
              <option value="private">Private</option>
              <option value="public">Public Read-Only</option>
            </select>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#E6E8F0] dark:border-[#262A3D]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  await updateBoard(board.id, { isArchived: !board.isArchived });
                  setSettingsOpen(false);
                  navigate('/boards');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#6B7085] hover:text-[#20212B]"
              >
                <Archive className="w-3.5 h-3.5" />
                {board.isArchived ? 'Unarchive' : 'Archive'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setConfirmDeleteBoard(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/50 text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg"
            >
              Save Settings
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteBoard}
        onClose={() => setConfirmDeleteBoard(false)}
        onConfirm={async () => {
          await deleteBoard(board.id);
          navigate('/boards');
        }}
        title={`Delete board "${board.title}"?`}
        description="This board, its lists, and tasks will be permanently deleted."
        confirmLabel="Delete Board"
      />
    </div>
  );
}
