import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import AppShell from '@/components/layout/AppShell';

// Lazy-loaded pages
const LandingPage = lazy(() => import('@/pages/Landing/LandingPage'));
const LoginPage = lazy(() => import('@/pages/Auth/LoginPage'));
const SignupPage = lazy(() => import('@/pages/Auth/SignupPage'));
const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'));
const ExtractionPage = lazy(() => import('@/pages/Extraction/ExtractionPage'));
const AgentNetworkPage = lazy(() => import('@/pages/Agents/AgentNetworkPage'));
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'));
const DatasetExplorerPage = lazy(() => import('@/pages/DatasetExplorer/DatasetExplorerPage'));
const HistoryPage = lazy(() => import('@/pages/History/HistoryPage'));
const NotificationsPage = lazy(() => import('@/pages/Notifications/NotificationsPage'));
const CopilotPage = lazy(() => import('@/pages/Copilot/CopilotPage'));

// Placeholder for future pages
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
        <span className="text-2xl">🚧</span>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
      <p className="text-text-secondary">Coming in the next phase</p>
    </div>
  );
}

// Loading spinner
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-[3px] border-accent/20 border-t-accent rounded-full animate-spin" />
        <p className="text-sm text-text-secondary animate-pulse">Loading...</p>
      </div>
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Public route wrapper (redirect to dashboard if already authenticated)
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

const router = createBrowserRouter([
  // Public routes
  {
    path: '/',
    element: (
      <PublicRoute>
        <Suspense fallback={<PageLoader />}>
          <LandingPage />
        </Suspense>
      </PublicRoute>
    ),
  },
  {
    path: '/login',
    element: (
      <PublicRoute>
        <Suspense fallback={<PageLoader />}>
          <LoginPage />
        </Suspense>
      </PublicRoute>
    ),
  },
  {
    path: '/signup',
    element: (
      <PublicRoute>
        <Suspense fallback={<PageLoader />}>
          <SignupPage />
        </Suspense>
      </PublicRoute>
    ),
  },

  // Protected routes (wrapped in AppShell)
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      {
        path: 'dashboard',
        element: (
          <Suspense fallback={<PageLoader />}>
            <DashboardPage />
          </Suspense>
        ),
      },
      {
        path: 'extraction',
        element: (
          <Suspense fallback={<PageLoader />}>
            <ExtractionPage />
          </Suspense>
        ),
      },
      {
        path: 'datasets',
        element: (
          <Suspense fallback={<PageLoader />}>
            <DatasetExplorerPage />
          </Suspense>
        ),
      },
      {
        path: 'eda',
        element: <PlaceholderPage title="EDA Dashboard" />,
      },
      {
        path: 'ml',
        element: <PlaceholderPage title="ML Insights" />,
      },
      {
        path: 'agents',
        element: (
          <Suspense fallback={<PageLoader />}>
            <AgentNetworkPage />
          </Suspense>
        ),
      },
      {
        path: 'copilot',
        element: (
          <Suspense fallback={<PageLoader />}>
            <CopilotPage />
          </Suspense>
        ),
      },
      {
        path: 'export',
        element: <PlaceholderPage title="Export Center" />,
      },
      {
        path: 'team',
        element: <PlaceholderPage title="Team Workspace" />,
      },
      {
        path: 'history',
        element: (
          <Suspense fallback={<PageLoader />}>
            <HistoryPage />
          </Suspense>
        ),
      },
      {
        path: 'settings',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SettingsPage />
          </Suspense>
        ),
      },
      {
        path: 'notifications',
        element: (
          <Suspense fallback={<PageLoader />}>
            <NotificationsPage />
          </Suspense>
        ),
      },
    ],
  },

  // Catch-all redirect
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
