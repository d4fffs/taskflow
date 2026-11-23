import React, { useEffect, useState } from 'react';
import { Upload, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/useAuthStore.js';
import { useToastStore } from '../../stores/useToastStore.js';
import { DEFAULT_AVATARS } from '../../constants/templates.js';
import { Avatar } from '../../components/common/UIPrimitives.jsx';

export function ProfilePage() {
  const { user, profile, saveProfile } = useAuthStore();
  const addToast = useToastStore((s) => s.addToast);

  const [fullName, setFullName] = useState('');
  const [roleTitle, setRoleTitle] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(profile?.fullName || user?.displayName || '');
    setRoleTitle(profile?.roleTitle || '');
    setBio(profile?.bio || '');
    setAvatarUrl(profile?.avatarUrl || user?.photoURL || '');
  }, [profile, user]);

  const handleAvatarFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }
    if (file.size > 350 * 1024) {
      setError('Please choose an image smaller than 350 KB.');
      return;
    }
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Full name is required.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      await saveProfile({
        fullName: fullName.trim(),
        roleTitle: roleTitle.trim(),
        bio: bio.trim(),
        avatarUrl,
      });
      addToast({ title: 'Profile saved', message: 'Your profile changes are updated.', variant: 'success' });
    } catch (err) {
      setError(err?.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const presetAvatars = [
    { id: 'lead', label: 'Studio Portrait 1', url: DEFAULT_AVATARS.lead },
    { id: 'engineer', label: 'Studio Portrait 2', url: DEFAULT_AVATARS.engineer },
    { id: 'ops', label: 'Studio Portrait 3', url: DEFAULT_AVATARS.ops },
  ];

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[#20212B] dark:text-[#F4F5FA] tracking-tight">
          Profile
        </h1>
        <p className="text-sm text-[#6B7085] dark:text-[#9EA3B8] mt-1">
          Manage your display name, role title, bio, and profile avatar.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-[#151722] border border-[#E6E8F0] dark:border-[#262A3D] rounded-xl p-6 space-y-6"
        noValidate
      >
        {/* Avatar Section */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-5 border-b border-[#E6E8F0] dark:border-[#262A3D]">
          <Avatar src={avatarUrl} name={fullName || 'User'} size="lg" />
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-[#E6E8F0] dark:border-[#262A3D] hover:bg-[#F7F8FC] dark:hover:bg-[#1C1F2E] cursor-pointer">
                <Upload className="w-3.5 h-3.5 text-[#635BFF]" />
                <span>Upload Avatar</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFile}
                  className="hidden"
                />
              </label>
              {presetAvatars.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAvatarUrl(preset.url)}
                  aria-label={`Choose ${preset.label}`}
                  className={`relative rounded-full p-0.5 border-2 transition-colors ${
                    avatarUrl === preset.url ? 'border-[#635BFF]' : 'border-transparent'
                  }`}
                >
                  <Avatar src={preset.url} name={preset.label} size="sm" />
                </button>
              ))}
            </div>
            <p className="text-xs text-[#6B7085] dark:text-[#9EA3B8]">
              Upload a square image (up to 350 KB) or choose a curated portrait.
            </p>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300"
          >
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="profile-name"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Full Name
            </label>
            <input
              id="profile-name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D]"
            />
          </div>

          <div>
            <label
              htmlFor="profile-role"
              className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
            >
              Role / Title
            </label>
            <input
              id="profile-role"
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              placeholder="e.g., Fullstack Engineer"
              className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D]"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="profile-email"
            className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
          >
            Email Address
          </label>
          <input
            id="profile-email"
            type="email"
            disabled
            value={profile?.email || user?.email || ''}
            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] text-[#6B7085] opacity-75"
          />
        </div>

        <div>
          <label
            htmlFor="profile-bio"
            className="block text-xs font-medium text-[#20212B] dark:text-[#F4F5FA] mb-1.5"
          >
            Bio
          </label>
          <textarea
            id="profile-bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Share what you focus on across your team's projects."
            className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-[#F7F8FC] dark:bg-[#0D0E14] border border-[#E6E8F0] dark:border-[#262A3D] resize-none"
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-[#E6E8F0] dark:border-[#262A3D]">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium text-white bg-[#635BFF] hover:bg-[#5249E8] rounded-lg disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
