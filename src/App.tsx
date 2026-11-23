import React, { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuthStore } from './stores/useAuthStore';
import { useDataStore } from './stores/useDataStore';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ToastContainer } from './components/common/UIPrimitives';
import { AppLayout } from './components/layout/AppLayout';
import {
  LoginPage,
  RegisterPage,
  ForgotPasswordPage,
} from './pages/auth/AuthPages';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { WorkspacesPage } from './pages/workspace/WorkspacesPage';
import { WorkspaceDetailPage } from './pages/workspace/WorkspaceDetailPage';
import { BoardsPage } from './pages/board/BoardsPage';
import { BoardDetailPage } from './pages/board/BoardDetailPage';
import { MyTasksPage } from './pages/task/MyTasksPage';
import { CalendarPage } from './pages/calendar/CalendarPage';
import { NotificationsPage } from './pages/notifications/NotificationsPage';
import { SettingsPage } from './pages/settings/SettingsPage';
import { ProfilePage } from './pages/settings/ProfilePage';

interface RouteGuardProps {
  children: ReactNode;
}

function ProtectedRoute({ children }: RouteGuardProps) {
  const { user, authReady } = useAuthStore();
  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F8FC] dark:bg-[#0D0E14]">
        <div className="flex items-center gap-3 text-sm text-[#6B7085] dark:text-[#9EA3B8]">
          <span className="w-5 h-5 rounded-full border-2 border-[#635BFF] border-t-transparent animate-spin" />
          <span>Loading TaskFlow...</span>
        </div>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PublicOnlyRoute({ children }: RouteGuardProps) {
  const { user, authReady } = useAuthStore();
  if (!authReady) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const { initAuth, user, authReady, isGuestMode } = useAuthStore();
  const { startSync, resetData } = useDataStore();

  useEffect(() => {
    const unsub = initAuth();
    return () => {
      if (unsub) unsub();
    };
  }, [initAuth]);

  useEffect(() => {
    if (!authReady) return;
    if (user) {
      startSync();
    } else {
      resetData();
    }
  }, [authReady, user?.uid, isGuestMode, startSync, resetData]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/workspaces" element={<WorkspacesPage />} />
            <Route path="/workspace/:id" element={<WorkspaceDetailPage />} />
            <Route path="/boards" element={<BoardsPage />} />
            <Route path="/board/:id" element={<BoardDetailPage />} />
            <Route path="/my-tasks" element={<MyTasksPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <ToastContainer />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
