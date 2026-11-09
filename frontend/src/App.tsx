import { Suspense, lazy } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useView } from './lib/view'
import { useAuth } from './lib/auth'
import { Layout } from './components/Layout'
import { PageLoader } from './components/Spinner'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ForgotPage from './pages/ForgotPage'
import ResetPage from './pages/ResetPage'
import HomePage from './pages/HomePage'
import EmployeesPage from './pages/EmployeesPage'
import EmployeeDetailPage from './pages/EmployeeDetailPage'
import ActivityPage from './pages/ActivityPage'
import ControlsPage from './pages/ControlsPage'
import OverviewPage from './pages/OverviewPage'
import ApprovalsPage from './pages/ApprovalsPage'
import ConnectionsPage from './pages/ConnectionsPage'
import WelcomePage from './pages/WelcomePage'
import SetupPage from './pages/SetupPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import { hasAdminView } from './lib/view'

// The team, finance and policy pages are admin tools; load them only when opened.
const FinancePage = lazy(() => import('./pages/FinancePage'))
const InviteAcceptPage = lazy(() => import('./pages/InviteAcceptPage'))
const PlatformPage = lazy(() => import('./pages/PlatformPage'))

/** Pages for owner, admin, finance and auditor only. Everyone else lands on Home. */
function RequireAdminView() {
  const { user } = useAuth()
  if (!hasAdminView(user?.role)) return <Navigate to="/" replace />
  return <Outlet />
}

/**
 * Needs a session. Logged-out visitors on / get the public landing page; elsewhere they go to sign in.
 * Anyone who still has setup to finish (no company, no 2FA, wizard not completed) is sent to /setup.
 */
function RequireAuth() {
  const { isAuthenticated, setupRequired, loading } = useAuth()
  const location = useLocation()
  if (loading) return <PageLoader />
  if (!isAuthenticated) {
    if (location.pathname === '/') { window.location.replace('/site/'); return <PageLoader /> }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (setupRequired && location.pathname !== '/setup' && location.pathname !== '/welcome') return <Navigate to="/setup" replace />
  return <Outlet />
}

function PublicOnly() {
  const { isAuthenticated, setupRequired, loading } = useAuth()
  if (loading) return <PageLoader />
  if (isAuthenticated) return <Navigate to={setupRequired ? '/setup' : '/'} replace />
  return <Outlet />
}

/** Desktop shows the Overview, phones the simpler Home. */
function Home() {
  const { phone } = useView()
  return phone ? <HomePage /> : <OverviewPage />
}

/** Old /settings, /team and /policy links (and their #anchors) land on the new Connections and Controls pages. */
function LegacyRedirect({ to }: { to?: string }) {
  const { hash } = useLocation()
  const id = hash.replace('#', '')
  if (to) return <Navigate to={to} replace />
  if (id === 'connect' || id === 'payments') return <Navigate to={`/connections${hash}`} replace />
  return <Navigate to={`/controls${hash}`} replace />
}

/** Old /agents/:id links keep working. */
function AgentRedirect() {
  const { id } = useParams()
  return <Navigate to={`/employees/${id}`} replace />
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/signup" element={<Navigate to="/register" replace />} />
          <Route path="/forgot" element={<ForgotPage />} />
        </Route>
        {/* Not PublicOnly: in Supabase mode the recovery link signs the user in before they choose a password. */}
        <Route path="/reset" element={<ResetPage />} />
        {/* Supabase sends confirmation, magic link, Google and recovery redirects here. */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        {/* Public: the invite page works signed in or out and decides what to show. */}
        <Route path="/invite/:token" element={<InviteAcceptPage />} />
        <Route element={<RequireAuth />}>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/employees/:id" element={<EmployeeDetailPage />} />
            <Route path="/spending" element={<ActivityPage />} />
            <Route path="/approvals" element={<ApprovalsPage />} />
            <Route path="/connections" element={<ConnectionsPage />} />
            <Route path="/controls" element={<ControlsPage />} />
            <Route element={<RequireAdminView />}>
              <Route path="/finance" element={<FinancePage />} />
            </Route>
            <Route path="/platform" element={<PlatformPage />} />
            {/* Old routes */}
            <Route path="/m" element={<Navigate to="/" replace />} />
            <Route path="/activity" element={<Navigate to="/spending" replace />} />
            <Route path="/settings" element={<LegacyRedirect />} />
            <Route path="/team" element={<LegacyRedirect to="/controls#people" />} />
            <Route path="/policy" element={<LegacyRedirect to="/controls#history" />} />
            <Route path="/transactions" element={<Navigate to="/spending" replace />} />
            <Route path="/agents" element={<Navigate to="/employees" replace />} />
            <Route path="/agents/:id" element={<AgentRedirect />} />
            <Route path="/budgets" element={<Navigate to="/controls#budgets" replace />} />
            <Route path="/cards" element={<Navigate to="/controls#budgets" replace />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
