import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { usePageTracking } from "@/hooks/usePageTracking";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Eager load critical routes
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy load other routes for faster initial load
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const NewAdminDashboard = lazy(() => import("./pages/NewAdminDashboard"));
const AdminSetup = lazy(() => import("./pages/AdminSetup"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const ExamTaking = lazy(() => import("./pages/ExamTaking"));
const ExamQuestions = lazy(() => import("./pages/ExamQuestions"));
const ExamGrading = lazy(() => import("./pages/ExamGrading"));
const ExamAnalytics = lazy(() => import("./pages/ExamAnalytics"));
const ExamReview = lazy(() => import("./pages/ExamReview"));
const NotFound = lazy(() => import("./pages/NotFound"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const FAQ = lazy(() => import("./pages/FAQ"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));

// Optimized QueryClient with aggressive caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Minimal loading fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="w-8 h-8 border-4 border-primary/30 rounded-full animate-spin border-t-primary" />
  </div>
);

// Inner component to use hooks inside BrowserRouter
function AppRoutes() {
  usePageTracking();
  
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['student']}><Dashboard /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']}><NewAdminDashboard /></ProtectedRoute>} />
        <Route path="/admin-setup" element={<ProtectedRoute allowedRoles={['admin']}><AdminSetup /></ProtectedRoute>} />
        <Route path="/admin/exam/:examId/questions" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ExamQuestions /></ProtectedRoute>} />
        <Route path="/admin/exam/grade/:attemptId" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ExamGrading /></ProtectedRoute>} />
        <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin', 'teacher']}><ExamAnalytics /></ProtectedRoute>} />
        <Route path="/teacher" element={<ProtectedRoute allowedRoles={['teacher']}><AdminDashboard /></ProtectedRoute>} />
        <Route path="/exam/take" element={<ProtectedRoute allowedRoles={['student']}><ExamTaking /></ProtectedRoute>} />
        <Route path="/exam/review/:attemptId" element={<ProtectedRoute allowedRoles={['student']}><ExamReview /></ProtectedRoute>} />
        <Route path="/parent" element={<ProtectedRoute allowedRoles={['parent']}><ParentDashboard /></ProtectedRoute>} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
