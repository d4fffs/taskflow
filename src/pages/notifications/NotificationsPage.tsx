import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useDataStore } from '../../stores/useDataStore';
import { EmptyState } from '../../components/common/UIPrimitives';
import { toJsDate } from '../../utils/kanban';

type NotificationFilter = 'all' | 'unread';

export function NotificationsPage() {
  const navigate = useNavigate();
  const { notifications, markNotificationRead, markAllNotificationsRead } = useDataStore();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const visible = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.isRead);
    return notifications;
  }, [notifications, filter]);

  return (
    <div className="p-5 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#20212B] dark:text-[#F4F5FA] tracking-tight">
            Notifications
          </h1>
          <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1">
            Mentions, task assignments, approaching deadlines, and workspace invitations.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] bg-white dark:bg-[#151722] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] whitespace-nowrap self-start sm:self-auto"
          >
            <CheckCheck className="w-3.5 h-3.5 text-[#635BFF]" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-[#EFF1F8] dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] w-fit">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filter === 'all'
              ? 'bg-white dark:bg-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] shadow-xs'
              : 'text-[#6B7085] dark:text-[#9EA3B8]'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            filter === 'unread'
              ? 'bg-white dark:bg-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] shadow-xs'
              : 'text-[#6B7085] dark:text-[#9EA3B8]'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? 'No unread notifications' : 'Inbox is clear'}
          description="Real-time alerts for task assignments, comments, and workspace invites will appear here."
        />
      ) : (
        <div className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl overflow-hidden divide-y divide-[#E6E8F0] dark:divide-[#262A3D]">
          {visible.map((n) => {
            const dt = toJsDate(n.createdAt);
            return (
              <div
                key={n.id}
                className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                  !n.isRead ? 'bg-[#635BFF]/[0.035]' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    markNotificationRead(n.id);
                    if (n.link) navigate(n.link);
                  }}
                  className="text-left flex-1 min-w-0"
                >
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                      {n.title}
                    </h2>
                    {!n.isRead && (
                      <span className="text-[11px] font-semibold text-[#635BFF]">Unread</span>
                    )}
                  </div>
                  <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1 leading-relaxed">
                    {n.message}
                  </p>
                  <p className="text-xs text-[#9295A5] mt-1.5 font-mono tabular-nums">
                    {n.type.replace('_', ' ')}
                    {dt ? ` · ${formatDistanceToNow(dt, { addSuffix: true })}` : ''}
                  </p>
                </button>

                {!n.isRead && (
                  <button
                    type="button"
                    onClick={() => markNotificationRead(n.id)}
                    aria-label={`Mark "${n.title}" as read`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-[#635BFF] hover:bg-[#635BFF]/10 rounded-lg shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark read</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
