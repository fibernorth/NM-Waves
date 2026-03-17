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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PrintIcon from '@mui/icons-material/Print';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import { budgetsApi, reportsApi } from '@/lib/api/accounting';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import type { Budget } from '@/types/models';
import toast from 'react-hot-toast';

const currentYear = new Date().getFullYear().toString();

const fmtCurrency = (val: number) =>
  `$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const VarianceCell = ({ budget, actual }: { budget: number; actual: number }) => {
  const variance = actual - budget;
  const pct = budget > 0 ? ((variance / budget) * 100) : 0;
  if (budget === 0 && actual === 0) return <Typography variant="body2" color="text.secondary">--</Typography>;
  return (
    <Box>
      <Typography
        variant="body2"
        fontWeight={600}
        color={variance >= 0 ? 'success.main' : 'error.main'}
      >
        {variance >= 0 ? '+' : '-'}{fmtCurrency(variance)}
      </Typography>
      {budget > 0 && (
        <Typography variant="caption" color="text.secondary">
          {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
        </Typography>
      )}
    </Box>
  );
};

const defaultPlannedIncome = {
  playerPayments: 0, sponsorships: 0, fundraisers: 0, donations: 0,
  grants: 0, merchandise: 0, concessions: 0, other: 0,
};
const defaultPlannedExpenses = {
  facilities: 0, equipment: 0, uniforms: 0, tournaments: 0, travel: 0,
  insurance: 0, leagueFees: 0, coaching: 0, administrative: 0,
  marketing: 0, fundraising: 0, maintenance: 0, other: 0,
};

const BudgetVsActualPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [season, setSeason] = useState(currentYear);
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [incomeForm, setIncomeForm] = useState({ ...defaultPlannedIncome });
  const [expenseForm, setExpenseForm] = useState({ ...defaultPlannedExpenses });
  const [budgetNotes, setBudgetNotes] = useState('');

  const { data: budgets = [], isLoading: loadingBudgets, isError: budgetsError } = useQuery({
    queryKey: ['budgets', season],
    queryFn: () => budgetsApi.getBySeason(season),
  });

  const { data: summary, isLoading: loadingSummary, isError: summaryError } = useQuery({
    queryKey: ['financialSummary', season],
    queryFn: () => reportsApi.generateSummary(season),
    enabled: !!season,
  });

  const isLoading = loadingBudgets || loadingSummary;
  const isError = budgetsError || summaryError;

  // Use the first (org-wide) budget for comparison, or fall back to empty
  const budget = budgets.find(b => !b.teamId) || budgets[0];

  const createBudgetMutation = useMutation({
    mutationFn: (data: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>) => budgetsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget created');
      closeBudgetDialog();
    },
    onError: () => toast.error('Failed to create budget'),
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Budget> }) => budgetsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Budget updated');
      closeBudgetDialog();
    },
    onError: () => toast.error('Failed to update budget'),
  });

  const openCreateBudget = () => {
    setEditingBudget(null);
    setIncomeForm({ ...defaultPlannedIncome });
    setExpenseForm({ ...defaultPlannedExpenses });
    setBudgetNotes('');
    setBudgetDialogOpen(true);
  };

  const openEditBudget = () => {
    if (!budget) return;
    setEditingBudget(budget);
    setIncomeForm({ ...defaultPlannedIncome, ...budget.plannedIncome });
    setExpenseForm({ ...defaultPlannedExpenses, ...budget.plannedExpenses });
    setBudgetNotes(budget.notes || '');
    setBudgetDialogOpen(true);
  };

  const closeBudgetDialog = () => {
    setBudgetDialogOpen(false);
    setEditingBudget(null);
  };

  const handleSaveBudget = () => {
    const payload = {
      season,
      plannedIncome: incomeForm,
      plannedExpenses: expenseForm,
      notes: budgetNotes || '',
      createdBy: user?.uid || '',
    };
    if (editingBudget) {
      updateBudgetMutation.mutate({ id: editingBudget.id, data: payload });
    } else {
      createBudgetMutation.mutate(payload as any);
    }
  };

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Budget vs Actual</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  const incomeRows = [
    { label: 'Player Payments', budgetKey: 'playerPayments', actualKey: 'playerPayments' },
    { label: 'Sponsorships', budgetKey: 'sponsorships', actualKey: 'sponsorships' },
    { label: 'Fundraisers', budgetKey: 'fundraisers', actualKey: 'fundraisers' },
    { label: 'Donations', budgetKey: 'donations', actualKey: 'donations' },
    { label: 'Grants', budgetKey: 'grants', actualKey: 'grants' },
    { label: 'Merchandise', budgetKey: 'merchandise', actualKey: 'merchandise' },
    { label: 'Concessions', budgetKey: 'concessions', actualKey: 'concessions' },
    { label: 'Other', budgetKey: 'other', actualKey: 'other' },
  ];

  const expenseRows = [
    { label: 'Facilities', budgetKey: 'facilities', actualKey: 'facilities' },
    { label: 'Equipment', budgetKey: 'equipment', actualKey: 'equipment' },
    { label: 'Uniforms', budgetKey: 'uniforms', actualKey: 'uniforms' },
    { label: 'Tournaments', budgetKey: 'tournaments', actualKey: 'tournaments' },
    { label: 'Travel', budgetKey: 'travel', actualKey: 'travel' },
    { label: 'Insurance', budgetKey: 'insurance', actualKey: 'insurance' },
    { label: 'League Fees', budgetKey: 'leagueFees', actualKey: 'leagueFees' },
    { label: 'Coaching', budgetKey: 'coaching', actualKey: 'coaching' },
    { label: 'Administrative', budgetKey: 'administrative', actualKey: 'administrative' },
    { label: 'Marketing', budgetKey: 'marketing', actualKey: 'marketing' },
    { label: 'Fundraising', budgetKey: 'fundraising', actualKey: 'fundraising' },
    { label: 'Maintenance', budgetKey: 'maintenance', actualKey: 'maintenance' },
    { label: 'Other', budgetKey: 'other', actualKey: 'other' },
  ];

  const totalBudgetIncome = budget
    ? Object.values(budget.plannedIncome).reduce((s, v) => s + v, 0)
    : 0;
  const totalBudgetExpenses = budget
    ? Object.values(budget.plannedExpenses).reduce((s, v) => s + v, 0)
    : 0;
  const totalActualIncome = summary?.income.total || 0;
  const totalActualExpenses = summary?.expenses.total || 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Budget vs Actual</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {budget && (
            <Button variant="outlined" startIcon={<EditIcon />} onClick={openEditBudget}>
              Edit Budget
            </Button>
          )}
          {!budget && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateBudget}>
              Create Budget
            </Button>
          )}
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Print
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
          {[currentYear, `${Number(currentYear) - 1}-${currentYear}`, String(Number(currentYear) - 1), `${Number(currentYear) - 2}-${Number(currentYear) - 1}`, String(Number(currentYear) - 2)].map(y => (
            <MenuItem key={y} value={y}>{y}</MenuItem>
          ))}
        </TextField>
      </Paper>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load budget or financial data. Please try again.
        </Alert>
      )}

      {!isLoading && !isError && !budget && (
        <Alert
          severity="info"
          sx={{ mb: 3 }}
          action={
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={openCreateBudget}>
              Create Budget
            </Button>
          }
        >
          No budget found for season {season}. Create a budget to see variance analysis.
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Budgeted Income</Typography>
              <Typography variant="h5">{fmtCurrency(totalBudgetIncome)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Actual Income</Typography>
              <Typography variant="h5" color="success.main">{fmtCurrency(totalActualIncome)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Budgeted Expenses</Typography>
              <Typography variant="h5">{fmtCurrency(totalBudgetExpenses)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Actual Expenses</Typography>
              <Typography variant="h5" color="error.main">{fmtCurrency(totalActualExpenses)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Net Income Comparison */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={4} sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Budgeted Net</Typography>
            <Typography variant="h5">
              {fmtCurrency(totalBudgetIncome - totalBudgetExpenses)}
            </Typography>
          </Grid>
          <Grid item xs={4} sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Actual Net</Typography>
            <Typography
              variant="h5"
              color={totalActualIncome - totalActualExpenses >= 0 ? 'success.main' : 'error.main'}
            >
              {totalActualIncome - totalActualExpenses >= 0 ? '' : '-'}{fmtCurrency(totalActualIncome - totalActualExpenses)}
            </Typography>
          </Grid>
          <Grid item xs={4} sx={{ textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">Variance</Typography>
            <VarianceCell
              budget={totalBudgetIncome - totalBudgetExpenses}
              actual={totalActualIncome - totalActualExpenses}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Income Section */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }} color="success.main">Income</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell align="right">Budget</TableCell>
                <TableCell align="right">Actual</TableCell>
                <TableCell align="right">Variance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {incomeRows.map((row) => {
                const budgetVal = budget ? (budget.plannedIncome as any)[row.budgetKey] || 0 : 0;
                const actualVal = summary ? (summary.income as any)[row.actualKey] || 0 : 0;
                if (budgetVal === 0 && actualVal === 0) return null;
                return (
                  <TableRow key={row.label}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell align="right">{fmtCurrency(budgetVal)}</TableCell>
                    <TableCell align="right">{fmtCurrency(actualVal)}</TableCell>
                    <TableCell align="right">
                      <VarianceCell budget={budgetVal} actual={actualVal} />
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell><Typography fontWeight={700}>Total Income</Typography></TableCell>
                <TableCell align="right"><Typography fontWeight={700}>{fmtCurrency(totalBudgetIncome)}</Typography></TableCell>
                <TableCell align="right"><Typography fontWeight={700}>{fmtCurrency(totalActualIncome)}</Typography></TableCell>
                <TableCell align="right">
                  <VarianceCell budget={totalBudgetIncome} actual={totalActualIncome} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Expenses Section */}
      <Paper sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }} color="error.main">Expenses</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Category</TableCell>
                <TableCell align="right">Budget</TableCell>
                <TableCell align="right">Actual</TableCell>
                <TableCell align="right">Variance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {expenseRows.map((row) => {
                const budgetVal = budget ? (budget.plannedExpenses as any)[row.budgetKey] || 0 : 0;
                const actualVal = summary ? (summary.expenses as any)[row.actualKey] || 0 : 0;
                if (budgetVal === 0 && actualVal === 0) return null;
                return (
                  <TableRow key={row.label}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell align="right">{fmtCurrency(budgetVal)}</TableCell>
                    <TableCell align="right">{fmtCurrency(actualVal)}</TableCell>
                    <TableCell align="right">
                      <VarianceCell budget={budgetVal} actual={actualVal} />
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell><Typography fontWeight={700}>Total Expenses</Typography></TableCell>
                <TableCell align="right"><Typography fontWeight={700}>{fmtCurrency(totalBudgetExpenses)}</Typography></TableCell>
                <TableCell align="right"><Typography fontWeight={700}>{fmtCurrency(totalActualExpenses)}</Typography></TableCell>
                <TableCell align="right">
                  <VarianceCell budget={totalBudgetExpenses} actual={totalActualExpenses} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {/* Budget Create/Edit Dialog */}
      <Dialog open={budgetDialogOpen} onClose={closeBudgetDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingBudget ? 'Edit Budget' : 'Create Budget'} — {season}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" color="success.main" gutterBottom>Planned Income</Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {[
                { key: 'playerPayments', label: 'Player Payments' },
                { key: 'sponsorships', label: 'Sponsorships' },
                { key: 'fundraisers', label: 'Fundraisers' },
                { key: 'donations', label: 'Donations' },
                { key: 'grants', label: 'Grants' },
                { key: 'merchandise', label: 'Merchandise' },
                { key: 'concessions', label: 'Concessions' },
                { key: 'other', label: 'Other' },
              ].map(({ key, label }) => (
                <Grid item xs={6} sm={3} key={key}>
                  <TextField
                    label={label}
                    type="number"
                    size="small"
                    fullWidth
                    value={(incomeForm as any)[key] || ''}
                    onChange={(e) => setIncomeForm({ ...incomeForm, [key]: parseFloat(e.target.value) || 0 })}
                    InputProps={{ startAdornment: '$' }}
                    inputProps={{ step: '0.01' }}
                  />
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" color="error.main" gutterBottom>Planned Expenses</Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {[
                { key: 'facilities', label: 'Facilities' },
                { key: 'equipment', label: 'Equipment' },
                { key: 'uniforms', label: 'Uniforms' },
                { key: 'tournaments', label: 'Tournaments' },
                { key: 'travel', label: 'Travel' },
                { key: 'insurance', label: 'Insurance' },
                { key: 'leagueFees', label: 'League Fees' },
                { key: 'coaching', label: 'Coaching' },
                { key: 'administrative', label: 'Administrative' },
                { key: 'marketing', label: 'Marketing' },
                { key: 'fundraising', label: 'Fundraising' },
                { key: 'maintenance', label: 'Maintenance' },
                { key: 'other', label: 'Other' },
              ].map(({ key, label }) => (
                <Grid item xs={6} sm={3} key={key}>
                  <TextField
                    label={label}
                    type="number"
                    size="small"
                    fullWidth
                    value={(expenseForm as any)[key] || ''}
                    onChange={(e) => setExpenseForm({ ...expenseForm, [key]: parseFloat(e.target.value) || 0 })}
                    InputProps={{ startAdornment: '$' }}
                    inputProps={{ step: '0.01' }}
                  />
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ my: 2 }} />

            <TextField
              label="Notes"
              multiline
              rows={2}
              fullWidth
              value={budgetNotes}
              onChange={(e) => setBudgetNotes(e.target.value)}
            />

            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Paper sx={{ p: 1.5, flex: 1, textAlign: 'center', bgcolor: 'success.50' }}>
                <Typography variant="caption" color="text.secondary">Total Income</Typography>
                <Typography variant="h6" color="success.main">
                  ${Object.values(incomeForm).reduce((s, v) => s + v, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Typography>
              </Paper>
              <Paper sx={{ p: 1.5, flex: 1, textAlign: 'center', bgcolor: 'error.50' }}>
                <Typography variant="caption" color="text.secondary">Total Expenses</Typography>
                <Typography variant="h6" color="error.main">
                  ${Object.values(expenseForm).reduce((s, v) => s + v, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Typography>
              </Paper>
              <Paper sx={{ p: 1.5, flex: 1, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">Net Budget</Typography>
                <Typography variant="h6">
                  ${(Object.values(incomeForm).reduce((s, v) => s + v, 0) - Object.values(expenseForm).reduce((s, v) => s + v, 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Typography>
              </Paper>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeBudgetDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveBudget}
            disabled={createBudgetMutation.isPending || updateBudgetMutation.isPending}
          >
            {createBudgetMutation.isPending || updateBudgetMutation.isPending
              ? 'Saving...'
              : editingBudget ? 'Update Budget' : 'Create Budget'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BudgetVsActualPage;
