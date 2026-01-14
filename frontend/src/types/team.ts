export type TeamRole = 'admin' | 'member';

export type TeamPermission = 'model_access' | 'data_source_access' | 'billing_view' | 'api_key_management';

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  member_count: number;
  permissions: TeamPermission[];
}

export interface TeamMember {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  invited_by: string | null;
  joined_at: string;
  user_email: string;
  user_full_name: string | null;
}

export interface TeamModelAccess {
  id: string;
  team_id: string;
  model_id: string;
  model_name: string;
  model_slug: string;
  granted_at: string;
}

export interface TeamDataSourceAccess {
  id: string;
  team_id: string;
  data_source_id: string;
  data_source_name: string;
  granted_at: string;
}

export interface TeamDetail extends Team {
  members: TeamMember[];
  model_access: TeamModelAccess[];
  data_source_access: TeamDataSourceAccess[];
}

export interface TeamCreate {
  name: string;
  description?: string;
}

export interface TeamUpdate {
  name?: string;
  description?: string;
}

export interface TeamMemberAdd {
  email: string;
  role: TeamRole;
}

export interface TeamMemberUpdate {
  role: TeamRole;
}

export interface TeamPermissionsUpdate {
  permissions: TeamPermission[];
}

export interface TeamModelAccessUpdate {
  model_ids: string[];
}

export interface TeamDataSourceAccessUpdate {
  data_source_ids: string[];
}
