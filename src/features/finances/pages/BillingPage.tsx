import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  MenuItem,
  TextField,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { playerFinancesApi } from '@/lib/api/finances';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import PaymentIcon from '@mui/icons-material/Payment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import QrCodeIcon from '@mui/icons-material/QrCode';
import PaymentDialog from '../components/PaymentDialog';
import SponsorPaymentDialog from '../components/SponsorPaymentDialog';
import InvoiceQRCard from '../components/InvoiceQRCard';
import { PlayerFinance } from '@/types/models';

const BillingPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [balanceFilter, setBalanceFilter] = useState<string>('all');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [sponsorPaymentDialogOpen, setSponsorPaymentDialogOpen] = useState(false);
  const [selectedFinance, setSelectedFinance] = useState<PlayerFinance | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrFinance, setQrFinance] = useState<PlayerFinance | null>(null);

  const { data: allFinances = [], isLoading } = useQuery({
    queryKey: ['playerFinances'],
    queryFn: () => playerFinancesApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  // Filter finances
  const finances = useMemo(() => {
    let filtered = allFinances;

    // Filter by team
    if (selectedTeam !== 'all') {
      filtered = filtered.filter(f => f.teamId === selectedTeam);
    }

    // Filter by balance status
    if (balanceFilter === 'owed') {
      filtered = filtered.filter(f => f.balance < 0);
    } else if (balanceFilter === 'paid') {
      filtered = filtered.filter(f => f.balance >= 0);
    }

    return filtered;
  }, [allFinances, selectedTeam, balanceFilter]);

  // Calculate summary statistics
  const stats = useMemo(() => {
    const totalOwed = finances.reduce((sum, f) => sum + f.totalOwed, 0);
    const totalPaid = finances.reduce((sum, f) => sum + f.totalPaid, 0);
    const totalOutstanding = finances.reduce((sum, f) => sum + (f.balance < 0 ? Math.abs(f.balance) : 0), 0);
    const playersWithBalance = finances.filter(f => f.balance < 0).length;

    return {
      totalOwed,
      totalPaid,
      totalOutstanding,
      playersWithBalance,
      collectionRate: totalOwed > 0 ? (totalPaid / totalOwed) * 100 : 0,
    };
  }, [finances]);

  const handleRecordPayment = (finance: PlayerFinance) => {
    setSelectedFinance(finance);
    setPaymentDialogOpen(true);
  };

  const handleClosePaymentDialog = () => {
    setPaymentDialogOpen(false);
    setSelectedFinance(null);
  };

  const columns: GridColDef[] = [
    {
      field: 'playerName',
      headerName: 'Player Name',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'teamName',
      headerName: 'Team',
      width: 150,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="primary" variant="outlined" />
      ),
    },
    {
      field: 'season',
      headerName: 'Season',
      width: 130,
    },
    {
      field: 'totalOwed',
      headerName: 'Total Owed',
      width: 120,
      valueFormatter: (params) => `$${params.value.toFixed(2)}`,
    },
    {
      field: 'totalPaid',
      headerName: 'Total Paid',
      width: 120,
      valueFormatter: (params) => `$${params.value.toFixed(2)}`,
    },
    {
      field: 'balance',
      headerName: 'Balance',
      width: 120,
      renderCell: (params) => {
        const balance = params.value as number;
        const isOwed = balance < 0;
        return (
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: isOwed ? 'error.main' : 'success.main',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            {isOwed ? `-$${Math.abs(balance).toFixed(2)}` : `$${balance.toFixed(2)}`}
          </Box>
        );
      },
    },
    {
      field: 'payments',
      headerName: 'Payments',
      width: 100,
      valueGetter: (params) => params.value?.length || 0,
    },
    {
      field: 'lastPayer',
      headerName: 'Last Payer',
      width: 140,
      valueGetter: (params) => {
        const payments = params.row.payments || [];
        if (payments.length === 0) return '--';
        const last = payments[payments.length - 1];
        if (last.isAnonymous && !isAdmin) return 'Anonymous Sponsor';
        if (last.isAnonymous) return `${last.payerName || last.sponsorName || '--'} (Anon)`;
        return last.payerName || last.sponsorName || '--';
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton size="small" color="primary">
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <>
              <Tooltip title="Record Payment">
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleRecordPayment(params.row)}
                >
                  <PaymentIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="QR Invoice">
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => {
                    setQrFinance(params.row);
                    setQrDialogOpen(true);
                  }}
                >
                  <QrCodeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Billing & Payments
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view billing information.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Billing & Payments
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoneyIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Total Owed
                </Typography>
              </Box>
              <Typography variant="h5">${stats.totalOwed.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PaymentIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Total Collected
                </Typography>
              </Box>
              <Typography variant="h5">${stats.totalPaid.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUpIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Outstanding
                </Typography>
              </Box>
              <Typography variant="h5" color="error">
                ${stats.totalOutstanding.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PeopleIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Players w/ Balance
                </Typography>
              </Box>
              <Typography variant="h5">{stats.playersWithBalance}</Typography>
              <Typography variant="caption" color="text.secondary">
                Collection Rate: {stats.collectionRate.toFixed(1)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
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
                <MenuItem key={team.id} value={team.id}>
                  {team.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <TextField
              label="Filter by Balance"
              select
              value={balanceFilter}
              onChange={(e) => setBalanceFilter(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="owed">Owed (Balance Due)</MenuItem>
              <MenuItem value="paid">Paid in Full</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {isAdmin && (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<BusinessIcon />}
                  onClick={() => setSponsorPaymentDialogOpen(true)}
                >
                  Sponsor Payment
                </Button>
              )}
              <Button variant="outlined" size="small">
                Export to CSV
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={finances}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: {
              sortModel: [{ field: 'balance', sort: 'asc' }],
            },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* Payment Dialog */}
      {selectedFinance && (
        <PaymentDialog
          open={paymentDialogOpen}
          onClose={handleClosePaymentDialog}
          financeId={selectedFinance.id}
          playerName={selectedFinance.playerName}
          currentBalance={selectedFinance.balance}
        />
      )}

      {/* Sponsor Payment Dialog */}
      <SponsorPaymentDialog
        open={sponsorPaymentDialogOpen}
        onClose={() => setSponsorPaymentDialogOpen(false)}
        finances={allFinances}
      />

      {/* QR Invoice Dialog */}
      {qrFinance && (
        <InvoiceQRCard
          open={qrDialogOpen}
          onClose={() => {
            setQrDialogOpen(false);
            setQrFinance(null);
          }}
          financeId={qrFinance.id}
          playerId={qrFinance.playerId}
          playerName={qrFinance.playerName}
          teamName={qrFinance.teamName}
          amountDue={Math.max(0, Math.abs(qrFinance.balance))}
        />
      )}
    </Box>
  );
};

export default BillingPage;
