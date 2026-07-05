import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  TextField,
  Button,
  Paper,
  Grid,
  MenuItem,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import PaymentIcon from '@mui/icons-material/Payment';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { redirectToCheckout } from '@/lib/api/stripe';
import toast from 'react-hot-toast';

const sponsorSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  contactEmail: z.string().email('Valid email required'),
  contactPhone: z.string().min(1, 'Phone number is required'),
  websiteUrl: z.string().optional(),
  amount: z.number({ invalid_type_error: 'Enter an amount' }).min(1, 'Minimum $1.00'),
  sponsorshipTarget: z.enum(['organization', 'team', 'player']),
  notes: z.string().optional(),
});

type SponsorFormData = z.infer<typeof sponsorSchema>;

const BecomeSponsorPage = () => {
  const navigate = useNavigate();
  const [paying, setPaying] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SponsorFormData>({
    resolver: zodResolver(sponsorSchema),
    defaultValues: {
      sponsorshipTarget: 'organization',
      amount: undefined as any,
    },
  });

  const sponsorshipTarget = watch('sponsorshipTarget');

  const onSubmit = async (data: SponsorFormData) => {
    setPaying(true);
    try {
      await redirectToCheckout({
        amount: data.amount,
        sponsorBusinessName: data.businessName,
        sponsorshipTarget: data.sponsorshipTarget,
        sponsorNotes: data.notes || '',
        payerName: data.contactName,
        payerEmail: data.contactEmail,
      });
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout. Please try again.');
      setPaying(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <BusinessIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" gutterBottom>
            Become a Sponsor
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Support Northern Michigan Waves players by becoming a sponsor. Your contribution is tax-deductible
            and directly supports youth athletics in Northern Michigan.
          </Typography>
        </Box>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Business / Organization Name"
                {...register('businessName')}
                error={!!errors.businessName}
                helperText={errors.businessName?.message}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Contact Name"
                {...register('contactName')}
                error={!!errors.contactName}
                helperText={errors.contactName?.message}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone"
                {...register('contactPhone')}
                error={!!errors.contactPhone}
                helperText={errors.contactPhone?.message}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email"
                type="email"
                {...register('contactEmail')}
                error={!!errors.contactEmail}
                helperText={errors.contactEmail?.message}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Website (optional)"
                {...register('websiteUrl')}
                fullWidth
              />
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="Sponsorship Amount"
                type="number"
                {...register('amount', { valueAsNumber: true })}
                error={!!errors.amount}
                helperText={errors.amount?.message || 'Gold: $1,000+ | Silver: $500+ | Bronze: $250+'}
                fullWidth
                required
                InputProps={{ startAdornment: <Typography sx={{ mr: 0.5, color: 'text.secondary' }}>$</Typography> }}
                inputProps={{ step: '1', min: '1' }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Apply Sponsorship To"
                select
                {...register('sponsorshipTarget')}
                error={!!errors.sponsorshipTarget}
                helperText={errors.sponsorshipTarget?.message}
                fullWidth
                required
                defaultValue="organization"
              >
                <MenuItem value="organization">Organization (General Fund)</MenuItem>
                <MenuItem value="team">A Specific Team</MenuItem>
                <MenuItem value="player">A Specific Player</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={
                  sponsorshipTarget === 'player'
                    ? 'Player name or details (we\'ll match them up)'
                    : sponsorshipTarget === 'team'
                    ? 'Team name or age group'
                    : 'Any notes for the club (optional)'
                }
                {...register('notes')}
                fullWidth
                multiline
                rows={3}
                placeholder={
                  sponsorshipTarget === 'player'
                    ? 'e.g. "Apply to Jane Smith, 12U team"'
                    : sponsorshipTarget === 'team'
                    ? 'e.g. "14U Gold team"'
                    : 'e.g. "Use where most needed"'
                }
              />
            </Grid>

            <Grid item xs={12}>
              <Alert severity="info" sx={{ mb: 1 }}>
                A small processing fee (2.9% + $0.30) applies to card payments. You&apos;ll be redirected to Stripe&apos;s secure checkout.
              </Alert>
            </Grid>

            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={isSubmitting || paying}
                startIcon={paying ? <CircularProgress size={20} color="inherit" /> : <PaymentIcon />}
                sx={{
                  py: 1.5,
                  fontSize: '1.1rem',
                  backgroundColor: '#635bff',
                  '&:hover': { backgroundColor: '#4b45c6' },
                }}
              >
                {paying ? 'Redirecting to Stripe...' : 'Pay & Become a Sponsor'}
              </Button>
            </Grid>
          </Grid>
        </form>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Prefer to pay by check or another method?{' '}
            <Button size="small" onClick={() => navigate('/contact')}>
              Contact us
            </Button>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Already a sponsor?{' '}
            <Button size="small" onClick={() => navigate('/login')}>
              Log in here
            </Button>
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
};

export default BecomeSponsorPage;
