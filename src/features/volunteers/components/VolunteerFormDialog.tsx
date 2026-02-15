import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { volunteersApi } from '@/lib/api/volunteers';
import type { Volunteer, ScheduleEvent, Team } from '@/types/models';
import toast from 'react-hot-toast';

const volunteerSchema = z.object({
  eventId: z.string().min(1, 'Event is required'),
  teamId: z.string().min(1, 'Team is required'),
  role: z.string().min(1, 'Role is required'),
  assignedTo: z.string().min(1, 'Assigned person is required'),
  assignedToName: z.string().optional(),
  status: z.enum(['assigned', 'confirmed', 'completed']),
});

type VolunteerFormData = z.infer<typeof volunteerSchema>;

const COMMON_ROLES = [
  'Scorekeeper',
  'Dugout Parent',
  'Gate Attendant',
  'Concession Stand',
  'Field Prep',
  'Pitch Counter',
  'Team Mom/Dad',
  'Photographer',
  'Other',
];

interface VolunteerFormDialogProps {
  open: boolean;
  onClose: () => void;
  volunteer: Volunteer | null;
  events: ScheduleEvent[];
  teams: Team[];
}

const VolunteerFormDialog = ({
  open,
  onClose,
  volunteer,
  events,
  teams,
}: VolunteerFormDialogProps) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<VolunteerFormData>({
    resolver: zodResolver(volunteerSchema),
    defaultValues: {
      eventId: '',
      teamId: '',
      role: '',
      assignedTo: '',
      assignedToName: '',
      status: 'assigned',
    },
  });

  const watchedEventId = watch('eventId');

  useEffect(() => {
    if (watchedEventId && !volunteer) {
      const selectedEvent = events.find((e) => e.id === watchedEventId);
      if (selectedEvent && selectedEvent.teamId !== 'all') {
        setValue('teamId', selectedEvent.teamId);
      }
    }
  }, [watchedEventId, events, setValue, volunteer]);

  useEffect(() => {
    if (volunteer) {
      reset({
        eventId: volunteer.eventId,
        teamId: volunteer.teamId,
        role: volunteer.role,
        assignedTo: volunteer.assignedTo,
        assignedToName: volunteer.assignedToName || '',
        status: volunteer.status,
      });
    } else {
      reset({
        eventId: '',
        teamId: '',
        role: '',
        assignedTo: '',
        assignedToName: '',
        status: 'assigned',
      });
    }
  }, [volunteer, reset]);

  const createMutation = useMutation({
    mutationFn: (data: VolunteerFormData) => {
      const selectedEvent = events.find((e) => e.id === data.eventId);
      const selectedTeam = teams.find((t) => t.id === data.teamId);
      return volunteersApi.create({
        eventId: data.eventId,
        eventTitle: selectedEvent?.title || '',
        teamId: data.teamId,
        teamName: selectedTeam?.name || '',
        role: data.role,
        assignedTo: data.assignedTo,
        assignedToName: data.assignedToName || data.assignedTo,
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      toast.success('Volunteer assigned successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to assign volunteer');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: VolunteerFormData) => {
      const selectedEvent = events.find((e) => e.id === data.eventId);
      const selectedTeam = teams.find((t) => t.id === data.teamId);
      return volunteersApi.update(volunteer!.id, {
        eventId: data.eventId,
        eventTitle: selectedEvent?.title || '',
        teamId: data.teamId,
        teamName: selectedTeam?.name || '',
        role: data.role,
        assignedTo: data.assignedTo,
        assignedToName: data.assignedToName || data.assignedTo,
        status: data.status,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      toast.success('Volunteer assignment updated');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update assignment');
    },
  });

  const onSubmit = (data: VolunteerFormData) => {
    if (volunteer) {
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
          {volunteer ? 'Edit Volunteer Assignment' : 'Assign Volunteer'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Controller
              name="eventId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Event"
                  error={!!errors.eventId}
                  helperText={errors.eventId?.message}
                  fullWidth
                >
                  {events.map((ev) => (
                    <MenuItem key={ev.id} value={ev.id}>
                      {ev.title}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <Controller
              name="teamId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Team"
                  error={!!errors.teamId}
                  helperText={errors.teamId?.message}
                  fullWidth
                >
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField
              label="Role"
              placeholder="e.g., Scorekeeper, Dugout Parent, Gate"
              {...register('role')}
              error={!!errors.role}
              helperText={
                errors.role?.message ||
                `Common roles: ${COMMON_ROLES.slice(0, 4).join(', ')}...`
              }
              fullWidth
            />
            <TextField
              label="Assigned To (Name)"
              placeholder="Name of the volunteer"
              {...register('assignedToName')}
              fullWidth
            />
            <TextField
              label="Assigned To (ID/Email)"
              placeholder="User ID or email"
              {...register('assignedTo')}
              error={!!errors.assignedTo}
              helperText={errors.assignedTo?.message}
              fullWidth
            />
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Status"
                  error={!!errors.status}
                  helperText={errors.status?.message}
                  fullWidth
                >
                  <MenuItem value="assigned">Assigned</MenuItem>
                  <MenuItem value="confirmed">Confirmed</MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </TextField>
              )}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {volunteer ? 'Update' : 'Assign'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default VolunteerFormDialog;
