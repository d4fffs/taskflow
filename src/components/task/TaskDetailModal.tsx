import React, { useEffect, useState, type FormEvent } from 'react';
import {
  Calendar,
  CheckSquare,
  Copy,
  Archive,
  Trash2,
  Paperclip,
  MessageSquare,
  Plus,
  Send,
  Tag,
  Users,
  Clock,
  X,
  ExternalLink,
  Link2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Modal, Avatar, ConfirmDialog } from '../common/UIPrimitives';
import { PRIORITIES } from '../../constants/templates';
import { useAuthStore } from '../../stores/useAuthStore';
import { useDataStore } from '../../stores/useDataStore';
import { subscribeTaskComments } from '../../services/task/taskService';
import {
  computeChecklistProgress,
  generateId,
  toJsDate,
  validateTaskInput,
} from '../../utils/kanban';
import type { Comment, TaskPriority } from '../../types';

function isSafeExternalUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

interface TaskDetailModalProps {
  taskId: string | null;
  open: boolean;
  onClose: () => void;
}

export function TaskDetailModal({ taskId, open, onClose }: TaskDetailModalProps) {
  const { user, isGuestMode } = useAuthStore();
  const {
    tasks,
    boards,
    lists,
    workspaceMembers,
    comments: storeComments,
    activities,
    canWriteWorkspace,
    updateTask,
    deleteTask,
    duplicateTask,
    addComment,
    removeComment,
    updateBoard,
  } = useDataStore();

  const task = tasks.find((t) => t.id === taskId) || null;
  const board = task ? boards.find((b) => b.id === task.boardId) || null : null;
  const boardLists = task
    ? lists.filter((l) => l.boardId === task.boardId).sort((a, b) => a.position - b.position)
    : [];
  const members = task ? workspaceMembers[task.workspaceId] || [] : [];
  const canWrite = task ? canWriteWorkspace(task.workspaceId) : false;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [titleError, setTitleError] = useState('');
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [showAddChecklist, setShowAddChecklist] = useState(false);
  const [itemInputs, setItemInputs] = useState<Record<string, string>>({});
  const [commentText, setCommentText] = useState('');
  const [liveComments, setLiveComments] = useState<Comment[]>([]);
  const [showAttachmentForm, setShowAttachmentForm] = useState(false);
  const [attName, setAttName] = useState('');
  const [attUrl, setAttUrl] = useState('');
  const [attError, setAttError] = useState('');
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#635BFF');
  const [showLabelForm, setShowLabelForm] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title || '');
      setDescription(task.description || '');
      setTitleError('');
    }
  }, [task?.id, task?.title, task?.description]);

  useEffect(() => {
    if (!open || !task || isGuestMode || !user) return undefined;
    const unsub = subscribeTaskComments(task.id, user.uid, (items) => {
      setLiveComments(items);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [open, task?.id, isGuestMode, user?.uid]);

  if (!open || !task) return null;

  const taskComments = isGuestMode
    ? storeComments.filter((c) => c.taskId === task.id)
    : liveComments;
  const taskActivities = activities.filter((a) => a.taskId === task.id).slice(0, 12);
  const checklists = Array.isArray(task.checklists) ? task.checklists : [];
  const attachments = Array.isArray(task.attachments) ? task.attachments : [];
  const boardLabels = Array.isArray(board?.labels) ? board.labels : [];
  const checklistProg = computeChecklistProgress(checklists);

  const handleSaveBasics = () => {
    if (!canWrite) return;
    const check = validateTaskInput({ title, description, priority: task.priority });
    if (!check.valid) {
      setTitleError(check.errors.title || check.errors.description || 'Invalid input');
      return;
    }
    setTitleError('');
    if (title.trim() !== task.title || description.trim() !== (task.description || '')) {
      void updateTask(task.id, { title: title.trim(), description: description.trim() });
    }
  };

  const toggleAssignee = (uid: string) => {
    if (!canWrite) return;
    const current = task.assigneeIds || [];
    const next = current.includes(uid)
      ? current.filter((id) => id !== uid)
      : [...current, uid];
    void updateTask(task.id, { assigneeIds: next });
  };

  const toggleLabel = (labelId: string) => {
    if (!canWrite) return;
    const current = task.labelIds || [];
    const next = current.includes(labelId)
      ? current.filter((id) => id !== labelId)
      : [...current, labelId];
    void updateTask(task.id, { labelIds: next });
  };

  const handleCreateLabel = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canWrite || !board || !newLabelName.trim()) return;
    const label = {
      id: generateId('lbl'),
      name: newLabelName.trim().slice(0, 32),
      color: newLabelColor,
    };
    const nextLabels = [...boardLabels, label];
    void updateBoard(board.id, { labels: nextLabels });
    void updateTask(task.id, { labelIds: [...(task.labelIds || []), label.id] });
    setNewLabelName('');
    setShowLabelForm(false);
  };

  const handleAddChecklist = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canWrite || !newChecklistTitle.trim()) return;
    const next = [
      ...checklists,
      { id: generateId('cl'), title: newChecklistTitle.trim().slice(0, 100), items: [] },
    ];
    void updateTask(task.id, { checklists: next });
    setNewChecklistTitle('');
    setShowAddChecklist(false);
  };

  const handleAddChecklistItem = (checklistId: string, e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = (itemInputs[checklistId] || '').trim();
    if (!canWrite || !text) return;
    const next = checklists.map((cl) =>
      cl.id === checklistId
        ? {
            ...cl,
            items: [
              ...(cl.items || []),
              { id: generateId('ci'), title: text.slice(0, 160), isCompleted: false },
            ],
          }
        : cl
    );
    void updateTask(task.id, { checklists: next });
    setItemInputs((prev) => ({ ...prev, [checklistId]: '' }));
  };

  const handleToggleChecklistItem = (checklistId: string, itemId: string) => {
    if (!canWrite) return;
    const next = checklists.map((cl) =>
      cl.id === checklistId
        ? {
            ...cl,
            items: (cl.items || []).map((item) =>
              item.id === itemId ? { ...item, isCompleted: !item.isCompleted } : item
            ),
          }
        : cl
    );
    void updateTask(task.id, { checklists: next });
  };

  const handleDeleteChecklist = (checklistId: string) => {
    if (!canWrite) return;
    void updateTask(task.id, { checklists: checklists.filter((c) => c.id !== checklistId) });
  };

  const handleDeleteChecklistItem = (checklistId: string, itemId: string) => {
    if (!canWrite) return;
    const next = checklists.map((cl) =>
      cl.id === checklistId
        ? { ...cl, items: (cl.items || []).filter((i) => i.id !== itemId) }
        : cl
    );
    void updateTask(task.id, { checklists: next });
  };

  const handleAddAttachment = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canWrite) return;
    if (!attName.trim() || !attUrl.trim()) {
      setAttError('Both file name and URL are required.');
      return;
    }
    if (!isSafeExternalUrl(attUrl.trim())) {
      setAttError('Please enter a valid http:// or https:// URL.');
      return;
    }
    setAttError('');
    const next = [
      ...attachments,
      {
        id: generateId('att'),
        fileName: attName.trim().slice(0, 120),
        fileUrl: attUrl.trim().slice(0, 500),
        uploadedBy: user?.uid || '',
      },
    ];
    void updateTask(task.id, { attachments: next });
    setAttName('');
    setAttUrl('');
    setShowAttachmentForm(false);
  };

  const handleRemoveAttachment = (attId: string) => {
    if (!canWrite) return;
    void updateTask(task.id, { attachments: attachments.filter((a) => a.id !== attId) });
  };

  const handlePostComment = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canWrite || !commentText.trim()) return;
    await addComment(task, commentText.trim());
    setCommentText('');
  };

  const handleDuplicate = async () => {
    if (!canWrite) return;
    await duplicateTask(task);
    onClose();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={board?.title || 'Task Details'}
        subtitle={`In ${boardLists.find((l) => l.id === task.listId)?.title || task.status || 'List'}${
          !canWrite ? ' · Read-only Viewer access' : ''
        }`}
        size="xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Main Column */}
          <div className="lg:col-span-8 space-y-6">
            {/* Title & Description */}
            <div className="space-y-3">
              <div>
                <label htmlFor="task-modal-title" className="sr-only">
                  Task title
                </label>
                <input
                  id="task-modal-title"
                  type="text"
                  disabled={!canWrite}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleSaveBasics}
                  className="w-full font-display text-lg font-bold text-[#20212B] dark:text-[#F4F5FA] bg-transparent border border-transparent hover:border-[#E6E8F0] dark:hover:border-[#262A3D] focus:border-[#635BFF] focus:bg-[#F7F8FC] dark:focus:bg-[#0D0E14] rounded-lg px-2.5 py-1.5 -mx-2.5 focus:outline-none transition-colors"
                />
                {titleError && <p className="text-xs text-[#EF4444] mt-1">{titleError}</p>}
              </div>

              <div>
                <label
                  htmlFor="task-modal-desc"
                  className="block text-xs font-semibold text-[#6B7085] dark:text-[#9EA3B8] mb-1.5"
                >
                  Description
                </label>
                <textarea
                  id="task-modal-desc"
                  rows={4}
                  disabled={!canWrite}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleSaveBasics}
                  placeholder="Add detailed specifications, acceptance criteria, or context..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF] resize-y"
                />
              </div>
            </div>

            {/* Checklists */}
            <div className="space-y-3 pt-2 border-t border-[#E6E8F0] dark:border-[#262A3D]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-[#635BFF]" />
                  <h3 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                    Checklists
                  </h3>
                  {checklistProg.total > 0 && (
                    <span className="text-xs font-mono tabular-nums text-[#6B7085] dark:text-[#9EA3B8]">
                      {checklistProg.completed}/{checklistProg.total} ({checklistProg.percent}%)
                    </span>
                  )}
                </div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setShowAddChecklist((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#635BFF] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Checklist
                  </button>
                )}
              </div>

              {checklistProg.total > 0 && (
                <div className="w-full h-1.5 rounded-full bg-[#E6E8F0] dark:bg-[#262A3D] overflow-hidden">
                  <div
                    className="h-full bg-[#22C55E] transition-all duration-200"
                    style={{ width: `${checklistProg.percent}%` }}
                  />
                </div>
              )}

              {showAddChecklist && canWrite && (
                <form onSubmit={handleAddChecklist} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newChecklistTitle}
                    onChange={(e) => setNewChecklistTitle(e.target.value)}
                    placeholder="Checklist title (e.g., QA Verification)"
                    className="flex-1 px-3 py-2 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 text-xs font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg"
                  >
                    Add
                  </button>
                </form>
              )}

              {checklists.map((cl) => (
                <div
                  key={cl.id}
                  className="p-3.5 rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                      {cl.title}
                    </span>
                    {canWrite && (
                      <button
                        type="button"
                        onClick={() => handleDeleteChecklist(cl.id)}
                        aria-label={`Delete checklist ${cl.title}`}
                        className="text-xs text-[#9295A5] hover:text-[#EF4444]"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {(cl.items || []).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 group">
                        <label className="flex items-center gap-2.5 text-sm cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            disabled={!canWrite}
                            checked={Boolean(item.isCompleted)}
                            onChange={() => handleToggleChecklistItem(cl.id, item.id)}
                            className="w-4 h-4 rounded accent-[#635BFF]"
                          />
                          <span
                            className={`truncate ${
                              item.isCompleted
                                ? 'line-through text-[#9295A5]'
                                : 'text-[#20212B] dark:text-[#F4F5FA]'
                            }`}
                          >
                            {item.title}
                          </span>
                        </label>
                        {canWrite && (
                          <button
                            type="button"
                            onClick={() => handleDeleteChecklistItem(cl.id, item.id)}
                            aria-label={`Delete item ${item.title}`}
                            className="opacity-0 group-hover:opacity-100 text-[#9295A5] hover:text-[#EF4444] p-0.5 transition-opacity"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canWrite && (
                    <form
                      onSubmit={(e) => handleAddChecklistItem(cl.id, e)}
                      className="flex items-center gap-2 pt-1"
                    >
                      <input
                        type="text"
                        value={itemInputs[cl.id] || ''}
                        onChange={(e) =>
                          setItemInputs((prev) => ({ ...prev, [cl.id]: e.target.value }))
                        }
                        placeholder="Add checklist item..."
                        className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 text-xs font-medium text-[#635BFF] hover:bg-[#635BFF]/10 rounded-lg"
                      >
                        Add item
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>

            {/* Attachments */}
            <div className="space-y-3 pt-2 border-t border-[#E6E8F0] dark:border-[#262A3D]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4 text-[#635BFF]" />
                  <h3 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                    Attachments ({attachments.length})
                  </h3>
                </div>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setShowAttachmentForm((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#635BFF] hover:underline"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Attach Link
                  </button>
                )}
              </div>

              {showAttachmentForm && canWrite && (
                <form
                  onSubmit={handleAddAttachment}
                  className="p-3 rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={attName}
                      onChange={(e) => setAttName(e.target.value)}
                      placeholder="File or resource name"
                      className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D]"
                    />
                    <input
                      type="url"
                      value={attUrl}
                      onChange={(e) => setAttUrl(e.target.value)}
                      placeholder="https://..."
                      className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D]"
                    />
                  </div>
                  {attError && <p className="text-xs text-[#EF4444]">{attError}</p>}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAttachmentForm(false)}
                      className="px-3 py-1.5 text-xs text-[#6B7085]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 text-xs font-medium text-white bg-[#635BFF] rounded-lg"
                    >
                      Attach
                    </button>
                  </div>
                </form>
              )}

              {attachments.length > 0 && (
                <div className="space-y-1.5">
                  {attachments.map((att) => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D]"
                    >
                      <a
                        href={isSafeExternalUrl(att.fileUrl) ? att.fileUrl : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] hover:text-[#635BFF] truncate"
                      >
                        <ExternalLink className="w-3.5 h-3.5 shrink-0 text-[#6B7085]" />
                        <span className="truncate">{att.fileName || att.name}</span>
                      </a>
                      {canWrite && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(att.id)}
                          aria-label={`Remove attachment ${att.fileName || att.name || ''}`}
                          className="text-[#9295A5] hover:text-[#EF4444]"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="space-y-3 pt-2 border-t border-[#E6E8F0] dark:border-[#262A3D]">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[#635BFF]" />
                <h3 className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                  Comments ({taskComments.length})
                </h3>
              </div>

              {canWrite && (
                <form onSubmit={handlePostComment} className="flex items-start gap-2.5">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment... Use @name to mention teammates"
                    className="flex-1 px-3.5 py-2 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
                  />
                  <button
                    type="submit"
                    aria-label="Post comment"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Post
                  </button>
                </form>
              )}

              <div className="space-y-3">
                {taskComments.length === 0 ? (
                  <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                    No comments yet. Start a discussion with your team.
                  </p>
                ) : (
                  taskComments.map((c) => {
                    const dt = toJsDate(c.createdAt);
                    return (
                      <div key={c.id} className="flex items-start gap-3">
                        <Avatar src={c.authorAvatar} name={c.authorName} size="xs" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                                {c.authorName}
                              </span>
                              {dt && (
                                <span className="text-[#9295A5] font-mono tabular-nums">
                                  {formatDistanceToNow(dt, { addSuffix: true })}
                                </span>
                              )}
                            </div>
                            {canWrite && c.userId === user?.uid && (
                              <button
                                type="button"
                                onClick={() => void removeComment(c.id, task.id)}
                                className="text-[11px] text-[#9295A5] hover:text-[#EF4444]"
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-[#20212B] dark:text-[#E2E4F0] mt-1 break-words">
                            {c.content}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Activity History */}
            {taskActivities.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-[#E6E8F0] dark:border-[#262A3D]">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#6B7085]" />
                  <h3 className="text-xs font-semibold text-[#6B7085] dark:text-[#9EA3B8]">
                    Activity History
                  </h3>
                </div>
                <ul className="space-y-1.5">
                  {taskActivities.map((act) => {
                    const dt = toJsDate(act.createdAt);
                    return (
                      <li key={act.id} className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
                        <span className="font-medium text-[#20212B] dark:text-[#F4F5FA]">
                          {act.actorName}
                        </span>{' '}
                        {act.action}
                        {dt && (
                          <span className="text-[#9295A5] ml-1.5 font-mono tabular-nums">
                            · {formatDistanceToNow(dt, { addSuffix: true })}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Right Metadata Sidebar */}
          <div className="lg:col-span-4 space-y-5 lg:border-l lg:border-[#E6E8F0] dark:lg:border-[#262A3D] lg:pl-5">
            {/* List / Status */}
            <div>
              <label
                htmlFor="task-modal-list"
                className="block text-xs font-semibold text-[#6B7085] dark:text-[#9EA3B8] mb-1.5"
              >
                Status Column
              </label>
              <select
                id="task-modal-list"
                disabled={!canWrite}
                value={task.listId}
                onChange={(e) => void updateTask(task.id, { listId: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA]"
              >
                {boardLists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label
                htmlFor="task-modal-priority"
                className="block text-xs font-semibold text-[#6B7085] dark:text-[#9EA3B8] mb-1.5"
              >
                Priority
              </label>
              <select
                id="task-modal-priority"
                disabled={!canWrite}
                value={task.priority || 'medium'}
                onChange={(e) =>
                  void updateTask(task.id, { priority: e.target.value as TaskPriority })
                }
                className="w-full px-3 py-2 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA]"
              >
                {Object.values(PRIORITIES).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div>
              <label
                htmlFor="task-modal-due"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7085] dark:text-[#9EA3B8] mb-1.5"
              >
                <Calendar className="w-3.5 h-3.5" />
                Due Date
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="task-modal-due"
                  type="date"
                  disabled={!canWrite}
                  value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                  onChange={(e) => void updateTask(task.id, { dueDate: e.target.value || null })}
                  className="flex-1 px-3 py-2 text-sm font-mono tabular-nums rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA]"
                />
                {task.dueDate && canWrite && (
                  <button
                    type="button"
                    onClick={() => void updateTask(task.id, { dueDate: null })}
                    aria-label="Clear due date"
                    className="p-2 text-[#9295A5] hover:text-[#EF4444]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Assignees */}
            <div>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7085] dark:text-[#9EA3B8] mb-2">
                <Users className="w-3.5 h-3.5" />
                Assignees
              </span>
              <div className="space-y-1.5">
                {members.map((m) => {
                  const uid = m.userId || m.id;
                  const assigned = (task.assigneeIds || []).includes(uid);
                  return (
                    <button
                      key={uid}
                      type="button"
                      disabled={!canWrite}
                      onClick={() => toggleAssignee(uid)}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors ${
                        assigned
                          ? 'border-[#635BFF] bg-[#635BFF]/[0.06] dark:bg-[#635BFF]/15'
                          : 'border-[#E6E8F0] dark:border-[#262A3D] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar src={m.avatarUrl} name={m.fullName} size="xs" />
                        <span className="text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] truncate">
                          {m.fullName}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#6B7085] dark:text-[#9EA3B8]">
                        {assigned ? 'Assigned' : 'Add'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Labels */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#6B7085] dark:text-[#9EA3B8]">
                  <Tag className="w-3.5 h-3.5" />
                  Labels
                </span>
                {canWrite && (
                  <button
                    type="button"
                    onClick={() => setShowLabelForm((v) => !v)}
                    className="text-xs font-medium text-[#635BFF] hover:underline"
                  >
                    New label
                  </button>
                )}
              </div>

              {showLabelForm && canWrite && (
                <form onSubmit={handleCreateLabel} className="flex items-center gap-1.5 mb-2">
                  <input
                    type="color"
                    value={newLabelColor}
                    onChange={(e) => setNewLabelColor(e.target.value)}
                    aria-label="Label color"
                    className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="Label name"
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D]"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#635BFF] rounded-lg"
                  >
                    Add
                  </button>
                </form>
              )}

              <div className="flex flex-wrap gap-1.5">
                {boardLabels.map((lbl) => {
                  const active = (task.labelIds || []).includes(lbl.id);
                  return (
                    <button
                      key={lbl.id}
                      type="button"
                      disabled={!canWrite}
                      onClick={() => toggleLabel(lbl.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                        active
                          ? 'border-[#635BFF] bg-[#635BFF]/10 text-[#20212B] dark:text-white'
                          : 'border-[#E6E8F0] dark:border-[#262A3D] text-[#6B7085] dark:text-[#9EA3B8] hover:text-[#20212B]'
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: lbl.color }}
                      />
                      <span>{lbl.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card Actions */}
            {canWrite && (
              <div className="pt-4 border-t border-[#E6E8F0] dark:border-[#262A3D] space-y-2">
                <button
                  type="button"
                  onClick={() => void handleDuplicate()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 text-[#6B7085]" />
                  <span>Duplicate Task</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void updateTask(task.id, { isArchived: !task.isArchived });
                    onClose();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors"
                >
                  <Archive className="w-3.5 h-3.5 text-[#6B7085]" />
                  <span>{task.isArchived ? 'Restore Task' : 'Archive Task'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-red-200 dark:border-red-900/50 text-[#EF4444] hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Task</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={async () => {
          await deleteTask(task.id);
          onClose();
        }}
        title="Delete this task?"
        description={`"${task.title}" and its checklist data will be permanently deleted.`}
        confirmLabel="Delete Task"
      />
    </>
  );
}
