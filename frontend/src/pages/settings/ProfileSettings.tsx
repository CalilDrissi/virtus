import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Tile, TextInput, Button, InlineNotification, InlineLoading, Modal } from '@carbon/react';
import { useAuthStore } from '../../stores/authStore';
import { usersApi } from '../../services/api';

const API_URL = import.meta.env.VITE_API_URL || '';

// Default avatar options using DiceBear API
const DEFAULT_AVATARS = [
  // Shapes style
  { id: 'shapes-1', url: 'https://api.dicebear.com/7.x/shapes/svg?seed=felix&backgroundColor=0052ff' },
  { id: 'shapes-2', url: 'https://api.dicebear.com/7.x/shapes/svg?seed=aneka&backgroundColor=6929c4' },
  { id: 'shapes-3', url: 'https://api.dicebear.com/7.x/shapes/svg?seed=jade&backgroundColor=009d9a' },
  { id: 'shapes-4', url: 'https://api.dicebear.com/7.x/shapes/svg?seed=luna&backgroundColor=9f1853' },
  // Identicon style
  { id: 'identicon-1', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=felix&backgroundColor=0052ff' },
  { id: 'identicon-2', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=aneka&backgroundColor=6929c4' },
  { id: 'identicon-3', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=jade&backgroundColor=009d9a' },
  { id: 'identicon-4', url: 'https://api.dicebear.com/7.x/identicon/svg?seed=luna&backgroundColor=9f1853' },
  // Bottts style (robots)
  { id: 'bottts-1', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=felix&backgroundColor=b8e986' },
  { id: 'bottts-2', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=aneka&backgroundColor=c1c7cd' },
  { id: 'bottts-3', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=jade&backgroundColor=ffd6e8' },
  { id: 'bottts-4', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=luna&backgroundColor=d0e2ff' },
  // Thumbs style
  { id: 'thumbs-1', url: 'https://api.dicebear.com/7.x/thumbs/svg?seed=felix&backgroundColor=0052ff' },
  { id: 'thumbs-2', url: 'https://api.dicebear.com/7.x/thumbs/svg?seed=aneka&backgroundColor=6929c4' },
  { id: 'thumbs-3', url: 'https://api.dicebear.com/7.x/thumbs/svg?seed=jade&backgroundColor=009d9a' },
  { id: 'thumbs-4', url: 'https://api.dicebear.com/7.x/thumbs/svg?seed=luna&backgroundColor=9f1853' },
];

export default function ProfileSettings() {
  const { user, fetchUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
  });
  const [success, setSuccess] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedDefault, setSelectedDefault] = useState<string | null>(null);

  // Update form when user changes
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: (data: { full_name?: string; email?: string; avatar_url?: string }) =>
      usersApi.update(user!.id, data),
    onSuccess: () => {
      fetchUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => usersApi.uploadAvatar(file),
    onSuccess: () => {
      fetchUser();
      setAvatarError(null);
      setShowAvatarModal(false);
    },
    onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
      setAvatarError(error.response?.data?.detail || 'Failed to upload avatar');
    },
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSave = () => {
    updateMutation.mutate({
      full_name: formData.full_name,
      email: formData.email,
    });
  };

  const handleAvatarClick = () => {
    setShowAvatarModal(true);
    setSelectedDefault(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setAvatarError('Invalid file type. Please upload a JPG, PNG, GIF, or WebP image.');
        return;
      }
      // Validate file size (5MB)
      if (file.size > 5 * 1024 * 1024) {
        setAvatarError('File too large. Maximum size is 5MB.');
        return;
      }
      avatarMutation.mutate(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleSelectDefault = (url: string) => {
    setSelectedDefault(url);
  };

  const handleSaveDefaultAvatar = () => {
    if (selectedDefault) {
      updateMutation.mutate({ avatar_url: selectedDefault });
      setShowAvatarModal(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const initials = (user?.full_name || user?.email || 'U').charAt(0).toUpperCase();

  // Check if avatar is a URL (default) or a path (uploaded)
  const getAvatarUrl = () => {
    if (!user?.avatar_url) return null;
    if (user.avatar_url.startsWith('http')) return user.avatar_url;
    return `${API_URL}${user.avatar_url}`;
  };
  const avatarUrl = getAvatarUrl();

  const hasChanges =
    formData.full_name !== (user?.full_name || '') ||
    formData.email !== (user?.email || '');

  return (
    <Tile style={{ padding: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '1.5rem' }}>
        Profile Settings
      </h2>

      {success && (
        <InlineNotification
          kind="success"
          title="Success"
          subtitle="Profile updated successfully!"
          lowContrast
          hideCloseButton
          style={{ marginBottom: '1rem' }}
        />
      )}

      {updateMutation.isError && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle="Failed to update profile. Please try again."
          lowContrast
          hideCloseButton
          style={{ marginBottom: '1rem' }}
        />
      )}

      {avatarError && (
        <InlineNotification
          kind="error"
          title="Avatar Error"
          subtitle={avatarError}
          lowContrast
          hideCloseButton
          onClose={() => setAvatarError(null)}
          style={{ marginBottom: '1rem' }}
        />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{
          width: '72px',
          height: '72px',
          borderRadius: '50%',
          backgroundColor: avatarUrl ? 'transparent' : 'var(--brand-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--white)',
          fontSize: '1.5rem',
          fontWeight: 400,
          overflow: 'hidden',
          position: 'relative',
        }}>
          {avatarMutation.isPending || updateMutation.isPending ? (
            <InlineLoading description="" />
          ) : avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Avatar"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          ) : (
            initials
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Button
            kind="tertiary"
            size="sm"
            onClick={handleAvatarClick}
            disabled={avatarMutation.isPending || updateMutation.isPending}
          >
            Change Avatar
          </Button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Choose from defaults or upload custom
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px' }}>
        <TextInput
          id="full_name"
          labelText="Full Name"
          value={formData.full_name}
          onChange={handleChange('full_name')}
        />

        <TextInput
          id="email"
          type="email"
          labelText="Email"
          value={formData.email}
          onChange={handleChange('email')}
        />

        <TextInput
          id="role"
          labelText="Role"
          value={user?.role || ''}
          disabled
        />

        <Button
          kind="primary"
          onClick={handleSave}
          disabled={updateMutation.isPending || !hasChanges}
        >
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Avatar Selection Modal */}
      <Modal
        open={showAvatarModal}
        onRequestClose={() => setShowAvatarModal(false)}
        onRequestSubmit={handleSaveDefaultAvatar}
        modalHeading="Choose Avatar"
        primaryButtonText="Save"
        primaryButtonDisabled={!selectedDefault || updateMutation.isPending}
        secondaryButtonText="Cancel"
        size="md"
      >
        <div style={{ marginBottom: '1.5rem' }}>
          <Button
            kind="tertiary"
            size="sm"
            onClick={handleUploadClick}
            disabled={avatarMutation.isPending}
          >
            {avatarMutation.isPending ? 'Uploading...' : 'Upload Custom Image'}
          </Button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '1rem' }}>
            JPG, PNG, GIF or WebP. Max 5MB.
          </span>
        </div>

        <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
          Or choose a default avatar:
        </h4>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          maxHeight: '400px',
          overflowY: 'auto',
          padding: '0.5rem',
        }}>
          {DEFAULT_AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => handleSelectDefault(avatar.url)}
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                border: selectedDefault === avatar.url ? '3px solid var(--brand-primary)' : '2px solid var(--border-subtle)',
                padding: 0,
                cursor: 'pointer',
                overflow: 'hidden',
                backgroundColor: 'transparent',
                transition: 'border-color 0.15s, transform 0.15s',
                transform: selectedDefault === avatar.url ? 'scale(1.1)' : 'scale(1)',
              }}
            >
              <img
                src={avatar.url}
                alt={`Avatar option ${avatar.id}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </button>
          ))}
        </div>
      </Modal>
    </Tile>
  );
}
