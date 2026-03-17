import { useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Divider,
  Alert,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getSponsorByUserId } from '@/lib/api/sponsorPortal';
import { sponsorsApi } from '@/lib/api/sponsors';
import toast from 'react-hot-toast';

interface AccountFormData {
  businessName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  websiteUrl: string;
}

const SponsorAccountPage = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: sponsor, isLoading } = useQuery({
    queryKey: ['sponsor', 'self', user?.uid],
    queryFn: () => getSponsorByUserId(user!.uid),
    enabled: !!user?.uid,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<AccountFormData>();

  useEffect(() => {
    if (sponsor) {
      reset({
        businessName: sponsor.businessName || '',
        contactName: sponsor.contactName || '',
        contactEmail: sponsor.contactEmail || '',
        contactPhone: sponsor.contactPhone || '',
        websiteUrl: sponsor.websiteUrl || '',
      });
    }
  }, [sponsor, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: AccountFormData) =>
      sponsorsApi.update(sponsor!.id, {
        businessName: data.businessName,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        websiteUrl: data.websiteUrl,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsor', 'self'] });
      toast.success('Account updated successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update account');
    },
  });

  const onSubmit = (data: AccountFormData) => {
    updateMutation.mutate(data);
  };

  if (isLoading) {
    return <Typography>Loading...</Typography>;
  }

  if (!sponsor) {
    return (
      <Alert severity="warning">
        No sponsor account found. Please contact the club administrator.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Account
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Account Summary
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">Sponsor Level</Typography>
            <Typography variant="body1" sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
              {sponsor.level}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">Season</Typography>
            <Typography variant="body1" fontWeight={600}>{sponsor.season}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">Total Sponsored</Typography>
            <Typography variant="body1" color="success.main" fontWeight={600}>
              ${(sponsor.totalSponsored || 0).toFixed(2)}
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="body2" color="text.secondary">Players Sponsored</Typography>
            <Typography variant="body1" fontWeight={600}>
              {new Set((sponsor.sponsoredPlayers || []).map(p => p.playerId)).size}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Edit Profile
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Business / Organization Name"
                {...register('businessName', { required: 'Required' })}
                error={!!errors.businessName}
                helperText={errors.businessName?.message}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Contact Name"
                {...register('contactName', { required: 'Required' })}
                error={!!errors.contactName}
                helperText={errors.contactName?.message}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Contact Email"
                type="email"
                {...register('contactEmail', { required: 'Required' })}
                error={!!errors.contactEmail}
                helperText={errors.contactEmail?.message}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Contact Phone"
                {...register('contactPhone', { required: 'Required' })}
                error={!!errors.contactPhone}
                helperText={errors.contactPhone?.message}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Website"
                {...register('websiteUrl')}
                fullWidth
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                disabled={!isDirty || updateMutation.isPending}
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default SponsorAccountPage;
