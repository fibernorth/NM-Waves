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
import SetupAccountPage from './features/auth/pages/SetupAccountPage';
import ResetPasswordPage from './features/auth/pages/ResetPasswordPage';

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
import CostManagementPage from './features/finances/pages/CostManagementPage';
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
import ParentInvoicesPage from './features/finances/pages/ParentInvoicesPage';

// Accounting Foundation (Phase 2)
import TrialBalancePage from './features/finances/pages/TrialBalancePage';
import BalanceSheetPage from './features/finances/pages/BalanceSheetPage';
import BudgetVsActualPage from './features/finances/pages/BudgetVsActualPage';
import AgedReceivablesPage from './features/finances/pages/AgedReceivablesPage';
import FunctionalExpensesPage from './features/finances/pages/FunctionalExpensesPage';
import CashFlowPage from './features/finances/pages/CashFlowPage';
import ComparativeReportsPage from './features/finances/pages/ComparativeReportsPage';
import JournalEntryPage from './features/finances/pages/JournalEntryPage';
import YearEndClosingPage from './features/finances/pages/YearEndClosingPage';
import DepreciationPage from './features/finances/pages/DepreciationPage';
import BankReconciliationPage from './features/finances/pages/BankReconciliationPage';

// Non-Profit Compliance (Phase 3)
import DonorManagementPage from './features/compliance/pages/DonorManagementPage';
import GovernancePage from './features/compliance/pages/GovernancePage';
import ComplianceDashboardPage from './features/compliance/pages/ComplianceDashboardPage';
import Form1099Page from './features/compliance/pages/Form1099Page';

// Public Website Polish (Phase 4)
import PrivacyPolicyPage from './features/public/pages/PrivacyPolicyPage';
import TermsPage from './features/public/pages/TermsPage';
import SponsorshipPackagesPage from './features/public/pages/SponsorshipPackagesPage';
import PricingPage from './features/public/pages/PricingPage';
import StaffDirectoryPage from './features/public/pages/StaffDirectoryPage';
import ParentResourcesPage from './features/public/pages/ParentResourcesPage';

// Stats
import TeamStatsPage from './features/stats/pages/TeamStatsPage';

// Homepage Manager
import HomepageManagerPage from './features/homepage-manager/pages/HomepageManagerPage';

// Admin Pages
import ZipUploadPage from './features/admin/pages/ZipUploadPage';
import AdminSettingsPage from './features/admin/pages/AdminSettingsPage';
import EmailParentsPage from './features/admin/pages/EmailParentsPage';
import SurveysPage from './features/surveys/pages/SurveysPage';
import SurveyAdminPage from './features/surveys/pages/SurveyAdminPage';

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
  const { initialize, initialized } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Gate only on the initial auth resolution. Do NOT also gate on `loading`:
  // signIn/signUp toggle it, and unmounting the whole router mid-submit tore
  // down the login form (clearing it, dropping inline errors, breaking navigate).
  if (!initialized) {
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
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/sponsorship-packages" element={<SponsorshipPackagesPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/staff" element={<StaffDirectoryPage />} />
              <Route path="/parent-resources" element={<ParentResourcesPage />} />
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
              <Route path="/setup-account" element={<SetupAccountPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>

            {/* Sponsor Portal Routes */}
            <Route element={<SponsorLayout />}>
              <Route path="/sponsor/dashboard" element={<SponsorDashboardPage />} />
              <Route path="/sponsor/pay" element={<SponsorPayPlayerPage />} />
              <Route path="/sponsor/history" element={<SponsorPaymentHistoryPage />} />
              <Route path="/sponsor/account" element={<SponsorAccountPage />} />
            </Route>

            {/* Protected Routes - All authenticated users */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/messaging" element={<MessagingPage />} />
              <Route path="/players/:id" element={<PlayerDetailsPage />} />
              <Route path="/my-invoices" element={<ParentInvoicesPage />} />
              <Route path="/tournaments" element={<TournamentsPage />} />
              <Route path="/stats" element={<TeamStatsPage />} />
              <Route path="/surveys" element={<SurveysPage />} />
            </Route>

            {/* Protected Routes - Coach and above */}
            <Route element={<ProtectedRoute requiredRole={['coach', 'admin', 'master-admin']}><AppLayout /></ProtectedRoute>}>
              <Route path="/teams" element={<TeamsPage />} />
              <Route path="/teams/:id" element={<TeamDetailsPage />} />
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/schedules" element={<SchedulesPage />} />
              <Route path="/volunteers" element={<VolunteersPage />} />
              <Route path="/equipment" element={<EquipmentPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/media" element={<MediaPage />} />
              <Route path="/metrics" element={<MetricsPage />} />
            </Route>

            {/* Protected Routes - Admin and above */}
            <Route element={<ProtectedRoute requiredRole={['admin', 'master-admin']}><AppLayout /></ProtectedRoute>}>
              <Route path="/finances/assumptions" element={<CostManagementPage />} />
              <Route path="/finances/billing" element={<BillingPage />} />
              <Route path="/finances/expenses" element={<ExpensesPage />} />
              <Route path="/finances/income" element={<IncomePage />} />
              <Route path="/finances/reports" element={<FinancialReportsPage />} />
              <Route path="/finances/reconciliation" element={<ReconciliationPage />} />
              <Route path="/finances/invoices" element={<InvoiceManagementPage />} />
              <Route path="/finances/trial-balance" element={<TrialBalancePage />} />
              <Route path="/finances/balance-sheet" element={<BalanceSheetPage />} />
              <Route path="/finances/budget-vs-actual" element={<BudgetVsActualPage />} />
              <Route path="/finances/aged-receivables" element={<AgedReceivablesPage />} />
              <Route path="/finances/functional-expenses" element={<FunctionalExpensesPage />} />
              <Route path="/finances/cash-flow" element={<CashFlowPage />} />
              <Route path="/finances/comparative" element={<ComparativeReportsPage />} />
              <Route path="/finances/journal-entries" element={<JournalEntryPage />} />
              <Route path="/finances/year-end-closing" element={<YearEndClosingPage />} />
              <Route path="/finances/depreciation" element={<DepreciationPage />} />
              <Route path="/finances/bank-reconciliation" element={<BankReconciliationPage />} />
              <Route path="/compliance/donors" element={<DonorManagementPage />} />
              <Route path="/compliance/governance" element={<GovernancePage />} />
              <Route path="/compliance/dashboard" element={<ComplianceDashboardPage />} />
              <Route path="/compliance/1099" element={<Form1099Page />} />
              <Route path="/sponsors/manage" element={<SponsorsPage />} />
              <Route path="/fundraisers" element={<FundraisersPage />} />
              <Route path="/scholarships" element={<ScholarshipsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/account-provisioning" element={<UserManagementPage />} />
              <Route path="/homepage-manager" element={<HomepageManagerPage />} />
              <Route path="/admin/zip-upload" element={<ZipUploadPage />} />
              <Route path="/admin/settings" element={<AdminSettingsPage />} />
              <Route path="/admin/email-parents" element={<EmailParentsPage />} />
              <Route path="/admin/surveys" element={<SurveyAdminPage />} />
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
