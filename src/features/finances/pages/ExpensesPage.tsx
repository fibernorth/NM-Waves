import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  MenuItem,
  TextField,
  Grid,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/lib/api/accounting';
import { teamsApi } from '@/lib/api/teams';
import { playersApi } from '@/lib/api/players';
import { tournamentsApi } from '@/lib/api/tournaments';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { Expense, ExpenseCategory } from '@/types/models';

const currentYear = new Date().getFullYear();
const seasonOptions: string[] = [];
for (let y = currentYear; y >= currentYear - 5; y--) {
  seasonOptions.push(y.toString());
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface ExpenseFormState {
  date: string;
  vendor: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  paymentMethod: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'venmo' | 'zelle' | 'other';
  isPaid: boolean;
  paidDate: string;
  season: string;
  notes: string;
  teamId: string;
  playerId: string;
  tournamentId: string;
}

const defaultExpenseForm: ExpenseFormState = {
  date: '',
  vendor: '',
  category: 'other',
  description: '',
  amount: '',
  paymentMethod: 'check',
  isPaid: false,
  paidDate: '',
  season: currentYear.toString(),
  notes: '',
  teamId: '',
  playerId: '',
  tournamentId: '',
};

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'facilities', label: 'Facilities' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'uniforms', label: 'Uniforms' },
  { value: 'tournaments', label: 'Tournaments' },
  { value: 'travel', label: 'Travel' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'league_fees', label: 'League Fees' },
  { value: 'coaching', label: 'Coaching' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'processing_fees', label: 'Processing Fees' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'fundraising', label: 'Fundraising' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'other', label: 'Other' },
];

const ExpensesPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [selectedSeason, setSelectedSeason] = useState<string>(currentYear.toString());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paidFilter, setSelectedPaidFilter] = useState<string>('all');
  const [selectedTeam, setSelectedTeam] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseForm, setExpenseForm] = useState<ExpenseFormState>(defaultExpenseForm);

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => expensesApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
  });

  const { data: tournaments = [] } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => tournamentsApi.getAll(),
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) =>
      expensesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense created successfully');
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create expense');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Expense> }) =>
      expensesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense updated successfully');
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update expense');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete expense');
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: Date }) => expensesApi.markAsPaid(id, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense marked as paid');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update expense');
    },
  });

  // ---------------------------------------------------------------------------
  // Dialog helpers
  // ---------------------------------------------------------------------------

  const openAddDialog = () => {
    setEditingExpense(null);
    setExpenseForm(defaultExpenseForm);
    setDialogOpen(true);
  };

  const openEditDialog = (expense: Expense) => {
    setEditingExpense(expense);
    setExpenseForm({
      date: expense.date ? format(expense.date, 'yyyy-MM-dd') : '',
      vendor: expense.vendor || '',
      category: expense.category,
      description: expense.description || '',
      amount: expense.amount?.toString() || '',
      paymentMethod: expense.paymentMethod || 'check',
      isPaid: expense.isPaid || false,
      paidDate: expense.paidDate ? format(expense.paidDate, 'yyyy-MM-dd') : '',
      season: expense.season || currentYear.toString(),
      notes: expense.notes || '',
      teamId: expense.teamId || '',
      playerId: expense.playerId || '',
      tournamentId: expense.tournamentId || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingExpense(null);
    setExpenseForm(defaultExpenseForm);
  };

  const handleSave = () => {
    if (!expenseForm.date || !expenseForm.vendor || !expenseForm.amount) {
      toast.error('Date, vendor, and amount are required');
      return;
    }

    const parsedAmount = parseFloat(expenseForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    const selectedTeamObj = teams.find(t => t.id === expenseForm.teamId);
    const selectedPlayerObj = players.find(p => p.id === expenseForm.playerId);
    const selectedTournamentObj = tournaments.find(t => t.id === expenseForm.tournamentId);

    const payload = {
      date: new Date(expenseForm.date + 'T00:00:00'),
      vendor: expenseForm.vendor,
      category: expenseForm.category,
      description: expenseForm.description,
      amount: parsedAmount,
      paymentMethod: expenseForm.paymentMethod,
      isPaid: expenseForm.isPaid,
      paidDate: expenseForm.paidDate
        ? new Date(expenseForm.paidDate + 'T00:00:00')
        : undefined,
      season: expenseForm.season,
      notes: expenseForm.notes || undefined,
      recordedBy: user?.uid || '',
      teamId: expenseForm.teamId || undefined,
      teamName: selectedTeamObj?.name || undefined,
      playerId: expenseForm.playerId || undefined,
      playerName: selectedPlayerObj
        ? `${selectedPlayerObj.firstName} ${selectedPlayerObj.lastName}`
        : undefined,
      tournamentId: expenseForm.tournamentId || undefined,
      tournamentName: selectedTournamentObj?.name || undefined,
    };

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleMarkAsPaid = (id: string) => {
    markAsPaidMutation.mutate({ id, date: new Date() });
  };

  // Build season options dynamically from actual data so imported seasons always appear
  const dynamicSeasonOptions = useMemo(() => {
    const set = new Set<string>(seasonOptions);
    for (const e of expenses) {
      if (e.season) set.add(e.season);
    }
    return Array.from(set).sort().reverse();
  }, [expenses]);

  // Flexible season match — "2026" matches "2025-2026" and vice-versa
  const matchesSeason = (recordSeason: string, filter: string) => {
    if (!recordSeason || !filter) return true;
    if (recordSeason === filter) return true;
    if (recordSeason.endsWith(`-${filter}`) || recordSeason.startsWith(`${filter}-`)) return true;
    if (filter.endsWith(`-${recordSeason}`) || filter.startsWith(`${recordSeason}-`)) return true;
    return false;
  };

  // Players filtered by selected team (for the form dropdown)
  const teamFilteredPlayers = useMemo(() => {
    if (!expenseForm.teamId) return players;
    return players.filter(p => p.teamId === expenseForm.teamId);
  }, [players, expenseForm.teamId]);

  // Filter expenses
  const filteredExpenses = expenses.filter((expense) => {
    if (selectedSeason !== 'all' && !matchesSeason(expense.season, selectedSeason)) return false;
    if (selectedCategory !== 'all' && expense.category !== selectedCategory) return false;
    if (paidFilter === 'paid' && !expense.isPaid) return false;
    if (paidFilter === 'unpaid' && expense.isPaid) return false;
    if (selectedTeam !== 'all' && expense.teamId !== selectedTeam) return false;
    return true;
  });

  // Calculate totals
  const totalAmount = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalPaid = filteredExpenses.filter(e => e.isPaid).reduce((sum, e) => sum + e.amount, 0);
  const totalUnpaid = filteredExpenses.filter(e => !e.isPaid).reduce((sum, e) => sum + e.amount, 0);

  const columns: GridColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      width: 110,
      valueFormatter: (params) => format(params.value, 'MM/dd/yyyy'),
    },
    {
      field: 'vendor',
      headerName: 'Vendor',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 130,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      valueFormatter: (params) => `$${params.value.toFixed(2)}`,
    },
    {
      field: 'paymentMethod',
      headerName: 'Method',
      width: 110,
    },
    {
      field: 'paidDate',
      headerName: 'Paid Date',
      width: 120,
      renderCell: (params) => {
        if (!params.value) return <Chip label="Unpaid" size="small" color="error" variant="outlined" />;
        try {
          return format(new Date(params.value), 'MM/dd/yyyy');
        } catch { return '--'; }
      },
    },
    {
      field: 'isPaid',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Paid' : 'Unpaid'}
          color={params.value ? 'success' : 'warning'}
          size="small"
        />
      ),
    },
    {
      field: 'tournamentName',
      headerName: 'Tournament',
      width: 150,
      renderCell: (params) => params.value || '—',
    },
    {
      field: 'teamName',
      headerName: 'Team',
      width: 140,
      renderCell: (params) => params.value || '—',
    },
    {
      field: 'playerName',
      headerName: 'Player',
      width: 140,
      renderCell: (params) => params.value || '—',
    },
    {
      field: 'season',
      headerName: 'Season',
      width: 120,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isAdmin && !params.row.isPaid && (
            <Tooltip title="Mark as Paid">
              <IconButton
                size="small"
                color="success"
                onClick={() => handleMarkAsPaid(params.row.id)}
              >
                <CheckCircleIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {isAdmin && (
            <>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => openEditDialog(params.row as Expense)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(params.row.id)}
                >
                  <DeleteIcon fontSize="small" />
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
          Expenses
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view expenses.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Expenses</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
          Add Expense
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'white' }}>
            <Typography variant="body2">Total Expenses</Typography>
            <Typography variant="h5">${totalAmount.toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'white' }}>
            <Typography variant="body2">Paid</Typography>
            <Typography variant="h5">${totalPaid.toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, bgcolor: 'warning.light', color: 'white' }}>
            <Typography variant="body2">Unpaid</Typography>
            <Typography variant="h5">${totalUnpaid.toFixed(2)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Season"
              select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All Seasons</MenuItem>
              {dynamicSeasonOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Category"
              select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All Categories</MenuItem>
              {EXPENSE_CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>{cat.label}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Team"
              select
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All Teams</MenuItem>
              {teams.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              label="Payment Status"
              select
              value={paidFilter}
              onChange={(e) => setSelectedPaidFilter(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="paid">Paid</MenuItem>
              <MenuItem value="unpaid">Unpaid</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
        <DataGrid
          rows={filteredExpenses}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: {
              sortModel: [{ field: 'date', sort: 'desc' }],
            },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* Expense Form Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingExpense ? 'Edit Expense' : 'Add Expense'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Date"
              type="date"
              value={expenseForm.date}
              onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Vendor"
              value={expenseForm.vendor}
              onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
              required
              fullWidth
            />
            <TextField
              select
              label="Category"
              value={expenseForm.category}
              onChange={(e) =>
                setExpenseForm({ ...expenseForm, category: e.target.value as ExpenseCategory })
              }
              fullWidth
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Description"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            <TextField
              label="Amount ($)"
              type="number"
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              required
              fullWidth
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              select
              label="Payment Method"
              value={expenseForm.paymentMethod}
              onChange={(e) =>
                setExpenseForm({
                  ...expenseForm,
                  paymentMethod: e.target.value as ExpenseFormState['paymentMethod'],
                })
              }
              fullWidth
            >
              {PAYMENT_METHODS.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
            <FormControlLabel
              control={
                <Checkbox
                  checked={expenseForm.isPaid}
                  onChange={(e) =>
                    setExpenseForm({ ...expenseForm, isPaid: e.target.checked })
                  }
                />
              }
              label="Paid"
            />
            {expenseForm.isPaid && (
              <TextField
                label="Paid Date"
                type="date"
                value={expenseForm.paidDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, paidDate: e.target.value })}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            )}
            <TextField
              select
              label="Season"
              value={expenseForm.season}
              onChange={(e) => setExpenseForm({ ...expenseForm, season: e.target.value })}
              fullWidth
            >
              {seasonOptions.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Tournament (optional)"
              value={expenseForm.tournamentId}
              onChange={(e) => {
                const tid = e.target.value;
                setExpenseForm({
                  ...expenseForm,
                  tournamentId: tid,
                  // Auto-set category to tournaments if a tournament is selected
                  ...(tid ? { category: 'tournaments' as ExpenseCategory } : {}),
                });
              }}
              fullWidth
            >
              <MenuItem value="">No Tournament</MenuItem>
              {tournaments.map(t => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name} ({t.location})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Team (optional)"
              value={expenseForm.teamId}
              onChange={(e) => setExpenseForm({ ...expenseForm, teamId: e.target.value, playerId: '' })}
              fullWidth
            >
              <MenuItem value="">No Team</MenuItem>
              {teams.map(t => (
                <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Player (optional)"
              value={expenseForm.playerId}
              onChange={(e) => setExpenseForm({ ...expenseForm, playerId: e.target.value })}
              fullWidth
            >
              <MenuItem value="">No Player</MenuItem>
              {teamFilteredPlayers.map(p => (
                <MenuItem key={p.id} value={p.id}>{p.firstName} {p.lastName}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Notes"
              value={expenseForm.notes}
              onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {editingExpense ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExpensesPage;
