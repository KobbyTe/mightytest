import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: 'student' | 'parent' | 'admin' | null;
  profile: any;
  preferences: any;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Cache for user data to avoid refetching on navigation
const userDataCache = new Map<string, { role: string; profile: any; preferences: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'student' | 'parent' | 'admin' | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (userId: string) => {
    // Check cache first
    const cached = userDataCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setRole(cached.role as any);
      setProfile(cached.profile);
      setPreferences(cached.preferences);
      setLoading(false);
      return;
    }

    try {
      // Optimized parallel queries with minimal field selection
      const [roleRes, studentRes, parentRes, prefsRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        supabase.from('students').select('id,user_id,full_name,email,grade,school_name,parent_id,class_id').eq('user_id', userId).maybeSingle(),
        supabase.from('parents').select('id,user_id,full_name,email,access_code').eq('user_id', userId).maybeSingle(),
        supabase.from('user_preferences').select('theme,language,notifications_enabled').eq('user_id', userId).maybeSingle()
      ]);

      const userRole = roleRes.data?.role as 'student' | 'parent' | 'admin' | null;
      let userProfile = null;

      if (userRole === 'student' && studentRes.data) {
        userProfile = studentRes.data;
      } else if (userRole === 'parent' && parentRes.data) {
        userProfile = parentRes.data;
      }

      // Update cache
      userDataCache.set(userId, {
        role: userRole || '',
        profile: userProfile,
        preferences: prefsRes.data,
        timestamp: Date.now()
      });

      setRole(userRole);
      setProfile(userProfile);
      setPreferences(prefsRes.data);
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const clearUserState = useCallback(() => {
    setRole(null);
    setProfile(null);
    setPreferences(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    // Get initial session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        clearUserState();
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserData, clearUserState]);

  const signOut = useCallback(async () => {
    // Clear cache on sign out
    if (user?.id) {
      userDataCache.delete(user.id);
    }
    await supabase.auth.signOut();
    clearUserState();
  }, [user?.id, clearUserState]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    session,
    role,
    profile,
    preferences,
    loading,
    signOut
  }), [user, session, role, profile, preferences, loading, signOut]);

  return (
    <AuthContext.Provider value={value}>
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