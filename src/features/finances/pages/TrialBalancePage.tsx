import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  MenuItem,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { generalLedgerApi } from '@/lib/api/generalLedger';
import { chartOfAccountsApi } from '@/lib/api/chartOfAccounts';
import { expensesApi, incomeApi } from '@/lib/api/accounting';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import toast from 'react-hot-toast';

const currentYear = new Date().getFullYear().toString();

const TrialBalancePage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const queryClient = useQueryClient();
  const [season, setSeason] = useState(currentYear);

  const { data: trialBalance, isLoading, isError: trialBalanceError } = useQuery({
    queryKey: ['trialBalance', season],
    queryFn: () => generalLedgerApi.computeTrialBalance(season || undefined),
  });

  const { data: accounts = [], isError: accountsError } = useQuery({
    queryKey: ['chartOfAccounts'],
    queryFn: () => chartOfAccountsApi.getAll(),
  });

  const isError = trialBalanceError || accountsError;

  const seedMutation = useMutation({
    mutationFn: () => chartOfAccountsApi.seedDefaults(),
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['chartOfAccounts'] });
      toast.success(`Created ${count} default accounts`);
    },
    onError: (err: Error) => toast.error(`Failed to seed accounts: ${err.message}`),
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const [allIncome, allExpenses] = await Promise.all([
        incomeApi.getAll(),
        expensesApi.getAll(),
      ]);
      return generalLedgerApi.backfillFromTransactions(
        allIncome,
        allExpenses,
        user?.uid || ''
      );
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['trialBalance'] });
      toast.success(`Posted ${result.posted} GL entries, skipped ${result.skipped} duplicates`);
    },
    onError: (err: Error) => toast.error(`Failed to backfill GL entries: ${err.message}`),
  });

  const columns: GridColDef[] = [
    { field: 'accountNumber', headerName: 'Account #', width: 110 },
    { field: 'accountName', headerName: 'Account Name', flex: 1, minWidth: 200 },
    {
      field: 'accountType',
      headerName: 'Type',
      width: 100,
      renderCell: (params) => (
        <Chip label={params.value || '--'} size="small" variant="outlined" />
      ),
    },
    {
      field: 'totalDebit',
      headerName: 'Debits',
      width: 130,
      type: 'number',
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value > 0 ? `$${params.value.toFixed(2)}` : ''}
        </Typography>
      ),
    },
    {
      field: 'totalCredit',
      headerName: 'Credits',
      width: 130,
      type: 'number',
      renderCell: (params) => (
        <Typography variant="body2">
          {params.value > 0 ? `$${params.value.toFixed(2)}` : ''}
        </Typography>
      ),
    },
    {
      field: 'balance',
      headerName: 'Balance',
      width: 130,
      type: 'number',
      renderCell: (params) => (
        <Typography
          variant="body2"
          fontWeight={600}
          color={params.value > 0 ? 'success.main' : params.value < 0 ? 'error.main' : 'text.secondary'}
        >
          {params.value !== 0 ? `$${Math.abs(params.value).toFixed(2)} ${params.value > 0 ? 'Dr' : 'Cr'}` : '--'}
        </Typography>
      ),
    },
  ];

  const rows = (trialBalance?.accounts || []).map((a, i) => ({
    id: a.accountNumber || i,
    ...a,
  }));

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Trial Balance</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Trial Balance</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {accounts.length === 0 && (
            <Button
              variant="outlined"
              startIcon={seedMutation.isPending ? <CircularProgress size={18} /> : <PlaylistAddIcon />}
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? 'Seeding...' : 'Setup Chart of Accounts'}
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={backfillMutation.isPending ? <CircularProgress size={18} /> : <PlaylistAddIcon />}
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
          >
            {backfillMutation.isPending ? 'Posting...' : 'Backfill GL from Transactions'}
          </Button>
        </Box>
      </Box>

      {/* Season Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          label="Season"
          select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All Seasons</MenuItem>
          {[currentYear, `${Number(currentYear) - 1}-${currentYear}`, String(Number(currentYear) - 1), `${Number(currentYear) - 2}-${Number(currentYear) - 1}`, String(Number(currentYear) - 2)].map(y => (
            <MenuItem key={y} value={y}>{y}</MenuItem>
          ))}
        </TextField>
      </Paper>

      {/* Balance Status */}
      {trialBalance && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>Total Debits</Typography>
                <Typography variant="h5">${trialBalance.totalDebits.toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Typography variant="body2" color="text.secondary" gutterBottom>Total Credits</Typography>
                <Typography variant="h5">${trialBalance.totalCredits.toFixed(2)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {trialBalance.isBalanced ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <ErrorIcon color="error" />
                  )}
                  <Typography variant="body2" color="text.secondary">Status</Typography>
                </Box>
                <Typography
                  variant="h5"
                  color={trialBalance.isBalanced ? 'success.main' : 'error.main'}
                >
                  {trialBalance.isBalanced ? 'Balanced' : `Off by $${Math.abs(trialBalance.totalDebits - trialBalance.totalCredits).toFixed(2)}`}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load trial balance data. Please try again.
        </Alert>
      )}

      {!trialBalance?.isBalanced && trialBalance && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Trial balance is not balanced. Total debits and credits should be equal. Review GL entries for errors.
        </Alert>
      )}

      {rows.length === 0 && !isLoading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No GL entries found. Use "Setup Chart of Accounts" to create the default account structure, then "Backfill GL from Transactions" to post existing income and expenses.
        </Alert>
      )}

      {/* Data Grid */}
      <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
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

export default TrialBalancePage;
