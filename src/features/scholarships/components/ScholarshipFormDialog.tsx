import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  MenuItem,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { scholarshipsApi } from '@/lib/api/scholarships';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import type { Scholarship } from '@/types/models';
import toast from 'react-hot-toast';

const scholarshipSchema = z.object({
  playerId: z.string().min(1, 'Player is required'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  reason: z.string().min(1, 'Reason is required'),
});

type ScholarshipFormData = z.infer<typeof scholarshipSchema>;

interface ScholarshipFormDialogProps {
  open: boolean;
  onClose: () => void;
  scholarship: Scholarship | null;
}

const ScholarshipFormDialog = ({ open, onClose, scholarship }: ScholarshipFormDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<ScholarshipFormData>({
    resolver: zodResolver(scholarshipSchema),
    defaultValues: {
      playerId: '',
      amount: 0,
      reason: '',
    },
  });

  useEffect(() => {
    if (scholarship) {
      reset({
        playerId: scholarship.playerId,
        amount: scholarship.amount,
        reason: scholarship.reason,
      });
    } else {
      reset({
        playerId: '',
        amount: 0,
        reason: '',
      });
    }
  }, [scholarship, reset]);

  const createMutation = useMutation({
    mutationFn: (data: ScholarshipFormData) => {
      const player = players.find(p => p.id === data.playerId);
      return scholarshipsApi.create({
        playerId: data.playerId,
        playerName: player ? `${player.firstName} ${player.lastName}` : '',
        amount: data.amount,
        reason: data.reason,
        approvedBy: user?.displayName || '',
        approvedAt: new Date(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scholarships'] });
      toast.success('Scholarship awarded successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to award scholarship');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: ScholarshipFormData) => {
      const player = players.find(p => p.id === data.playerId);
      return scholarshipsApi.update(scholarship!.id, {
        playerId: data.playerId,
        playerName: player ? `${player.firstName} ${player.lastName}` : '',
        amount: data.amount,
        reason: data.reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scholarships'] });
      toast.success('Scholarship updated successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update scholarship');
    },
  });

  const onSubmit = (data: ScholarshipFormData) => {
    if (scholarship) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>
          {scholarship ? 'Edit Scholarship' : 'Award Scholarship'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Controller
              name="playerId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Player"
                  error={!!errors.playerId}
                  helperText={errors.playerId?.message}
                  fullWidth
                >
                  {players.map(player => (
                    <MenuItem key={player.id} value={player.id}>
                      {player.firstName} {player.lastName}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <TextField
              label="Amount ($)"
              type="number"
              inputProps={{ step: '0.01', min: '0' }}
              {...register('amount')}
              error={!!errors.amount}
              helperText={errors.amount?.message}
              fullWidth
            />

            <TextField
              label="Reason"
              {...register('reason')}
              error={!!errors.reason}
              helperText={errors.reason?.message}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {scholarship ? 'Update' : 'Award'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default ScholarshipFormDialog;
