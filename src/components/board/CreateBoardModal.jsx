import React, { useEffect, useState } from 'react';
import { Modal } from '../common/UIPrimitives.jsx';
import { BOARD_BACKGROUNDS, BOARD_TEMPLATES } from '../../constants/templates.js';
import { validateBoardInput } from '../../utils/kanban.js';
import { useDataStore } from '../../stores/useDataStore.js';

export function CreateBoardModal({ open, onClose, defaultWorkspaceId, onCreated }) {
  const { workspaces, activeWorkspaceId, createBoard } = useDataStore();
  const [workspaceId, setWorkspaceId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [templateId, setTemplateId] = useState('project-management');
  const [background, setBackground] = useState('indigo');
  const [visibility, setVisibility] = useState('workspace');
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setWorkspaceId(defaultWorkspaceId || activeWorkspaceId || workspaces[0]?.id || '');
      setTitle('');
      setDescription('');
      setTemplateId('project-management');
      setBackground('indigo');
      setVisibility('workspace');
      setErrors({});
    }
  }, [open, defaultWorkspaceId, activeWorkspaceId, workspaces]);

  const handleSelectTemplate = (tpl) => {
    setTemplateId(tpl.id);
    setBackground(tpl.background || 'slate');
    if (!title.trim() && tpl.id !== 'blank') {
      setTitle(tpl.name);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validation = validateBoardInput({ title, description });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }
    if (!workspaceId) {
      setErrors({ workspaceId: 'Please select a workspace.' });
      return;
    }

    setSubmitting(true);
    try {
      const board = await createBoard({
        workspaceId,
        title: title.trim(),
        description: description.trim(),
        background,
        visibility,
        templateId,
      });
      if (board && onCreated) onCreated(board);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create Kanban Board"
      subtitle="Start from a curated workflow template or configure a custom board."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="board-title"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Board Title
            </label>
            <input
              id="board-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="e.g., Website Redesign Sprint"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
            />
            {errors.title && <p className="text-xs text-[#EF4444] mt-1">{errors.title}</p>}
          </div>

          <div>
            <label
              htmlFor="board-workspace"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Workspace
            </label>
            <select
              id="board-workspace"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
            >
              {workspaces.map((ws) => (
                <option key={ws.id} value={ws.id}>
                  {ws.name}
                </option>
              ))}
            </select>
            {errors.workspaceId && (
              <p className="text-xs text-[#EF4444] mt-1">{errors.workspaceId}</p>
            )}
          </div>
        </div>

        {/* Templates */}
        <div>
          <span className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-2">
            Workflow Template
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
            {BOARD_TEMPLATES.map((tpl) => {
              const selected = templateId === tpl.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => handleSelectTemplate(tpl)}
                  className={`text-left p-3 rounded-lg border transition-colors ${
                    selected
                      ? 'border-[#635BFF] bg-[#635BFF]/[0.06] dark:bg-[#635BFF]/15'
                      : 'border-[#E6E8F0] dark:border-[#262A3D] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#20212B] dark:text-[#F4F5FA]">
                      {tpl.name}
                    </span>
                    <span className="text-[11px] text-[#6B7085] dark:text-[#9EA3B8]">
                      {tpl.category}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8] mt-1 line-clamp-2">
                    {tpl.description}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Background Swatches */}
          <div>
            <span className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-2">
              Board Theme
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {BOARD_BACKGROUNDS.map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setBackground(bg.id)}
                  aria-label={`Board theme ${bg.name}`}
                  title={bg.name}
                  className={`w-8 h-8 rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] transition-transform ${
                    background === bg.id
                      ? 'ring-2 ring-offset-2 ring-[#635BFF] dark:ring-offset-[#151722] scale-105'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: bg.swatch }}
                />
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div>
            <label
              htmlFor="board-visibility"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Visibility
            </label>
            <select
              id="board-visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className="w-full px-3.5 py-2 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
            >
              <option value="workspace">Workspace Members</option>
              <option value="private">Private (Board Members Only)</option>
              <option value="public">Public Read-Only Link</option>
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="board-desc"
            className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
          >
            Description (Optional)
          </label>
          <input
            id="board-desc"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short summary of goals for this board"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E8F0] dark:border-[#262A3D]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-[#635BFF] hover:bg-[#5249E8] disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            {submitting ? 'Creating...' : 'Create Board'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
