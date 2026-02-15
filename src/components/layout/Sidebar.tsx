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
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import FundraiseIcon from '@mui/icons-material/Paid';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import ChecklistIcon from '@mui/icons-material/Checklist';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import QrCodeIcon from '@mui/icons-material/QrCode';
import WebIcon from '@mui/icons-material/Web';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin, isMasterAdmin } from '@/lib/auth/roles';

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

  const menuItems = [
    { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', roles: ['all'] },
    { text: 'Teams', icon: <GroupsIcon />, path: '/teams', roles: ['all'] },
    { text: 'Players', icon: <PersonIcon />, path: '/players', roles: ['all'] },
    { text: 'Schedule', icon: <CalendarMonthIcon />, path: '/schedules', roles: ['all'] },
    { text: 'Announcements', icon: <CampaignIcon />, path: '/announcements', roles: ['all'] },
    { text: 'Messaging', icon: <ChatIcon />, path: '/messaging', roles: ['parent', 'coach', 'admin', 'master-admin'] },
    { text: 'Homepage Manager', icon: <WebIcon />, path: '/homepage-manager', roles: ['coach', 'admin', 'master-admin'] },
  ];

  const financeItems = [
    { text: 'Billing & Payments', icon: <AttachMoneyIcon />, path: '/finances/billing', roles: ['admin', 'master-admin'] },
    { text: 'Expenses', icon: <TrendingDownIcon />, path: '/finances/expenses', roles: ['admin', 'master-admin'] },
    { text: 'Income', icon: <TrendingUpIcon />, path: '/finances/income', roles: ['admin', 'master-admin'] },
    { text: 'Cost Assumptions', icon: <AttachMoneyIcon />, path: '/finances/assumptions', roles: ['admin', 'master-admin'] },
    { text: 'Financial Reports', icon: <AssessmentIcon />, path: '/finances/reports', roles: ['admin', 'master-admin'] },
    { text: 'Reconciliation', icon: <AccountBalanceIcon />, path: '/finances/reconciliation', roles: ['admin', 'master-admin'] },
    { text: 'Invoices & QR', icon: <QrCodeIcon />, path: '/finances/invoices', roles: ['admin', 'master-admin'] },
  ];

  const operationsItems = [
    { text: 'Equipment', icon: <ChecklistIcon />, path: '/equipment', roles: ['admin', 'master-admin'] },
    { text: 'Volunteers', icon: <VolunteerActivismIcon />, path: '/volunteers', roles: ['all'] },
    { text: 'Tournaments', icon: <EmojiEventsIcon />, path: '/tournaments', roles: ['all'] },
    { text: 'Documents', icon: <DescriptionIcon />, path: '/documents', roles: ['all'] },
    { text: 'Media Gallery', icon: <PhotoLibraryIcon />, path: '/media', roles: ['all'] },
  ];

  const managementItems = [
    { text: 'Player Development', icon: <BarChartIcon />, path: '/metrics', roles: ['coach', 'admin', 'master-admin'] },
    { text: 'Scholarships', icon: <SchoolIcon />, path: '/scholarships', roles: ['admin', 'master-admin'] },
    { text: 'Sponsors', icon: <BusinessIcon />, path: '/sponsors/manage', roles: ['admin', 'master-admin'] },
    { text: 'Fundraising', icon: <FundraiseIcon />, path: '/fundraisers', roles: ['admin', 'master-admin'] },
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
            <Box sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>TC Waves</Box>
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

      {isAdmin && renderNavSection('Finances', financeItems)}
      {renderNavSection('Operations', operationsItems)}
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
    </Box>
  );
};

export default Sidebar;
