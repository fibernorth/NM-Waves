import { useEffect, useState } from 'react';
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
  InputAdornment,
  IconButton,
} from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import { teamsApi } from '@/lib/api/teams';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
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
  email: z.string().email('Enter a valid email address'),
  newPassword: z
    .string()
    .refine((v) => v === '' || v.length >= 6, 'Password must be at least 6 characters'),
  roles: z.array(z.enum(['visitor', 'parent', 'coach', 'admin', 'master-admin', 'sponsor'])).min(1, 'At least one role is required'),
  canEditRosters: z.boolean(),
  canViewFinancials: z.boolean(),
  canManageSchedules: z.boolean(),
  canUploadMedia: z.boolean(),
  teamIds: z.array(z.string()),
  linkedPlayerIds: z.array(z.string()),
});

type UserEditFormData = z.infer<typeof userEditSchema>;

interface UserEditDialogProps {
  open: boolean;
  onClose: () => void;
  user: User | null;
}

const UserEditDialog = ({ open, onClose, user }: UserEditDialogProps) => {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
    enabled: open,
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
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
      email: '',
      newPassword: '',
      roles: ['visitor'],
      canEditRosters: false,
      canViewFinancials: false,
      canManageSchedules: false,
      canUploadMedia: false,
      teamIds: [],
      linkedPlayerIds: [],
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        email: user.email || '',
        newPassword: '',
        roles: user.roles?.length ? user.roles : ['visitor'],
        canEditRosters: user.permissions?.canEditRosters ?? false,
        canViewFinancials: user.permissions?.canViewFinancials ?? false,
        canManageSchedules: user.permissions?.canManageSchedules ?? false,
        canUploadMedia: user.permissions?.canUploadMedia ?? false,
        teamIds: user.teamIds || [],
        linkedPlayerIds: user.linkedPlayerIds || [],
      });
    } else {
      reset({
        email: '',
        newPassword: '',
        roles: ['visitor'],
        canEditRosters: false,
        canViewFinancials: false,
        canManageSchedules: false,
        canUploadMedia: false,
        teamIds: [],
        linkedPlayerIds: [],
      });
    }
  }, [user, reset]);

  const updateMutation = useMutation({
    mutationFn: async (data: UserEditFormData) => {
      // Email and password are Firebase Auth changes — routed through the
      // admin callable. Only call it when something actually changed.
      const emailChanged =
        data.email.trim().toLowerCase() !== (user!.email || '').trim().toLowerCase();
      const settingPassword = data.newPassword.trim().length > 0;
      if (emailChanged || settingPassword) {
        await usersApi.updateAuth(user!.uid, {
          email: emailChanged ? data.email.trim() : undefined,
          password: settingPassword ? data.newPassword : undefined,
        });
      }

      await usersApi.update(user!.uid, {
        roles: data.roles,
        permissions: {
          canEditRosters: data.canEditRosters,
          canViewFinancials: data.canViewFinancials,
          canManageSchedules: data.canManageSchedules,
          canUploadMedia: data.canUploadMedia,
        },
        teamIds: data.teamIds,
        linkedPlayerIds: data.linkedPlayerIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User updated successfully');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update user');
    },
  });

  const onSubmit = (data: UserEditFormData) => {
    updateMutation.mutate(data);
  };

  const isSubmitting = updateMutation.isPending;

  // Password reset is offered only for parent (non-admin) accounts — admins and
  // master-admins reset their own passwords from the sign-in page, and the
  // backend refuses to change them here.
  const targetRoles = user?.roles || [];
  const targetIsAdmin = targetRoles.includes('admin') || targetRoles.includes('master-admin');
  const canManagePassword = targetRoles.includes('parent') && !targetIsAdmin;

  // The backend only lets a master-admin change an admin's login email; lock the
  // field (rather than let the save fail) when that isn't allowed.
  const callerIsMaster = (currentUser?.roles || []).includes('master-admin');
  const emailLocked = targetIsAdmin && !callerIsMaster;

  const [showPassword, setShowPassword] = useState(false);

  const teamOptions = teams.map(t => ({ id: t.id, label: `${t.name} (${t.ageGroup})` }));
  const playerOptions = players.map(p => ({ id: p.id, label: `${p.firstName} ${p.lastName}${p.teamName ? ` (${p.teamName})` : ''}` }));

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

            <Controller
              name="email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Login Email"
                  type="email"
                  fullWidth
                  disabled={emailLocked}
                  error={!!errors.email}
                  helperText={
                    emailLocked
                      ? "Only a master admin can change an admin account's login email"
                      : errors.email?.message || 'Changing this updates the account they sign in with'
                  }
                />
              )}
            />

            {canManagePassword && (
              <Controller
                name="newPassword"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Set New Password"
                    type={showPassword ? 'text' : 'password'}
                    fullWidth
                    autoComplete="new-password"
                    error={!!errors.newPassword}
                    helperText={
                      errors.newPassword?.message ||
                      'Optional — enter to set this parent a new password (leave blank to keep current)'
                    }
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                            onClick={() => setShowPassword((s) => !s)}
                            edge="end"
                            tabIndex={-1}
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            )}

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

            <Controller
              name="linkedPlayerIds"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  multiple
                  options={playerOptions}
                  getOptionLabel={(option) => option.label}
                  value={playerOptions.filter(p => field.value.includes(p.id))}
                  onChange={(_, newValue) => {
                    field.onChange(newValue.map(v => v.id));
                  }}
                  isOptionEqualToValue={(option, value) => option.id === value.id}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Linked Players"
                      placeholder="Search players"
                      helperText="Link children to this parent/coach account"
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
