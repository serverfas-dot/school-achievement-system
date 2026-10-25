import { useState, useEffect } from 'react';
import { UserPlus, Users, Trash2, LogOut, Edit2, DatabaseBackup, Download, KeyRound, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database, UserRole } from '../lib/database.types';

interface UserRoleData {
  id: string;
  email: string;
  full_name: string;
  created_at: string;
  roles: UserRole[];
}

type Backup = Pick<Database['public']['Tables']['system_backups']['Row'], 'id' | 'backup_type' | 'file_name' | 'created_at'>;

export function SuperAdminDashboard() {
  const { signOut, userDetails, user } = useAuth();
  const [users, setUsers] = useState<UserRoleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [backupSettings, setBackupSettings] = useState({ daily_enabled: true, monthly_enabled: true });
  const [backupLoading, setBackupLoading] = useState(false);
  const [credentialForm, setCredentialForm] = useState({ targetUserId: '', email: '', password: '' });
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingRoles, setEditingRoles] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    roles: ['teacher'] as UserRole[],
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const availableRoles: UserRole[] = ['super_admin', 'admin', 'teacher'];

  const loadUsers = async () => {
    const { data: usersData, error: usersError } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false });

    if (usersError || !usersData) {
      setLoading(false);
      return;
    }

    const usersWithRoles = await Promise.all(
      usersData.map(async (user) => {
        const { data: roleAssignments } = await supabase
          .from('user_role_assignments')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true);

        return {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          created_at: user.created_at,
          roles: roleAssignments?.map(r => r.role) || [],
        };
      })
    );

    setUsers(usersWithRoles);
    setLoading(false);
  };

  const loadBackups = async () => {
    const [settingsResponse, backupsResponse] = await Promise.all([
      supabase.from('backup_settings').select('daily_enabled, monthly_enabled').eq('id', 1).maybeSingle(),
      supabase.from('system_backups').select('id, backup_type, file_name, created_at').order('created_at', { ascending: false }),
    ]);

    if (settingsResponse.data) {
      setBackupSettings({
        daily_enabled: settingsResponse.data.daily_enabled,
        monthly_enabled: settingsResponse.data.monthly_enabled,
      });
    }
    if (backupsResponse.data) setBackups(backupsResponse.data);
  };

  useEffect(() => {
    void loadUsers();
    void loadBackups();
  }, []);

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const { error: functionError } = await supabase.functions.invoke('admin-user-management', {
        body: {
          action: 'update_credentials',
          targetUserId: credentialForm.targetUserId,
          email: credentialForm.email,
          password: credentialForm.password || undefined,
        },
      });

      if (functionError) throw functionError;
      setSuccess('Staff account credentials updated successfully.');
      setCredentialForm({ targetUserId: '', email: '', password: '' });
      await loadUsers();
    } catch (err) {
      console.error('Credential update failed:', err);
      setError('Could not update the staff account. Please check the details and try again.');
    }
  };

  const handleCreateBackup = async () => {
    setBackupLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data, error: backupError } = await supabase.rpc('create_system_backup', { p_backup_type: 'manual' });
      if (backupError || !data?.[0]) throw backupError || new Error('Backup could not be created');

      const backup = data[0];
      const blob = new Blob([JSON.stringify(backup.snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.file_name;
      link.click();
      URL.revokeObjectURL(url);
      setSuccess('Backup created and downloaded successfully.');
      await loadBackups();
    } catch (err) {
      console.error('Backup creation failed:', err);
      setError('Could not create the backup. Please try again.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleDownloadBackup = async (backup: Backup) => {
    try {
      const { data, error: backupError } = await supabase
        .from('system_backups')
        .select('snapshot')
        .eq('id', backup.id)
        .maybeSingle();
      if (backupError || !data) throw backupError || new Error('Backup not found');

      const blob = new Blob([JSON.stringify(data.snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = backup.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Backup download failed:', err);
      setError('Could not download that backup.');
    }
  };

  const handleRestoreBackup = async (backup: Backup) => {
    if (!confirm(`Restore ${backup.file_name}? Current student and activity data will be replaced.`)) return;

    setBackupLoading(true);
    setError('');
    setSuccess('');
    try {
      const { error: restoreError } = await supabase.rpc('restore_system_backup', { p_backup_id: backup.id });
      if (restoreError) throw restoreError;
      setSuccess('Backup restored successfully.');
    } catch (err) {
      console.error('Backup restore failed:', err);
      setError('Could not restore that backup. No changes were made if the restore failed.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleSaveBackupSettings = async (field: 'daily_enabled' | 'monthly_enabled', value: boolean) => {
    const nextSettings = { ...backupSettings, [field]: value };
    setBackupSettings(nextSettings);
    const { error: settingsError } = await supabase
      .from('backup_settings')
      .update({ ...nextSettings, updated_by: user?.id })
      .eq('id', 1);
    if (settingsError) {
      setBackupSettings(backupSettings);
      setError('Could not save backup schedule settings.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (formData.roles.length === 0) {
      setError('Please select at least one role');
      return;
    }

    try {
      const { error: functionError } = await supabase.functions.invoke('admin-user-management', {
        body: {
          action: 'create_user',
          email: formData.email,
          password: formData.password,
          fullName: formData.full_name,
          roles: formData.roles,
        },
      });

      if (functionError) throw functionError;
      setSuccess('User created successfully!');
      setFormData({ email: '', password: '', full_name: '', roles: ['teacher'] });
      setShowAddUser(false);
      await loadUsers();
    } catch (err) {
      console.error('User creation failed:', err);
      setError('Could not create the staff account. Please check the details and try again.');
    }
  };

  const handleUpdateRoles = async (userId: string) => {
    setError('');
    setSuccess('');

    if (selectedRoles.length === 0) {
      setError('User must have at least one role');
      return;
    }

    try {
      const { data: existingRoles } = await supabase
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', userId)
        .eq('is_active', true);

      const existingRoleNames = existingRoles?.map(r => r.role) || [];
      const rolesToAdd = selectedRoles.filter(r => !existingRoleNames.includes(r));
      const rolesToRemove = existingRoleNames.filter(r => !selectedRoles.includes(r));

      if (rolesToAdd.length > 0) {
        const currentUser = await supabase.auth.getUser();
        const newAssignments = rolesToAdd.map(role => ({
          user_id: userId,
          role,
          assigned_by: currentUser.data.user?.id,
        }));

        const { error: addError } = await supabase
          .from('user_role_assignments')
          .insert(newAssignments);

        if (addError) throw addError;
      }

      if (rolesToRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('user_role_assignments')
          .delete()
          .eq('user_id', userId)
          .in('role', rolesToRemove);

        if (removeError) throw removeError;
      }

      const { error: updatePrimaryError } = await supabase
        .from('user_roles')
        .update({ role: selectedRoles[0] })
        .eq('id', userId);

      if (updatePrimaryError) throw updatePrimaryError;

      setSuccess('User roles updated successfully!');
      setEditingRoles(null);
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to update roles');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      setSuccess('User deleted successfully!');
      loadUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to delete user');
    }
  };

  const toggleFormRole = (role: UserRole) => {
    setFormData(prev => ({
      ...prev,
      roles: prev.roles.includes(role)
        ? prev.roles.filter(r => r !== role)
        : [...prev.roles, role]
    }));
  };

  const toggleSelectedRole = (role: UserRole) => {
    setSelectedRoles(prev =>
      prev.includes(role)
        ? prev.filter(r => r !== role)
        : [...prev, role]
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <img
                src={`${import.meta.env.BASE_URL}png.png`}
                alt="Faafu Atoll School logo"
                className="w-12 h-12 object-contain"
              />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Super Admin Dashboard</h1>
                <p className="text-sm text-gray-600">{userDetails?.full_name}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(error || success) && (
          <div className={`mb-6 px-4 py-3 rounded-lg ${error ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
            {error || success}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">User Management</h2>
            </div>
            <button
              onClick={() => setShowAddUser(!showAddUser)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <UserPlus className="w-5 h-5" />
              <span>Add User</span>
            </button>
          </div>

          {showAddUser && (
            <form onSubmit={handleCreateUser} className="mb-6 p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Roles (Select Multiple)
                  </label>
                  <div className="space-y-2">
                    {availableRoles.map(role => (
                      <label key={role} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={formData.roles.includes(role)}
                          onChange={() => toggleFormRole(role)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">
                          {role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Roles</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Created</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{user.full_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      {editingRoles === user.id ? (
                        <div className="space-y-1">
                          {availableRoles.map(role => (
                            <label key={role} className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={selectedRoles.includes(role)}
                                onChange={() => toggleSelectedRole(role)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-xs text-gray-700">
                                {role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
                              </span>
                            </label>
                          ))}
                          <div className="flex space-x-2 mt-2">
                            <button
                              onClick={() => handleUpdateRoles(user.id)}
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingRoles(null)}
                              className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map(role => (
                            <span
                              key={role}
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                role === 'super_admin' ? 'bg-red-100 text-red-700' :
                                role === 'admin' ? 'bg-blue-100 text-blue-700' :
                                'bg-green-100 text-green-700'
                              }`}
                            >
                              {role.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end space-x-2">
                        {editingRoles !== user.id && (
                          <button
                            onClick={() => {
                              setEditingRoles(user.id);
                              setSelectedRoles(user.roles);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            title="Edit Roles"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <KeyRound className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Staff Account Access</h2>
                <p className="text-sm text-gray-600">Change an admin or teacher email and password.</p>
              </div>
            </div>
          </div>
          <form onSubmit={handleUpdateCredentials} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Staff account</label>
              <select
                value={credentialForm.targetUserId}
                onChange={(e) => {
                  const selectedUser = users.find((item) => item.id === e.target.value);
                  setCredentialForm({ targetUserId: e.target.value, email: selectedUser?.email || '', password: '' });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              >
                <option value="">Select account</option>
                {users.filter((item) => item.roles.some((role) => role === 'admin' || role === 'teacher')).map((item) => (
                  <option key={item.id} value={item.id}>{item.full_name} ({item.email})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email / username</label>
              <input
                type="email"
                value={credentialForm.email}
                onChange={(e) => setCredentialForm({ ...credentialForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={credentialForm.password}
                onChange={(e) => setCredentialForm({ ...credentialForm, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                minLength={8}
                placeholder="Leave blank to keep current"
              />
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              Save Access
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center space-x-3">
              <DatabaseBackup className="w-6 h-6 text-blue-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Backup and Restore</h2>
                <p className="text-sm text-gray-600">Protect student and activity records with downloadable snapshots.</p>
              </div>
            </div>
            <button onClick={handleCreateBackup} disabled={backupLoading} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              <DatabaseBackup className="w-4 h-4" />
              <span>{backupLoading ? 'Working...' : 'Create Backup Now'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <label className="flex items-center justify-between border rounded-lg p-4">
              <span><span className="block font-medium text-gray-900">Daily automatic backup</span><span className="text-sm text-gray-500">Runs every day at 02:00 UTC</span></span>
              <input type="checkbox" checked={backupSettings.daily_enabled} onChange={(e) => handleSaveBackupSettings('daily_enabled', e.target.checked)} className="w-5 h-5" />
            </label>
            <label className="flex items-center justify-between border rounded-lg p-4">
              <span><span className="block font-medium text-gray-900">Monthly automatic backup</span><span className="text-sm text-gray-500">Runs on the first day at 03:00 UTC</span></span>
              <input type="checkbox" checked={backupSettings.monthly_enabled} onChange={(e) => handleSaveBackupSettings('monthly_enabled', e.target.checked)} className="w-5 h-5" />
            </label>
          </div>

          {backups.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No backups have been created yet.</p>
          ) : (
            <div className="space-y-2">
              {backups.map((backup) => (
                <div key={backup.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border rounded-lg p-4">
                  <div>
                    <p className="font-medium text-gray-900">{backup.file_name}</p>
                    <p className="text-sm text-gray-500">{backup.backup_type} · {new Date(backup.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleDownloadBackup(backup)} className="flex items-center gap-2 px-3 py-2 text-sm text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100"><Download className="w-4 h-4" />Download</button>
                    <button onClick={() => handleRestoreBackup(backup)} disabled={backupLoading} className="flex items-center gap-2 px-3 py-2 text-sm text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 disabled:opacity-50"><RefreshCw className="w-4 h-4" />Restore</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
