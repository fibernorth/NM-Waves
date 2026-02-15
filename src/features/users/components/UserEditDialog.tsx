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
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import type { User, UserRole } from '@/types/models';
import toast from 'react-hot-toast';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'visitor', label: 'Visitor' },
  { value: 'parent', label: 'Parent' },
  { value: 'coach', label: 'Coach' },
  { value: 'admin', label: 'Admin' },
  { value: 'master-admin', label: 'Super Admin' },
];

const userEditSchema = z.object({
  role: z.enum(['visitor', 'parent', 'coach', 'admin', 'master-admin']),
  canEditRosters: z.boolean(),
  canViewFinancials: z.boolean(),
  canManageSchedules: z.boolean(),
  canUploadMedia: z.boolean(),
  teamIds: z.string(),
});

type UserEditFormData = z.infer<typeof userEditSchema>;

interface UserEditDialogProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

const UserEditDialog = ({ open, onClose, user }: UserEditDialogProps) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<UserEditFormData>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      role: 'visitor',
      canEditRosters: false,
      canViewFinancials: false,
      canManageSchedules: false,
      canUploadMedia: false,
      teamIds: '',
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        role: user.role,
        canEditRosters: user.permissions?.canEditRosters ?? false,
        canViewFinancials: user.permissions?.canViewFinancials ?? false,
        canManageSchedules: user.permissions?.canManageSchedules ?? false,
        canUploadMedia: user.permissions?.canUploadMedia ?? false,
        teamIds: (user.teamIds || []).join(', '),
      });
    } else {
      reset({
        role: 'visitor',
        canEditRosters: false,
        canViewFinancials: false,
        canManageSchedules: false,
        canUploadMedia: false,
        teamIds: '',
      });
    }
  }, [user, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: UserEditFormData) => {
      const teamIdsArray = data.teamIds
        .split(',')
        .map(id => id.trim())
        .filter(id => id.length > 0);

      return usersApi.update(user!.uid, {
        role: data.role,
        permissions: {
          canEditRosters: data.canEditRosters,
          canViewFinancials: data.canViewFinancials,
          canManageSchedules: data.canManageSchedules,
          canUploadMedia: data.canUploadMedia,
        },
        teamIds: teamIdsArray,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update user');
    },
  });

  const onSubmit = (data: UserEditFormData) => {
    updateMutation.mutate(data);
  };

  const isSubmitting = updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Display Name
              </Typography>
              <Typography variant="body1">{user?.displayName || '-'}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" color="text.secondary">
                Email
              </Typography>
              <Typography variant="body1">{user?.email || '-'}</Typography>
            </Box>

            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Role"
                  error={!!errors.role}
                  helperText={errors.role?.message}
                  fullWidth
                >
                  {ROLES.map(role => (
                    <MenuItem key={role.value} value={role.value}>
                      {role.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Permissions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', pl: 1 }}>
                <FormControlLabel
                  control={
                    <Controller
                      name="canEditRosters"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onChange={field.onChange} />
                      )}
                    />
                  }
                  label="Can Edit Rosters"
                />
                <FormControlLabel
                  control={
                    <Controller
                      name="canViewFinancials"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onChange={field.onChange} />
                      )}
                    />
                  }
                  label="Can View Financials"
                />
                <FormControlLabel
                  control={
                    <Controller
                      name="canManageSchedules"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onChange={field.onChange} />
                      )}
                    />
                  }
                  label="Can Manage Schedules"
                />
                <FormControlLabel
                  control={
                    <Controller
                      name="canUploadMedia"
                      control={control}
                      render={({ field }) => (
                        <Checkbox checked={field.value} onChange={field.onChange} />
                      )}
                    />
                  }
                  label="Can Upload Media"
                />
              </Box>
            </Box>

            <TextField
              label="Team IDs"
              placeholder="Comma-separated team IDs"
              {...register('teamIds')}
              error={!!errors.teamIds}
              helperText={errors.teamIds?.message || 'Enter team IDs separated by commas'}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            Update
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserEditDialog;
