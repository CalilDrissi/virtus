import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  Button,
  TextInput,
  TextArea,
  Modal,
  Tag,
  Toggle,
  InlineNotification,
  InlineLoading,
} from '@carbon/react';
import { Add, TrashCan, Edit } from '@carbon/icons-react';
import { rolesApi, subscriptionsApi, dataSourcesApi } from '../../services/api';
import type { Role, RoleListItem, Permission } from '../../types/role';

const PERMISSIONS: { id: Permission; label: string; description: string }[] = [
  { id: 'model_access', label: 'Model Access', description: 'Can use assigned AI models' },
  { id: 'data_source_access', label: 'Data Source Access', description: 'Can access assigned data sources' },
  { id: 'billing_view', label: 'Billing View', description: 'Can view billing and usage information' },
  { id: 'api_key_management', label: 'API Key Management', description: 'Can create and manage API keys' },
];

// Default role templates
const DEFAULT_ROLES: { name: string; description: string; permissions: Permission[]; color: 'blue' | 'green' | 'purple' }[] = [
  {
    name: 'Viewer',
    description: 'Can view and use assigned models and data sources',
    permissions: ['model_access', 'data_source_access'],
    color: 'blue',
  },
  {
    name: 'Editor',
    description: 'Can use models, data sources, and manage API keys',
    permissions: ['model_access', 'data_source_access', 'api_key_management'],
    color: 'green',
  },
  {
    name: 'Manager',
    description: 'Full access including billing and API key management',
    permissions: ['model_access', 'data_source_access', 'billing_view', 'api_key_management'],
    color: 'purple',
  },
];

export default function RoleSettings() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permissions: [] as Permission[],
    model_ids: [] as string[],
    data_source_ids: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch roles
  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await rolesApi.list();
      return res.data as RoleListItem[];
    },
  });

  // Fetch role detail when selected
  const { data: roleDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['role', selectedRole?.id],
    queryFn: async () => {
      if (!selectedRole?.id) return null;
      const res = await rolesApi.get(selectedRole.id);
      return res.data as Role;
    },
    enabled: !!selectedRole?.id,
  });

  // Fetch subscriptions for model access
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions-active'],
    queryFn: async () => {
      const res = await subscriptionsApi.listActive();
      return res.data;
    },
  });

  // Fetch data sources
  const { data: dataSources = [] } = useQuery({
    queryKey: ['data-sources'],
    queryFn: async () => {
      const res = await dataSourcesApi.list();
      return res.data;
    },
  });

  // Mutations
  const createRoleMutation = useMutation({
    mutationFn: (data: typeof formData) => rolesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail || 'Failed to create role');
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: typeof formData }) =>
      rolesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['role', selectedRole?.id] });
      setShowEditModal(false);
      resetForm();
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail || 'Failed to update role');
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => rolesApi.delete(roleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setSelectedRole(null);
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      permissions: [],
      model_ids: [],
      data_source_ids: [],
    });
    setError(null);
  };

  const openEditModal = () => {
    if (roleDetail) {
      setFormData({
        name: roleDetail.name,
        description: roleDetail.description || '',
        permissions: roleDetail.permissions,
        model_ids: roleDetail.model_access.map(m => m.model_id),
        data_source_ids: roleDetail.data_source_access.map(d => d.data_source_id),
      });
      setShowEditModal(true);
    }
  };

  const togglePermission = (permission: Permission) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const toggleModel = (modelId: string) => {
    setFormData(prev => ({
      ...prev,
      model_ids: prev.model_ids.includes(modelId)
        ? prev.model_ids.filter(id => id !== modelId)
        : [...prev.model_ids, modelId],
    }));
  };

  const toggleDataSource = (dsId: string) => {
    setFormData(prev => ({
      ...prev,
      data_source_ids: prev.data_source_ids.includes(dsId)
        ? prev.data_source_ids.filter(id => id !== dsId)
        : [...prev.data_source_ids, dsId],
    }));
  };

  if (rolesLoading) {
    return (
      <Tile style={{ padding: '2rem' }}>
        <InlineLoading description="Loading roles..." />
      </Tile>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', height: '100%' }}>
      {/* Roles List */}
      <Tile style={{ width: '300px', flexShrink: 0, padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Roles</h3>
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={Add}
            iconDescription="Create role"
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
          />
        </div>

        {/* Default Role Templates */}
        {roles.length === 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
              Quick create from templates:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {DEFAULT_ROLES.map((template) => (
                <Button
                  key={template.name}
                  kind="tertiary"
                  size="sm"
                  style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => {
                    setFormData({
                      name: template.name,
                      description: template.description,
                      permissions: template.permissions,
                      model_ids: [],
                      data_source_ids: [],
                    });
                    setShowCreateModal(true);
                  }}
                >
                  <Tag type={template.color} size="sm" style={{ marginRight: '0.5rem' }}>
                    {template.name}
                  </Tag>
                </Button>
              ))}
            </div>
          </div>
        )}

        {roles.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>
            Or create a custom role with the + button above.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => setSelectedRole(role as Role)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  borderRadius: '0',
                  backgroundColor: selectedRole?.id === role.id ? 'var(--border-subtle)' : 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '0.875rem' }}>{role.name}</span>
                <Tag size="sm" type="gray">{role.user_count} users</Tag>
              </button>
            ))}
          </div>
        )}
      </Tile>

      {/* Role Detail */}
      <div style={{ flex: 1 }}>
        {selectedRole ? (
          detailLoading ? (
            <Tile style={{ padding: '2rem' }}>
              <InlineLoading description="Loading role details..." />
            </Tile>
          ) : roleDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Role Header */}
              <Tile style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '0.5rem' }}>
                      {roleDetail.name}
                    </h2>
                    {roleDetail.description && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {roleDetail.description}
                      </p>
                    )}
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                      {roleDetail.user_count} user{roleDetail.user_count !== 1 ? 's' : ''} assigned
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      kind="tertiary"
                      size="sm"
                      hasIconOnly
                      renderIcon={Edit}
                      iconDescription="Edit role"
                      onClick={openEditModal}
                    />
                    <Button
                      kind="danger--ghost"
                      size="sm"
                      hasIconOnly
                      renderIcon={TrashCan}
                      iconDescription="Delete role"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this role?')) {
                          deleteRoleMutation.mutate(roleDetail.id);
                        }
                      }}
                    />
                  </div>
                </div>
              </Tile>

              {/* Permissions Section */}
              <Tile style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Permissions</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {roleDetail.permissions.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      No permissions assigned
                    </p>
                  ) : (
                    roleDetail.permissions.map(perm => {
                      const permInfo = PERMISSIONS.find(p => p.id === perm);
                      return (
                        <Tag key={perm} type="blue" size="md">
                          {permInfo?.label || perm}
                        </Tag>
                      );
                    })
                  )}
                </div>
              </Tile>

              {/* Model Access Section */}
              <Tile style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Model Access</h3>
                {roleDetail.model_access.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    No models assigned
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {roleDetail.model_access.map(ma => (
                      <Tag key={ma.model_id} type="green" size="md">
                        {ma.model_name}
                      </Tag>
                    ))}
                  </div>
                )}
              </Tile>

              {/* Data Source Access Section */}
              <Tile style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Data Source Access</h3>
                {roleDetail.data_source_access.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    No data sources assigned
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {roleDetail.data_source_access.map(dsa => (
                      <Tag key={dsa.data_source_id} type="purple" size="md">
                        {dsa.data_source_name}
                      </Tag>
                    ))}
                  </div>
                )}
              </Tile>
            </div>
          ) : null
        ) : (
          <Tile style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Select a role to view details, or create a new role to define access permissions.
            </p>
          </Tile>
        )}
      </div>

      {/* Create/Edit Role Modal */}
      <Modal
        open={showCreateModal || showEditModal}
        onRequestClose={() => {
          setShowCreateModal(false);
          setShowEditModal(false);
          resetForm();
        }}
        onRequestSubmit={() => {
          if (showEditModal && selectedRole) {
            updateRoleMutation.mutate({ id: selectedRole.id, data: formData });
          } else {
            createRoleMutation.mutate(formData);
          }
        }}
        modalHeading={showEditModal ? 'Edit Role' : 'Create Role'}
        primaryButtonText={showEditModal ? 'Save' : 'Create'}
        primaryButtonDisabled={!formData.name || createRoleMutation.isPending || updateRoleMutation.isPending}
        secondaryButtonText="Cancel"
        size="lg"
      >
        {error && (
          <InlineNotification
            kind="error"
            title="Error"
            subtitle={error}
            lowContrast
            hideCloseButton
            style={{ marginBottom: '1rem' }}
          />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Template Selection - Only show in create mode */}
          {showCreateModal && !showEditModal && (
            <div>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Start from Template</h4>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {DEFAULT_ROLES.map((template) => (
                  <Button
                    key={template.name}
                    kind={formData.name === template.name ? 'primary' : 'tertiary'}
                    size="sm"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        name: template.name,
                        description: template.description,
                        permissions: template.permissions,
                      });
                    }}
                  >
                    {template.name}
                  </Button>
                ))}
                <Button
                  kind={!DEFAULT_ROLES.some(t => t.name === formData.name) ? 'primary' : 'tertiary'}
                  size="sm"
                  onClick={() => {
                    setFormData({
                      name: '',
                      description: '',
                      permissions: [],
                      model_ids: [],
                      data_source_ids: [],
                    });
                  }}
                >
                  Custom
                </Button>
              </div>
            </div>
          )}

          {/* Basic Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <TextInput
              id="role-name"
              labelText="Role Name"
              placeholder="e.g., Sales Rep, Analyst, Engineer"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            <TextArea
              id="role-description"
              labelText="Description (optional)"
              placeholder="Brief description of this role"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          {/* Permissions */}
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Permissions</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {PERMISSIONS.map((perm) => (
                <div
                  key={perm.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: 'var(--bg-primary)',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '0.875rem' }}>{perm.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {perm.description}
                    </div>
                  </div>
                  <Toggle
                    id={`perm-${perm.id}`}
                    size="sm"
                    toggled={formData.permissions.includes(perm.id)}
                    onToggle={() => togglePermission(perm.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Model Access */}
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Model Access</h4>
            {subscriptions.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                No active model subscriptions
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {subscriptions.map((sub: { id: string; model_id: string; model?: { name: string } }) => (
                  <div
                    key={sub.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'var(--bg-primary)',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem' }}>{sub.model?.name || 'Unknown Model'}</span>
                    <Toggle
                      id={`model-${sub.model_id}`}
                      size="sm"
                      toggled={formData.model_ids.includes(sub.model_id)}
                      onToggle={() => toggleModel(sub.model_id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Data Source Access */}
          <div>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.75rem' }}>Data Source Access</h4>
            {dataSources.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                No data sources available
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {dataSources.map((ds: { id: string; name: string }) => (
                  <div
                    key={ds.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem 0.75rem',
                      backgroundColor: 'var(--bg-primary)',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem' }}>{ds.name}</span>
                    <Toggle
                      id={`ds-${ds.id}`}
                      size="sm"
                      toggled={formData.data_source_ids.includes(ds.id)}
                      onToggle={() => toggleDataSource(ds.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
