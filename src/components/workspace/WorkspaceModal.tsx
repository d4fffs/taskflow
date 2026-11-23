import React, { useEffect, useState, type FormEvent } from 'react';
import { Modal } from '../common/UIPrimitives';
import { WORKSPACE_COLORS } from '../../constants/templates';
import { validateWorkspaceInput } from '../../utils/kanban';
import { useDataStore } from '../../stores/useDataStore';
import type { Workspace } from '../../types';

interface WorkspaceModalProps {
  open: boolean;
  onClose: () => void;
  workspace?: Workspace | null;
  onSaved?: (workspace: Workspace) => void;
}

export function WorkspaceModal({
  open,
  onClose,
  workspace = null,
  onSaved,
}: WorkspaceModalProps) {
  const { createWorkspace, updateWorkspace } = useDataStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarColor, setAvatarColor] = useState(WORKSPACE_COLORS[0]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(workspace?.name || '');
      setDescription(workspace?.description || '');
      setAvatarColor(workspace?.avatarColor || WORKSPACE_COLORS[0]);
      setErrors({});
    }
  }, [open, workspace]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const validation = validateWorkspaceInput({ name, description });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      if (workspace) {
        await updateWorkspace(workspace.id, {
          name: name.trim(),
          description: description.trim(),
          avatarColor,
        });
        if (onSaved) onSaved(workspace);
      } else {
        const created = await createWorkspace({
          name: name.trim(),
          description: description.trim(),
          avatarColor,
        });
        if (onSaved && created) onSaved(created);
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={workspace ? 'Edit Workspace' : 'Create Workspace'}
      subtitle="Organize boards, collaborators, and permissions in one shared space."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="ws-name"
            className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
          >
            Workspace Name
          </label>
          <input
            id="ws-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="e.g., Product Engineering"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF]"
          />
          {errors.name && <p className="text-xs text-[#EF4444] mt-1">{errors.name}</p>}
        </div>

        <div>
          <label
            htmlFor="ws-desc"
            className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
          >
            Description
          </label>
          <textarea
            id="ws-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What projects or teams collaborate in this workspace?"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#20212B] dark:text-[#F4F5FA] focus:outline-none focus:ring-2 focus:ring-[#635BFF] resize-none"
          />
          {errors.description && (
            <p className="text-xs text-[#EF4444] mt-1">{errors.description}</p>
          )}
        </div>

        <div>
          <span className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-2">
            Workspace Color
          </span>
          <div className="flex items-center gap-2.5">
            {WORKSPACE_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Select color ${color}`}
                onClick={() => setAvatarColor(color)}
                className={`w-8 h-8 rounded-lg transition-transform ${
                  avatarColor === color
                    ? 'ring-2 ring-offset-2 ring-[#635BFF] dark:ring-offset-[#151722] scale-105'
                    : 'hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
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
            {submitting ? 'Saving...' : workspace ? 'Save Changes' : 'Create Workspace'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
