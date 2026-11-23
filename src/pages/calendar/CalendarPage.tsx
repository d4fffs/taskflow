import React, { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useDataStore } from '../../stores/useDataStore';
import { PRIORITIES } from '../../constants/templates';
import { PriorityLabel } from '../../components/common/UIPrimitives';
import { TaskDetailModal } from '../../components/task/TaskDetailModal';
import type { Task } from '../../types';

type CalendarView = 'month' | 'week' | 'day';

const CALENDAR_VIEWS: ReadonlyArray<{ id: CalendarView; label: string }> = [
  { id: 'month', label: 'Month' },
  { id: 'week', label: 'Week' },
  { id: 'day', label: 'Day' },
];

export function CalendarPage() {
  const { tasks, boards } = useDataStore();
  const [view, setView] = useState<CalendarView>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const scheduledTasks = useMemo(
    () => tasks.filter((t) => !t.isArchived && Boolean(t.dueDate)),
    [tasks]
  );

  const tasksByDateKey = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of scheduledTasks) {
      if (!t.dueDate) continue;
      const key = t.dueDate.slice(0, 10);
      const existing = map.get(key);
      if (existing) {
        existing.push(t);
      } else {
        map.set(key, [t]);
      }
    }
    return map;
  }, [scheduledTasks]);

  const navigatePrev = () => {
    if (view === 'month') setCurrentDate((d) => subMonths(d, 1));
    else if (view === 'week') setCurrentDate((d) => subWeeks(d, 1));
    else setCurrentDate((d) => subDays(d, 1));
  };

  const navigateNext = () => {
    if (view === 'month') setCurrentDate((d) => addMonths(d, 1));
    else if (view === 'week') setCurrentDate((d) => addWeeks(d, 1));
    else setCurrentDate((d) => addDays(d, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(now);
  };

  const monthDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentDate]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [currentDate]);

  const selectedDateKey = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayTasks = tasksByDateKey.get(selectedDateKey) || [];
  const currentDayKey = format(currentDate, 'yyyy-MM-dd');
  const dailyViewTasks = tasksByDateKey.get(currentDayKey) || [];

  const headerTitle =
    view === 'month'
      ? format(currentDate, 'MMMM yyyy')
      : view === 'week'
      ? `${format(weekDays[0], 'MMM d')} – ${format(weekDays[6], 'MMM d, yyyy')}`
      : format(currentDate, 'EEEE, MMMM d, yyyy');

  return (
    <div className="p-5 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#20212B] dark:text-[#F4F5FA] tracking-tight">
            Calendar
          </h1>
          <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1">
            Visualize upcoming deadlines across every board. Click any task to edit details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFF1F8] dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D]">
            {CALENDAR_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setView(v.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  view === v.id
                    ? 'bg-white dark:bg-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] shadow-xs'
                    : 'text-[#6B7085] dark:text-[#9EA3B8]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={navigatePrev}
              aria-label="Previous period"
              className="p-2 rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] bg-white dark:bg-[#151722] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] bg-white dark:bg-[#151722] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]"
            >
              Today
            </button>
            <button
              type="button"
              onClick={navigateNext}
              aria-label="Next period"
              className="p-2 rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] bg-white dark:bg-[#151722] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Period Title */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-[#20212B] dark:text-[#F4F5FA]">
          {headerTitle}
        </h2>
        <span className="text-xs font-mono tabular-nums text-[#6B7085] dark:text-[#9EA3B8]">
          {scheduledTasks.length} scheduled tasks
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Calendar Main Area */}
        <div className="lg:col-span-9 bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl overflow-hidden">
          {view === 'month' && (
            <div>
              <div className="grid grid-cols-7 border-b border-[#E6E8F0] dark:border-[#262A3D] bg-[#F7F8FC] dark:bg-[#11131D]">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div
                    key={d}
                    className="py-2.5 px-2 text-center text-xs font-semibold text-[#6B7085] dark:text-[#9EA3B8]"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 divide-x divide-y divide-[#E6E8F0] dark:divide-[#262A3D]">
                {monthDays.map((day) => {
                  const key = format(day, 'yyyy-MM-dd');
                  const dayTasks = tasksByDateKey.get(key) || [];
                  const isToday = isSameDay(day, new Date());
                  const isSelected = isSameDay(day, selectedDate);
                  const inMonth = isSameMonth(day, currentDate);
                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedDate(day)}
                      className={`min-h-[104px] p-2 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#635BFF]/[0.06] dark:bg-[#635BFF]/15'
                          : inMonth
                          ? 'bg-white dark:bg-[#151722] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]/60'
                          : 'bg-[#F7F8FC]/70 dark:bg-[#10121B] text-[#9295A5]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-xs font-mono tabular-nums inline-flex items-center justify-center w-6 h-6 rounded-full ${
                            isToday
                              ? 'bg-[#635BFF] text-white font-semibold'
                              : inMonth
                              ? 'text-[#20212B] dark:text-[#F4F5FA]'
                              : 'text-[#9295A5]'
                          }`}
                        >
                          {format(day, 'd')}
                        </span>
                        {dayTasks.length > 0 && (
                          <span className="text-[10px] font-mono tabular-nums text-[#6B7085]">
                            {dayTasks.length}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayTasks.slice(0, 2).map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDate(day);
                              setSelectedTaskId(t.id);
                            }}
                            className="w-full text-left px-1.5 py-1 rounded text-[11px] font-medium bg-[#F7F8FC] dark:bg-[#1C1F2E] border border-[#E6E8F0] dark:border-[#2A2F45] hover:border-[#635BFF] truncate flex items-center gap-1.5 text-[#20212B] dark:text-[#F4F5FA]"
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{
                                backgroundColor: PRIORITIES[t.priority]?.dot || '#635BFF',
                              }}
                            />
                            <span className="truncate">{t.title}</span>
                          </button>
                        ))}
                        {dayTasks.length > 2 && (
                          <p className="text-[10px] text-[#635BFF] font-medium pl-1">
                            +{dayTasks.length - 2} more
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {view === 'week' && (
            <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-[#E6E8F0] dark:divide-[#262A3D] min-h-[420px]">
              {weekDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd');
                const dayTasks = tasksByDateKey.get(key) || [];
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={key}
                    onClick={() => setSelectedDate(day)}
                    className={`p-3 space-y-2.5 cursor-pointer ${
                      isSameDay(day, selectedDate) ? 'bg-[#635BFF]/[0.04]' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between border-b border-[#F0F1F6] dark:border-[#202436] pb-2">
                      <span className="text-xs font-medium text-[#6B7085] dark:text-[#9EA3B8]">
                        {format(day, 'EEE')}
                      </span>
                      <span
                        className={`text-xs font-mono tabular-nums px-2 py-0.5 rounded-full ${
                          isToday
                            ? 'bg-[#635BFF] text-white font-semibold'
                            : 'text-[#20212B] dark:text-[#F4F5FA]'
                        }`}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {dayTasks.length === 0 ? (
                        <p className="text-[11px] text-[#9295A5]">No deadlines</p>
                      ) : (
                        dayTasks.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskId(t.id);
                            }}
                            className="w-full text-left p-2 rounded-lg bg-[#F7F8FC] dark:bg-[#1C1F2E] border border-[#E6E8F0] dark:border-[#262A3D] hover:border-[#635BFF] text-xs font-medium text-[#20212B] dark:text-[#F4F5FA]"
                          >
                            <p className="line-clamp-2">{t.title}</p>
                            <div className="mt-1">
                              <PriorityLabel priority={t.priority} />
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {view === 'day' && (
            <div className="p-6 min-h-[380px] space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                <CalendarIcon className="w-4 h-4 text-[#635BFF]" />
                <span>Tasks due on {format(currentDate, 'MMMM d, yyyy')}</span>
              </div>
              {dailyViewTasks.length === 0 ? (
                <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] py-12 text-center">
                  No tasks scheduled for this date.
                </p>
              ) : (
                <div className="divide-y divide-[#E6E8F0] dark:divide-[#262A3D] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl overflow-hidden">
                  {dailyViewTasks.map((t) => {
                    const board = boards.find((b) => b.id === t.boardId);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTaskId(t.id)}
                        className="w-full text-left px-4 py-3.5 hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] flex items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#20212B] dark:text-[#F4F5FA] truncate">
                            {t.title}
                          </p>
                          <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-0.5">
                            {board?.title || 'Board'} · {t.status}
                          </p>
                        </div>
                        <PriorityLabel priority={t.priority} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected Date Agenda Panel */}
        <aside className="lg:col-span-3 bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-5 flex flex-col">
          <h3 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
            {format(selectedDate, 'EEEE, MMM d')}
          </h3>
          <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-0.5 mb-4 font-mono tabular-nums">
            {selectedDayTasks.length} {selectedDayTasks.length === 1 ? 'task' : 'tasks'} due
          </p>

          <div className="space-y-2.5 flex-1">
            {selectedDayTasks.length === 0 ? (
              <p className="text-xs text-[#9295A5] py-8 text-center">
                Select another highlighted date or add due dates to tasks on your boards.
              </p>
            ) : (
              selectedDayTasks.map((t) => {
                const board = boards.find((b) => b.id === t.boardId);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTaskId(t.id)}
                    className="w-full text-left p-3 rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] hover:border-[#635BFF] transition-colors"
                  >
                    <p className="text-xs font-semibold text-[#20212B] dark:text-[#F4F5FA] leading-snug">
                      {t.title}
                    </p>
                    <p className="text-[11px] text-[#6B7085] dark:text-[#9EA3B8] mt-1">
                      {board?.title || 'Board'} · {t.status}
                    </p>
                    <div className="mt-2">
                      <PriorityLabel priority={t.priority} />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>

      <TaskDetailModal
        taskId={selectedTaskId}
        open={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
}
