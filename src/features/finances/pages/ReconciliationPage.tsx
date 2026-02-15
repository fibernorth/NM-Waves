import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  MenuItem,
  Button,
  Chip,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { incomeApi, expensesApi, reconciliationApi } from '@/lib/api/accounting';
import { playerFinancesApi } from '@/lib/api/finances';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import toast from 'react-hot-toast';

interface ReconciliationRow {
  id: string;
  date: Date;
  type: 'income' | 'expense' | 'payment';
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  reconciled: boolean;
  source: string;
  // References for reconciliation
  sourceType: 'income' | 'expense' | 'payment';
  sourceId: string;
  financeId?: string;
}

const ReconciliationPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';

  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [filterReconciled, setFilterReconciled] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: income = [] } = useQuery({
    queryKey: ['income'],
    queryFn: () => incomeApi.getAll(),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => expensesApi.getAll(),
  });

  const { data: finances = [] } = useQuery({
    queryKey: ['playerFinances'],
    queryFn: () => playerFinancesApi.getAll(),
  });

  // Merge all transactions into a unified view
  const allTransactions = useMemo((): ReconciliationRow[] => {
    const rows: ReconciliationRow[] = [];

    // Income records
    income.forEach((inc) => {
      rows.push({
        id: `inc_${inc.id}`,
        date: inc.date,
        type: 'income',
        category: inc.category,
        description: `${inc.source}: ${inc.description}`,
        amount: inc.amount,
        paymentMethod: inc.paymentMethod,
        reconciled: inc.reconciled || false,
        source: inc.source,
        sourceType: 'income',
        sourceId: inc.id,
      });
    });

    // Expense records
    expenses.forEach((exp) => {
      rows.push({
        id: `exp_${exp.id}`,
        date: exp.date,
        type: 'expense',
        category: exp.category,
        description: `${exp.vendor}: ${exp.description}`,
        amount: -exp.amount,
        paymentMethod: exp.paymentMethod,
        reconciled: exp.reconciled || false,
        source: exp.vendor,
        sourceType: 'expense',
        sourceId: exp.id,
      });
    });

    // Player payments
    finances.forEach((fin) => {
      (fin.payments || []).forEach((pmt) => {
        rows.push({
          id: `pmt_${fin.id}_${pmt.id}`,
          date: pmt.date,
          type: 'payment',
          category: 'player_payment',
          description: `Payment from ${fin.playerName}`,
          amount: pmt.amount,
          paymentMethod: pmt.method,
          reconciled: pmt.reconciled || false,
          source: fin.playerName,
          sourceType: 'payment',
          sourceId: pmt.id,
          financeId: fin.id,
        });
      });
    });

    // Sort by date desc
    rows.sort((a, b) => b.date.getTime() - a.date.getTime());
    return rows;
  }, [income, expenses, finances]);

  // Apply filters
  const filteredTransactions = useMemo(() => {
    let result = allTransactions;

    if (filterMethod !== 'all') {
      result = result.filter((r) => r.paymentMethod === filterMethod);
    }
    if (filterReconciled === 'reconciled') {
      result = result.filter((r) => r.reconciled);
    } else if (filterReconciled === 'unreconciled') {
      result = result.filter((r) => !r.reconciled);
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((r) => r.date >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((r) => r.date <= to);
    }

    return result;
  }, [allTransactions, filterMethod, filterReconciled, dateFrom, dateTo]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredTransactions.length;
    const reconciled = filteredTransactions.filter((r) => r.reconciled).length;
    const unreconciledAmount = filteredTransactions
      .filter((r) => !r.reconciled)
      .reduce((sum, r) => sum + r.amount, 0);
    return { total, reconciled, unreconciled: total - reconciled, unreconciledAmount };
  }, [filteredTransactions]);

  const reconcileMutation = useMutation({
    mutationFn: async ({ ids, reconcile }: { ids: string[]; reconcile: boolean }) => {
      const promises = ids.map((id) => {
        const row = allTransactions.find((r) => r.id === id);
        if (!row) return Promise.resolve();

        if (row.sourceType === 'income') {
          return reconcile
            ? reconciliationApi.reconcileIncome(row.sourceId, user?.uid || '')
            : reconciliationApi.unreconcileIncome(row.sourceId);
        } else if (row.sourceType === 'expense') {
          return reconcile
            ? reconciliationApi.reconcileExpense(row.sourceId, user?.uid || '')
            : reconciliationApi.unreconcileExpense(row.sourceId);
        } else if (row.sourceType === 'payment' && row.financeId) {
          return playerFinancesApi.reconcilePayment(
            row.financeId,
            row.sourceId,
            user?.uid || '',
            reconcile
          );
        }
        return Promise.resolve();
      });
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      setSelectedIds([]);
      toast.success('Reconciliation updated');
    },
    onError: () => toast.error('Failed to update reconciliation'),
  });

  const handleReconcileSelected = () => {
    if (selectedIds.length === 0) return;
    reconcileMutation.mutate({ ids: selectedIds, reconcile: true });
  };

  const handleUnreconcileSelected = () => {
    if (selectedIds.length === 0) return;
    reconcileMutation.mutate({ ids: selectedIds, reconcile: false });
  };

  const methodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Cash',
      check: 'Check',
      venmo: 'Venmo',
      zelle: 'Zelle',
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
      sponsor: 'Sponsor',
      other: 'Other',
    };
    return labels[method] || method;
  };

  const columns: GridColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      width: 110,
      renderCell: (params) => format(params.value, 'MM/dd/yyyy'),
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 100,
      renderCell: (params) => {
        const colors: Record<string, 'success' | 'error' | 'info'> = {
          income: 'success',
          expense: 'error',
          payment: 'info',
        };
        return (
          <Chip
            label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
            size="small"
            color={colors[params.value] || 'default'}
          />
        );
      },
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'paymentMethod',
      headerName: 'Method',
      width: 120,
      renderCell: (params) => methodLabel(params.value),
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      renderCell: (params) => {
        const val = params.value as number;
        const isNeg = val < 0;
        return (
          <Typography
            variant="body2"
            sx={{ fontWeight: 'bold', color: isNeg ? 'error.main' : 'success.main' }}
          >
            {isNeg ? `-$${Math.abs(val).toFixed(2)}` : `$${val.toFixed(2)}`}
          </Typography>
        );
      },
    },
    {
      field: 'reconciled',
      headerName: 'Reconciled',
      width: 110,
      renderCell: (params) => (
        <Chip
          icon={params.value ? <CheckCircleIcon /> : <PendingIcon />}
          label={params.value ? 'Yes' : 'No'}
          size="small"
          color={params.value ? 'success' : 'default'}
          variant="outlined"
        />
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Reconciliation</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <AccountBalanceIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4">Reconciliation</Typography>
        </Box>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Transactions</Typography>
              <Typography variant="h5">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Reconciled</Typography>
              <Typography variant="h5" color="success.main">{stats.reconciled}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Unreconciled</Typography>
              <Typography variant="h5" color="warning.main">{stats.unreconciled}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              label="Payment Method"
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="all">All Methods</MenuItem>
              <MenuItem value="venmo">Venmo</MenuItem>
              <MenuItem value="zelle">Zelle</MenuItem>
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="check">Check</MenuItem>
              <MenuItem value="credit_card">Credit Card</MenuItem>
              <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
              <MenuItem value="sponsor">Sponsor</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              label="Status"
              value={filterReconciled}
              onChange={(e) => setFilterReconciled(e.target.value)}
              size="small"
              fullWidth
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="reconciled">Reconciled</MenuItem>
              <MenuItem value="unreconciled">Unreconciled</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="From"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              label="To"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                color="success"
                size="small"
                disabled={selectedIds.length === 0 || reconcileMutation.isPending}
                onClick={handleReconcileSelected}
              >
                Reconcile ({selectedIds.length})
              </Button>
              <Button
                variant="outlined"
                color="warning"
                size="small"
                disabled={selectedIds.length === 0 || reconcileMutation.isPending}
                onClick={handleUnreconcileSelected}
              >
                Unreconcile ({selectedIds.length})
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredTransactions}
          columns={columns}
          checkboxSelection
          onRowSelectionModelChange={(model) => setSelectedIds(model as string[])}
          rowSelectionModel={selectedIds}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 50 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  );
};

export default ReconciliationPage;
