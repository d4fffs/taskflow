import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, CheckSquare, MessageSquare, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar } from '../common/UIPrimitives.jsx';
import { PRIORITIES } from '../../constants/templates.js';
import { computeChecklistProgress, isTaskOverdue } from '../../utils/kanban.js';

export function KanbanCard({
  task,
  lists = [],
  boardLabels = [],
  members = [],
  onOpenTask,
  isOverlay = false,
  disabled = false,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
    disabled: isOverlay || disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityMeta = PRIORITIES[task.priority] || PRIORITIES.medium;
  const overdue = isTaskOverdue(task, lists);
  const checklist = computeChecklistProgress(task.checklists || []);
  const attachedLabels = (task.labelIds || [])
    .map((id) => boardLabels.find((l) => l.id === id))
    .filter(Boolean);
  const assignees = (task.assigneeIds || [])
    .map((uid) => members.find((m) => m.userId === uid || m.id === uid))
    .filter(Boolean);

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      {...(isOverlay ? {} : attributes)}
      {...(isOverlay ? {} : listeners)}
      className={`group rounded-xl bg-white dark:bg-[#151722] border transition-[border-color,box-shadow,opacity] duration-150 ${
        isOverlay
          ? 'border-[#635BFF] shadow-2xl rotate-[1.5deg] cursor-grabbing'
          : isDragging
          ? 'opacity-40 border-dashed border-[#635BFF]'
          : 'border-[#E6E8F0] dark:border-[#262A3D] hover:border-[#C7CBE0] dark:hover:border-[#3A405C] shadow-[0_1px_2px_rgba(32,33,43,0.03)] cursor-grab active:cursor-grabbing'
      }`}
    >
      <button
        type="button"
        onClick={() => onOpenTask && onOpenTask(task.id)}
        className="w-full text-left p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#635BFF] rounded-xl"
      >
        {/* Subtle Label Color Bars + Names */}
        {attachedLabels.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mb-2 text-[11px] font-medium text-[#6B7085] dark:text-[#9EA3B8]">
            {attachedLabels.slice(0, 3).map((lbl) => (
              <span key={lbl.id} className="inline-flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: lbl.color }}
                  aria-hidden="true"
                />
                <span>{lbl.name}</span>
              </span>
            ))}
          </div>
        )}

        {/* Primary Title */}
        <h4 className="text-sm font-medium text-[#20212B] dark:text-[#F4F5FA] leading-snug group-hover:text-[#635BFF] transition-colors">
          {task.title}
        </h4>

        {/* Unboxed Metadata Footer */}
        <div className="mt-3 pt-2.5 border-t border-[#F0F1F6] dark:border-[#202436] flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#6B7085] dark:text-[#9EA3B8] font-mono tabular-nums">
            <span className="inline-flex items-center gap-1 font-sans font-medium">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: priorityMeta.dot }}
              />
              {priorityMeta.label}
            </span>

            {task.dueDate && (
              <span
                className={`inline-flex items-center gap-1 ${
                  overdue ? 'text-[#EF4444] font-semibold' : ''
                }`}
              >
                <Calendar className="w-3 h-3" />
                {format(new Date(`${task.dueDate.slice(0, 10)}T00:00:00`), 'MMM d')}
              </span>
            )}

            {checklist.total > 0 && (
              <span
                className={`inline-flex items-center gap-1 ${
                  checklist.completed === checklist.total ? 'text-[#22C55E]' : ''
                }`}
              >
                <CheckSquare className="w-3 h-3" />
                {checklist.completed}/{checklist.total}
              </span>
            )}

            {(task.commentCount || 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {task.commentCount}
              </span>
            )}

            {(task.attachments?.length || 0) > 0 && (
              <span className="inline-flex items-center gap-1">
                <Paperclip className="w-3 h-3" />
                {task.attachments.length}
              </span>
            )}
          </div>

          {assignees.length > 0 && (
            <div className="flex items-center -space-x-1.5 shrink-0">
              {assignees.slice(0, 3).map((m) => (
                <Avatar
                  key={m.userId || m.id}
                  src={m.avatarUrl}
                  name={m.fullName}
                  size="xs"
                  className="ring-2 ring-white dark:ring-[#151722]"
                />
              ))}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
