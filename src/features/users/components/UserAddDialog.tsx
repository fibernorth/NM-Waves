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
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi } from '@/lib/api/users';
import type { UserRole } from '@/types/models';
import toast from 'react-hot-toast';

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'visitor', label: 'Visitor' },
  { value: 'parent', label: 'Parent' },
  { value: 'coach', label: 'Coach' },
  { value: 'admin', label: 'Admin' },
  { value: 'master-admin', label: 'Super Admin' },
];

const userAddSchema = z.object({
  email: z.string().email('Valid email is required'),
  displayName: z.string().min(1, 'Display name is required'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['visitor', 'parent', 'coach', 'admin', 'master-admin']),
});

type UserAddFormData = z.infer<typeof userAddSchema>;

interface UserAddDialogProps {
  open: boolean;
  onClose: () => void;
}

const UserAddDialog = ({ open, onClose }: UserAddDialogProps) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<UserAddFormData>({
    resolver: zodResolver(userAddSchema),
    defaultValues: {
      email: '',
      displayName: '',
      password: '',
      role: 'parent',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        email: '',
        displayName: '',
        password: '',
        role: 'parent',
      });
    }
  }, [open, reset]);

  const createMutation = useMutation({
    mutationFn: (data: UserAddFormData) =>
      usersApi.create({
        email: data.email,
        password: data.password,
        displayName: data.displayName,
        role: data.role,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User created successfully');
      onClose();
    },
    onError: (error: any) => {
      const msg = error?.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists'
        : error?.message || 'Failed to create user';
      toast.error(msg);
    },
  });

  const onSubmit = (data: UserAddFormData) => {
    createMutation.mutate(data);
  };

  const isSubmitting = createMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>Add New User</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Display Name"
              {...register('displayName')}
              error={!!errors.displayName}
              helperText={errors.displayName?.message}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
              fullWidth
            />
            <TextField
              label="Temporary Password"
              type="password"
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message || 'User can change this after first login'}
              fullWidth
            />
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
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create User'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default UserAddDialog;
