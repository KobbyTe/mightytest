import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";

// Eager load critical routes
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy load other routes for faster initial load
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminSetup = lazy(() => import("./pages/AdminSetup"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const ExamTaking = lazy(() => import("./pages/ExamTaking"));
const ExamQuestions = lazy(() => import("./pages/ExamQuestions"));
const ExamGrading = lazy(() => import("./pages/ExamGrading"));
const ExamAnalytics = lazy(() => import("./pages/ExamAnalytics"));
const ExamReview = lazy(() => import("./pages/ExamReview"));
const NotFound = lazy(() => import("./pages/NotFound"));

// Optimized QueryClient with aggressive caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={0}>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin-setup" element={<AdminSetup />} />
              <Route path="/admin/exam/:examId/questions" element={<ExamQuestions />} />
              <Route path="/admin/exam/grade/:attemptId" element={<ExamGrading />} />
              <Route path="/admin/analytics" element={<ExamAnalytics />} />
              <Route path="/exam/take" element={<ExamTaking />} />
              <Route path="/exam/review/:attemptId" element={<ExamReview />} />
              <Route path="/parent" element={<ParentDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;