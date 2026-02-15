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
  Typography,
  Autocomplete,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { teamsApi } from '@/lib/api/teams';
import type { User, UserRole } from '@/types/models';
import toast from 'react-hot-toast';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'visitor', label: 'Visitor' },
  { value: 'parent', label: 'Parent' },
  { value: 'coach', label: 'Coach' },
  { value: 'admin', label: 'Admin' },
  { value: 'master-admin', label: 'Super Admin' },
  { value: 'sponsor', label: 'Sponsor' },
];

const userEditSchema = z.object({
  roles: z.array(z.enum(['visitor', 'parent', 'coach', 'admin', 'master-admin', 'sponsor'])).min(1, 'At least one role is required'),
  canEditRosters: z.boolean(),
  canViewFinancials: z.boolean(),
  canManageSchedules: z.boolean(),
  canUploadMedia: z.boolean(),
  teamIds: z.array(z.string()),
});

type UserEditFormData = z.infer<typeof userEditSchema>;

interface UserEditDialogProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

const UserEditDialog = ({ open, onClose, user }: UserEditDialogProps) => {
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
    enabled: open,
  });

  const {
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<UserEditFormData>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      roles: ['visitor'],
      canEditRosters: false,
      canViewFinancials: false,
      canManageSchedules: false,
      canUploadMedia: false,
      teamIds: [],
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        roles: user.roles?.length ? user.roles : ['visitor'],
        canEditRosters: user.permissions?.canEditRosters ?? false,
        canViewFinancials: user.permissions?.canViewFinancials ?? false,
        canManageSchedules: user.permissions?.canManageSchedules ?? false,
        canUploadMedia: user.permissions?.canUploadMedia ?? false,
        teamIds: user.teamIds || [],
      });
    } else {
      reset({
        roles: ['visitor'],
        canEditRosters: false,
        canViewFinancials: false,
        canManageSchedules: false,
        canUploadMedia: false,
        teamIds: [],
      });
    }
  }, [user, reset]);

  const updateMutation = useMutation({
    mutationFn: (data: UserEditFormData) => {
      return usersApi.update(user!.uid, {
        roles: data.roles,
        permissions: {
          canEditRosters: data.canEditRosters,
          canViewFinancials: data.canViewFinancials,
          canManageSchedules: data.canManageSchedules,
          canUploadMedia: data.canUploadMedia,
        },
        teamIds: data.teamIds,
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

  const teamOptions = teams.map(t => ({ id: t.id, label: `${t.name} (${t.ageGroup})` }));

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

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Roles
              </Typography>
              {errors.roles && (
                <Typography variant="caption" color="error">{errors.roles.message}</Typography>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', pl: 1 }}>
                {ROLES.map(role => (
                  <Controller
                    key={role.value}
                    name="roles"
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={field.value.includes(role.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                field.onChange([...field.value, role.value]);
                              } else {
                                field.onChange(field.value.filter((r: string) => r !== role.value));
                              }
                            }}
                          />
                        }
                        label={role.label}
                      />
                    )}
                  />
                ))}
              </Box>
            </Box>

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

            <Controller
              name="teamIds"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  multiple
                  options={teamOptions}
                  getOptionLabel={(option) => option.label}
                  value={teamOptions.filter(t => field.value.includes(t.id))}
                  onChange={(_, newValue) => {
                    field.onChange(newValue.map(v => v.id));
                  }}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Teams"
                      placeholder="Select teams"
                      helperText="Assign user to one or more teams"
                    />
                  )}
                />
              )}
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
