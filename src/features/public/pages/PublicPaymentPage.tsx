import { useState } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import { invoiceTokensApi } from '@/lib/api/invoiceTokens';
import StripeCheckoutButton from '@/components/common/StripeCheckoutButton';

const PublicPaymentPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');

  const { data: invoiceToken, isLoading } = useQuery({
    queryKey: ['invoiceToken', token],
    queryFn: () => invoiceTokensApi.getByToken(token!),
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading invoice...</Typography>
      </Container>
    );
  }

  if (!invoiceToken) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>Invoice not found</Alert>
          <Typography variant="body1" color="text.secondary">
            This payment link is invalid or has expired. Please contact the club for a new link.
          </Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/')}>
            Go Home
          </Button>
        </Paper>
      </Container>
    );
  }

  if (invoiceToken.used) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="warning" sx={{ mb: 2 }}>This invoice has already been paid</Alert>
          <Typography variant="body1" color="text.secondary">
            A payment was already made using this link. If you believe this is an error,
            please contact the club.
          </Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/')}>
            Go Home
          </Button>
        </Paper>
      </Container>
    );
  }

  if (new Date(invoiceToken.expiresAt) < new Date()) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="warning" sx={{ mb: 2 }}>This invoice link has expired</Alert>
          <Typography variant="body1" color="text.secondary">
            Please contact the club for a new payment link.
          </Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/')}>
            Go Home
          </Button>
        </Paper>
      </Container>
    );
  }

  const amount = parseFloat(paymentAmount) || invoiceToken.amountDue;
  const canPayAsGuest = guestName.trim() && guestEmail.trim() && amount >= 0.5;

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <SportsBaseballIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="h4" gutterBottom fontWeight={700}>
          TC Waves Ball Club
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Player Payment
        </Typography>
      </Box>

      {/* Invoice Details */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>Invoice Details</Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid container spacing={1}>
            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Player</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body1" fontWeight={600}>{invoiceToken.playerName}</Typography>
            </Grid>
            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Team</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body1">{invoiceToken.teamName}</Typography>
            </Grid>
            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Season</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="body1">{invoiceToken.season}</Typography>
            </Grid>
            <Grid item xs={5}>
              <Typography variant="body2" color="text.secondary">Amount Due</Typography>
            </Grid>
            <Grid item xs={7}>
              <Typography variant="h6" color="error.main" fontWeight={700}>
                ${invoiceToken.amountDue.toFixed(2)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Pay as Guest */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Pay Now</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Enter your information and pay securely with a card.
        </Typography>
        <TextField
          label="Your Name"
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          required
        />
        <TextField
          label="Your Email"
          type="email"
          value={guestEmail}
          onChange={(e) => setGuestEmail(e.target.value)}
          fullWidth
          sx={{ mb: 2 }}
          required
          helperText="A receipt will be sent to this email"
        />
        <TextField
          label="Payment Amount"
          type="number"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
          placeholder={invoiceToken.amountDue.toFixed(2)}
          fullWidth
          sx={{ mb: 2 }}
          InputProps={{ startAdornment: '$' }}
          inputProps={{ step: '0.01', min: '0.50' }}
          helperText="Leave blank to pay the full amount due"
        />
        <Alert severity="info" sx={{ mb: 2 }}>
          A processing fee (2.9% + $0.30) applies to card payments.
        </Alert>
        <StripeCheckoutButton
          financeId={invoiceToken.financeId}
          playerId={invoiceToken.playerId}
          amount={amount}
          invoiceToken={invoiceToken.token}
          payerName={guestName}
          payerEmail={guestEmail}
          label={`Pay $${amount.toFixed(2)}`}
          disabled={!canPayAsGuest}
          fullWidth
        />
      </Paper>

      {/* Sponsor Option */}
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="body1" gutterBottom>
          Are you a sponsor?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Log in to your sponsor account to make this payment with anonymous options.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            component={RouterLink}
            to={`/login?returnTo=/pay/${token}`}
          >
            Log In
          </Button>
          <Button
            variant="text"
            component={RouterLink}
            to="/become-sponsor"
          >
            Become a Sponsor
          </Button>
        </Box>
      </Paper>
    </Container>
  );
};

export default PublicPaymentPage;
