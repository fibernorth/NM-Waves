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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '@/lib/api/announcements';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import type { Announcement } from '@/types/models';
import toast from 'react-hot-toast';

const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  body: z.string().min(1, 'Body is required'),
  teamId: z.string().min(1, 'Team selection is required'),
  priority: z.enum(['normal', 'urgent']),
  pinned: z.boolean(),
});

type AnnouncementFormData = z.infer<typeof announcementSchema>;

interface AnnouncementFormDialogProps {
  open: boolean;
  onClose: () => void;
  announcement: Announcement | null;
}

const AnnouncementFormDialog = ({
  open,
  onClose,
  announcement,
}: AnnouncementFormDialogProps) => {
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
  } = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: '',
      body: '',
      teamId: 'all',
      priority: 'normal',
      pinned: false,
    },
  });

  useEffect(() => {
    if (announcement) {
      reset({
        title: announcement.title,
        body: announcement.body,
        teamId: announcement.teamId,
        priority: announcement.priority,
        pinned: announcement.pinned,
      });
    } else {
      reset({
        title: '',
        body: '',
        teamId: 'all',
        priority: 'normal',
        pinned: false,
      });
    }
  }, [announcement, reset]);

  const createMutation = useMutation({
    mutationFn: (data: AnnouncementFormData) =>
      announcementsApi.create({
        ...data,
        createdBy: user?.uid || '',
        createdByName: user?.displayName || '',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement created successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create announcement');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: AnnouncementFormData) =>
      announcementsApi.update(announcement!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement updated successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update announcement');
    },
  });

  const onSubmit = (data: AnnouncementFormData) => {
    if (announcement) {
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
          {announcement ? 'Edit Announcement' : 'New Announcement'}
        </DialogTitle>
        <DialogContent>
          <Box
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}
          >
            <TextField
              label="Title"
              {...register('title')}
              error={!!errors.title}
              helperText={errors.title?.message}
              fullWidth
            />
            <TextField
              label="Body"
              {...register('body')}
              error={!!errors.body}
              helperText={errors.body?.message}
              fullWidth
              multiline
              rows={4}
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
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Priority"
                  error={!!errors.priority}
                  helperText={errors.priority?.message}
                  fullWidth
                >
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="urgent">Urgent</MenuItem>
                </TextField>
              )}
            />
            <FormControlLabel
              control={
                <Controller
                  name="pinned"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      checked={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              }
              label="Pin this announcement"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {announcement ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default AnnouncementFormDialog;
