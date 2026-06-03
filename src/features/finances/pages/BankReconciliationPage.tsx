import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  TextField,
  MenuItem,
  Chip,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Divider,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { bankReconciliationApi } from '@/lib/api/bankReconciliation';
import { chartOfAccountsApi } from '@/lib/api/chartOfAccounts';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { ChartOfAccount, GeneralLedgerEntry, BankReconciliation } from '@/types/models';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const STEPS = ['Select Account', 'Statement Info', 'Match Transactions', 'Review & Save'];

const BankReconciliationPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  // Stepper state
  const [activeStep, setActiveStep] = useState(0);

  // Step 1: Account selection
  const [selectedAccountNumber, setSelectedAccountNumber] = useState('');

  // Step 2: Statement info
  const [statementDate, setStatementDate] = useState('');
  const [statementEndingBalance, setStatementEndingBalance] = useState('');

  // Step 3: Cleared transaction IDs
  const [clearedIds, setClearedIds] = useState<string[]>([]);

  // Fetch chart of accounts (filter for cash/asset types suitable for bank reconciliation)
  const { data: accounts = [] } = useQuery({
    queryKey: ['chartOfAccounts'],
    queryFn: () => chartOfAccountsApi.getActive(),
  });

  // Filter to bank-like accounts (cash, checking)
  const bankAccounts = useMemo(
    () => accounts.filter((a: ChartOfAccount) =>
      a.type === 'asset' && (a.subtype === 'cash' || a.subtype === 'other_asset')
    ),
    [accounts]
  );

  const selectedAccount = useMemo(
    () => bankAccounts.find((a: ChartOfAccount) => a.accountNumber === selectedAccountNumber),
    [bankAccounts, selectedAccountNumber]
  );

  // Fetch uncleared transactions for the selected account
  const { data: unclearedTransactions = [], isLoading: txLoading } = useQuery({
    queryKey: ['unclearedTransactions', selectedAccountNumber],
    queryFn: () => bankReconciliationApi.getUnclearedTransactions(selectedAccountNumber),
    enabled: !!selectedAccountNumber,
  });

  // Fetch past reconciliations for reference
  const { data: pastReconciliations = [] } = useQuery({
    queryKey: ['bankReconciliations'],
    queryFn: () => bankReconciliationApi.getAll(),
  });

  // Compute reconciliation summary
  const summary = useMemo(() => {
    const stmtBal = parseFloat(statementEndingBalance) || 0;

    const clearedTxs = unclearedTransactions.filter((t: GeneralLedgerEntry) =>
      clearedIds.includes(t.id)
    );
    const unclearedTxs = unclearedTransactions.filter((t: GeneralLedgerEntry) =>
      !clearedIds.includes(t.id)
    );

    // Deposits = credits to this account (money coming in)
    // Payments = debits to this account (money going out)
    // In double-entry: debit to cash = money in, credit to cash = money out
    const clearedDeposits = clearedTxs
      .filter((t: GeneralLedgerEntry) => t.debit > 0)
      .reduce((sum: number, t: GeneralLedgerEntry) => sum + t.debit, 0);

    const clearedPayments = clearedTxs
      .filter((t: GeneralLedgerEntry) => t.credit > 0)
      .reduce((sum: number, t: GeneralLedgerEntry) => sum + t.credit, 0);

    const outstandingDeposits = unclearedTxs
      .filter((t: GeneralLedgerEntry) => t.debit > 0)
      .reduce((sum: number, t: GeneralLedgerEntry) => sum + t.debit, 0);

    const outstandingPayments = unclearedTxs
      .filter((t: GeneralLedgerEntry) => t.credit > 0)
      .reduce((sum: number, t: GeneralLedgerEntry) => sum + t.credit, 0);

    // Adjusted bank balance = statement balance + outstanding deposits - outstanding payments
    const adjustedBankBalance = Math.round((stmtBal + outstandingDeposits - outstandingPayments) * 100) / 100;

    // Book balance = total debits - total credits for all uncleared + cleared
    const allTxs = unclearedTransactions;
    const bookBalance = Math.round(
      allTxs.reduce((sum: number, t: GeneralLedgerEntry) => sum + t.debit - t.credit, 0) * 100
    ) / 100;

    const clearedBalance = Math.round((clearedDeposits - clearedPayments) * 100) / 100;

    const difference = Math.round((adjustedBankBalance - bookBalance) * 100) / 100;

    return {
      stmtBal,
      clearedDeposits,
      clearedPayments,
      clearedBalance,
      outstandingDeposits,
      outstandingPayments,
      adjustedBankBalance,
      bookBalance,
      difference,
      isBalanced: Math.abs(difference) < 0.01,
    };
  }, [unclearedTransactions, clearedIds, statementEndingBalance]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const stmtDate = new Date(statementDate + 'T00:00:00');
      const reconciliation: Omit<BankReconciliation, 'id' | 'createdAt' | 'updatedAt'> = {
        accountName: selectedAccount?.name || '',
        accountNumber: selectedAccountNumber,
        statementDate: stmtDate,
        statementEndingBalance: summary.stmtBal,
        clearedDeposits: summary.clearedDeposits,
        clearedPayments: summary.clearedPayments,
        clearedBalance: summary.clearedBalance,
        outstandingDeposits: summary.outstandingDeposits,
        outstandingPayments: summary.outstandingPayments,
        adjustedBankBalance: summary.adjustedBankBalance,
        difference: summary.difference,
        status: 'completed',
        clearedTransactionIds: clearedIds,
        completedAt: new Date(),
        completedBy: user?.uid || '',
        createdBy: user?.uid || '',
      };

      return bankReconciliationApi.saveReconciliation(reconciliation, clearedIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bankReconciliations'] });
      queryClient.invalidateQueries({ queryKey: ['unclearedTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['generalLedger'] });
      toast.success('Reconciliation saved successfully');
      // Reset form
      setActiveStep(0);
      setSelectedAccountNumber('');
      setStatementDate('');
      setStatementEndingBalance('');
      setClearedIds([]);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save reconciliation'),
  });

  // Stepper navigation
  const canAdvance = () => {
    switch (activeStep) {
      case 0: return !!selectedAccountNumber;
      case 1: return !!statementDate && !!statementEndingBalance;
      case 2: return true; // Can always advance from matching step
      case 3: return summary.isBalanced;
      default: return false;
    }
  };

  const handleNext = () => {
    if (activeStep < STEPS.length - 1) {
      setActiveStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep(prev => Math.max(0, prev - 1));
  };

  // Transaction columns for Step 3
  const txColumns: GridColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      width: 110,
      valueFormatter: (params) => format(params.value, 'MM/dd/yyyy'),
    },
    {
      field: 'memo',
      headerName: 'Description',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'debit',
      headerName: 'Debit (In)',
      width: 120,
      renderCell: (params) => {
        const val = params.value as number;
        return val > 0 ? (
          <Typography variant="body2" color="success.main" fontWeight="bold">
            {formatCurrency(val)}
          </Typography>
        ) : '---';
      },
    },
    {
      field: 'credit',
      headerName: 'Credit (Out)',
      width: 120,
      renderCell: (params) => {
        const val = params.value as number;
        return val > 0 ? (
          <Typography variant="body2" color="error.main" fontWeight="bold">
            {formatCurrency(val)}
          </Typography>
        ) : '---';
      },
    },
    {
      field: 'sourceType',
      headerName: 'Source',
      width: 110,
      renderCell: (params) => {
        const colors: Record<string, 'success' | 'error' | 'info' | 'default'> = {
          income: 'success',
          expense: 'error',
          payment: 'info',
          journal: 'default',
          depreciation: 'default',
        };
        return (
          <Chip
            label={params.value}
            size="small"
            color={colors[params.value] || 'default'}
            variant="outlined"
          />
        );
      },
    },
  ];

  // Past reconciliation columns
  const pastColumns: GridColDef[] = [
    {
      field: 'statementDate',
      headerName: 'Statement Date',
      width: 130,
      valueFormatter: (params) => format(params.value, 'MM/dd/yyyy'),
    },
    {
      field: 'accountName',
      headerName: 'Account',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'statementEndingBalance',
      headerName: 'Statement Bal.',
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'difference',
      headerName: 'Difference',
      width: 120,
      renderCell: (params) => {
        const val = params.value as number;
        const balanced = Math.abs(val) < 0.01;
        return (
          <Chip
            icon={balanced ? <CheckCircleIcon /> : <WarningIcon />}
            label={formatCurrency(val)}
            size="small"
            color={balanced ? 'success' : 'warning'}
            variant="outlined"
          />
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.value === 'completed' ? 'Completed' : 'In Progress'}
          size="small"
          color={params.value === 'completed' ? 'success' : 'warning'}
        />
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Bank Reconciliation</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <AccountBalanceIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h4">Bank Reconciliation</Typography>
      </Box>

      {/* Stepper */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Stepper activeStep={activeStep} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* Step 1: Select Account */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="h6" gutterBottom>Select Bank Account</Typography>
            <TextField
              select
              label="Account"
              value={selectedAccountNumber}
              onChange={(e) => {
                setSelectedAccountNumber(e.target.value);
                setClearedIds([]);
              }}
              fullWidth
              sx={{ maxWidth: 400 }}
            >
              {bankAccounts.map((a: ChartOfAccount) => (
                <MenuItem key={a.accountNumber} value={a.accountNumber}>
                  {a.accountNumber} - {a.name}
                </MenuItem>
              ))}
            </TextField>
            {bankAccounts.length === 0 && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No bank accounts found. Please set up cash accounts in the Chart of Accounts first.
              </Alert>
            )}
          </Box>
        )}

        {/* Step 2: Statement Info */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Enter Statement Details for {selectedAccount?.name}
            </Typography>
            <Grid container spacing={2} sx={{ maxWidth: 600 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Statement Date"
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Statement Ending Balance ($)"
                  type="number"
                  value={statementEndingBalance}
                  onChange={(e) => setStatementEndingBalance(e.target.value)}
                  fullWidth
                  required
                  inputProps={{ step: '0.01' }}
                />
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Step 3: Match Transactions */}
        {activeStep === 2 && (
          <Box>
            <Typography variant="h6" gutterBottom>
              Match Cleared Transactions
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select the transactions that appear on your bank statement.
              Showing {unclearedTransactions.length} uncleared transaction(s) for {selectedAccount?.name}.
            </Typography>

            <Paper sx={{ height: { xs: 350, md: 500 }, width: '100%' }}>
              <DataGrid
                rows={unclearedTransactions}
                columns={txColumns}
                loading={txLoading}
                checkboxSelection
                onRowSelectionModelChange={(model) => setClearedIds(model as string[])}
                rowSelectionModel={clearedIds}
                pageSizeOptions={[25, 50, 100]}
                initialState={{
                  pagination: { paginationModel: { pageSize: 50 } },
                  sorting: { sortModel: [{ field: 'date', sort: 'asc' }] },
                }}
                disableRowSelectionOnClick
              />
            </Paper>

            <Typography variant="body2" sx={{ mt: 1 }}>
              {clearedIds.length} transaction(s) selected as cleared
            </Typography>
          </Box>
        )}

        {/* Step 4: Review & Save */}
        {activeStep === 3 && (
          <Box>
            <Typography variant="h6" gutterBottom>Reconciliation Summary</Typography>

            <Paper sx={{ p: 3, mb: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1">Statement Ending Balance:</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {formatCurrency(summary.stmtBal)}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      + Outstanding Deposits:
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      {formatCurrency(summary.outstandingDeposits)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      - Outstanding Payments:
                    </Typography>
                    <Typography variant="body2" color="error.main">
                      {formatCurrency(summary.outstandingPayments)}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" fontWeight="bold">Adjusted Bank Balance:</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {formatCurrency(summary.adjustedBankBalance)}
                    </Typography>
                  </Box>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1">Cleared Deposits:</Typography>
                    <Typography variant="body1" color="success.main">
                      {formatCurrency(summary.clearedDeposits)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1">Cleared Payments:</Typography>
                    <Typography variant="body1" color="error.main">
                      {formatCurrency(summary.clearedPayments)}
                    </Typography>
                  </Box>
                  <Divider sx={{ my: 1 }} />
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body1" fontWeight="bold">Book Balance (GL):</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {formatCurrency(summary.bookBalance)}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">Difference:</Typography>
                <Chip
                  icon={summary.isBalanced ? <CheckCircleIcon /> : <WarningIcon />}
                  label={formatCurrency(summary.difference)}
                  color={summary.isBalanced ? 'success' : 'warning'}
                  size="medium"
                />
              </Box>

              {summary.isBalanced ? (
                <Alert severity="success" sx={{ mt: 2 }}>
                  Balanced! The bank statement matches your books. You can save this reconciliation.
                </Alert>
              ) : (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  The reconciliation is off by {formatCurrency(Math.abs(summary.difference))}.
                  Please go back and check your cleared transactions or statement balance.
                </Alert>
              )}
            </Paper>
          </Box>
        )}

        {/* Navigation Buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
          <Button
            disabled={activeStep === 0}
            onClick={handleBack}
          >
            Back
          </Button>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {activeStep < STEPS.length - 1 ? (
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!canAdvance()}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                color="success"
                onClick={() => saveMutation.mutate()}
                disabled={!summary.isBalanced || saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Reconciliation'}
              </Button>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Past Reconciliations */}
      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>Past Reconciliations</Typography>
      <Paper sx={{ height: { xs: 300, md: 400 }, width: '100%' }}>
        <DataGrid
          rows={pastReconciliations}
          columns={pastColumns}
          pageSizeOptions={[10, 25]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            sorting: { sortModel: [{ field: 'statementDate', sort: 'desc' }] },
          }}
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  );
};

export default BankReconciliationPage;
