import { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
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
  const { signIn } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Signed in successfully');
      // Check role for redirect
      const { user } = useAuthStore.getState();
      if (user?.roles?.includes('sponsor')) {
        navigate('/sponsor/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
      toast.error('Failed to sign in');
    } finally {
      setLoading(false);
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
          <Typography variant="body2">
            Don't have an account?{' '}
            <Link component={RouterLink} to="/signup">
              Sign up
            </Link>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default LoginPage;
