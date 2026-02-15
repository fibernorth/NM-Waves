import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { userProvisioningApi } from '@/lib/api/userProvisioning';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EmailIcon from '@mui/icons-material/Email';
import GroupIcon from '@mui/icons-material/Group';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import toast from 'react-hot-toast';

const UserManagementPage = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isAdmin = checkIsAdmin(user);

  const [provisioning, setProvisioning] = useState(false);

  // Fetch active users
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const q = query(collection(db, 'users'), orderBy('displayName'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },
  });

  // Fetch pending users
  const { data: pendingUsers = [], isLoading: pendingLoading } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: async () => {
      const snapshot = await getDocs(collection(db, 'pendingUsers'));
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));
    },
  });

  const handleProvisionAll = async () => {
    setProvisioning(true);
    try {
      const result = await userProvisioningApi.provisionAllPlayerContacts();
      toast.success(`Created ${result.created} pending accounts (${result.existing} already existed)`);
      queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
    } catch {
      toast.error('Failed to provision accounts');
    } finally {
      setProvisioning(false);
    }
  };

  const userColumns: GridColDef[] = [
    { field: 'displayName', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
    {
      field: 'role',
      headerName: 'Role',
      width: 130,
      renderCell: (params) => {
        const roleColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'> = {
          'master-admin': 'error',
          admin: 'warning',
          coach: 'primary',
          parent: 'info',
          visitor: 'default',
        };
        return (
          <Chip
            label={params.value}
            size="small"
            color={roleColors[params.value as string] || 'default'}
            sx={{ textTransform: 'capitalize' }}
          />
        );
      },
    },
    {
      field: 'linkedPlayerIds',
      headerName: 'Linked Players',
      width: 130,
      valueGetter: (params: any) => (params.row.linkedPlayerIds || []).length,
    },
    {
      field: 'teamIds',
      headerName: 'Teams',
      width: 100,
      valueGetter: (params: any) => (params.row.teamIds || []).length,
    },
  ];

  const pendingColumns: GridColDef[] = [
    { field: 'displayName', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 200 },
    { field: 'role', headerName: 'Role', width: 100 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'pending' ? 'warning' : params.value === 'invited' ? 'info' : 'success'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'linkedPlayerIds',
      headerName: 'Linked Players',
      width: 130,
      valueGetter: (params: any) => (params.row.linkedPlayerIds || []).length,
    },
  ];

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>User Management</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to manage users.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Account Provisioning</Typography>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <GroupIcon color="primary" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Active Users</Typography>
                <Typography variant="h4">{users.length}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <HourglassEmptyIcon color="warning" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Pending Accounts</Typography>
                <Typography variant="h4">{pendingUsers.length}</Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PersonAddIcon color="success" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">Parents</Typography>
                <Typography variant="h4">
                  {users.filter((u: any) => u.roles?.includes('parent') || u.role === 'parent').length}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Actions */}
      <Paper sx={{ p: 2, mb: 3, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="contained"
          startIcon={provisioning ? <CircularProgress size={16} /> : <PersonAddIcon />}
          onClick={handleProvisionAll}
          disabled={provisioning}
        >
          {provisioning ? 'Provisioning...' : 'Provision All Contact Accounts'}
        </Button>
        <Tooltip title="Invites will be sent when the site goes live">
          <span>
            <Button
              variant="outlined"
              startIcon={<EmailIcon />}
              disabled
            >
              Send Invite Emails
            </Button>
          </span>
        </Tooltip>
        <Alert severity="info" sx={{ flex: 1 }}>
          Contact accounts are auto-created when players are saved. Invite emails are disabled until the site is live.
        </Alert>
      </Paper>

      {/* Active Users */}
      <Typography variant="h6" gutterBottom>Active Users</Typography>
      <Paper sx={{ height: 400, mb: 4 }}>
        <DataGrid
          rows={users}
          columns={userColumns}
          loading={usersLoading}
          pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
        />
      </Paper>

      {/* Pending Users */}
      <Typography variant="h6" gutterBottom>Pending Accounts</Typography>
      <Paper sx={{ height: 400 }}>
        <DataGrid
          rows={pendingUsers}
          columns={pendingColumns}
          loading={pendingLoading}
          pageSizeOptions={[10, 25]}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
        />
      </Paper>
    </Box>
  );
};

export default UserManagementPage;
