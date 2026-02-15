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
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api/teams';
import { Team } from '@/types/models';
import toast from 'react-hot-toast';

const teamSchema = z.object({
  name: z.string().min(1, 'Team name is required'),
  ageGroup: z.string().min(1, 'Age group is required'),
  season: z.string().min(1, 'Season is required'),
  gcTeamId: z.string().optional(),
  active: z.boolean(),
});

type TeamFormData = z.infer<typeof teamSchema>;

interface TeamFormDialogProps {
  open: boolean;
  onClose: () => void;
  team: Team | null;
}

const TeamFormDialog = ({ open, onClose, team }: TeamFormDialogProps) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      ageGroup: '',
      season: '',
      gcTeamId: '',
      active: true,
    },
  });

  useEffect(() => {
    if (team) {
      reset({
        name: team.name,
        ageGroup: team.ageGroup,
        season: team.season,
        gcTeamId: team.gcTeamId || '',
        active: team.active,
      });
    } else {
      reset({
        name: '',
        ageGroup: '',
        season: '',
        gcTeamId: '',
        active: true,
      });
    }
  }, [team, reset]);

  const createMutation = useMutation({
    mutationFn: (data: TeamFormData) =>
      teamsApi.create({
        ...data,
        active: data.active,
      } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team created successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create team');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: TeamFormData) => teamsApi.update(team!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team updated successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update team');
    },
  });

  const onSubmit = (data: TeamFormData) => {
    if (team) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{team ? 'Edit Team' : 'Add New Team'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Team Name"
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
            />
            <TextField
              label="Age Group"
              placeholder="e.g., 10U, 12U, 14U"
              {...register('ageGroup')}
              error={!!errors.ageGroup}
              helperText={errors.ageGroup?.message}
              fullWidth
            />
            <TextField
              label="Season"
              placeholder="e.g., 2024 Spring, 2024 Summer"
              {...register('season')}
              error={!!errors.season}
              helperText={errors.season?.message}
              fullWidth
            />
            <TextField
              label="GameChanger Team ID"
              placeholder="e.g., JFnsbiN6fNjH"
              {...register('gcTeamId')}
              helperText="Found in the team's GameChanger URL: web.gc.com/teams/[ID]"
              fullWidth
            />
            <FormControlLabel
              control={<Checkbox {...register('active')} defaultChecked />}
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            {team ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TeamFormDialog;
