import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  TextField,
  MenuItem,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { usersApi } from '@/lib/api/users';
import type { User, UserRole } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import UserEditDialog from '../components/UserEditDialog';
import UserAddDialog from '../components/UserAddDialog';

const ROLE_CHIP_COLORS: Record<UserRole, 'default' | 'info' | 'success' | 'warning' | 'error'> = {
  visitor: 'default',
  parent: 'info',
  coach: 'success',
  admin: 'warning',
  'master-admin': 'error',
};

const ROLE_LABELS: Record<UserRole, string> = {
  visitor: 'Visitor',
  parent: 'Parent',
  coach: 'Coach',
  admin: 'Admin',
  'master-admin': 'Master Admin',
};

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Roles' },
  { value: 'visitor', label: 'Visitor' },
  { value: 'parent', label: 'Parent' },
  { value: 'coach', label: 'Coach' },
  { value: 'admin', label: 'Admin' },
  { value: 'master-admin', label: 'Super Admin' },
];

const UsersPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'master-admin';
  const [openDialog, setOpenDialog] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
    enabled: isSuperAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: (uid: string) => usersApi.delete(uid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('User deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete user');
    },
  });

  const handleEdit = (userRow: User) => {
    setSelectedUser(userRow);
    setOpenDialog(true);
  };

  const handleDelete = (uid: string) => {
    if (window.confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteMutation.mutate(uid);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedUser(null);
  };

  const filteredUsers = roleFilter === 'all'
    ? users
    : users.filter(u => u.role === roleFilter);

  const columns: GridColDef[] = [
    { field: 'displayName', headerName: 'Name', flex: 1, minWidth: 180 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 220 },
    {
      field: 'role',
      headerName: 'Role',
      width: 140,
      renderCell: (params) => (
        <Chip
          label={ROLE_LABELS[params.value as UserRole] || params.value}
          color={ROLE_CHIP_COLORS[params.value as UserRole] || 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'teamIds',
      headerName: 'Teams',
      width: 100,
      valueGetter: (params: any) => params.row.teamIds?.length || 0,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Created',
      width: 120,
      valueFormatter: (params: any) => {
        try {
          return format(params.value, 'MM/dd/yyyy');
        } catch {
          return '-';
        }
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<EditIcon />}
            onClick={() => handleEdit(params.row)}
          >
            Edit
          </Button>
          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleDelete(params.row.uid)}
            disabled={params.row.uid === user?.uid}
          >
            Delete
          </Button>
        </Box>
      ),
    },
  ];

  if (!isSuperAdmin) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 2 }}>
          User Management
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Typography color="error">
            Access denied. Only super admins can manage users.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">User Management</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenAddDialog(true)}>
          Add User
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          select
          label="Filter by Role"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
        >
          {ROLE_FILTER_OPTIONS.map(option => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredUsers}
          columns={columns}
          loading={isLoading}
          getRowId={(row) => row.uid}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      <UserEditDialog
        open={openDialog}
        onClose={handleCloseDialog}
        user={selectedUser}
      />

      <UserAddDialog
        open={openAddDialog}
        onClose={() => setOpenAddDialog(false)}
      />
    </Box>
  );
};

export default UsersPage;
