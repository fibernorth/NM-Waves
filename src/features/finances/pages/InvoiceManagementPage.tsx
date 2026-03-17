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
  Button,
  CircularProgress,
  Chip,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import QrCodeIcon from '@mui/icons-material/QrCode';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import TimerIcon from '@mui/icons-material/Timer';
import { useNavigate } from 'react-router-dom';
import { playerFinancesApi, computeFeeTotal } from '@/lib/api/finances';
import { invoiceTokensApi } from '@/lib/api/invoiceTokens';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import InvoiceQRCard from '../components/InvoiceQRCard';
import { PlayerFinance, InvoiceToken } from '@/types/models';
import toast from 'react-hot-toast';

/** Calculate aging bucket from a date */
function getAgingBucket(dueDate: Date | undefined, used: boolean): string {
  if (used) return 'Paid';
  if (!dueDate) return 'Current';
  const now = new Date();
  const diffMs = now.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Current';
  if (diffDays <= 30) return '1-30 Days';
  if (diffDays <= 60) return '31-60 Days';
  if (diffDays <= 90) return '61-90 Days';
  return '90+ Days';
}

function getAgingColor(bucket: string): 'default' | 'success' | 'info' | 'warning' | 'error' {
  switch (bucket) {
    case 'Paid': return 'success';
    case 'Current': return 'info';
    case '1-30 Days': return 'warning';
    case '31-60 Days': return 'warning';
    case '61-90 Days': return 'error';
    case '90+ Days': return 'error';
    default: return 'default';
  }
}

function getDaysOverdue(dueDate: Date | undefined): number {
  if (!dueDate) return 0;
  const now = new Date();
  const diffMs = now.getTime() - dueDate.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

const InvoiceManagementPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const queryClient = useQueryClient();

  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedFinance, setSelectedFinance] = useState<PlayerFinance | null>(null);
  const [selectionModel, setSelectionModel] = useState<GridRowSelectionModel>([]);

  const { data: allFinances = [], isLoading, isError: financesError } = useQuery({
    queryKey: ['playerFinances'],
    queryFn: () => playerFinancesApi.getAll(),
  });

  const { data: teams = [], isError: teamsError } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const { data: allInvoices = [], isError: invoicesError } = useQuery({
    queryKey: ['invoiceTokens'],
    queryFn: () => invoiceTokensApi.getAll(),
  });

  const batchMutation = useMutation({
    mutationFn: (params: { season?: string; teamId?: string }) =>
      invoiceTokensApi.batchGenerate(params),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoiceTokens'] });
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      if (result.errors.length > 0) {
        toast.error(`Created ${result.created} invoices, ${result.errors.length} errors`);
      } else {
        toast.success(
          `Created ${result.created} invoices, skipped ${result.skipped} (already invoiced)`
        );
      }
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate invoices'),
  });

  // Only show players with outstanding balances
  const finances = useMemo(() => {
    let filtered = allFinances.filter(f => {
      const totalOwed = computeFeeTotal(f);
      return totalOwed - f.totalPaid - (f.scholarshipAmount || 0) > 0;
    });

    if (selectedTeam !== 'all') {
      filtered = filtered.filter(f => f.teamId === selectedTeam);
    }

    return filtered;
  }, [allFinances, selectedTeam]);

  // Build financeId -> balanceDue map for accurate remaining amounts
  const financeBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of allFinances) {
      map.set(f.id, f.balanceDue);
    }
    return map;
  }, [allFinances]);

  // Compute actual remaining per invoice token using finance data
  const invoiceRemainingMap = useMemo(() => {
    const result: Record<string, { remaining: number; isPaid: boolean }> = {};
    const tokensByFinance = new Map<string, InvoiceToken[]>();

    for (const token of allInvoices) {
      if (token.used) {
        result[token.id] = { remaining: 0, isPaid: true };
        continue;
      }
      const existing = tokensByFinance.get(token.financeId) || [];
      existing.push(token);
      tokensByFinance.set(token.financeId, existing);
    }

    for (const [financeId, tokens] of tokensByFinance) {
      const balanceDue = financeBalanceMap.get(financeId);
      if (balanceDue === undefined) {
        for (const t of tokens) {
          const amt = t.chargeAmount || t.amountDue || 0;
          result[t.id] = { remaining: amt, isPaid: false };
        }
        continue;
      }
      if (balanceDue <= 0) {
        for (const t of tokens) {
          result[t.id] = { remaining: 0, isPaid: true };
        }
      } else {
        const totalInvoiced = tokens.reduce((s, t) => s + (t.chargeAmount || t.amountDue || 0), 0);
        for (const t of tokens) {
          const originalAmt = t.chargeAmount || t.amountDue || 0;
          const remaining = totalInvoiced > 0
            ? Math.round((originalAmt / totalInvoiced) * balanceDue * 100) / 100
            : balanceDue;
          result[t.id] = { remaining, isPaid: remaining <= 0 };
        }
      }
    }
    return result;
  }, [allInvoices, financeBalanceMap]);

  // Aging stats from existing invoices (using finance-aware remaining amounts)
  const agingStats = useMemo(() => {
    const activeInvoices = allInvoices.filter(inv => {
      const info = invoiceRemainingMap[inv.id];
      return !inv.used && !(info?.isPaid);
    });
    const buckets = { current: 0, days30: 0, days60: 0, days90: 0 };
    let totalInvoiced = 0;

    for (const inv of activeInvoices) {
      const info = invoiceRemainingMap[inv.id];
      const amount = info ? info.remaining : inv.amountDue;
      const bucket = getAgingBucket(inv.dueDate, inv.used);
      totalInvoiced += amount;
      if (bucket === 'Current') buckets.current += amount;
      else if (bucket === '1-30 Days') buckets.days30 += amount;
      else if (bucket === '31-60 Days') buckets.days60 += amount;
      else if (bucket === '61-90 Days' || bucket === '90+ Days') buckets.days90 += amount;
    }

    return { ...buckets, totalInvoiced, invoiceCount: activeInvoices.length };
  }, [allInvoices, invoiceRemainingMap]);

  const stats = useMemo(() => ({
    totalPlayers: finances.length,
    totalOutstanding: finances.reduce((sum, f) => {
      const owed = computeFeeTotal(f);
      return sum + Math.max(0, owed - f.totalPaid - (f.scholarshipAmount || 0));
    }, 0),
  }), [finances]);

  const handleOpenQR = (finance: PlayerFinance) => {
    setSelectedFinance(finance);
    setQrDialogOpen(true);
  };

  const handleBatchGenerate = () => {
    const params: { season?: string; teamId?: string } = {};
    if (selectedTeam !== 'all') {
      params.teamId = selectedTeam;
    }
    batchMutation.mutate(params);
  };

  // Build invoice lookup for the grid: map "playerId" to their active invoices
  const playerInvoiceMap = useMemo(() => {
    const map = new Map<string, InvoiceToken[]>();
    for (const inv of allInvoices) {
      if (!map.has(inv.playerId)) map.set(inv.playerId, []);
      map.get(inv.playerId)!.push(inv);
    }
    return map;
  }, [allInvoices]);

  const columns: GridColDef[] = [
    {
      field: 'playerName',
      headerName: 'Player',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Typography
          variant="body2"
          sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}
          onClick={() => navigate(`/players/${params.row.playerId}`)}
        >
          {params.value}
        </Typography>
      ),
    },
    { field: 'teamName', headerName: 'Team', width: 150 },
    { field: 'season', headerName: 'Season', width: 100 },
    {
      field: 'balanceDue',
      headerName: 'Balance Due',
      width: 120,
      valueGetter: (params) => {
        const f = params.row;
        const owed = computeFeeTotal(f);
        return Math.max(0, owed - f.totalPaid - (f.scholarshipAmount || 0));
      },
      renderCell: (params) => (
        <Typography color="error.main" fontWeight={600}>
          ${params.value.toFixed(2)}
        </Typography>
      ),
    },
    {
      field: 'invoiceCount',
      headerName: 'Invoices',
      width: 90,
      valueGetter: (params) => {
        const invoices = playerInvoiceMap.get(params.row.playerId) || [];
        const active = invoices.filter(i => !i.used && i.expiresAt > new Date());
        return active.length;
      },
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'primary' : 'default'}
          variant={params.value > 0 ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      field: 'oldestDue',
      headerName: 'Oldest Due',
      width: 110,
      valueGetter: (params) => {
        const invoices = playerInvoiceMap.get(params.row.playerId) || [];
        const active = invoices.filter(i => !i.used && i.expiresAt > new Date());
        if (active.length === 0) return null;
        const oldest = active.reduce((min, inv) =>
          inv.dueDate && (!min || inv.dueDate < min) ? inv.dueDate : min,
          null as Date | null
        );
        return oldest;
      },
      renderCell: (params) => {
        if (!params.value) return <Typography variant="body2" color="text.secondary">--</Typography>;
        return (
          <Typography variant="body2">
            {new Date(params.value).toLocaleDateString()}
          </Typography>
        );
      },
    },
    {
      field: 'agingBucket',
      headerName: 'Aging',
      width: 120,
      valueGetter: (params) => {
        const invoices = playerInvoiceMap.get(params.row.playerId) || [];
        const active = invoices.filter(i => !i.used && i.expiresAt > new Date());
        if (active.length === 0) return 'No Invoice';
        // Return the worst aging bucket across all invoices
        const buckets = active.map(inv => getAgingBucket(inv.dueDate, inv.used));
        const order = ['Current', '1-30 Days', '31-60 Days', '61-90 Days', '90+ Days'];
        let worst = 0;
        for (const b of buckets) {
          const idx = order.indexOf(b);
          if (idx > worst) worst = idx;
        }
        return order[worst];
      },
      renderCell: (params) => {
        if (params.value === 'No Invoice') {
          return <Chip label="No Invoice" size="small" variant="outlined" />;
        }
        return (
          <Chip
            label={params.value}
            size="small"
            color={getAgingColor(params.value)}
            variant="filled"
          />
        );
      },
    },
    {
      field: 'daysOverdue',
      headerName: 'Days Over',
      width: 100,
      valueGetter: (params) => {
        const invoices = playerInvoiceMap.get(params.row.playerId) || [];
        const active = invoices.filter(i => !i.used && i.expiresAt > new Date());
        if (active.length === 0) return 0;
        return Math.max(...active.map(inv => getDaysOverdue(inv.dueDate)));
      },
      renderCell: (params) => {
        if (params.value === 0) return <Typography variant="body2" color="text.secondary">--</Typography>;
        return (
          <Typography
            variant="body2"
            color={params.value > 60 ? 'error.main' : params.value > 30 ? 'warning.main' : 'text.primary'}
            fontWeight={params.value > 30 ? 600 : 400}
          >
            {params.value}d
          </Typography>
        );
      },
    },
    {
      field: 'actions',
      headerName: 'QR Invoice',
      width: 100,
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          Invoices & QR Payments
        </Typography>
        <Tooltip title={finances.length === 0 ? 'No players with outstanding balances' : ''}>
          <span>
            <Button
              variant="contained"
              color="primary"
              startIcon={batchMutation.isPending ? <CircularProgress size={18} color="inherit" /> : <ReceiptLongIcon />}
              onClick={handleBatchGenerate}
              disabled={batchMutation.isPending || finances.length === 0}
              size="large"
            >
              {batchMutation.isPending ? 'Generating...' : 'Generate All Invoices'}
            </Button>
          </span>
        </Tooltip>
      </Box>
      {(financesError || teamsError || invoicesError) && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to load some data. Please refresh the page.</Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
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
        <Grid item xs={12} sm={6} md={3}>
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
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ReceiptLongIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Active Invoices
                </Typography>
              </Box>
              <Typography variant="h4">{agingStats.invoiceCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TimerIcon color="warning" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Overdue Amount
                </Typography>
              </Box>
              <Typography variant="h4" color="warning.main">
                ${(agingStats.days30 + agingStats.days60 + agingStats.days90).toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Aging Breakdown */}
      {agingStats.invoiceCount > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>Invoice Aging Summary</Typography>
          <Grid container spacing={2}>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Chip label="Current" color="info" size="small" sx={{ mb: 0.5 }} />
                <Typography variant="h6">${agingStats.current.toFixed(2)}</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Chip label="1-30 Days" color="warning" size="small" sx={{ mb: 0.5 }} />
                <Typography variant="h6">${agingStats.days30.toFixed(2)}</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Chip label="31-60 Days" color="warning" size="small" sx={{ mb: 0.5 }} />
                <Typography variant="h6">${agingStats.days60.toFixed(2)}</Typography>
              </Box>
            </Grid>
            <Grid item xs={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Chip label="61-90+ Days" color="error" size="small" sx={{ mb: 0.5 }} />
                <Typography variant="h6">${agingStats.days90.toFixed(2)}</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

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
      <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
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
            queryClient.invalidateQueries({ queryKey: ['invoiceTokens'] });
          }}
          finance={selectedFinance}
        />
      )}
    </Box>
  );
};

export default InvoiceManagementPage;
