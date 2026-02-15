import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  MenuItem,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { playersApi } from '@/lib/api/players';
import { teamsApi } from '@/lib/api/teams';
import { Player } from '@/types/models';
import toast from 'react-hot-toast';

const playerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  teamId: z.string().optional(),
  jerseyNumber: z.string().optional(),
  positions: z.string().optional(),
  bats: z.string().optional(),
  throws: z.string().optional(),
  parentName: z.string().min(1, 'Parent name is required'),
  parentEmail: z.string().email('Invalid email address'),
  parentPhone: z.string().min(1, 'Parent phone is required'),
  emergencyContact: z.string().min(1, 'Emergency contact is required'),
  emergencyPhone: z.string().min(1, 'Emergency phone is required'),
  medicalNotes: z.string().optional(),
  notes: z.string().optional(),
  playingUpFrom: z.string().optional(),
  active: z.boolean(),
});

type PlayerFormData = z.infer<typeof playerSchema>;

interface PlayerFormDialogProps {
  open: boolean;
  onClose: () => void;
  player: Player | null;
}

const PlayerFormDialog = ({ open, onClose, player }: PlayerFormDialogProps) => {
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
  } = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      teamId: '',
      jerseyNumber: '',
      positions: '',
      bats: '',
      throws: '',
      parentName: '',
      parentEmail: '',
      parentPhone: '',
      emergencyContact: '',
      emergencyPhone: '',
      medicalNotes: '',
      notes: '',
      playingUpFrom: '',
      active: true,
    },
  });

  useEffect(() => {
    if (player) {
      reset({
        firstName: player.firstName,
        lastName: player.lastName,
        dateOfBirth: player.dateOfBirth ? player.dateOfBirth.toISOString().split('T')[0] : '',
        teamId: player.teamId || '',
        jerseyNumber: player.jerseyNumber != null ? String(player.jerseyNumber) : '',
        positions: Array.isArray(player.positions) ? player.positions.join(', ') : '',
        bats: player.bats || '',
        throws: player.throws || '',
        parentName: player.parentName,
        parentEmail: player.parentEmail,
        parentPhone: player.parentPhone,
        emergencyContact: player.emergencyContact,
        emergencyPhone: player.emergencyPhone,
        medicalNotes: player.medicalNotes || '',
        notes: player.notes || '',
        playingUpFrom: player.playingUpFrom || '',
        active: player.active,
      });
    } else {
      reset({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        teamId: '',
        jerseyNumber: '',
        positions: '',
        bats: '',
        throws: '',
        parentName: '',
        parentEmail: '',
        parentPhone: '',
        emergencyContact: '',
        emergencyPhone: '',
        medicalNotes: '',
        notes: '',
        playingUpFrom: '',
        active: true,
      });
    }
  }, [player, reset]);

  const createMutation = useMutation({
    mutationFn: async (data: PlayerFormData) => {
      const team = teams.find(t => t.id === data.teamId);
      return playersApi.create({
        ...data,
        dateOfBirth: new Date(data.dateOfBirth),
        teamName: team?.name,
        jerseyNumber: data.jerseyNumber ? parseInt(data.jerseyNumber) : undefined,
        positions: data.positions ? data.positions.split(',').map(p => p.trim()).filter(Boolean) : [],
        bats: (data.bats as 'L' | 'R' | 'S') || undefined,
        throws: (data.throws as 'L' | 'R') || undefined,
        notes: data.notes || undefined,
        playingUpFrom: data.playingUpFrom || undefined,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Player created successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create player');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PlayerFormData) => {
      const team = teams.find(t => t.id === data.teamId);
      return playersApi.update(player!.id, {
        ...data,
        dateOfBirth: new Date(data.dateOfBirth),
        teamName: team?.name,
        jerseyNumber: data.jerseyNumber ? parseInt(data.jerseyNumber) : undefined,
        positions: data.positions ? data.positions.split(',').map(p => p.trim()).filter(Boolean) : [],
        bats: (data.bats as 'L' | 'R' | 'S') || undefined,
        throws: (data.throws as 'L' | 'R') || undefined,
        notes: data.notes || undefined,
        playingUpFrom: data.playingUpFrom || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Player updated successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update player');
    },
  });

  const onSubmit = (data: PlayerFormData) => {
    if (player) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{player ? 'Edit Player' : 'Add New Player'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="First Name"
                {...register('firstName')}
                error={!!errors.firstName}
                helperText={errors.firstName?.message}
                fullWidth
              />
              <TextField
                label="Last Name"
                {...register('lastName')}
                error={!!errors.lastName}
                helperText={errors.lastName?.message}
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Date of Birth"
                type="date"
                {...register('dateOfBirth')}
                error={!!errors.dateOfBirth}
                helperText={errors.dateOfBirth?.message}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Team"
                select
                {...register('teamId')}
                error={!!errors.teamId}
                helperText={errors.teamId?.message}
                fullWidth
              >
                <MenuItem value="">
                  <em>No Team</em>
                </MenuItem>
                {teams.filter(t => t.active).map(team => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Jersey Number"
                type="number"
                {...register('jerseyNumber')}
                fullWidth
              />
              <TextField
                label="Positions"
                placeholder="e.g., P, SS, CF"
                {...register('positions')}
                helperText="Comma-separated"
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <TextField
                label="Bats"
                select
                {...register('bats')}
                fullWidth
              >
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
                <MenuItem value="L">Left</MenuItem>
                <MenuItem value="R">Right</MenuItem>
                <MenuItem value="S">Switch</MenuItem>
              </TextField>
              <TextField
                label="Throws"
                select
                {...register('throws')}
                fullWidth
              >
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
                <MenuItem value="L">Left</MenuItem>
                <MenuItem value="R">Right</MenuItem>
              </TextField>
              <TextField
                label="Playing Up From"
                placeholder="e.g., 12U"
                {...register('playingUpFrom')}
                fullWidth
              />
            </Box>

            <TextField
              label="Notes"
              {...register('notes')}
              multiline
              rows={2}
              fullWidth
            />

            <TextField
              label="Parent/Guardian Name"
              {...register('parentName')}
              error={!!errors.parentName}
              helperText={errors.parentName?.message}
              fullWidth
            />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Parent Email"
                type="email"
                {...register('parentEmail')}
                error={!!errors.parentEmail}
                helperText={errors.parentEmail?.message}
                fullWidth
              />
              <TextField
                label="Parent Phone"
                {...register('parentPhone')}
                error={!!errors.parentPhone}
                helperText={errors.parentPhone?.message}
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Emergency Contact"
                {...register('emergencyContact')}
                error={!!errors.emergencyContact}
                helperText={errors.emergencyContact?.message}
                fullWidth
              />
              <TextField
                label="Emergency Phone"
                {...register('emergencyPhone')}
                error={!!errors.emergencyPhone}
                helperText={errors.emergencyPhone?.message}
                fullWidth
              />
            </Box>

            <TextField
              label="Medical Notes"
              {...register('medicalNotes')}
              error={!!errors.medicalNotes}
              helperText={errors.medicalNotes?.message}
              multiline
              rows={3}
              fullWidth
            />

            <FormControlLabel
              control={
                <Controller
                  name="active"
                  control={control}
                  render={({ field }) => (
                    <Checkbox {...field} checked={field.value} />
                  )}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            {player ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PlayerFormDialog;
