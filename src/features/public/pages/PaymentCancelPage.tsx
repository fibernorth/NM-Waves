import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Button,
  Box,
} from '@mui/material';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';

const PaymentCancelPage = () => {
  const navigate = useNavigate();

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <SportsBaseballIcon sx={{ fontSize: 36, color: 'primary.main', mb: 1 }} />
        <CancelOutlinedIcon sx={{ fontSize: 80, color: 'warning.main', mb: 2 }} />
        <Typography variant="h4" gutterBottom fontWeight={700}>
          Payment Cancelled
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Your payment was not completed. No charges have been made.
          You can try again or contact the club for assistance.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="contained" onClick={() => navigate(-1)}>
            Try Again
          </Button>
          <Button variant="outlined" onClick={() => navigate('/')}>
            Go Home
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default PaymentCancelPage;
