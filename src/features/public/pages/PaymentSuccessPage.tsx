import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import { useAuthStore } from '@/stores/authStore';
import { isSponsor as checkIsSponsor } from '@/lib/auth/roles';

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <SportsBaseballIcon sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
        <CheckCircleOutlineIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom fontWeight={700}>
          Payment Successful!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
          Your payment has been processed successfully. The player's account has been credited.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          A receipt has been sent to your email address.
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
          {checkIsSponsor(user) ? (
            <Button variant="contained" onClick={() => navigate('/sponsor/dashboard')}>
              Go to Dashboard
            </Button>
          ) : (
            <Button variant="contained" onClick={() => navigate('/')}>
              Back to Home
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentSuccessPage;
