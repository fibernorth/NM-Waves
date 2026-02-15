import { useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { costAssumptionsApi } from '@/lib/api/finances';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import SaveIcon from '@mui/icons-material/Save';

const costSchema = z.object({
  registrationFee: z.number().min(0, 'Must be 0 or greater'),
  uniformCost: z.number().min(0, 'Must be 0 or greater'),
  tournamentFeePerEvent: z.number().min(0, 'Must be 0 or greater'),
  facilityFeePerSeason: z.number().min(0, 'Must be 0 or greater'),
  equipmentFeePerSeason: z.number().min(0, 'Must be 0 or greater'),
  fundraisingTarget: z.number().min(0, 'Must be 0 or greater'),
});

type CostFormData = z.infer<typeof costSchema>;

const CostAssumptionsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';

  const { data: costs, isLoading } = useQuery({
    queryKey: ['costAssumptions'],
    queryFn: () => costAssumptionsApi.get(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<CostFormData>({
    resolver: zodResolver(costSchema),
    defaultValues: {
      registrationFee: 0,
      uniformCost: 0,
      tournamentFeePerEvent: 0,
      facilityFeePerSeason: 0,
      equipmentFeePerSeason: 0,
      fundraisingTarget: 0,
    },
  });

  useEffect(() => {
    if (costs) {
      reset({
        registrationFee: costs.registrationFee,
        uniformCost: costs.uniformCost,
        tournamentFeePerEvent: costs.tournamentFeePerEvent,
        facilityFeePerSeason: costs.facilityFeePerSeason,
        equipmentFeePerSeason: costs.equipmentFeePerSeason,
        fundraisingTarget: costs.fundraisingTarget,
      });
    }
  }, [costs, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: CostFormData) =>
      costAssumptionsApi.update(
        {
          ...data,
          tournamentCost: data.tournamentFeePerEvent || 0,
          indoorFacilityCost: data.facilityFeePerSeason || 0,
          insurance: 0,
          adminFee: 0,
          otherCosts: [],
          season: new Date().getFullYear().toString(),
          updatedAt: new Date(),
          updatedBy: user?.uid || 'unknown',
        },
        user?.uid || 'unknown'
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costAssumptions'] });
      toast.success('Cost assumptions updated successfully');
    },
    onError: () => {
      toast.error('Failed to update cost assumptions');
    },
  });

  const onSubmit = (data: CostFormData) => {
    updateMutation.mutate(data);
  };

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Cost Assumptions
        </Typography>
        <Alert severity="warning">
          You do not have permission to view or edit cost assumptions.
        </Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cost Assumptions
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        These default costs are used to automatically calculate player fees. You can override
        these on a per-player basis in the Billing page.
      </Alert>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Registration Fee"
                type="number"
                {...register('registrationFee', { valueAsNumber: true })}
                error={!!errors.registrationFee}
                helperText={errors.registrationFee?.message || 'One-time registration fee per player'}
                fullWidth
                InputProps={{
                  startAdornment: '$',
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Uniform Cost"
                type="number"
                {...register('uniformCost', { valueAsNumber: true })}
                error={!!errors.uniformCost}
                helperText={errors.uniformCost?.message || 'Cost for jerseys, pants, socks, etc.'}
                fullWidth
                InputProps={{
                  startAdornment: '$',
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Tournament Fee (Per Event)"
                type="number"
                {...register('tournamentFeePerEvent', { valueAsNumber: true })}
                error={!!errors.tournamentFeePerEvent}
                helperText={
                  errors.tournamentFeePerEvent?.message ||
                  'Average cost per tournament (multiply by number of tournaments)'
                }
                fullWidth
                InputProps={{
                  startAdornment: '$',
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Facility Fee (Per Season)"
                type="number"
                {...register('facilityFeePerSeason', { valueAsNumber: true })}
                error={!!errors.facilityFeePerSeason}
                helperText={
                  errors.facilityFeePerSeason?.message || 'Indoor facility, practice field rentals per season'
                }
                fullWidth
                InputProps={{
                  startAdornment: '$',
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Equipment Fee (Per Season)"
                type="number"
                {...register('equipmentFeePerSeason', { valueAsNumber: true })}
                error={!!errors.equipmentFeePerSeason}
                helperText={
                  errors.equipmentFeePerSeason?.message || 'Bats, balls, helmets, catcher gear, etc.'
                }
                fullWidth
                InputProps={{
                  startAdornment: '$',
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Fundraising Target (Per Player)"
                type="number"
                {...register('fundraisingTarget', { valueAsNumber: true })}
                error={!!errors.fundraisingTarget}
                helperText={
                  errors.fundraisingTarget?.message ||
                  'Expected fundraising contribution per player to offset costs'
                }
                fullWidth
                InputProps={{
                  startAdornment: '$',
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  bgcolor: 'grey.100',
                  borderRadius: 1,
                }}
              >
                <Typography variant="h6">
                  Total Expected Cost Per Player:{' '}
                  <Typography component="span" variant="h6" color="primary">
                    $
                    {(
                      (costs?.registrationFee || 0) +
                      (costs?.uniformCost || 0) +
                      (costs?.facilityFeePerSeason || 0) +
                      (costs?.equipmentFeePerSeason || 0)
                    ).toFixed(2)}
                  </Typography>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  (Does not include tournament fees - those vary by # of events)
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={() => reset()}
                  disabled={!isDirty || updateMutation.isPending}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={!isDirty || updateMutation.isPending}
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default CostAssumptionsPage;
