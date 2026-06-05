import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

import AdminDashboard from "@/pages/admin/Dashboard";
import ScannerPage from "@/pages/admin/Scanner";
import AttendancePage from "@/pages/admin/Attendance";
import StudentsPage from "@/pages/admin/Students";
import PaymentsPage from "@/pages/admin/Payments";
import ReportsPage from "@/pages/admin/Reports";

import StudentDashboard from "@/pages/student/Dashboard";
import StudentAttendance from "@/pages/student/Attendance";
import StudentPayments from "@/pages/student/Payments";
import StudentDownloads from "@/pages/student/Downloads";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Redirect to="/login" />;
  return <Redirect to={user.role === "admin" ? "/admin" : "/student"} />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={RootRedirect} />
      <Route path="/login" component={Login} />

      {/* Admin routes */}
      <Route path="/admin">
        <ProtectedRoute requiredRole="admin">
          <AdminDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/scanner">
        <ProtectedRoute requiredRole="admin">
          <ScannerPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/attendance">
        <ProtectedRoute requiredRole="admin">
          <AttendancePage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/students">
        <ProtectedRoute requiredRole="admin">
          <StudentsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/payments">
        <ProtectedRoute requiredRole="admin">
          <PaymentsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/admin/reports">
        <ProtectedRoute requiredRole="admin">
          <ReportsPage />
        </ProtectedRoute>
      </Route>

      {/* Student routes */}
      <Route path="/student">
        <ProtectedRoute requiredRole="student">
          <StudentDashboard />
        </ProtectedRoute>
      </Route>
      <Route path="/student/attendance">
        <ProtectedRoute requiredRole="student">
          <StudentAttendance />
        </ProtectedRoute>
      </Route>
      <Route path="/student/payments">
        <ProtectedRoute requiredRole="student">
          <StudentPayments />
        </ProtectedRoute>
      </Route>
      <Route path="/student/downloads">
        <ProtectedRoute requiredRole="student">
          <StudentDownloads />
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
