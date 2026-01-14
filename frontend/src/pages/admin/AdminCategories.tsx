import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  Button,
  TextInput,
  TextArea,
  Tag,
  Modal,
  Loading,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  NumberInput,
  Toggle,
} from '@carbon/react';
import { Add, Edit, TrashCan } from '@carbon/icons-react';
import { categoriesApi } from '../../services/api';

interface Category {
  id: string;
  slug: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

const colorOptions = [
  { id: 'blue', name: 'Blue' },
  { id: 'green', name: 'Green' },
  { id: 'purple', name: 'Purple' },
  { id: 'magenta', name: 'Magenta' },
  { id: 'cyan', name: 'Cyan' },
  { id: 'teal', name: 'Teal' },
  { id: 'red', name: 'Red' },
  { id: 'gray', name: 'Gray' },
];

const defaultCategory = {
  slug: '',
  name: '',
  description: '',
  icon: '',
  color: 'blue',
  sort_order: 0,
};

export default function AdminCategories() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState(defaultCategory);
  const [deleteConfirm, setDeleteConfirm] = useState<Category | null>(null);

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['admin-categories'],
    queryFn: () => categoriesApi.list({ active_only: false }).then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => categoriesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCreateOpen(false);
      setFormData(defaultCategory);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<typeof formData> & { is_active?: boolean } }) =>
      categoriesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingCategory(null);
      setIsCreateOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeleteConfirm(null);
    },
  });

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      slug: category.slug,
      name: category.name,
      description: category.description || '',
      icon: category.icon || '',
      color: category.color || 'blue',
      sort_order: category.sort_order,
    });
    setIsCreateOpen(true);
  };

  const handleSubmit = () => {
    if (editingCategory) {
      updateMutation.mutate({ id: editingCategory.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleClose = () => {
    setIsCreateOpen(false);
    setEditingCategory(null);
    setFormData(defaultCategory);
  };

  const handleToggleActive = (category: Category) => {
    updateMutation.mutate({
      id: category.id,
      data: { is_active: !category.is_active },
    });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
        <Loading description="Loading categories..." withOverlay={false} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '0.5rem' }}>Model Categories</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage categories for organizing AI models</p>
        </div>
        <Button kind="primary" renderIcon={Add} onClick={() => setIsCreateOpen(true)}>
          Add Category
        </Button>
      </div>

      <Tile style={{ padding: '1.5rem' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Order</TableHeader>
              <TableHeader>Name</TableHeader>
              <TableHeader>Slug</TableHeader>
              <TableHeader>Description</TableHeader>
              <TableHeader>Color</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories?.map(category => (
              <TableRow key={category.id}>
                <TableCell>{category.sort_order}</TableCell>
                <TableCell>
                  <div style={{ fontWeight: 600 }}>{category.name}</div>
                </TableCell>
                <TableCell>
                  <code style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                    {category.slug}
                  </code>
                </TableCell>
                <TableCell>
                  <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {category.description || '-'}
                  </div>
                </TableCell>
                <TableCell>
                  <Tag type={category.color as any || 'gray'}>{category.color || 'gray'}</Tag>
                </TableCell>
                <TableCell>
                  <Tag type={category.is_active ? 'green' : 'red'}>
                    {category.is_active ? 'Active' : 'Inactive'}
                  </Tag>
                </TableCell>
                <TableCell>
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={Edit}
                    hasIconOnly
                    iconDescription="Edit"
                    onClick={() => handleEdit(category)}
                  />
                  <Button
                    kind="ghost"
                    size="sm"
                    renderIcon={TrashCan}
                    hasIconOnly
                    iconDescription="Delete"
                    onClick={() => setDeleteConfirm(category)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {categories?.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
            No categories found. Add your first category to get started.
          </p>
        )}
      </Tile>

      {/* Create/Edit Modal */}
      <Modal
        open={isCreateOpen}
        onRequestClose={handleClose}
        onRequestSubmit={handleSubmit}
        modalHeading={editingCategory ? 'Edit Category' : 'Add New Category'}
        primaryButtonText={editingCategory ? 'Save Changes' : 'Create Category'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={!formData.name || !formData.slug || createMutation.isPending || updateMutation.isPending}
        size="sm"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
          <TextInput
            id="name"
            labelText="Display Name"
            placeholder="e.g., Customer Support"
            value={formData.name}
            onChange={(e) => {
              const name = e.target.value;
              setFormData({
                ...formData,
                name,
                // Auto-generate slug from name if creating new
                slug: editingCategory ? formData.slug : name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
              });
            }}
          />

          <TextInput
            id="slug"
            labelText="Slug (URL-friendly identifier)"
            placeholder="e.g., customer_support"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
            helperText="Used in URLs and API. Only lowercase letters, numbers, and underscores."
          />

          <TextArea
            id="description"
            labelText="Description"
            placeholder="Brief description of this category"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextInput
              id="icon"
              labelText="Icon (optional)"
              placeholder="e.g., Chat, Bot, Document"
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              helperText="Carbon icon name"
            />
            <div>
              <label className="cds--label" style={{ marginBottom: '0.5rem', display: 'block' }}>Color</label>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {colorOptions.map(color => (
                  <Tag
                    key={color.id}
                    type={color.id as any}
                    onClick={() => setFormData({ ...formData, color: color.id })}
                    style={{
                      cursor: 'pointer',
                      outline: formData.color === color.id ? '2px solid var(--brand-primary)' : 'none',
                      outlineOffset: '2px',
                    }}
                  >
                    {color.name}
                  </Tag>
                ))}
              </div>
            </div>
          </div>

          <NumberInput
            id="sort_order"
            label="Sort Order"
            helperText="Lower numbers appear first"
            value={formData.sort_order}
            onChange={(_e, { value }) => setFormData({ ...formData, sort_order: Number(value) })}
            min={0}
            max={100}
          />

          {editingCategory && (
            <Toggle
              id="is_active"
              labelText="Active"
              toggled={editingCategory.is_active}
              onToggle={() => handleToggleActive(editingCategory)}
            />
          )}
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteConfirm}
        onRequestClose={() => setDeleteConfirm(null)}
        onRequestSubmit={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
        modalHeading="Delete Category"
        primaryButtonText={deleteMutation.isPending ? 'Deleting...' : 'Delete'}
        secondaryButtonText="Cancel"
        danger
        size="sm"
        primaryButtonDisabled={deleteMutation.isPending}
      >
        <p style={{ marginTop: '1rem' }}>
          Are you sure you want to delete the category <strong>{deleteConfirm?.name}</strong>?
        </p>
        <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          This category cannot be deleted if it is being used by any AI models.
        </p>
      </Modal>
    </div>
  );
}
