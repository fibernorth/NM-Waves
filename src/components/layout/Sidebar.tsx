import { useState } from 'react';
import {
  Drawer,
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Toolbar,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssessmentIcon from '@mui/icons-material/Assessment';
import DescriptionIcon from '@mui/icons-material/Description';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import BarChartIcon from '@mui/icons-material/BarChart';
import SchoolIcon from '@mui/icons-material/School';
import BusinessIcon from '@mui/icons-material/Business';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import CampaignIcon from '@mui/icons-material/Campaign';
import ChatIcon from '@mui/icons-material/Chat';
import EmailIcon from '@mui/icons-material/Email';
import PollIcon from '@mui/icons-material/Poll';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FundraiseIcon from '@mui/icons-material/Paid';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import ChecklistIcon from '@mui/icons-material/Checklist';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import QrCodeIcon from '@mui/icons-material/QrCode';
import PaymentIcon from '@mui/icons-material/Payment';
import BalanceIcon from '@mui/icons-material/Balance';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import WebIcon from '@mui/icons-material/Web';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import SettingsIcon from '@mui/icons-material/Settings';
import HandshakeIcon from '@mui/icons-material/Handshake';
import GavelIcon from '@mui/icons-material/Gavel';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import LinkIcon from '@mui/icons-material/Link';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import ScoreboardIcon from '@mui/icons-material/Scoreboard';
import TableChartIcon from '@mui/icons-material/TableChart';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import LockClockIcon from '@mui/icons-material/LockClock';
import EditNoteIcon from '@mui/icons-material/EditNote';
import InventoryIcon from '@mui/icons-material/Inventory';
import ArticleIcon from '@mui/icons-material/Article';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin, isMasterAdmin, isParent as checkIsParent } from '@/lib/auth/roles';
import { playersApi } from '@/lib/api/players';
import LinkChildDialog from '@/features/players/components/LinkChildDialog';

interface SidebarProps {
  drawerWidth: number;
  mobileOpen: boolean;
  onDrawerToggle: () => void;
}

const Sidebar = ({ drawerWidth, mobileOpen, onDrawerToggle }: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const isAdmin = checkIsAdmin(user);
  const isSuperAdmin = isMasterAdmin(user);
  const isParent = checkIsParent(user);

  const [linkChildOpen, setLinkChildOpen] = useState(false);

  // Fetch linked player names for parent sidebar
  const linkedPlayerIds = user?.linkedPlayerIds || [];
  const linkedPlayerQueries = useQuery({
    queryKey: ['linkedPlayers', ...linkedPlayerIds],
    queryFn: async () => {
      const results = await Promise.all(
        linkedPlayerIds.map(id => playersApi.getById(id))
      );
      return results.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof playersApi.getById>>>[];
    },
    enabled: linkedPlayerIds.length > 0,
  });

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', roles: ['all'] },
    { text: 'Teams', icon: <GroupsIcon />, path: '/teams', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Players', icon: <PersonIcon />, path: '/players', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Schedule', icon: <CalendarMonthIcon />, path: '/schedules', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Announcements', icon: <CampaignIcon />, path: '/announcements', roles: ['all'] },
    { text: 'Messaging', icon: <ChatIcon />, path: '/messaging', roles: ['all'] },
    { text: 'Email Parents', icon: <EmailIcon />, path: '/admin/email-parents', roles: ['admin', 'master-admin'] },
    { text: 'Surveys', icon: <PollIcon />, path: '/surveys', roles: ['parent'] },
    { text: 'Surveys', icon: <PollIcon />, path: '/manage-surveys', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Tryout Signups', icon: <HowToRegIcon />, path: '/tryout-signups', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Stats', icon: <ScoreboardIcon />, path: '/stats', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Homepage Manager', icon: <WebIcon />, path: '/homepage-manager', roles: ['admin', 'master-admin'] },
  ];

  const financeItems = [
    { text: 'Billing & Payments', icon: <AttachMoneyIcon />, path: '/finances/billing', roles: ['admin', 'master-admin'] },
    { text: 'Expenses', icon: <TrendingDownIcon />, path: '/finances/expenses', roles: ['admin', 'master-admin'] },
    { text: 'Income', icon: <TrendingUpIcon />, path: '/finances/income', roles: ['admin', 'master-admin'] },
    { text: 'Cost Management', icon: <AttachMoneyIcon />, path: '/finances/assumptions', roles: ['admin', 'master-admin'] },
    { text: 'Financial Reports', icon: <AssessmentIcon />, path: '/finances/reports', roles: ['admin', 'master-admin'] },
    { text: 'Reconciliation', icon: <AccountBalanceIcon />, path: '/finances/reconciliation', roles: ['admin', 'master-admin'] },
    { text: 'Invoices & QR', icon: <QrCodeIcon />, path: '/finances/invoices', roles: ['admin', 'master-admin'] },
    { text: 'Trial Balance', icon: <BalanceIcon />, path: '/finances/trial-balance', roles: ['admin', 'master-admin'] },
    { text: 'Balance Sheet', icon: <AccountTreeIcon />, path: '/finances/balance-sheet', roles: ['admin', 'master-admin'] },
    { text: 'Budget vs Actual', icon: <CompareArrowsIcon />, path: '/finances/budget-vs-actual', roles: ['admin', 'master-admin'] },
    { text: 'Aged AR / AP', icon: <ReceiptLongIcon />, path: '/finances/aged-receivables', roles: ['admin', 'master-admin'] },
    { text: 'Functional Expenses', icon: <TableChartIcon />, path: '/finances/functional-expenses', roles: ['admin', 'master-admin'] },
    { text: 'Cash Flow', icon: <WaterDropIcon />, path: '/finances/cash-flow', roles: ['admin', 'master-admin'] },
    { text: 'Comparative', icon: <CompareArrowsIcon />, path: '/finances/comparative', roles: ['admin', 'master-admin'] },
    { text: 'Journal Entries', icon: <EditNoteIcon />, path: '/finances/journal-entries', roles: ['admin', 'master-admin'] },
    { text: 'Fixed Assets', icon: <InventoryIcon />, path: '/finances/depreciation', roles: ['admin', 'master-admin'] },
    { text: 'Bank Recon', icon: <AccountBalanceIcon />, path: '/finances/bank-reconciliation', roles: ['admin', 'master-admin'] },
    { text: 'Year-End Close', icon: <LockClockIcon />, path: '/finances/year-end-closing', roles: ['master-admin'] },
  ];

  const operationsItems = [
    { text: 'Equipment', icon: <ChecklistIcon />, path: '/equipment', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Volunteers', icon: <VolunteerActivismIcon />, path: '/volunteers', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Tournaments', icon: <EmojiEventsIcon />, path: '/tournaments', roles: ['parent', 'coach', 'admin', 'master-admin'] },
    { text: 'Documents', icon: <DescriptionIcon />, path: '/documents', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Media Gallery', icon: <PhotoLibraryIcon />, path: '/media', roles: ['coach', 'admin', 'master-admin'] },
  ];

  const complianceItems = [
    { text: 'Donor Management', icon: <HandshakeIcon />, path: '/compliance/donors', roles: ['admin', 'master-admin'] },
    { text: 'Governance & Board', icon: <GavelIcon />, path: '/compliance/governance', roles: ['admin', 'master-admin'] },
    { text: 'Compliance', icon: <VerifiedUserIcon />, path: '/compliance/dashboard', roles: ['admin', 'master-admin'] },
    { text: '1099 Reporting', icon: <ArticleIcon />, path: '/compliance/1099', roles: ['admin', 'master-admin'] },
  ];

  const managementItems = [
    { text: 'Player Development', icon: <BarChartIcon />, path: '/metrics', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Scholarships', icon: <SchoolIcon />, path: '/scholarships', roles: ['admin', 'master-admin'] },
    { text: 'Sponsors', icon: <BusinessIcon />, path: '/sponsors/manage', roles: ['admin', 'master-admin'] },
    { text: 'Fundraising', icon: <FundraiseIcon />, path: '/fundraisers', roles: ['admin', 'master-admin'] },
    ...(isAdmin ? [{ text: 'Bulk Image Upload', icon: <FolderZipIcon />, path: '/admin/zip-upload', roles: ['admin', 'master-admin'] }] : []),
    ...(isAdmin ? [{ text: 'Admin Settings', icon: <SettingsIcon />, path: '/admin/settings', roles: ['admin', 'master-admin'] }] : []),
    ...(isAdmin ? [{ text: 'Account Provisioning', icon: <PersonAddIcon />, path: '/account-provisioning', roles: ['admin', 'master-admin'] }] : []),
    ...(isSuperAdmin ? [{ text: 'User Management', icon: <PeopleIcon />, path: '/users', roles: ['master-admin'] }] : []),
  ];

  const hasAccess = (roles: string[]) => {
    if (roles.includes('all')) return true;
    return user?.roles?.some(r => roles.includes(r)) ?? false;
  };

  const isSelected = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const renderNavSection = (title: string, items: typeof menuItems) => {
    const visibleItems = items.filter(item => hasAccess(item.roles));
    if (visibleItems.length === 0) return null;

    return (
      <>
        <Divider />
        <List>
          <ListItem>
            <ListItemText
              primary={title}
              primaryTypographyProps={{
                fontSize: '0.75rem',
                fontWeight: 'bold',
                color: 'text.secondary',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                pl: 2,
              }}
            />
          </ListItem>
          {visibleItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={isSelected(item.path)}
                onClick={() => {
                  navigate(item.path);
                  if (mobileOpen) onDrawerToggle();
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </>
    );
  };

  const drawer = (
    <div>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
          <SportsBaseballIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Box>
            <Box sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>Northern Michigan Waves</Box>
            <Box sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Ball Club</Box>
          </Box>
        </Box>
      </Toolbar>
      <Divider />

      <List>
        {menuItems.filter(item => hasAccess(item.roles)).map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={isSelected(item.path)}
              onClick={() => {
                navigate(item.path);
                if (mobileOpen) onDrawerToggle();
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* Parent: My Players section */}
      {isParent && (
        <>
          <Divider />
          <List>
            <ListItem>
              <ListItemText
                primary="MY PLAYERS"
                primaryTypographyProps={{
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  pl: 2,
                }}
              />
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                selected={isSelected('/my-invoices')}
                onClick={() => {
                  navigate('/my-invoices');
                  if (mobileOpen) onDrawerToggle();
                }}
                sx={{ bgcolor: isSelected('/my-invoices') ? undefined : 'primary.50' }}
              >
                <ListItemIcon><PaymentIcon color="primary" /></ListItemIcon>
                <ListItemText primary="My Invoices & Pay" primaryTypographyProps={{ fontWeight: 600 }} />
              </ListItemButton>
            </ListItem>
            {(linkedPlayerQueries.data || []).map((player) => (
              <ListItem key={player.id} disablePadding>
                <ListItemButton
                  selected={isSelected(`/players/${player.id}`)}
                  onClick={() => {
                    navigate(`/players/${player.id}`);
                    if (mobileOpen) onDrawerToggle();
                  }}
                >
                  <ListItemIcon><ChildCareIcon /></ListItemIcon>
                  <ListItemText primary={`${player.firstName} ${player.lastName}`} />
                </ListItemButton>
              </ListItem>
            ))}
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => setLinkChildOpen(true)}
                sx={{ color: 'primary.main' }}
              >
                <ListItemIcon><LinkIcon color="primary" /></ListItemIcon>
                <ListItemText primary="Link a Child" />
              </ListItemButton>
            </ListItem>
          </List>
        </>
      )}

      {isAdmin && renderNavSection('Finances', financeItems)}
      {renderNavSection('Operations', operationsItems)}
      {isAdmin && renderNavSection('Compliance', complianceItems)}
      {renderNavSection('Management', managementItems)}
    </div>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
      >
        {drawer}
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
        }}
        open
      >
        {drawer}
      </Drawer>

      {/* Link Child Dialog */}
      <LinkChildDialog open={linkChildOpen} onClose={() => setLinkChildOpen(false)} />
    </Box>
  );
};

export default Sidebar;
