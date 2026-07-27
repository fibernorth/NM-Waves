import { useState, useMemo } from 'react';
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
  IconButton,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/components/common/ConfirmProvider';
import { collection, getDocs, doc, updateDoc, query, orderBy, Timestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { userProvisioningApi } from '@/lib/api/userProvisioning';
import { playersApi } from '@/lib/api/players';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EmailIcon from '@mui/icons-material/Email';
import SendIcon from '@mui/icons-material/Send';
import UndoIcon from '@mui/icons-material/Undo';
import LockResetIcon from '@mui/icons-material/LockReset';
import GroupIcon from '@mui/icons-material/Group';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import toast from 'react-hot-toast';

const UserManagementPage = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const isAdmin = checkIsAdmin(user);

  const [provisioning, setProvisioning] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  const sendInvite = async (emails: string[]) => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not authenticated');
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
    const url = `https://us-central1-${projectId}.cloudfunctions.net/sendParentInvites`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ emails }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  };

  const handleSendOne = async (email: string) => {
    setSendingEmail(email);
    try {
      const result = await sendInvite([email]);
      if (result.sent > 0) {
        toast.success(`Invite sent to ${email}`);
      } else {
        toast.error(`Failed to send invite: ${result.results?.[0]?.error || 'Unknown error'}`);
      }
      queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setSendingEmail(null);
    }
  };

  const handleSendAll = async () => {
    setSendingAll(true);
    try {
      const pendingEmails = pendingUsers
        .filter((u: any) => u.status === 'pending')
        .map((u: any) => u.email);
      if (pendingEmails.length === 0) {
        toast.error('No pending accounts to invite');
        return;
      }
      const result = await sendInvite(pendingEmails);
      toast.success(`Sent ${result.sent} invites (${result.failed} failed)`);
      queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invites');
    } finally {
      setSendingAll(false);
    }
  };

  const [resettingPw, setResettingPw] = useState<string | null>(null);

  const handleResetPassword = async (email: string) => {
    if (!(await confirm({ title: 'Send password reset?', message: `Send a password reset email to ${email}?`, confirmText: 'Send' }))) return;
    setResettingPw(email);
    try {
      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
      const res = await fetch(
        `https://us-central1-${projectId}.cloudfunctions.net/sendCustomPasswordReset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        }
      );
      if (res.ok) {
        toast.success(`Password reset email sent to ${email} (valid for 48 hours)`);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to send password reset');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send password reset');
    } finally {
      setResettingPw(null);
    }
  };

  const [resettingEmail, setResettingEmail] = useState<string | null>(null);

  const handleResetToUninvited = async (docId: string, email: string) => {
    setResettingEmail(email);
    try {
      await updateDoc(doc(db, 'pendingUsers', docId), {
        status: 'pending',
        invitedAt: null,
        updatedAt: Timestamp.now(),
      });
      toast.success(`Reset ${email} to uninvited`);
      queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset status');
    } finally {
      setResettingEmail(null);
    }
  };

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

  // Fetch players and teams for name lookups
  const { data: allPlayers = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
  });

  const { data: allTeams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  // Build lookup maps
  const playerMap = useMemo(() => {
    const map = new Map<string, { name: string; teamId?: string; teamName?: string }>();
    for (const p of allPlayers) {
      map.set(p.id, { name: `${p.firstName} ${p.lastName}`, teamId: p.teamId, teamName: p.teamName });
    }
    return map;
  }, [allPlayers]);

  const teamMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of allTeams) {
      map.set(t.id, t.name);
    }
    return map;
  }, [allTeams]);

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
      flex: 1,
      minWidth: 180,
      valueGetter: (params: any) => {
        const ids: string[] = params.row.linkedPlayerIds || [];
        return ids.map(id => playerMap.get(id)?.name || id).join(', ');
      },
      renderCell: (params: any) => {
        const ids: string[] = params.row.linkedPlayerIds || [];
        if (ids.length === 0) return <Typography variant="body2" color="text.secondary">--</Typography>;
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5 }}>
            {ids.map(id => {
              const info = playerMap.get(id);
              return (
                <Chip key={id} label={info?.name || id} size="small" variant="outlined" />
              );
            })}
          </Box>
        );
      },
    },
    {
      field: 'teamIds',
      headerName: 'Teams',
      flex: 1,
      minWidth: 150,
      valueGetter: (params: any) => {
        const ids: string[] = params.row.teamIds || [];
        return ids.map(id => teamMap.get(id) || id).join(', ');
      },
      renderCell: (params: any) => {
        const ids: string[] = params.row.teamIds || [];
        if (ids.length === 0) return <Typography variant="body2" color="text.secondary">--</Typography>;
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5 }}>
            {ids.map(id => (
              <Chip key={id} label={teamMap.get(id) || id} size="small" color="primary" variant="outlined" />
            ))}
          </Box>
        );
      },
    },
    {
      field: 'userActions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params: any) => {
        const email = params.row.email;
        const isResetting = resettingPw === email;
        return (
          <Tooltip title="Send password reset email">
            <span>
              <IconButton
                size="small"
                color="secondary"
                onClick={() => handleResetPassword(email)}
                disabled={isResetting}
              >
                {isResetting ? <CircularProgress size={18} /> : <LockResetIcon fontSize="small" />}
              </IconButton>
            </span>
          </Tooltip>
        );
      },
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
      flex: 1,
      minWidth: 160,
      valueGetter: (params: any) => {
        const ids: string[] = params.row.linkedPlayerIds || [];
        return ids.map(id => playerMap.get(id)?.name || id).join(', ');
      },
      renderCell: (params: any) => {
        const ids: string[] = params.row.linkedPlayerIds || [];
        if (ids.length === 0) return <Typography variant="body2" color="text.secondary">--</Typography>;
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5 }}>
            {ids.map(id => {
              const info = playerMap.get(id);
              return (
                <Chip key={id} label={info?.name || id} size="small" variant="outlined" />
              );
            })}
          </Box>
        );
      },
    },
    {
      field: 'teams',
      headerName: 'Team',
      flex: 1,
      minWidth: 140,
      valueGetter: (params: any) => {
        // Derive team names from linked players
        const ids: string[] = params.row.linkedPlayerIds || [];
        const teamNames = new Set<string>();
        for (const id of ids) {
          const info = playerMap.get(id);
          if (info?.teamName) teamNames.add(info.teamName);
        }
        // Also check teamIds on the pending user itself
        const teamIds: string[] = params.row.teamIds || [];
        for (const tid of teamIds) {
          const name = teamMap.get(tid);
          if (name) teamNames.add(name);
        }
        return Array.from(teamNames).join(', ');
      },
      renderCell: (params: any) => {
        const val = params.value as string;
        if (!val) return <Typography variant="body2" color="text.secondary">--</Typography>;
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', py: 0.5 }}>
            {val.split(', ').map(name => (
              <Chip key={name} label={name} size="small" color="primary" variant="outlined" />
            ))}
          </Box>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      renderCell: (params: any) => {
        const email = params.row.email;
        const docId = params.row.id;
        const status = params.row.status;
        const isSending = sendingEmail === email;
        const isResetting = resettingEmail === email;
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title={status === 'invited' ? 'Resend invite' : 'Send invite'}>
              <span>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handleSendOne(email)}
                  disabled={isSending}
                >
                  {isSending ? <CircularProgress size={18} /> : <SendIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            {status === 'invited' && (
              <Tooltip title="Reset to uninvited">
                <span>
                  <IconButton
                    size="small"
                    color="warning"
                    onClick={() => handleResetToUninvited(docId, email)}
                    disabled={isResetting}
                  >
                    {isResetting ? <CircularProgress size={18} /> : <UndoIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            )}
          </Box>
        );
      },
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
        <Button
          variant="outlined"
          startIcon={sendingAll ? <CircularProgress size={16} /> : <EmailIcon />}
          onClick={handleSendAll}
          disabled={sendingAll || pendingUsers.filter((u: any) => u.status === 'pending').length === 0}
        >
          {sendingAll ? 'Sending...' : `Send All Pending Invites (${pendingUsers.filter((u: any) => u.status === 'pending').length})`}
        </Button>
        <Alert severity="info" sx={{ flex: 1 }}>
          Contact accounts are auto-created when players are saved. Use the send button next to each name or send all at once.
        </Alert>
      </Paper>

      {/* Active Users */}
      <Typography variant="h6" gutterBottom>Active Users</Typography>
      <Paper sx={{ mb: 4, width: '100%' }}>
        <DataGrid
          rows={users}
          columns={userColumns}
          loading={usersLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
          getRowHeight={() => 'auto'}
          sx={{ '& .MuiDataGrid-cell': { py: 1 } }}
          autoHeight
        />
      </Paper>

      {/* Pending Users */}
      <Typography variant="h6" gutterBottom>Pending Accounts</Typography>
      <Paper sx={{ width: '100%' }}>
        <DataGrid
          rows={pendingUsers}
          columns={pendingColumns}
          loading={pendingLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          disableRowSelectionOnClick
          getRowId={(row) => row.id}
          getRowHeight={() => 'auto'}
          sx={{ '& .MuiDataGrid-cell': { py: 1 } }}
          autoHeight
        />
      </Paper>
    </Box>
  );
};

export default UserManagementPage;
