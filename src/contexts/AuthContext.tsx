import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Storage key for Supabase auth - must match the project ID
const SUPABASE_AUTH_KEY = 'sb-kzxqhtdxjyuktrghzmsp-auth-token';

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

// Helper function to clear stale auth data
const clearStaleAuthData = () => {
  try {
    localStorage.removeItem(SUPABASE_AUTH_KEY);
    sessionStorage.removeItem(SUPABASE_AUTH_KEY);
  } catch (e) {
    console.warn('Failed to clear auth storage:', e);
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'student' | 'parent' | 'admin' | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (userId: string) => {
    // Signal that we're loading user data (prevents premature redirects)
    setLoading(true);
    
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
        supabase.from('students').select('id,user_id,full_name,email,grade,school_name,parent_id,class_id,student_id_code').eq('user_id', userId).maybeSingle(),
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
    let initialSessionHandled = false;

    // IMPORTANT: Set up auth listener FIRST to catch all auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      // Handle token refresh failures - clear stale session data
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.warn('Token refresh failed, clearing stale session data');
        clearStaleAuthData();
        setUser(null);
        setSession(null);
        clearUserState();
        setLoading(false);
        return;
      }
      
      // Handle sign out event
      if (event === 'SIGNED_OUT') {
        clearStaleAuthData();
        setUser(null);
        setSession(null);
        clearUserState();
        setLoading(false);
        return;
      }
      
      initialSessionHandled = true;
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        loadUserData(session.user.id);
      } else {
        clearUserState();
        setLoading(false);
      }
    });

    // THEN get initial session (listener above will handle it, but this ensures we don't miss it)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      
      // Handle refresh token errors during initial session retrieval
      if (error) {
        console.warn('Session retrieval error:', error.message);
        // Check for specific refresh token errors
        if (error.message?.includes('refresh_token') || 
            error.message?.includes('Refresh Token Not Found') ||
            error.message?.includes('Invalid Refresh Token')) {
          console.warn('Clearing stale session due to refresh token error');
          clearStaleAuthData();
          supabase.auth.signOut().catch(() => {}); // Best effort sign out
        }
        setLoading(false);
        return;
      }
      
      // Only handle if the auth state change hasn't already fired
      if (!initialSessionHandled) {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          loadUserData(session.user.id);
        } else {
          setLoading(false);
        }
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
    clearStaleAuthData();
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