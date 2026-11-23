import React, { useMemo, useState } from 'react';
import { CheckSquare, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDataStore } from '../../stores/useDataStore';
import { EmptyState, PriorityLabel } from '../../components/common/UIPrimitives';
import { TaskDetailModal } from '../../components/task/TaskDetailModal';
import { isTaskDone, isTaskOverdue } from '../../utils/kanban';
import type { TaskPriority } from '../../types';

type TaskScope = 'assigned' | 'all';
type StatusFilter = 'open' | 'overdue' | 'done' | 'all';
type PriorityFilter = 'all' | TaskPriority;

const SCOPE_OPTIONS: ReadonlyArray<{ id: TaskScope; label: string }> = [
  { id: 'assigned', label: 'Assigned to Me' },
  { id: 'all', label: 'All Tasks' },
];

export function MyTasksPage() {
  const { user } = useAuthStore();
  const { tasks, boards, lists } = useDataStore();

  const [scope, setScope] = useState<TaskScope>('assigned');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tasks
      .filter((t) => {
        if (t.isArchived) return false;
        if (scope === 'assigned' && user && !(t.assigneeIds || []).includes(user.uid)) {
          return false;
        }
        const done = isTaskDone(t, lists);
        if (statusFilter === 'open' && done) return false;
        if (statusFilter === 'done' && !done) return false;
        if (statusFilter === 'overdue' && !isTaskOverdue(t, lists)) return false;
        if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
        if (q && !t.title.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [tasks, lists, user, scope, statusFilter, priorityFilter, search]);

  return (
    <div className="p-5 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#20212B] dark:text-[#F4F5FA] tracking-tight">
          My Tasks
        </h1>
        <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1">
          Consolidated task queue across every board and workspace.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFF1F8] dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D]">
          {SCOPE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScope(opt.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                scope === opt.id
                  ? 'bg-white dark:bg-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] shadow-xs'
                  : 'text-[#6B7085] dark:text-[#9EA3B8]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#9295A5] absolute left-3 top-2.5" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks..."
              aria-label="Search my tasks"
              className="pl-8 pr-3 py-2 text-xs rounded-lg bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] w-48"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filter tasks by status"
            className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D]"
          >
            <option value="open">Open tasks</option>
            <option value="overdue">Overdue</option>
            <option value="done">Completed</option>
            <option value="all">All statuses</option>
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            aria-label="Filter tasks by priority"
            className="px-3 py-2 text-xs rounded-lg bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D]"
          >
            <option value="all">All priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks match your filters"
          description="Try broadening your status or priority filters, or open a board to add new tasks."
        />
      ) : (
        <div className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E6E8F0] dark:border-[#262A3D] text-xs font-semibold text-[#6B7085] dark:text-[#9EA3B8] bg-[#F7F8FC] dark:bg-[#11131D]">
                  <th className="py-3 px-5">Task</th>
                  <th className="py-3 px-4">Board</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-5 text-right">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E8F0] dark:divide-[#262A3D] text-sm">
                {filtered.map((task) => {
                  const board = boards.find((b) => b.id === task.boardId);
                  const list = lists.find((l) => l.id === task.listId);
                  const overdue = isTaskOverdue(task, lists);
                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] cursor-pointer transition-colors"
                    >
                      <td className="py-3.5 px-5 font-medium text-[#20212B] dark:text-[#F4F5FA] max-w-md truncate">
                        {task.title}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#6B7085] dark:text-[#9EA3B8] whitespace-nowrap">
                        {board?.title || 'Board'}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#20212B] dark:text-[#F4F5FA] whitespace-nowrap">
                        {list?.title || task.status}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <PriorityLabel priority={task.priority} />
                      </td>
                      <td className="py-3.5 px-5 text-right whitespace-nowrap">
                        {task.dueDate ? (
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-mono tabular-nums ${
                              overdue
                                ? 'text-[#EF4444] font-semibold'
                                : 'text-[#6B7085] dark:text-[#9EA3B8]'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            {format(new Date(`${task.dueDate.slice(0, 10)}T00:00:00`), 'MMM d, yyyy')}
                          </span>
                        ) : (
                          <span className="text-xs text-[#9295A5]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <TaskDetailModal
        taskId={selectedTaskId}
        open={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
