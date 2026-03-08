import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: ('student' | 'parent' | 'admin' | 'teacher')[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 rounded-full animate-spin border-t-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Block pending/rejected teachers
  if (role === 'teacher' && profile?.status && profile.status !== 'approved') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-8">
        <div className="max-w-md text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            {profile.status === 'pending' ? '⏳' : '❌'}
          </div>
          <h2 className="text-2xl font-bold">
            {profile.status === 'pending' ? 'Account Pending Approval' : 'Account Not Approved'}
          </h2>
          <p className="text-muted-foreground">
            {profile.status === 'pending'
              ? 'Your teacher account is awaiting admin approval. You will be notified once your account is approved.'
              : 'Your teacher account registration was not approved. Please contact the administrator for more information.'}
          </p>
        </div>
      </div>
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    const roleRoutes: Record<string, string> = {
      student: '/dashboard',
      parent: '/parent',
      admin: '/admin',
      teacher: '/teacher',
    };
    return <Navigate to={roleRoutes[role] || '/auth'} replace />;
  }

  return <>{children}</>;
}
