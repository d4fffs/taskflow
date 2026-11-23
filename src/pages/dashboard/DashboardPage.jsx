import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Plus, Calendar, ArrowUpRight, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useDataStore } from '../../stores/useDataStore.js';
import {
  computeDashboardAnalytics,
  isTaskDone,
  isTaskOverdue,
  toJsDate,
} from '../../utils/kanban.js';
import { PriorityLabel, SkeletonGrid } from '../../components/common/UIPrimitives.jsx';
import { WorkspaceModal } from '../../components/workspace/WorkspaceModal.jsx';
import { CreateBoardModal } from '../../components/board/CreateBoardModal.jsx';
import { TaskDetailModal } from '../../components/task/TaskDetailModal.jsx';

const PRIORITY_COLORS = {
  urgent: '#EF4444',
  high: '#F59E0B',
  medium: '#635BFF',
  low: '#9295A5',
};

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, profile, theme } = useAuthStore();
  const { workspaces, boards, lists, tasks, activities, loading } = useDataStore();

  const [wsModalOpen, setWsModalOpen] = useState(false);
  const [boardModalOpen, setBoardModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const analytics = useMemo(
    () => computeDashboardAnalytics({ workspaces, boards, lists, tasks }),
    [workspaces, boards, lists, tasks]
  );

  const myAssignedTasks = useMemo(() => {
    if (!user) return [];
    return tasks
      .filter(
        (t) =>
          !t.isArchived &&
          !isTaskDone(t, lists) &&
          (t.assigneeIds || []).includes(user.uid)
      )
      .sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      })
      .slice(0, 6);
  }, [tasks, lists, user]);

  const completionChartData = [
    { name: 'Completed', value: analytics.summary.completedTasks, color: '#22C55E' },
    {
      name: 'Remaining',
      value: Math.max(0, analytics.summary.totalTasks - analytics.summary.completedTasks),
      color: theme === 'dark' ? '#262A3D' : '#E6E8F0',
    },
  ];

  const axisColor = theme === 'dark' ? '#9EA3B8' : '#6B7085';
  const gridColor = theme === 'dark' ? '#222638' : '#ECEEF5';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? '#151722' : '#FFFFFF',
    border: `1px solid ${theme === 'dark' ? '#262A3D' : '#E6E8F0'}`,
    borderRadius: '10px',
    fontSize: '12px',
    color: theme === 'dark' ? '#F4F5FA' : '#20212B',
  };

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <SkeletonGrid count={6} />
      </div>
    );
  }

  const kpis = [
    { label: 'Total Workspaces', value: analytics.summary.totalWorkspaces, tone: 'text-[#20212B] dark:text-[#F4F5FA]' },
    { label: 'Active Boards', value: analytics.summary.totalBoards, tone: 'text-[#20212B] dark:text-[#F4F5FA]' },
    { label: 'Total Tasks', value: analytics.summary.totalTasks, tone: 'text-[#20212B] dark:text-[#F4F5FA]' },
    { label: 'Completed Tasks', value: analytics.summary.completedTasks, tone: 'text-[#22C55E]' },
    { label: 'In Progress', value: analytics.summary.inProgressTasks, tone: 'text-[#635BFF]' },
    {
      label: 'Overdue Tasks',
      value: analytics.summary.overdueTasks,
      tone: analytics.summary.overdueTasks > 0 ? 'text-[#EF4444]' : 'text-[#20212B] dark:text-[#F4F5FA]',
    },
  ];

  return (
    <div className="p-5 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#20212B] dark:text-[#F4F5FA] tracking-tight">
            Welcome back, {(profile?.fullName || user?.displayName || 'there').split(' ')[0]}
          </h1>
          <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1">
            Live workspace metrics across {analytics.summary.totalBoards} boards and{' '}
            {analytics.summary.totalTasks} tasks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/calendar')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] bg-white dark:bg-[#151722] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors whitespace-nowrap"
          >
            <Calendar className="w-3.5 h-3.5 text-[#6B7085]" />
            <span>Schedule</span>
          </button>
          <button
            type="button"
            onClick={() => setWsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] bg-white dark:bg-[#151722] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-[#6B7085]" />
            <span>New Workspace</span>
          </button>
          <button
            type="button"
            onClick={() => setBoardModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg text-white bg-[#635BFF] hover:bg-[#5249E8] transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Board</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Strip */}
      <section aria-label="Summary metrics" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {kpis.map((item) => (
          <div
            key={item.label}
            className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-4"
          >
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] truncate">{item.label}</p>
            <p className={`text-2xl font-display font-bold font-mono tabular-nums mt-2 ${item.tone}`}>
              {item.value}
            </p>
          </div>
        ))}
      </section>

      {/* Analytics Charts Grid (2x2) */}
      <section aria-label="Task analytics" className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Completion Rate */}
        <div className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                Task Completion Rate
              </h2>
              <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                Completed tasks versus active workload
              </p>
            </div>
            <span className="text-lg font-mono tabular-nums font-bold text-[#22C55E]">
              {analytics.summary.completionRate}%
            </span>
          </div>
          <div className="h-56 relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={completionChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={86}
                  strokeWidth={0}
                >
                  {completionChartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-display font-bold font-mono tabular-nums text-[#20212B] dark:text-[#F4F5FA]">
                {analytics.summary.completedTasks}/{analytics.summary.totalTasks}
              </span>
              <span className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">Done</span>
            </div>
          </div>
        </div>

        {/* 2. Weekly Task Trends */}
        <div className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
              Weekly Task Trends
            </h2>
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
              Tasks created versus completed over the past 7 days
            </p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.weeklyTrends} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="day" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="#635BFF"
                  fill="#635BFF"
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#22C55E"
                  fill="#22C55E"
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. Tasks by Status */}
        <div className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
              Tasks by Status
            </h2>
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
              Distribution across Kanban workflow columns
            </p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.tasksByStatus} margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Tasks" fill="#635BFF" radius={[6, 6, 0, 0]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. Tasks by Priority */}
        <div className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
              Tasks by Priority
            </h2>
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
              Breakdown from urgent blockers to low-priority backlog
            </p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={analytics.tasksByPriority}
                layout="vertical"
                margin={{ top: 6, right: 16, left: 6, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fill: axisColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: axisColor, fontSize: 12 }} axisLine={false} tickLine={false} width={68} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Tasks" radius={[0, 6, 6, 0]} maxBarSize={24}>
                  {analytics.tasksByPriority.map((entry) => (
                    <Cell key={entry.key} fill={PRIORITY_COLORS[entry.key] || '#635BFF'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Operational Lists: Assigned Tasks, Upcoming Deadlines & Recent Activity */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* My Assigned Tasks & Deadlines */}
        <div className="lg:col-span-7 bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E8F0] dark:border-[#262A3D] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                My Assigned Tasks & Deadlines
              </h2>
              <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                Click any task to inspect or update progress
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/my-tasks')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#635BFF] hover:underline whitespace-nowrap"
            >
              View all
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-[#E6E8F0] dark:divide-[#262A3D]">
            {myAssignedTasks.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#6B7085] dark:text-[#9EA3B8]">
                No open tasks assigned to you right now.
              </p>
            ) : (
              myAssignedTasks.map((task) => {
                const board = boards.find((b) => b.id === task.boardId);
                const overdue = isTaskOverdue(task, lists);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => setSelectedTaskId(task.id)}
                    className="w-full text-left px-5 py-3.5 hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-[#20212B] dark:text-[#F4F5FA] truncate">
                        {task.title}
                      </p>
                      <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-0.5 truncate">
                        {board?.title || 'Board'} · {task.status}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <PriorityLabel priority={task.priority} />
                      {task.dueDate && (
                        <span
                          className={`text-xs font-mono tabular-nums ${
                            overdue
                              ? 'text-[#EF4444] font-semibold'
                              : 'text-[#6B7085] dark:text-[#9EA3B8]'
                          }`}
                        >
                          {format(new Date(`${task.dueDate.slice(0, 10)}T00:00:00`), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="lg:col-span-5 bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[#E6E8F0] dark:border-[#262A3D]">
            <h2 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
              Recent Activity
            </h2>
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
              Latest updates across your workspaces
            </p>
          </div>

          <div className="divide-y divide-[#E6E8F0] dark:divide-[#262A3D] flex-1">
            {activities.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-[#6B7085] dark:text-[#9EA3B8]">
                Activity will appear here as your team updates boards.
              </p>
            ) : (
              activities.slice(0, 7).map((act) => {
                const dt = toJsDate(act.createdAt);
                return (
                  <div key={act.id} className="px-5 py-3.5">
                    <p className="text-xs text-[#20212B] dark:text-[#F4F5FA] leading-relaxed">
                      <span className="font-semibold">{act.actorName}</span> {act.action}
                    </p>
                    {dt && (
                      <p className="text-[11px] text-[#9295A5] mt-1 inline-flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="w-3 h-3" />
                        {formatDistanceToNow(dt, { addSuffix: true })}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <WorkspaceModal
        open={wsModalOpen}
        onClose={() => setWsModalOpen(false)}
        onSaved={(ws) => ws?.id && navigate(`/workspace/${ws.id}`)}
      />
      <CreateBoardModal
        open={boardModalOpen}
        onClose={() => setBoardModalOpen(false)}
        onCreated={(b) => b?.id && navigate(`/board/${b.id}`)}
      />
      <TaskDetailModal
        taskId={selectedTaskId}
        open={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
