import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  TextInput,
  Button,
  Tag,
  InlineNotification,
  Dropdown,
  InlineLoading,
} from '@carbon/react';
import { TrashCan } from '@carbon/icons-react';
import { useAuthStore } from '../../stores/authStore';
import { organizationsApi, usersApi, rolesApi } from '../../services/api';
import type { User } from '../../types';
import type { RoleListItem } from '../../types/role';

export default function OrganizationSettings() {
  const queryClient = useQueryClient();
  const { organization, user: currentUser, fetchUser } = useAuthStore();
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    slug: organization?.slug || '',
  });
  const [success, setSuccess] = useState(false);

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await usersApi.list();
      return res.data as User[];
    },
  });

  // Fetch roles for dropdown
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await rolesApi.list();
      return res.data as RoleListItem[];
    },
  });

  // Fetch user roles
  const { data: userRoles = {} } = useQuery({
    queryKey: ['user-roles'],
    queryFn: async () => {
      const roleMap: Record<string, string | null> = {};
      for (const user of users) {
        try {
          const res = await rolesApi.getUserRole(user.id);
          roleMap[user.id] = res.data?.id || null;
        } catch {
          roleMap[user.id] = null;
        }
      }
      return roleMap;
    },
    enabled: users.length > 0,
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => organizationsApi.update(data),
    onSuccess: () => {
      fetchUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    },
  });

  const assignRoleMutation = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string | null }) =>
      rolesApi.assignToUser(userId, roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => usersApi.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const getPlanColor = (plan: string): 'blue' | 'green' | 'magenta' | 'purple' => {
    const colors: Record<string, 'blue' | 'green' | 'magenta' | 'purple'> = {
      free: 'blue',
      starter: 'green',
      pro: 'magenta',
      enterprise: 'purple',
    };
    return colors[plan] || 'blue';
  };

  const getRoleColor = (role: string): 'purple' | 'blue' | 'gray' => {
    const colors: Record<string, 'purple' | 'blue' | 'gray'> = {
      owner: 'purple',
      admin: 'blue',
      member: 'gray',
    };
    return colors[role] || 'gray';
  };

  const roleDropdownItems = [
    { id: '', text: 'No Role' },
    ...roles.map(r => ({ id: r.id, text: r.name })),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Organization Info */}
      <Tile style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '1.5rem' }}>
          Organization Settings
        </h2>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          padding: '1rem',
          backgroundColor: 'var(--bg-primary)',
          marginBottom: '1.5rem',
        }}>
          <span style={{ fontWeight: 600 }}>Current Plan:</span>
          <Tag type={getPlanColor(organization?.plan || 'free')} size="md">
            {organization?.plan?.toUpperCase()}
          </Tag>
          <Button kind="tertiary" size="sm">Upgrade</Button>
        </div>

        {success && (
          <InlineNotification
            kind="success"
            title="Success"
            subtitle="Settings saved successfully!"
            lowContrast
            hideCloseButton
            style={{ marginBottom: '1rem' }}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '400px' }}>
          <TextInput
            id="org_name"
            labelText="Organization Name"
            value={formData.name}
            onChange={handleChange('name')}
          />

          <div>
            <TextInput
              id="org_slug"
              labelText="Slug"
              value={formData.slug}
              onChange={handleChange('slug')}
            />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
              Used in URLs and API calls
            </p>
          </div>

          <Button
            kind="primary"
            onClick={() => updateMutation.mutate(formData)}
            disabled={updateMutation.isPending}
          >
            Save Changes
          </Button>
        </div>
      </Tile>

      {/* Users List */}
      <Tile style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '1.5rem' }}>
          Team Members
        </h2>

        {usersLoading ? (
          <InlineLoading description="Loading users..." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {users.map((user) => (
              <div
                key={user.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-primary)',
                  gap: '1rem',
                }}
              >
                {/* User Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.full_name || user.email}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {user.email}
                  </div>
                </div>

                {/* Org Role Tag */}
                <Tag type={getRoleColor(user.role)} size="sm">
                  {user.role}
                </Tag>

                {/* Custom Role Dropdown */}
                <div style={{ width: '180px' }}>
                  <Dropdown
                    id={`role-${user.id}`}
                    size="sm"
                    titleText=""
                    label="Select role"
                    items={roleDropdownItems}
                    selectedItem={
                      roleDropdownItems.find(r => r.id === userRoles[user.id]) || roleDropdownItems[0]
                    }
                    onChange={({ selectedItem }) => {
                      assignRoleMutation.mutate({
                        userId: user.id,
                        roleId: selectedItem?.id || null,
                      });
                    }}
                    disabled={user.role === 'owner'}
                  />
                </div>

                {/* Delete Button */}
                {user.id !== currentUser?.id && user.role !== 'owner' && (
                  <Button
                    kind="danger--ghost"
                    size="sm"
                    hasIconOnly
                    renderIcon={TrashCan}
                    iconDescription="Remove user"
                    onClick={() => {
                      if (window.confirm(`Remove ${user.email} from the organization?`)) {
                        deleteUserMutation.mutate(user.id);
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {roles.length === 0 && (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
            Create roles in Settings → Roles to assign them to users.
          </p>
        )}
      </Tile>
    </div>
  );
}
