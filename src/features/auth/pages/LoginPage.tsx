import { useState } from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
} from '@mui/material';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const prefillEmail = searchParams.get('email') || '';
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Signed in successfully');
      if (returnTo && returnTo.startsWith('/')) {
        navigate(returnTo);
      } else {
        const { user } = useAuthStore.getState();
        if (user?.roles?.includes('sponsor')) {
          navigate('/sponsor/dashboard');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      toast.error('Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error('Enter your email address first');
      return;
    }
    setResetLoading(true);
    try {
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      const res = await fetch(
        `https://us-central1-${projectId}.cloudfunctions.net/sendCustomPasswordReset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        toast.success('If an account exists with that email, a password reset link has been sent.');
      } else {
        toast.error(data.error || 'Failed to send password reset email');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send password reset email');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <SportsBaseballIcon sx={{ fontSize: 60, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            TC Waves
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Club Management System
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Link
            component="button"
            variant="body2"
            onClick={handleForgotPassword}
            disabled={resetLoading}
            sx={{ cursor: 'pointer', mb: 1, display: 'block' }}
          >
            {resetLoading ? 'Sending...' : 'Forgot Password?'}
          </Link>
          <Typography variant="body2">
            Don't have an account?{' '}
            <Link component={RouterLink} to={returnTo ? `/signup?returnTo=${encodeURIComponent(returnTo)}` : '/signup'}>
              Sign up
            </Link>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default LoginPage;
