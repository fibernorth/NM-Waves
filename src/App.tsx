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
import SponsorLayout from './components/layout/SponsorLayout';

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
import UserManagementPage from './features/admin/pages/UserManagementPage';

// Sponsor Portal Pages
import BecomeSponsorPage from './features/sponsors/pages/BecomeSponsorPage';
import SponsorDashboardPage from './features/sponsors/pages/SponsorDashboardPage';
import SponsorPayPlayerPage from './features/sponsors/pages/SponsorPayPlayerPage';
import SponsorPaymentHistoryPage from './features/sponsors/pages/SponsorPaymentHistoryPage';
import SponsorAccountPage from './features/sponsors/pages/SponsorAccountPage';

// Public Payment Pages
import PublicPaymentPage from './features/public/pages/PublicPaymentPage';
import PaymentSuccessPage from './features/public/pages/PaymentSuccessPage';
import PaymentCancelPage from './features/public/pages/PaymentCancelPage';

// Invoice Management
import InvoiceManagementPage from './features/finances/pages/InvoiceManagementPage';

// Homepage Manager
import HomepageManagerPage from './features/homepage-manager/pages/HomepageManagerPage';

// Admin Pages
import ZipUploadPage from './features/admin/pages/ZipUploadPage';
import AdminSettingsPage from './features/admin/pages/AdminSettingsPage';

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

            {/* Public Payment Routes (no layout wrapper needed) */}
            <Route path="/pay/:token" element={<PublicPaymentPage />} />
            <Route path="/pay/success" element={<PaymentSuccessPage />} />
            <Route path="/pay/cancel" element={<PaymentCancelPage />} />
            <Route path="/become-sponsor" element={<BecomeSponsorPage />} />

            {/* Auth Routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
            </Route>

            {/* Sponsor Portal Routes */}
            <Route element={<SponsorLayout />}>
              <Route path="/sponsor/dashboard" element={<SponsorDashboardPage />} />
              <Route path="/sponsor/pay" element={<SponsorPayPlayerPage />} />
              <Route path="/sponsor/history" element={<SponsorPaymentHistoryPage />} />
              <Route path="/sponsor/account" element={<SponsorAccountPage />} />
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
              <Route path="/finances/invoices" element={<InvoiceManagementPage />} />

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

              {/* Homepage Manager */}
              <Route path="/homepage-manager" element={<HomepageManagerPage />} />

              {/* Admin Tools */}
              <Route path="/admin/zip-upload" element={<ZipUploadPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />

              {/* Phase 4 - Growth */}
              <Route path="/fundraisers" element={<FundraisersPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
              <Route path="/scholarships" element={<ScholarshipsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/account-provisioning" element={<UserManagementPage />} />
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
