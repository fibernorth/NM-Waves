import { Outlet, Navigate, useSearchParams } from 'react-router-dom';
import { Box, Container } from '@mui/material';
import { useAuthStore } from '@/stores/authStore';

const AuthLayout = () => {
  const { user } = useAuthStore();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');

  if (user) {
    // If returnTo is present and valid (starts with /), redirect there instead of dashboard
    const destination = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'background.default',
      }}
    >
      <Container maxWidth="sm">
        <Outlet />
      </Container>
    </Box>
  );
};

export default AuthLayout;
