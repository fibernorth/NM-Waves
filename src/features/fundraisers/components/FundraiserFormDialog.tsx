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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fundraisersApi } from '@/lib/api/fundraisers';
import { teamsApi } from '@/lib/api/teams';
import { Fundraiser } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const fundraiserSchema = z.object({
  name: z.string().min(1, 'Fundraiser name is required'),
  description: z.string().optional(),
  goal: z.number().min(1, 'Goal must be greater than 0'),
  teamId: z.string().min(1, 'Team is required'),
  status: z.enum(['active', 'completed']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type FundraiserFormData = z.infer<typeof fundraiserSchema>;

interface FundraiserFormDialogProps {
  open: boolean;
  onClose: () => void;
  fundraiser: Fundraiser | null;
}

const FundraiserFormDialog = ({ open, onClose, fundraiser }: FundraiserFormDialogProps) => {
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FundraiserFormData>({
    resolver: zodResolver(fundraiserSchema),
    defaultValues: {
      name: '',
      description: '',
      goal: 0,
      teamId: '',
      status: 'active',
      startDate: '',
      endDate: '',
    },
  });

  useEffect(() => {
    if (fundraiser) {
      reset({
        name: fundraiser.name,
        description: fundraiser.description || '',
        goal: fundraiser.goal,
        teamId: fundraiser.teamId,
        status: fundraiser.status,
        startDate: fundraiser.startDate ? format(fundraiser.startDate, 'yyyy-MM-dd') : '',
        endDate: fundraiser.endDate ? format(fundraiser.endDate, 'yyyy-MM-dd') : '',
      });
    } else {
      reset({
        name: '',
        description: '',
        goal: 0,
        teamId: '',
        status: 'active',
        startDate: '',
        endDate: '',
      });
    }
  }, [fundraiser, reset]);

  const createMutation = useMutation({
    mutationFn: (data: FundraiserFormData) =>
      fundraisersApi.create({
        name: data.name,
        description: data.description,
        goal: data.goal,
        teamId: data.teamId,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
      toast.success('Fundraiser created successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create fundraiser');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: FundraiserFormData) =>
      fundraisersApi.update(fundraiser!.id, {
        name: data.name,
        description: data.description,
        goal: data.goal,
        teamId: data.teamId,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
      toast.success('Fundraiser updated successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update fundraiser');
    },
  });

  const onSubmit = (data: FundraiserFormData) => {
    if (fundraiser) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{fundraiser ? 'Edit Fundraiser' : 'Add New Fundraiser'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Fundraiser Name"
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
            />
            <TextField
              label="Description"
              {...register('description')}
              error={!!errors.description}
              helperText={errors.description?.message}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Goal Amount"
              type="number"
              {...register('goal', { valueAsNumber: true })}
              error={!!errors.goal}
              helperText={errors.goal?.message}
              fullWidth
              InputProps={{ startAdornment: '$' }}
              inputProps={{ step: '0.01', min: '1' }}
            />
            <TextField
              label="Team"
              select
              {...register('teamId')}
              error={!!errors.teamId}
              helperText={errors.teamId?.message}
              fullWidth
              defaultValue={fundraiser?.teamId || ''}
            >
              <MenuItem value="all">All Teams</MenuItem>
              {teams.map((team) => (
                <MenuItem key={team.id} value={team.id}>
                  {team.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Status"
              select
              {...register('status')}
              error={!!errors.status}
              helperText={errors.status?.message}
              fullWidth
              defaultValue={fundraiser?.status || 'active'}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </TextField>
            <TextField
              label="Start Date"
              type="date"
              {...register('startDate')}
              error={!!errors.startDate}
              helperText={errors.startDate?.message}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="End Date"
              type="date"
              {...register('endDate')}
              error={!!errors.endDate}
              helperText={errors.endDate?.message}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : fundraiser ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default FundraiserFormDialog;
