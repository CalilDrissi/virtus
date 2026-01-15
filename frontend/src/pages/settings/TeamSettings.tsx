import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Tile,
  Button,
  TextInput,
  TextArea,
  Modal,
  Tag,
  Dropdown,
  InlineNotification,
  InlineLoading,
} from '@carbon/react';
import { Add, TrashCan, UserFollow, Close } from '@carbon/icons-react';
import { teamsApi, usersApi } from '../../services/api';
import type { Team, TeamDetail, TeamRole } from '../../types/team';

interface OrgUser {
  id: string;
  email: string;
  full_name?: string;
}

export default function TeamSettings() {
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<TeamDetail | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [newMember, setNewMember] = useState({ email: '', role: 'member' as TeamRole, userId: '' });
  const [error, setError] = useState<string | null>(null);

  // Fetch organization users
  const { data: orgUsers = [] } = useQuery({
    queryKey: ['org-users'],
    queryFn: async () => {
      const res = await usersApi.list();
      return res.data as OrgUser[];
    },
  });

  // Fetch teams
  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const res = await teamsApi.list();
      return res.data as Team[];
    },
  });

  // Fetch team detail when selected
  const { data: teamDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['team', selectedTeam?.id],
    queryFn: async () => {
      if (!selectedTeam?.id) return null;
      const res = await teamsApi.get(selectedTeam.id);
      return res.data as TeamDetail;
    },
    enabled: !!selectedTeam?.id,
  });

  // Mutations
  const createTeamMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) => teamsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowCreateModal(false);
      setNewTeam({ name: '', description: '' });
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail || 'Failed to create team');
    },
  });

  const deleteTeamMutation = useMutation({
    mutationFn: (teamId: string) => teamsApi.delete(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setSelectedTeam(null);
    },
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: { email: string; role: string } }) =>
      teamsApi.addMember(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', selectedTeam?.id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowAddMemberModal(false);
      setNewMember({ email: '', role: 'member', userId: '' });
    },
    onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail || 'Failed to add member');
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsApi.removeMember(teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', selectedTeam?.id] });
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  if (teamsLoading) {
    return (
      <Tile style={{ padding: '2rem' }}>
        <InlineLoading description="Loading teams..." />
      </Tile>
    );
  }

  return (
    <div style={{ display: 'flex', gap: '1.5rem', height: '100%' }}>
      {/* Teams List */}
      <Tile style={{ width: '300px', flexShrink: 0, padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Teams</h3>
          <Button
            kind="ghost"
            size="sm"
            hasIconOnly
            renderIcon={Add}
            iconDescription="Create team"
            onClick={() => setShowCreateModal(true)}
          />
        </div>

        {teams.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem 0' }}>
            No teams yet. Create one to group users.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team as TeamDetail)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  borderRadius: '0',
                  backgroundColor: selectedTeam?.id === team.id ? 'var(--border-subtle)' : 'transparent',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <span style={{ fontSize: '0.875rem' }}>{team.name}</span>
                <Tag size="sm" type="gray">{team.member_count}</Tag>
              </button>
            ))}
          </div>
        )}
      </Tile>

      {/* Team Detail */}
      <div style={{ flex: 1 }}>
        {selectedTeam ? (
          detailLoading ? (
            <Tile style={{ padding: '2rem' }}>
              <InlineLoading description="Loading team details..." />
            </Tile>
          ) : teamDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Team Header */}
              <Tile style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: 400, marginBottom: '0.5rem' }}>
                      {teamDetail.name}
                    </h2>
                    {teamDetail.description && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {teamDetail.description}
                      </p>
                    )}
                  </div>
                  <Button
                    kind="danger--ghost"
                    size="sm"
                    hasIconOnly
                    renderIcon={TrashCan}
                    iconDescription="Delete team"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to delete this team?')) {
                        deleteTeamMutation.mutate(teamDetail.id);
                      }
                    }}
                  />
                </div>
              </Tile>

              {/* Members Section */}
              <Tile style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Members</h3>
                  <Button
                    kind="tertiary"
                    size="sm"
                    renderIcon={UserFollow}
                    onClick={() => setShowAddMemberModal(true)}
                  >
                    Add Member
                  </Button>
                </div>

                {teamDetail.members.length === 0 ? (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    No members yet. Add users to this team.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {teamDetail.members.map((member) => (
                      <div
                        key={member.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.75rem 1rem',
                          backgroundColor: 'var(--bg-primary)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>
                            {member.user_full_name || member.user_email}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {member.user_email}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <Tag size="sm" type={member.role === 'admin' ? 'blue' : 'gray'}>
                            {member.role}
                          </Tag>
                          <Button
                            kind="ghost"
                            size="sm"
                            hasIconOnly
                            renderIcon={Close}
                            iconDescription="Remove member"
                            onClick={() => removeMemberMutation.mutate({
                              teamId: teamDetail.id,
                              userId: member.user_id,
                            })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '1rem' }}>
                  User permissions are controlled by their assigned Role in Organization settings.
                </p>
              </Tile>
            </div>
          ) : null
        ) : (
          <Tile style={{ padding: '2rem', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Select a team to view members, or create a new team.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Teams are for organizing users. Use Roles to control permissions.
            </p>
          </Tile>
        )}
      </div>

      {/* Create Team Modal */}
      <Modal
        open={showCreateModal}
        onRequestClose={() => {
          setShowCreateModal(false);
          setNewTeam({ name: '', description: '' });
          setError(null);
        }}
        onRequestSubmit={() => createTeamMutation.mutate(newTeam)}
        modalHeading="Create Team"
        primaryButtonText="Create"
        primaryButtonDisabled={!newTeam.name || createTeamMutation.isPending}
        secondaryButtonText="Cancel"
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <TextInput
            id="team-name"
            labelText="Team Name"
            placeholder="e.g., Engineering, Sales, Support"
            value={newTeam.name}
            onChange={(e) => setNewTeam({ ...newTeam, name: e.target.value })}
          />
          <TextArea
            id="team-description"
            labelText="Description (optional)"
            placeholder="Brief description of the team's purpose"
            value={newTeam.description}
            onChange={(e) => setNewTeam({ ...newTeam, description: e.target.value })}
          />
        </div>
      </Modal>

      {/* Add Member Modal */}
      <Modal
        open={showAddMemberModal}
        onRequestClose={() => {
          setShowAddMemberModal(false);
          setNewMember({ email: '', role: 'member', userId: '' });
          setError(null);
        }}
        onRequestSubmit={() => {
          if (selectedTeam && newMember.email) {
            addMemberMutation.mutate({
              teamId: selectedTeam.id,
              data: { email: newMember.email, role: newMember.role },
            });
          }
        }}
        modalHeading="Add Team Member"
        primaryButtonText="Add"
        primaryButtonDisabled={!newMember.userId || addMemberMutation.isPending}
        secondaryButtonText="Cancel"
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingBottom: '5rem', overflow: 'visible' }}>
          <Dropdown
            id="member-user"
            titleText="Select User"
            label="Choose a user to add"
            items={orgUsers.filter(u =>
              !teamDetail?.members.some(m => m.user_id === u.id)
            )}
            selectedItem={orgUsers.find(u => u.id === newMember.userId) || null}
            itemToString={(user) => user ? `${user.full_name || user.email} (${user.email})` : ''}
            onChange={({ selectedItem }) => {
              if (selectedItem) {
                setNewMember({ ...newMember, userId: selectedItem.id, email: selectedItem.email });
              }
            }}
          />
          <Dropdown
            id="member-role"
            titleText="Team Role"
            label="Select role"
            items={['member', 'admin']}
            selectedItem={newMember.role}
            itemToString={(item) => item === 'admin' ? 'Admin (can manage team members)' : 'Member'}
            onChange={({ selectedItem }) => setNewMember({ ...newMember, role: (selectedItem || 'member') as TeamRole })}
          />
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Select an existing organization user to add to this team. To add new users to the organization, go to Organization settings.
          </p>
        </div>
      </Modal>
    </div>
  );
}
