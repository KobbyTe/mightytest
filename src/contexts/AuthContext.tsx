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

const userDataCache = new Map<string, { role: string; profile: any; preferences: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole>(null);
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadingUserIdRef = useRef<string | null>(null);

  const loadUserData = useCallback(async (userId: string, isInitialLoad: boolean) => {
    if (isInitialLoad) {
      setLoading(true);
    }

    loadingUserIdRef.current = userId;

    const cached = userDataCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setRole(cached.role as UserRole);
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
        supabase.from('user_preferences').select('theme,language,notifications_enabled').eq('user_id', userId).maybeSingle(),
      ]);

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
        timestamp: Date.now(),
      });

      if (loadingUserIdRef.current === userId) {
        setRole(userRole);
        setProfile(userProfile);
        setPreferences(prefsRes.data);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      if (loadingUserIdRef.current === userId) {
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

  const applyAuthenticatedSession = useCallback((nextSession: Session, isInitialLoad: boolean) => {
    setSession(nextSession);
    setUser(nextSession.user);
    loadUserData(nextSession.user.id, isInitialLoad);
  }, [loadUserData]);

  const applySignedOutState = useCallback(() => {
    setSession(null);
    setUser(null);
    clearUserState();
    setLoading(false);
  }, [clearUserState]);

  useEffect(() => {
    let mounted = true;
    let initialSessionPending = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT') {
        initialSessionPending = false;
        applySignedOutState();
        return;
      }

      if (event === 'INITIAL_SESSION') {
        if (nextSession?.user && initialSessionPending) {
          initialSessionPending = false;
          applyAuthenticatedSession(nextSession, true);
        }
        return;
      }

      if (!nextSession?.user) {
        return;
      }

      const isFirstResolvedSession = initialSessionPending;
      initialSessionPending = false;
      applyAuthenticatedSession(nextSession, isFirstResolvedSession);
    });

    supabase.auth.getSession().then(({ data: { session: initialSession }, error }) => {
      if (!mounted || !initialSessionPending) return;

      initialSessionPending = false;

      if (error) {
        console.warn('Session retrieval error:', error.message);
        applySignedOutState();
        return;
      }

      if (initialSession?.user) {
        applyAuthenticatedSession(initialSession, true);
      } else {
        applySignedOutState();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [applyAuthenticatedSession, applySignedOutState]);

  const signOut = useCallback(async () => {
    if (user?.id) {
      userDataCache.delete(user.id);
    }
    await supabase.auth.signOut();
    applySignedOutState();
  }, [user?.id, applySignedOutState]);

  const value = useMemo(() => ({
    user,
    session,
    role,
    profile,
    preferences,
    loading,
    signOut,
  }), [user, session, role, profile, preferences, loading, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
