import { useState } from 'react';
import { Outlet, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PaymentIcon from '@mui/icons-material/Payment';
import HistoryIcon from '@mui/icons-material/History';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import { useAuthStore } from '@/stores/authStore';

const DRAWER_WIDTH = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/sponsor/dashboard' },
  { text: 'Sponsor a Player', icon: <PaymentIcon />, path: '/sponsor/pay' },
  { text: 'Payment History', icon: <HistoryIcon />, path: '/sponsor/history' },
  { text: 'My Account', icon: <AccountCircleIcon />, path: '/sponsor/account' },
];

const SponsorLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuthStore();

  if (!user || !user.roles?.includes('sponsor')) {
    return <Navigate to="/login" replace />;
  }

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const drawer = (
    <div>
      <Toolbar>
        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'center' }}>
          <SportsBaseballIcon sx={{ mr: 1, color: 'primary.main' }} />
          <Box>
            <Box sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>TC Waves</Box>
            <Box sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Sponsor Portal</Box>
          </Box>
        </Box>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => {
                navigate(item.path);
                if (mobileOpen) handleDrawerToggle();
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon><LogoutIcon /></ListItemIcon>
            <ListItemText primary="Logout" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{ width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { sm: `${DRAWER_WIDTH}px` } }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
            Sponsor Portal
          </Typography>
          <Typography variant="body2" sx={{ mr: 2, display: { xs: 'none', sm: 'block' } }}>
            {user.displayName}
          </Typography>
          <Button color="inherit" size="small" onClick={handleLogout} startIcon={<LogoutIcon />}>
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8,
          backgroundColor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
};

export default SponsorLayout;
