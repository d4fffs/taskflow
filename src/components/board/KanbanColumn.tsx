import React, { useState, type FormEvent } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2, Check, X } from 'lucide-react';
import { KanbanCard } from './KanbanCard';
import { ConfirmDialog } from '../common/UIPrimitives';
import type { BoardLabel, KanbanList, Task, TaskPriority, WorkspaceMember } from '../../types';

interface KanbanColumnProps {
  list: KanbanList;
  tasks: Task[];
  allLists: KanbanList[];
  boardLabels: BoardLabel[];
  members: WorkspaceMember[];
  canWrite: boolean;
  onAddTask: (listId: string, data: { title: string; priority: TaskPriority }) => Promise<unknown>;
  onRenameList: (listId: string, title: string) => void | Promise<void>;
  onDeleteList: (listId: string) => void | Promise<void>;
  onOpenTask: (taskId: string) => void;
  isOverlay?: boolean;
  isOverColumn?: boolean;
}

export function KanbanColumn({
  list,
  tasks,
  allLists,
  boardLabels,
  members,
  canWrite,
  onAddTask,
  onRenameList,
  onDeleteList,
  onOpenTask,
  isOverlay = false,
  isOverColumn = false,
}: KanbanColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: list.id,
    data: { type: 'list', list },
    disabled: isOverlay || !canWrite,
  });

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(list.title);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleRenameSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== list.title) {
      void onRenameList(list.id, trimmed);
    } else {
      setTitleDraft(list.title);
    }
    setEditingTitle(false);
  };

  const handleAddTaskSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    await onAddTask(list.id, { title: trimmed, priority: newTaskPriority });
    setNewTaskTitle('');
    setNewTaskPriority('medium');
    setAddingTask(false);
  };

  return (
    <>
      <section
        ref={isOverlay ? undefined : setNodeRef}
        style={isOverlay ? undefined : style}
        aria-label={`${list.title} column`}
        data-testid={`kanban-column-${list.id}`}
        className={`w-[304px] shrink-0 flex flex-col max-h-[calc(100vh-196px)] rounded-xl border transition-colors ${
          isOverlay
            ? 'bg-[#F0F1F8] dark:bg-[#181B29] border-[#635BFF] shadow-2xl'
            : isDragging
            ? 'opacity-45 bg-[#F0F1F8] dark:bg-[#181B29] border-dashed border-[#635BFF]'
            : isOverColumn
            ? 'bg-[#635BFF]/[0.05] dark:bg-[#635BFF]/10 border-[#635BFF]'
            : 'bg-[#EFF1F8]/75 dark:bg-[#131520] border-[#E6E8F0] dark:border-[#262A3D]'
        }`}
      >
        {/* Column Header */}
        <div className="px-3.5 py-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            {canWrite && (
              <button
                type="button"
                {...(isOverlay ? {} : attributes)}
                {...(isOverlay ? {} : listeners)}
                aria-label={`Reorder list ${list.title}`}
                className="p-1 -ml-1 text-[#9295A5] hover:text-[#20212B] dark:hover:text-white cursor-grab active:cursor-grabbing shrink-0"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}

            {editingTitle && canWrite ? (
              <form
                onSubmit={handleRenameSubmit}
                className="flex items-center gap-1 flex-1 min-w-0"
              >
                <input
                  type="text"
                  autoFocus
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setTitleDraft(list.title);
                      setEditingTitle(false);
                    }
                  }}
                  aria-label="Edit list title"
                  className="w-full px-2 py-1 text-xs font-semibold rounded bg-white dark:bg-[#0D0E14] border border-[#635BFF] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Save list title"
                  className="p-1 text-[#22C55E]"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled={!canWrite}
                onClick={() => {
                  setTitleDraft(list.title);
                  setEditingTitle(true);
                }}
                className="text-left text-xs font-semibold tracking-wide text-[#20212B] dark:text-[#F4F5FA] truncate hover:text-[#635BFF] transition-colors"
              >
                {list.title}
              </button>
            )}

            <span className="text-xs font-mono tabular-nums text-[#6B7085] dark:text-[#9EA3B8] shrink-0">
              {tasks.length}
            </span>
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() => setConfirmDeleteOpen(true)}
              aria-label={`Delete list ${list.title}`}
              className="p-1 rounded-md text-[#9295A5] hover:text-[#EF4444] hover:bg-white/80 dark:hover:bg-[#1C1F2E] transition-colors shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Task Cards Scroll Area */}
        <div className="flex-1 overflow-y-auto px-2.5 pb-2.5 space-y-2.5 kanban-scroll min-h-[64px]">
          <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                lists={allLists}
                boardLabels={boardLabels}
                members={members}
                onOpenTask={onOpenTask}
                disabled={!canWrite}
              />
            ))}
          </SortableContext>

          {tasks.length === 0 && !addingTask && (
            <div className="py-6 px-3 text-center text-xs text-[#9295A5] border border-dashed border-[#D8DCEB] dark:border-[#262A3D] rounded-lg">
              Drop a task here
            </div>
          )}
        </div>

        {/* Add Task Footer */}
        {canWrite && (
          <div className="p-2.5 pt-1 shrink-0">
            {addingTask ? (
              <form
                onSubmit={handleAddTaskSubmit}
                className="p-3 rounded-xl bg-white dark:bg-[#151722] border border-[#635BFF] space-y-2.5"
              >
                <input
                  type="text"
                  autoFocus
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setAddingTask(false);
                      setNewTaskTitle('');
                    }
                  }}
                  placeholder="Enter task title..."
                  aria-label={`New task title in ${list.title}`}
                  className="w-full text-sm text-[#20212B] dark:text-[#F4F5FA] bg-transparent focus:outline-none"
                />
                <div className="flex items-center justify-between gap-2">
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as TaskPriority)}
                    aria-label="New task priority"
                    className="text-xs px-2 py-1 rounded bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA]"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAddingTask(false);
                        setNewTaskTitle('');
                      }}
                      aria-label="Cancel adding task"
                      className="p-1.5 rounded-md text-[#6B7085] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-md whitespace-nowrap"
                    >
                      Add Task
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setAddingTask(true)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#6B7085] dark:text-[#9EA3B8] hover:text-[#20212B] dark:hover:text-[#F4F5FA] hover:bg-white/80 dark:hover:bg-[#1C1F2E] rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add task to {list.title}</span>
              </button>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => onDeleteList(list.id)}
        title={`Delete "${list.title}"?`}
        description="This column and all tasks currently inside it will be permanently removed."
        confirmLabel="Delete Column"
      />
    </>
  );
}
