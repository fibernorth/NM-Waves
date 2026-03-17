import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
} from '@mui/material';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import toast from 'react-hot-toast';

const SetupAccountPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token || !email) {
      setError('Invalid setup link. Please contact your administrator.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      const res = await fetch(
        `https://us-central1-${projectId}.cloudfunctions.net/setAccountPassword`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, email, password, type: 'invite' }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to set password. Please try again.');
        return;
      }

      setSuccess(true);
      toast.success('Password set successfully!');
      setTimeout(() => navigate(`/login?email=${encodeURIComponent(email)}`), 2000);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token || !email) {
    return (
      <Card>
        <CardContent sx={{ p: 4, textAlign: 'center' }}>
          <SportsBaseballIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>Invalid Link</Typography>
          <Typography color="text.secondary">
            This setup link appears to be invalid. Please contact your administrator
            or use the "Forgot Password" link on the login page.
          </Typography>
          <Button variant="contained" sx={{ mt: 3 }} onClick={() => navigate('/login')}>
            Go to Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent sx={{ p: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <SportsBaseballIcon sx={{ fontSize: 60, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" component="h1" gutterBottom>
            TC Waves
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Set up your account password
          </Typography>
        </Box>

        {success ? (
          <Alert severity="success" sx={{ mb: 2 }}>
            Password set successfully! Redirecting to login...
          </Alert>
        ) : (
          <>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <Alert severity="info" sx={{ mb: 2 }}>
              Setting password for: <strong>{email}</strong>
            </Alert>

            <form onSubmit={handleSubmit}>
              <TextField
                label="New Password"
                type="password"
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                inputProps={{ minLength: 6 }}
              />
              <TextField
                label="Confirm Password"
                type="password"
                fullWidth
                margin="normal"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <Button
                type="submit"
                variant="contained"
                fullWidth
                size="large"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? 'Setting Password...' : 'Set Password & Continue'}
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default SetupAccountPage;
