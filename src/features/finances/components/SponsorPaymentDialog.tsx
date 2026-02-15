import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Autocomplete,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { playerFinancesApi } from '@/lib/api/finances';
import { incomeApi } from '@/lib/api/accounting';
import { sponsorsApi } from '@/lib/api/sponsors';
import { useAuthStore } from '@/stores/authStore';
import { Sponsor, PlayerFinance } from '@/types/models';
import toast from 'react-hot-toast';

const sponsorPaymentSchema = z.object({
  sponsorId: z.string().min(1, 'Sponsor is required'),
  financeId: z.string().min(1, 'Player is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  notes: z.string().optional(),
});

type SponsorPaymentFormData = z.infer<typeof sponsorPaymentSchema>;

interface SponsorPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  finances: PlayerFinance[];
}

const SponsorPaymentDialog = ({ open, onClose, finances }: SponsorPaymentDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [, setSelectedSponsor] = useState<Sponsor | null>(null);

  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => sponsorsApi.getAll(),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<SponsorPaymentFormData>({
    resolver: zodResolver(sponsorPaymentSchema),
    defaultValues: {
      sponsorId: '',
      financeId: '',
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: SponsorPaymentFormData) => {
      const sponsor = sponsors.find((s) => s.id === data.sponsorId);
      const finance = finances.find((f) => f.id === data.financeId);
      if (!sponsor || !finance) throw new Error('Invalid sponsor or player');

      // 1. Record payment on player finance
      const paymentId = await playerFinancesApi.addPayment(data.financeId, {
        amount: data.amount,
        date: new Date(data.date),
        method: 'sponsor',
        notes: data.notes || `Sponsored by ${sponsor.businessName}`,
        sponsorId: data.sponsorId,
        sponsorName: sponsor.businessName,
        recordedBy: user?.uid || 'unknown',
      });

      // 2. Create income record
      await incomeApi.create({
        date: new Date(data.date),
        category: 'sponsorships',
        amount: data.amount,
        source: sponsor.businessName,
        description: `Sponsor payment for ${finance.playerName}`,
        paymentMethod: 'other',
        playerId: finance.playerId,
        season: finance.season,
        notes: data.notes,
        recordedBy: user?.uid || 'unknown',
      });

      // 3. Update sponsor's sponsoredPlayers
      await sponsorsApi.addSponsoredPlayer(data.sponsorId, {
        playerId: finance.playerId,
        playerName: finance.playerName,
        amount: data.amount,
        paymentId,
        date: new Date(data.date),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      queryClient.invalidateQueries({ queryKey: ['income'] });
      toast.success('Sponsor payment recorded successfully');
      reset();
      setSelectedSponsor(null);
      onClose();
    },
    onError: () => {
      toast.error('Failed to record sponsor payment');
    },
  });

  const onSubmit = (data: SponsorPaymentFormData) => {
    mutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    setSelectedSponsor(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>Record Sponsor Payment</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Record a payment from a sponsor on behalf of a player. This will create a payment on
              the player's account, an income record, and update the sponsor's records.
            </Typography>

            <Controller
              name="sponsorId"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  options={sponsors}
                  getOptionLabel={(option) => option.businessName}
                  value={sponsors.find((s) => s.id === field.value) || null}
                  onChange={(_, newValue) => {
                    field.onChange(newValue?.id || '');
                    setSelectedSponsor(newValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Sponsor"
                      error={!!errors.sponsorId}
                      helperText={errors.sponsorId?.message}
                      required
                    />
                  )}
                />
              )}
            />

            <Controller
              name="financeId"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  options={finances}
                  getOptionLabel={(option) => `${option.playerName} (${option.teamName})`}
                  value={finances.find((f) => f.id === field.value) || null}
                  onChange={(_, newValue) => field.onChange(newValue?.id || '')}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Player"
                      error={!!errors.financeId}
                      helperText={errors.financeId?.message}
                      required
                    />
                  )}
                />
              )}
            />

            <TextField
              label="Payment Amount"
              type="number"
              {...register('amount', { valueAsNumber: true })}
              error={!!errors.amount}
              helperText={errors.amount?.message}
              fullWidth
              InputProps={{ startAdornment: '$' }}
              inputProps={{ step: '0.01' }}
            />

            <TextField
              label="Payment Date"
              type="date"
              {...register('date')}
              error={!!errors.date}
              helperText={errors.date?.message}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="Notes"
              {...register('notes')}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={mutation.isPending}>
            {mutation.isPending ? 'Recording...' : 'Record Sponsor Payment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default SponsorPaymentDialog;
