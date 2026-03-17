import { useState, useMemo } from 'react';
import {
  Box, Typography, Button, Paper, Chip, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton, Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { playersApi } from '@/lib/api/players';
import { playerFinancesApi } from '@/lib/api/finances';
import { Player } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin, isCoach as checkIsCoach } from '@/lib/auth/roles';
import PlayerFormDialog from '../components/PlayerFormDialog';

const PlayersPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const isCoach = checkIsCoach(user);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  // Quick charge dialog
  const [chargeDialogOpen, setChargeDialogOpen] = useState(false);
  const [chargePlayer, setChargePlayer] = useState<Player | null>(null);
  const [chargeForm, setChargeForm] = useState({
    feeField: 'otherFees' as 'registrationFee' | 'uniformCost' | 'tournamentFees' | 'facilityFees' | 'equipmentFees' | 'otherFees',
    amount: '',
    description: '',
  });

  const { data: players = [], isLoading, isError: playersError } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
  });

  // Fetch finances for balance column (admin only)
  const { data: allFinances = [] } = useQuery({
    queryKey: ['playerFinances'],
    queryFn: () => playerFinancesApi.getAll(),
    enabled: isAdmin,
  });

  // Build a map: playerId -> balanceDue (positive = owes money, accounts for scholarships)
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const fin of allFinances) {
      const existing = map.get(fin.playerId) || 0;
      map.set(fin.playerId, existing + (fin.balanceDue ?? (fin.totalOwed - fin.totalPaid)));
    }
    return map;
  }, [allFinances]);

  // Build a map: playerId -> worst payment status
  const statusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const fin of allFinances) {
      const status = fin.status || ((fin.balanceDue ?? (fin.totalOwed - fin.totalPaid)) <= 0 ? 'paid' : 'current');
      const existing = map.get(fin.playerId);
      if (!existing || existing === 'paid') {
        map.set(fin.playerId, status);
      } else if (existing === 'current' && status === 'overdue') {
        map.set(fin.playerId, 'overdue');
      }
    }
    return map;
  }, [allFinances]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => playersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Player deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete player');
    },
  });

  const handleEdit = (player: Player) => {
    setSelectedPlayer(player);
    setOpenDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this player?')) {
      deleteMutation.mutate(id);
    }
  };

  const chargeMutation = useMutation({
    mutationFn: async ({ playerId, feeField, amount }: { playerId: string; feeField: string; amount: number }) => {
      // Find existing finance record for this player/season
      const existing = allFinances.find(f => f.playerId === playerId);
      if (existing) {
        const currentVal = (existing as any)[feeField] || 0;
        await playerFinancesApi.update(existing.id, { [feeField]: currentVal + amount });
      } else {
        // Create new finance record
        const player = players.find(p => p.id === playerId);
        await playerFinancesApi.create({
          playerId,
          playerName: player ? `${player.firstName} ${player.lastName}` : '',
          teamId: player?.teamId || '',
          season: '2025-2026',
          [feeField]: amount,
        } as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      toast.success('Charge added successfully');
      setChargeDialogOpen(false);
      setChargeForm({ feeField: 'otherFees', amount: '', description: '' });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add charge');
    },
  });

  const handleAddCharge = (player: Player) => {
    setChargePlayer(player);
    setChargeForm({ feeField: 'otherFees', amount: '', description: '' });
    setChargeDialogOpen(true);
  };

  const handleSubmitCharge = () => {
    if (!chargePlayer || !chargeForm.amount) return;
    const amount = parseFloat(chargeForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    chargeMutation.mutate({ playerId: chargePlayer.id, feeField: chargeForm.feeField, amount });
  };

  const handleAdd = () => {
    setSelectedPlayer(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPlayer(null);
  };

  const columns: GridColDef[] = [
    {
      field: 'lastName',
      headerName: 'Last Name',
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'firstName',
      headerName: 'First Name',
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'dateOfBirth',
      headerName: 'Date of Birth',
      width: 120,
      valueFormatter: (params) => {
        try {
          return params.value ? format(params.value, 'MM/dd/yyyy') : '-';
        } catch {
          return '-';
        }
      },
    },
    {
      field: 'teamName',
      headerName: 'Team',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        params.value ? (
          <Chip label={params.value} size="small" color="primary" variant="outlined" />
        ) : (
          <Chip label="No Team" size="small" variant="outlined" />
        )
      ),
    },
    {
      field: 'parentName',
      headerName: 'Parent/Guardian',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'parentEmail',
      headerName: 'Email',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'parentPhone',
      headerName: 'Phone',
      width: 130,
    },
    ...(isAdmin ? [
      {
        field: 'paymentStatus',
        headerName: 'Payment',
        width: 100,
        valueGetter: (params: any) => statusMap.get(params.row.id) || '',
        renderCell: (params: any) => {
          const status = params.value as string;
          if (!status) return <Typography variant="body2" color="text.disabled">--</Typography>;
          return (
            <Chip
              label={status}
              size="small"
              color={status === 'paid' ? 'success' : status === 'overdue' ? 'error' : 'warning'}
              sx={{ textTransform: 'capitalize', fontWeight: 600 }}
            />
          );
        },
      },
      {
        field: 'balance',
        headerName: 'Balance',
        width: 120,
        valueGetter: (params: any) => {
          const bal = balanceMap.get(params.row.id);
          return bal ?? 0;
        },
        renderCell: (params: any) => {
          const balanceDue = params.value as number;
          if (balanceDue === 0 && !balanceMap.has(params.row.id)) {
            return <Typography variant="body2" color="text.secondary">--</Typography>;
          }
          const isOwed = balanceDue > 0;
          return (
            <Box
              onClick={() => navigate(`/players/${params.row.id}`)}
              sx={{
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: isOwed ? 'error.main' : 'success.main',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                '&:hover': { opacity: 0.85 },
              }}
            >
              {isOwed ? `$${balanceDue.toFixed(2)} owed` : 'Paid'}
            </Box>
          );
        },
      },
    ] : []),
    {
      field: 'active',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Box
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: params.value ? 'success.main' : 'grey.400',
            color: 'white',
            fontSize: '0.75rem',
          }}
        >
          {params.value ? 'Active' : 'Inactive'}
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View">
            <IconButton size="small" onClick={() => navigate(`/players/${params.row.id}`)}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isCoach && (
            <Tooltip title="Add Charge">
              <IconButton size="small" color="warning" onClick={() => handleAddCharge(params.row as Player)}>
                <AttachMoneyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {isAdmin && (
            <>
              <Tooltip title="Edit">
                <IconButton size="small" color="primary" onClick={() => handleEdit(params.row)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Players</Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Player
          </Button>
        )}
      </Box>

      {playersError && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to load players. Please refresh the page.</Alert>
      )}

      <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
        <DataGrid
          rows={players}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          disableRowSelectionOnClick
          onRowDoubleClick={(params) => navigate(`/players/${params.row.id}`)}
          sx={{ cursor: 'pointer' }}
        />
      </Paper>

      {isAdmin && (
        <PlayerFormDialog
          open={openDialog}
          onClose={handleCloseDialog}
          player={selectedPlayer}
          defaultTeamId={user?.teamIds?.[0]}
        />
      )}

      {/* Quick Charge Dialog */}
      <Dialog open={chargeDialogOpen} onClose={() => setChargeDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Add Charge — {chargePlayer?.firstName} {chargePlayer?.lastName}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Fee Type"
              value={chargeForm.feeField}
              onChange={(e) => setChargeForm({ ...chargeForm, feeField: e.target.value as any })}
              fullWidth
            >
              <MenuItem value="registrationFee">Registration Fee</MenuItem>
              <MenuItem value="uniformCost">Uniform Cost</MenuItem>
              <MenuItem value="tournamentFees">Tournament Fees</MenuItem>
              <MenuItem value="facilityFees">Facility Fees</MenuItem>
              <MenuItem value="equipmentFees">Equipment Fees</MenuItem>
              <MenuItem value="otherFees">Other Fees</MenuItem>
            </TextField>
            <TextField
              label="Amount ($)"
              type="number"
              value={chargeForm.amount}
              onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })}
              fullWidth
              inputProps={{ min: 0, step: '0.01' }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChargeDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmitCharge}
            disabled={chargeMutation.isPending}
          >
            Add Charge
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PlayersPage;
