import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useMemo, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type UserRole = 'student' | 'parent' | 'admin' | 'teacher' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole;
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
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Track whether initial session has been resolved
  const initializedRef = useRef(false);
  // Track the current user ID being loaded to avoid stale updates
  const loadingUserIdRef = useRef<string | null>(null);

  const loadUserData = useCallback(async (userId: string, isInitialLoad: boolean) => {
    // Only set loading=true on initial load, NOT on token refreshes
    // This prevents ProtectedRoute from flashing the spinner mid-session
    if (isInitialLoad) {
      setLoading(true);
    }
    
    loadingUserIdRef.current = userId;

    // Check cache first
    const cached = userDataCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setRole(cached.role as any);
      setProfile(cached.profile);
      setPreferences(cached.preferences);
      if (isInitialLoad) setLoading(false);
      return;
    }

    try {
      const [roleRes, studentRes, parentRes, teacherRes, prefsRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
        supabase.from('students').select('id,user_id,full_name,email,grade,school_name,parent_id,class_id,student_id_code').eq('user_id', userId).maybeSingle(),
        supabase.from('parents').select('id,user_id,full_name,email,access_code').eq('user_id', userId).maybeSingle(),
        supabase.from('teachers').select('id,user_id,full_name,email,status,subject_specialty,school_id').eq('user_id', userId).maybeSingle(),
        supabase.from('user_preferences').select('theme,language,notifications_enabled').eq('user_id', userId).maybeSingle()
      ]);

      // Bail if user changed while we were loading
      if (loadingUserIdRef.current !== userId) return;

      const userRole = roleRes.data?.role as UserRole;
      let userProfile = null;

      if (userRole === 'student' && studentRes.data) {
        userProfile = studentRes.data;
      } else if (userRole === 'parent' && parentRes.data) {
        userProfile = parentRes.data;
      } else if (userRole === 'teacher' && teacherRes.data) {
        userProfile = teacherRes.data;
      }

      userDataCache.set(userId, {
        role: userRole || '',
        profile: userProfile,
        preferences: prefsRes.data,
        timestamp: Date.now()
      });

      // Final check that user hasn't changed
      if (loadingUserIdRef.current === userId) {
        setRole(userRole);
        setProfile(userProfile);
        setPreferences(prefsRes.data);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      if (loadingUserIdRef.current === userId || isInitialLoad) {
        setLoading(false);
      }
    }
  }, []);

  const clearUserState = useCallback(() => {
    loadingUserIdRef.current = null;
    setRole(null);
    setProfile(null);
    setPreferences(null);
  }, []);

  useEffect(() => {
    let mounted = true;

    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      // Handle sign out
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        clearUserState();
        setLoading(false);
        initializedRef.current = true;
        return;
      }

      // For TOKEN_REFRESHED, only act if we actually have a valid session
      // Don't treat a missing session during refresh as a sign-out
      if (event === 'TOKEN_REFRESHED') {
        if (newSession?.user) {
          setSession(newSession);
          setUser(newSession.user);
          // Silently refresh user data without setting loading=true
          loadUserData(newSession.user.id, false);
        }
        // If no session on TOKEN_REFRESHED, just ignore — Supabase will
        // fire SIGNED_OUT separately if the refresh truly failed
        return;
      }

      // For SIGNED_IN and INITIAL_SESSION events
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (newSession?.user) {
        const isInitial = !initializedRef.current;
        initializedRef.current = true;
        loadUserData(newSession.user.id, isInitial);
      } else {
        clearUserState();
        setLoading(false);
        initializedRef.current = true;
      }
    });

    // Get initial session as a fallback
    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!mounted) return;

      if (error) {
        console.warn('Session retrieval error:', error.message);
        if (error.message?.includes('refresh_token') ||
            error.message?.includes('Refresh Token Not Found') ||
            error.message?.includes('Invalid Refresh Token')) {
          supabase.auth.signOut().catch(() => {});
        }
        if (!initializedRef.current) {
          initializedRef.current = true;
          setLoading(false);
        }
        return;
      }

      // Only use getSession result if onAuthStateChange hasn't fired yet
      if (!initializedRef.current) {
        initializedRef.current = true;
        setSession(initialSession);
        setUser(initialSession?.user ?? null);

        if (initialSession?.user) {
          loadUserData(initialSession.user.id, true);
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
    if (user?.id) {
      userDataCache.delete(user.id);
    }
    await supabase.auth.signOut();
    clearUserState();
  }, [user?.id, clearUserState]);

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
