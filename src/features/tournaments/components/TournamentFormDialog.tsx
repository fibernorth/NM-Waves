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
  Chip,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tournamentsApi } from '@/lib/api/tournaments';
import { teamsApi } from '@/lib/api/teams';
import { Tournament } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const tournamentSchema = z.object({
  name: z.string().min(1, 'Tournament name is required'),
  location: z.string().min(1, 'Location is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  teamIds: z.array(z.string()),
  contact: z.string().optional(),
  cost: z.number().min(0, 'Cost must be 0 or greater'),
  notes: z.string().optional(),
  status: z.enum(['upcoming', 'in_progress', 'completed']),
});

type TournamentFormData = z.infer<typeof tournamentSchema>;

interface TournamentFormDialogProps {
  open: boolean;
  onClose: () => void;
  tournament: Tournament | null;
}

const TournamentFormDialog = ({ open, onClose, tournament }: TournamentFormDialogProps) => {
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<TournamentFormData>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: {
      name: '',
      location: '',
      startDate: '',
      endDate: '',
      teamIds: [],
      contact: '',
      cost: 0,
      notes: '',
      status: 'upcoming',
    },
  });

  useEffect(() => {
    if (tournament) {
      reset({
        name: tournament.name,
        location: tournament.location,
        startDate: format(tournament.startDate, 'yyyy-MM-dd'),
        endDate: format(tournament.endDate, 'yyyy-MM-dd'),
        teamIds: tournament.teamIds || [],
        contact: tournament.contact || '',
        cost: tournament.cost,
        notes: tournament.notes || '',
        status: tournament.status || 'upcoming',
      });
    } else {
      reset({
        name: '',
        location: '',
        startDate: '',
        endDate: '',
        teamIds: [],
        contact: '',
        cost: 0,
        notes: '',
        status: 'upcoming',
      });
    }
  }, [tournament, reset]);

  const createMutation = useMutation({
    mutationFn: (data: TournamentFormData) =>
      tournamentsApi.create({
        name: data.name,
        location: data.location,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        teamIds: data.teamIds,
        contact: data.contact,
        cost: data.cost,
        notes: data.notes,
        status: data.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Tournament created successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create tournament');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: TournamentFormData) =>
      tournamentsApi.update(tournament!.id, {
        name: data.name,
        location: data.location,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        teamIds: data.teamIds,
        contact: data.contact,
        cost: data.cost,
        notes: data.notes,
        status: data.status,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Tournament updated successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update tournament');
    },
  });

  const onSubmit = (data: TournamentFormData) => {
    if (tournament) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{tournament ? 'Edit Tournament' : 'Add New Tournament'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Tournament Name"
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
            />
            <TextField
              label="Location"
              {...register('location')}
              error={!!errors.location}
              helperText={errors.location?.message}
              fullWidth
            />
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
            <Controller
              name="teamIds"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Teams</InputLabel>
                  <Select
                    multiple
                    value={field.value}
                    onChange={field.onChange}
                    input={<OutlinedInput label="Teams" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((id) => {
                          const team = teams.find((t) => t.id === id);
                          return <Chip key={id} label={team?.name || id} size="small" />;
                        })}
                      </Box>
                    )}
                  >
                    {teams.map((team) => (
                      <MenuItem key={team.id} value={team.id}>
                        {team.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            <TextField
              label="Contact"
              {...register('contact')}
              error={!!errors.contact}
              helperText={errors.contact?.message}
              fullWidth
            />
            <TextField
              label="Cost"
              type="number"
              {...register('cost', { valueAsNumber: true })}
              error={!!errors.cost}
              helperText={errors.cost?.message}
              fullWidth
              InputProps={{ startAdornment: '$' }}
              inputProps={{ step: '0.01', min: '0' }}
            />
            <TextField
              label="Status"
              select
              {...register('status')}
              error={!!errors.status}
              helperText={errors.status?.message}
              fullWidth
              defaultValue={tournament?.status || 'upcoming'}
            >
              <MenuItem value="upcoming">Upcoming</MenuItem>
              <MenuItem value="in_progress">In Progress</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </TextField>
            <TextField
              label="Notes"
              {...register('notes')}
              error={!!errors.notes}
              helperText={errors.notes?.message}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : tournament ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TournamentFormDialog;
