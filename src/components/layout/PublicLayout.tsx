import { useState } from 'react';
import { Outlet, Link as RouterLink, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Container,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import SponsorBanner from '@/components/common/SponsorBanner';


const NAV_LINKS = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Teams', path: '/teams-roster' },
  { label: 'Schedule', path: '/schedule' },
  { label: 'Gallery', path: '/gallery' },
  { label: 'Sponsors', path: '/sponsors' },
  { label: 'Contact', path: '/contact' },
];

const PublicLayout = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const drawer = (
    <Box sx={{ width: 280 }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          component="img"
          src="/images/logo.png"
          alt="Northern Michigan Waves"
          sx={{ height: 28, width: 'auto' }}
        />
        <Typography variant="h6" color="primary" fontWeight={700}>
          Northern Michigan Waves
        </Typography>
      </Box>
      <Divider />
      <List>
        {NAV_LINKS.map((link) => (
          <ListItem key={link.path} disablePadding>
            <ListItemButton
              component={RouterLink}
              to={link.path}
              selected={location.pathname === link.path}
              onClick={handleDrawerToggle}
            >
              <ListItemText primary={link.label} />
            </ListItemButton>
          </ListItem>
        ))}
        <Divider sx={{ my: 1 }} />
        <ListItem disablePadding>
          <ListItemButton component={RouterLink} to="/login" onClick={handleDrawerToggle}>
            <ListItemText primary="Parent Login" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Header */}
      <AppBar position="sticky" elevation={2} sx={{ backgroundColor: 'white', color: 'text.primary' }}>
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ justifyContent: 'space-between' }}>
            {/* Logo / Brand */}
            <Box
              component={RouterLink}
              to="/"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              <Box
                component="img"
                src="/images/logo.png"
                alt="Northern Michigan Waves"
                sx={{ height: 36, width: 'auto' }}
              />
              <Typography
                variant="h6"
                noWrap
                sx={{ fontWeight: 700, color: 'primary.main' }}
              >
                Northern Michigan Waves
              </Typography>
            </Box>

            {/* Desktop Navigation */}
            {!isMobile && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {NAV_LINKS.map((link) => (
                  <Button
                    key={link.path}
                    component={RouterLink}
                    to={link.path}
                    size="small"
                    sx={{
                      color: location.pathname === link.path ? 'primary.main' : 'text.secondary',
                      fontWeight: location.pathname === link.path ? 600 : 400,
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    {link.label}
                  </Button>
                ))}
                <Button
                  component={RouterLink}
                  to="/login"
                  variant="outlined"
                  size="small"
                  sx={{ ml: 1 }}
                >
                  Parent Login
                </Button>
              </Box>
            )}

            {/* Mobile Hamburger */}
            {isMobile && (
              <IconButton
                color="inherit"
                edge="end"
                onClick={handleDrawerToggle}
                aria-label="open navigation menu"
              >
                <MenuIcon />
              </IconButton>
            )}
          </Toolbar>
        </Container>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
      >
        {drawer}
      </Drawer>

      {/* Page Content */}
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Outlet />
      </Box>

      {/* Footer */}
      <Box
        component="footer"
        sx={{
          backgroundColor: 'primary.dark',
          color: 'white',
          py: 4,
          mt: 'auto',
        }}
      >
        <Container maxWidth="lg">
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'center', md: 'flex-start' },
              gap: 3,
            }}
          >
            <Box sx={{ textAlign: { xs: 'center', md: 'left' } }}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Northern Michigan Waves
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Work as a Team, Win as a Team, Better Every Time
              </Typography>
            </Box>
            <Box sx={{ textAlign: { xs: 'center', md: 'right' } }}>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                Traverse City, Michigan
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.85 }}>
                tcwavessoftball@gmail.com
              </Typography>
            </Box>
          </Box>
          <Divider sx={{ my: 2, borderColor: 'rgba(255,255,255,0.2)' }} />
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, flexWrap: 'wrap', mb: 2 }}>
            {[
              { label: 'Privacy Policy', path: '/privacy' },
              { label: 'Terms of Service', path: '/terms' },
              { label: 'Sponsorship Packages', path: '/sponsorship-packages' },
            ].map((link) => (
              <Typography
                key={link.path}
                component={RouterLink}
                to={link.path}
                variant="body2"
                sx={{ color: 'rgba(255,255,255,0.7)', textDecoration: 'none', '&:hover': { color: 'white' } }}
              >
                {link.label}
              </Typography>
            ))}
          </Box>
          <SponsorBanner mode="footer" />
          <Typography variant="body2" align="center" sx={{ opacity: 0.7, mt: 2 }}>
            &copy; {new Date().getFullYear()} Northern Michigan Waves, Inc. All rights reserved.
          </Typography>
          <Typography variant="caption" align="center" display="block" sx={{ opacity: 0.45, mt: 0.5 }}>
            Developed by KSA08 Enterprises
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default PublicLayout;
