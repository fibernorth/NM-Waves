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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { schedulesApi } from '@/lib/api/schedules';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import type { ScheduleEvent } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const eventSchema = z
  .object({
    title: z.string().min(1, 'Title is required'),
    eventType: z.enum(['game', 'practice', 'tournament', 'meeting', 'other']),
    teamId: z.string().min(1, 'Team is required'),
    location: z.string().min(1, 'Location is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string().min(1, 'End time is required'),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startTime && data.endTime) {
        return new Date(data.endTime) > new Date(data.startTime);
      }
      return true;
    },
    { message: 'End time must be after start time', path: ['endTime'] }
  );

type EventFormData = z.infer<typeof eventSchema>;

const EVENT_TYPES = [
  { value: 'game', label: 'Game' },
  { value: 'practice', label: 'Practice' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
];

interface EventFormDialogProps {
  open: boolean;
  onClose: () => void;
  event: ScheduleEvent | null;
}

const formatDateForInput = (date: Date): string => {
  return format(date, "yyyy-MM-dd'T'HH:mm");
};

const EventFormDialog = ({ open, onClose, event }: EventFormDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

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
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: '',
      eventType: 'practice',
      teamId: 'all',
      location: '',
      startTime: '',
      endTime: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (event) {
      reset({
        title: event.title,
        eventType: event.eventType,
        teamId: event.teamId,
        location: event.location,
        startTime: formatDateForInput(event.startTime),
        endTime: formatDateForInput(event.endTime),
        notes: event.notes || '',
      });
    } else {
      reset({
        title: '',
        eventType: 'practice',
        teamId: 'all',
        location: '',
        startTime: '',
        endTime: '',
        notes: '',
      });
    }
  }, [event, reset]);

  const createMutation = useMutation({
    mutationFn: (data: EventFormData) => {
      const selectedTeam = teams.find((t) => t.id === data.teamId);
      return schedulesApi.create({
        title: data.title,
        eventType: data.eventType,
        teamId: data.teamId,
        teamName: data.teamId === 'all' ? 'All Teams' : selectedTeam?.name || '',
        location: data.location,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        notes: data.notes || undefined,
        createdBy: user?.uid || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Event created successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create event');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: EventFormData) => {
      const selectedTeam = teams.find((t) => t.id === data.teamId);
      return schedulesApi.update(event!.id, {
        title: data.title,
        eventType: data.eventType,
        teamId: data.teamId,
        teamName: data.teamId === 'all' ? 'All Teams' : selectedTeam?.name || '',
        location: data.location,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        notes: data.notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Event updated successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update event');
    },
  });

  const onSubmit = (data: EventFormData) => {
    if (event) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{event ? 'Edit Event' : 'Add New Event'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              {...register('title')}
              error={!!errors.title}
              helperText={errors.title?.message}
              fullWidth
            />
            <Controller
              name="eventType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Event Type"
                  error={!!errors.eventType}
                  helperText={errors.eventType?.message}
                  fullWidth
                >
                  {EVENT_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
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
                  <MenuItem value="all">All Teams</MenuItem>
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>
                      {team.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            <TextField
              label="Location"
              {...register('location')}
              error={!!errors.location}
              helperText={errors.location?.message}
              fullWidth
            />
            <TextField
              label="Start Time"
              type="datetime-local"
              {...register('startTime')}
              error={!!errors.startTime}
              helperText={errors.startTime?.message}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="End Time"
              type="datetime-local"
              {...register('endTime')}
              error={!!errors.endTime}
              helperText={errors.endTime?.message}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Notes"
              {...register('notes')}
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
            {event ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EventFormDialog;
