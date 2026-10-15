import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { PublicDashboard } from './components/PublicDashboard';
import type { UserRole } from './lib/database.types';

function AppContent() {
  const { user, userRole, userRoles, loading, switchRole, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const showLogin = new URLSearchParams(window.location.search).get('login') === 'true';

    if (showLogin) {
      return <Login />;
    }

    return <PublicDashboard />;
  }

  const renderRoleSwitcher = () => {
    if (userRoles.length <= 1) return null;

    return (
      <div className="fixed top-4 right-4 z-50">
        <div className="bg-white rounded-lg shadow-lg p-3 border border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Switch Role
          </label>
          <select
            value={userRole || ''}
            onChange={(e) => switchRole(e.target.value as UserRole)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {userRoles.map(role => (
              <option key={role} value={role}>
                {role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };

  if (user && (!userRole || userRoles.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No roles assigned. Please contact administrator.</p>
          <button
            onClick={signOut}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  switch (userRole) {
    case 'super_admin':
      return (
        <>
          {renderRoleSwitcher()}
          <SuperAdminDashboard />
        </>
      );
    case 'admin':
      return (
        <>
          {renderRoleSwitcher()}
          <AdminDashboard />
        </>
      );
    case 'teacher':
      return (
        <>
          {renderRoleSwitcher()}
          <TeacherDashboard />
        </>
      );
    default:
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-gray-600">Invalid user role. Please contact administrator.</p>
          </div>
        </div>
      );
  }
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
