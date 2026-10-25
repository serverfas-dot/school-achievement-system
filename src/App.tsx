import { useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';
import { PublicDashboard } from './components/PublicDashboard';

function AppContent() {
  const { user, userRole, userRoles, loading, switchRole, signOut } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const showLogin = new URLSearchParams(window.location.search).get('login') === 'true';

  if (loading) {
    return <PublicDashboard />;
  }

  if (!user) {
    if (showLogin) {
      return <Login />;
    }

    return <PublicDashboard />;
  }

  const renderRoleSwitcher = () => {
    return (
      <div className="absolute top-2 right-4 z-[9999]" style={{ insetBlockStart: 'max(8px, env(safe-area-inset-top))', insetInlineEnd: 'max(16px, env(safe-area-inset-right))' }}>
        <button
          type="button"
          aria-expanded={roleMenuOpen}
          onClick={() => setRoleMenuOpen(open => !open)}
          className="flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-blue-400 hover:text-blue-700"
        >
          {userRole === 'super_admin' ? 'Super Admin' : userRole ? userRole.charAt(0).toUpperCase() + userRole.slice(1) : 'Account'}
          <ChevronDown className={`h-4 w-4 transition-transform ${roleMenuOpen ? 'rotate-180' : ''}`} />
        </button>
        {roleMenuOpen && (
          <div className="absolute right-0 mt-2 min-w-40 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
            {userRoles.map(role => (
              <button
                key={role}
                type="button"
                onClick={() => { switchRole(role); setRoleMenuOpen(false); }}
                className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-blue-50 ${role === userRole ? 'font-semibold text-blue-700' : 'text-gray-700'}`}
              >
                {role === 'super_admin' ? 'Super Admin' : role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
            <div className="my-1 border-t border-gray-100" />
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
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
  const showLogin = new URLSearchParams(window.location.search).get('login') === 'true';

  return (
    <AuthProvider>
      {showLogin ? <Login /> : <AppContent />}
    </AuthProvider>
  );
}

export default App;
