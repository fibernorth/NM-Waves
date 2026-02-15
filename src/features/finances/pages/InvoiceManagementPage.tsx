import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  MenuItem,
  TextField,
  Tooltip,
  IconButton,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import QrCodeIcon from '@mui/icons-material/QrCode';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import { playerFinancesApi } from '@/lib/api/finances';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import InvoiceQRCard from '../components/InvoiceQRCard';
import { PlayerFinance } from '@/types/models';

const InvoiceManagementPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedFinance, setSelectedFinance] = useState<PlayerFinance | null>(null);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>([]);

  const { data: allFinances = [], isLoading } = useQuery({
    queryKey: ['playerFinances'],
    queryFn: () => playerFinancesApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  // Only show players with outstanding balances
  const finances = useMemo(() => {
    let filtered = allFinances.filter(f => {
      const totalOwed = f.registrationFee + f.uniformCost + f.tournamentFees +
        f.facilityFees + f.equipmentFees + f.otherFees;
      return totalOwed - f.totalPaid - (f.scholarshipAmount || 0) > 0;
    });

    if (selectedTeam !== 'all') {
      filtered = filtered.filter(f => f.teamId === selectedTeam);
    }

    return filtered;
  }, [allFinances, selectedTeam]);

  const stats = useMemo(() => ({
    totalPlayers: finances.length,
    totalOutstanding: finances.reduce((sum, f) => {
      const owed = f.registrationFee + f.uniformCost + f.tournamentFees +
        f.facilityFees + f.equipmentFees + f.otherFees;
      return sum + Math.max(0, owed - f.totalPaid - (f.scholarshipAmount || 0));
    }, 0),
  }), [finances]);

  const handleOpenQR = (finance: PlayerFinance) => {
    setSelectedFinance(finance);
    setQrDialogOpen(true);
  };

  const columns: GridColDef[] = [
    { field: 'playerName', headerName: 'Player', flex: 1, minWidth: 150 },
    { field: 'teamName', headerName: 'Team', width: 150 },
    { field: 'season', headerName: 'Season', width: 120 },
    {
      field: 'balanceDue',
      headerName: 'Balance Due',
      width: 130,
      valueGetter: (params) => {
        const f = params.row;
        const owed = f.registrationFee + f.uniformCost + f.tournamentFees +
          f.facilityFees + f.equipmentFees + f.otherFees;
        return Math.max(0, owed - f.totalPaid - (f.scholarshipAmount || 0));
      },
      renderCell: (params) => (
        <Typography color="error.main" fontWeight={600}>
          ${params.value.toFixed(2)}
        </Typography>
      ),
    },
    {
      field: 'actions',
      headerName: 'QR Invoice',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="Generate QR Invoice">
          <IconButton color="primary" onClick={() => handleOpenQR(params.row)}>
            <QrCodeIcon />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Invoice Management</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Invoices & QR Payments
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PeopleIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Players with Balance
                </Typography>
              </Box>
              <Typography variant="h4">{stats.totalPlayers}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoneyIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Total Outstanding
                </Typography>
              </Box>
              <Typography variant="h4" color="error.main">
                ${stats.totalOutstanding.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6}>
            <TextField
              label="Filter by Team"
              select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All Teams</MenuItem>
              {teams.map((team) => (
                <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={finances}
          columns={columns}
          loading={isLoading}
          checkboxSelection
          rowSelectionModel={selectionModel}
          onRowSelectionModelChange={setSelectionModel}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: 'balanceDue', sort: 'desc' }] },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* QR Dialog */}
      {selectedFinance && (
        <InvoiceQRCard
          open={qrDialogOpen}
          onClose={() => {
            setQrDialogOpen(false);
            setSelectedFinance(null);
          }}
          financeId={selectedFinance.id}
          playerId={selectedFinance.playerId}
          playerName={selectedFinance.playerName}
          teamName={selectedFinance.teamName}
          amountDue={Math.max(0,
            selectedFinance.registrationFee + selectedFinance.uniformCost +
            selectedFinance.tournamentFees + selectedFinance.facilityFees +
            selectedFinance.equipmentFees + selectedFinance.otherFees -
            selectedFinance.totalPaid - (selectedFinance.scholarshipAmount || 0)
          )}
        />
      )}
    </Box>
  );
};

export default InvoiceManagementPage;
