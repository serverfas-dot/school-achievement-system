import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { UserRole } from '../lib/database.types';

interface AuthContextType {
  user: User | null;
  userRole: UserRole | null;
  userRoles: UserRole[];
  userDetails: { full_name: string; email: string } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  switchRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [userDetails, setUserDetails] = useState<{ full_name: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUserRole = async (userId: string) => {
    try {
      const { data: userInfo, error: userError } = await supabase
        .from('user_roles')
        .select('full_name, email')
        .eq('id', userId)
        .maybeSingle();

      const { data: roleAssignments, error: rolesError } = await supabase
        .from('user_role_assignments')
        .select('role')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (userInfo && !userError) {
        setUserDetails({ full_name: userInfo.full_name, email: userInfo.email });
      } else {
        setUserDetails(null);
      }

      if (roleAssignments && !rolesError && roleAssignments.length > 0) {
        const roles = roleAssignments.map(r => r.role);
        setUserRoles(roles);

        const storedRole = localStorage.getItem('selectedRole') as UserRole;
        setUserRole(storedRole && roles.includes(storedRole) ? storedRole : roles[0]);
      } else {
        setUserRoles([]);
        setUserRole(null);
      }
    } catch (error) {
      console.error('Failed to load user access:', error);
      setUserDetails(null);
      setUserRoles([]);
      setUserRole(null);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const applySession = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      if (!mounted) return;

      setLoading(true);
      setUser(session?.user ?? null);
      try {
        if (session?.user) {
          await loadUserRole(session.user.id);
        } else {
          setUserRole(null);
          setUserRoles([]);
          setUserDetails(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const initialize = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        await supabase.auth.signOut({ scope: 'local' });
        await applySession(null);
        return;
      }
      await applySession(data.session);
    };

    void initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;

      window.setTimeout(() => {
        void applySession(session);
      }, 0);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured) {
      throw new Error('The sign-in service is not configured yet.');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    setLoading(true);
    setUser(null);
    setUserRole(null);
    setUserRoles([]);
    setUserDetails(null);
    localStorage.removeItem('selectedRole');

    try {
      await supabase.auth.signOut({ scope: 'local' });
    } finally {
      for (const storage of [localStorage, sessionStorage]) {
        for (const key of Object.keys(storage)) {
          if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
            storage.removeItem(key);
          }
        }
      }
      setLoading(false);
      window.location.replace(`${import.meta.env.BASE_URL}?login=true`);
    }
  };

  const switchRole = (role: UserRole) => {
    if (userRoles.includes(role)) {
      setUserRole(role);
      localStorage.setItem('selectedRole', role);
    }
  };

  return (
    <AuthContext.Provider value={{ user, userRole, userRoles, userDetails, loading, signIn, signOut, switchRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
