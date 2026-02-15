import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { theme } from './theme';

// Layouts
import AppLayout from './components/layout/AppLayout';
import AuthLayout from './components/layout/AuthLayout';
import PublicLayout from './components/layout/PublicLayout';

// Auth Pages
import LoginPage from './features/auth/pages/LoginPage';
import SignupPage from './features/auth/pages/SignupPage';

// Public Pages
import HomePage from './features/public/pages/HomePage';
import AboutPage from './features/public/pages/AboutPage';
import PublicTeamsPage from './features/public/pages/PublicTeamsPage';
import PublicSchedulePage from './features/public/pages/PublicSchedulePage';
import PublicSponsorsPage from './features/public/pages/PublicSponsorsPage';
import ContactPage from './features/public/pages/ContactPage';
import TryoutRegistrationPage from './features/public/pages/TryoutRegistrationPage';
import PublicGalleryPage from './features/public/pages/PublicGalleryPage';
import PublicTeamDetailPage from './features/public/pages/PublicTeamDetailPage';

// Main Pages
import DashboardPage from './features/dashboard/pages/DashboardPage';
import TeamsPage from './features/teams/pages/TeamsPage';
import TeamDetailsPage from './features/teams/pages/TeamDetailsPage';
import PlayersPage from './features/players/pages/PlayersPage';
import PlayerDetailsPage from './features/players/pages/PlayerDetailsPage';
import CostAssumptionsPage from './features/finances/pages/CostAssumptionsPage';
import BillingPage from './features/finances/pages/BillingPage';
import ExpensesPage from './features/finances/pages/ExpensesPage';
import IncomePage from './features/finances/pages/IncomePage';
import FinancialReportsPage from './features/finances/pages/FinancialReportsPage';

// Phase 2 - Communication & Scheduling
import AnnouncementsPage from './features/announcements/pages/AnnouncementsPage';
import MessagingPage from './features/messaging/pages/MessagingPage';
import SchedulesPage from './features/schedules/pages/SchedulesPage';
import VolunteersPage from './features/volunteers/pages/VolunteersPage';

// Phase 3 - Content & Public
import DocumentsPage from './features/documents/pages/DocumentsPage';
import MediaPage from './features/media/pages/MediaPage';
import TournamentsPage from './features/tournaments/pages/TournamentsPage';
import SponsorsPage from './features/sponsors/pages/SponsorsPage';

// Equipment
import EquipmentPage from './features/equipment/pages/EquipmentPage';

// Reconciliation
import ReconciliationPage from './features/finances/pages/ReconciliationPage';

// Phase 4 - Growth
import FundraisersPage from './features/fundraisers/pages/FundraisersPage';
import MetricsPage from './features/metrics/pages/MetricsPage';
import ScholarshipsPage from './features/scholarships/pages/ScholarshipsPage';
import UsersPage from './features/users/pages/UsersPage';

// Components
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoadingScreen from './components/common/LoadingScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  const { initialize, initialized, loading } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!initialized || loading) {
    return <LoadingScreen />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/teams-roster" element={<PublicTeamsPage />} />
              <Route path="/teams-roster/:id" element={<PublicTeamDetailPage />} />
              <Route path="/schedule" element={<PublicSchedulePage />} />
              <Route path="/gallery" element={<PublicGalleryPage />} />
              <Route path="/sponsors" element={<PublicSponsorsPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/tryouts" element={<TryoutRegistrationPage />} />
            </Route>

            {/* Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>

            {/* Protected Routes */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />

              {/* Teams */}
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/:id" element={<TeamDetailsPage />} />

              {/* Players */}
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/players/:id" element={<PlayerDetailsPage />} />

              {/* Finances */}
              <Route path="/finances/assumptions" element={<CostAssumptionsPage />} />
              <Route path="/finances/billing" element={<BillingPage />} />
              <Route path="/finances/expenses" element={<ExpensesPage />} />
              <Route path="/finances/income" element={<IncomePage />} />
              <Route path="/finances/reports" element={<FinancialReportsPage />} />
              <Route path="/finances/reconciliation" element={<ReconciliationPage />} />

              {/* Phase 2 - Communication & Scheduling */}
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/messaging" element={<MessagingPage />} />
              <Route path="/schedules" element={<SchedulesPage />} />
              <Route path="/volunteers" element={<VolunteersPage />} />

              {/* Equipment */}
              <Route path="/equipment" element={<EquipmentPage />} />

              {/* Phase 3 - Content & Public */}
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/media" element={<MediaPage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/sponsors/manage" element={<SponsorsPage />} />

              {/* Phase 4 - Growth */}
              <Route path="/fundraisers" element={<FundraisersPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/scholarships" element={<ScholarshipsPage />} />
              <Route path="/users" element={<UsersPage />} />
            </Route>

            {/* 404 - Redirect to public home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
