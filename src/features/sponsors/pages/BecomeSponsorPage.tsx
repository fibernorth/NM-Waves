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
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sponsorsApi } from '@/lib/api/sponsors';
import { useAuthStore } from '@/stores/authStore';
import { isSponsor as checkIsSponsor } from '@/lib/auth/roles';
import toast from 'react-hot-toast';

const sponsorSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  contactEmail: z.string().email('Valid email required'),
  contactPhone: z.string().min(1, 'Phone number is required'),
  websiteUrl: z.string().optional(),
});

type SponsorFormData = z.infer<typeof sponsorSchema>;

const BecomeSponsorPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [submitted, setSubmitted] = useState(false);

  // If already a sponsor, redirect
  if (checkIsSponsor(user)) {
    navigate('/sponsor/dashboard', { replace: true });
    return null;
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SponsorFormData>({
    resolver: zodResolver(sponsorSchema),
  });

  const onSubmit = async (data: SponsorFormData) => {
    try {
      await sponsorsApi.create({
        businessName: data.businessName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        websiteUrl: data.websiteUrl || '',
        level: 'custom',
        sponsorshipType: 'player_sponsor',
        displayOnPublicSite: false,
        season: new Date().getFullYear().toString(),
        sponsoredPlayers: [],
      });

      setSubmitted(true);
      toast.success('Sponsor application submitted!');
    } catch (error) {
      toast.error('Failed to submit. Please try again.');
    }
  };

  if (submitted) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <BusinessIcon sx={{ fontSize: 64, color: 'success.main', mb: 2 }} />
          <Typography variant="h4" gutterBottom>
            Thank You!
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Your sponsor application has been submitted. An administrator will review your
            information and set up your account. Check your email for login instructions.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/')}>
            Back to Home
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <BusinessIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
          <Typography variant="h4" gutterBottom>
            Become a Sponsor
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Support TC Waves players by becoming a sponsor. You can sponsor individual players
            and help cover their costs for the season.
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
            <Grid item xs={12}>
              <TextField
                label="Contact Name"
                {...register('contactName')}
                error={!!errors.contactName}
                helperText={errors.contactName?.message}
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
                label="Website (optional)"
                {...register('websiteUrl')}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Sponsor Application'}
              </Button>
            </Grid>
          </Grid>
        </form>

        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
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
