export type Permission = 'model_access' | 'data_source_access' | 'billing_view' | 'api_key_management';

export interface RoleModelAccess {
  model_id: string;
  model_name: string;
  model_slug: string;
}

export interface RoleDataSourceAccess {
  data_source_id: string;
  data_source_name: string;
}

export interface Role {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  permissions: Permission[];
  model_access: RoleModelAccess[];
  data_source_access: RoleDataSourceAccess[];
  user_count: number;
}

export interface RoleListItem {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  permissions: Permission[];
  user_count: number;
}

export interface RoleCreate {
  name: string;
  description?: string;
  permissions: Permission[];
  model_ids: string[];
  data_source_ids: string[];
}

export interface RoleUpdate {
  name?: string;
  description?: string;
  permissions?: Permission[];
  model_ids?: string[];
  data_source_ids?: string[];
}
