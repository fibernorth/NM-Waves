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
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { incomeApi } from '@/lib/api/accounting';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { Income, IncomeCategory } from '@/types/models';

const currentYear = new Date().getFullYear();
const seasonOptions: string[] = [];
for (let y = currentYear; y >= currentYear - 5; y--) {
  seasonOptions.push(y.toString());
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface IncomeFormState {
  date: string;
  source: string;
  category: IncomeCategory;
  description: string;
  amount: string;
  paymentMethod: 'cash' | 'check' | 'credit_card' | 'bank_transfer' | 'venmo' | 'zelle' | 'other';
  season: string;
  payerName: string;
  payerEmail: string;
  notes: string;
}

const defaultIncomeForm: IncomeFormState = {
  date: '',
  source: '',
  category: 'other',
  description: '',
  amount: '',
  paymentMethod: 'check',
  season: currentYear.toString(),
  payerName: '',
  payerEmail: '',
  notes: '',
};

const INCOME_CATEGORIES: { value: IncomeCategory; label: string }[] = [
  { value: 'player_payments', label: 'Player Payments' },
  { value: 'sponsorships', label: 'Sponsorships' },
  { value: 'fundraisers', label: 'Fundraisers' },
  { value: 'donations', label: 'Donations' },
  { value: 'grants', label: 'Grants' },
  { value: 'merchandise', label: 'Merchandise' },
  { value: 'concessions', label: 'Concessions' },
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

const IncomePage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [selectedSeason, setSelectedSeason] = useState<string>(currentYear.toString());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [incomeForm, setIncomeForm] = useState<IncomeFormState>(defaultIncomeForm);

  const { data: incomes = [], isLoading } = useQuery({
    queryKey: ['income'],
    queryFn: () => incomeApi.getAll(),
  });

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: Omit<Income, 'id' | 'createdAt' | 'updatedAt'>) =>
      incomeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['generalLedger'] });
      queryClient.invalidateQueries({ queryKey: ['financialReport'] });
      toast.success('Income record created successfully');
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create income record');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Income> }) =>
      incomeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['financialReport'] });
      toast.success('Income record updated successfully');
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update income record');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => incomeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['generalLedger'] });
      queryClient.invalidateQueries({ queryKey: ['financialReport'] });
      toast.success('Income record deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete income record');
    },
  });

  // ---------------------------------------------------------------------------
  // Dialog helpers
  // ---------------------------------------------------------------------------

  const openAddDialog = () => {
    setEditingIncome(null);
    setIncomeForm(defaultIncomeForm);
    setDialogOpen(true);
  };

  const openEditDialog = (income: Income) => {
    setEditingIncome(income);
    setIncomeForm({
      date: income.date ? format(income.date, 'yyyy-MM-dd') : '',
      source: income.source || '',
      category: income.category,
      description: income.description || '',
      amount: income.amount?.toString() || '',
      paymentMethod: income.paymentMethod || 'check',
      season: income.season || currentYear.toString(),
      payerName: income.payerName || '',
      payerEmail: '',
      notes: income.notes || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingIncome(null);
    setIncomeForm(defaultIncomeForm);
  };

  const handleSave = () => {
    if (!incomeForm.date || !incomeForm.source || !incomeForm.amount) {
      toast.error('Date, source, and amount are required');
      return;
    }

    const parsedAmount = parseFloat(incomeForm.amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Amount must be a positive number');
      return;
    }

    const payload = {
      date: new Date(incomeForm.date + 'T00:00:00'),
      source: incomeForm.source,
      category: incomeForm.category,
      description: incomeForm.description,
      amount: parsedAmount,
      paymentMethod: incomeForm.paymentMethod,
      season: incomeForm.season,
      payerName: incomeForm.payerName || undefined,
      notes: incomeForm.notes || undefined,
      recordedBy: user?.uid || '',
    };

    if (editingIncome) {
      updateMutation.mutate({ id: editingIncome.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this income record?')) {
      deleteMutation.mutate(id);
    }
  };

  // Build season options dynamically from actual data so imported seasons always appear
  const dynamicSeasonOptions = useMemo(() => {
    const set = new Set<string>(seasonOptions);
    for (const i of incomes) {
      if (i.season) set.add(i.season);
    }
    return Array.from(set).sort().reverse();
  }, [incomes]);

  // Flexible season match — "2026" matches "2025-2026" and vice-versa
  const matchesSeason = (recordSeason: string, filter: string) => {
    if (!recordSeason || !filter) return true;
    if (recordSeason === filter) return true;
    if (recordSeason.endsWith(`-${filter}`) || recordSeason.startsWith(`${filter}-`)) return true;
    if (filter.endsWith(`-${recordSeason}`) || filter.startsWith(`${recordSeason}-`)) return true;
    return false;
  };

  // Filter income
  const filteredIncome = incomes.filter((income) => {
    if (selectedSeason !== 'all' && !matchesSeason(income.season, selectedSeason)) return false;
    if (selectedCategory !== 'all' && income.category !== selectedCategory) return false;
    return true;
  });

  // Calculate totals by category
  const totals = {
    playerPayments: filteredIncome.filter(i => i.category === 'player_payments').reduce((sum, i) => sum + i.amount, 0),
    sponsorships: filteredIncome.filter(i => i.category === 'sponsorships').reduce((sum, i) => sum + i.amount, 0),
    fundraisers: filteredIncome.filter(i => i.category === 'fundraisers').reduce((sum, i) => sum + i.amount, 0),
    donations: filteredIncome.filter(i => i.category === 'donations').reduce((sum, i) => sum + i.amount, 0),
    grants: filteredIncome.filter(i => i.category === 'grants').reduce((sum, i) => sum + i.amount, 0),
    merchandise: filteredIncome.filter(i => i.category === 'merchandise').reduce((sum, i) => sum + i.amount, 0),
    concessions: filteredIncome.filter(i => i.category === 'concessions').reduce((sum, i) => sum + i.amount, 0),
    other: filteredIncome.filter(i => i.category === 'other').reduce((sum, i) => sum + i.amount, 0),
  };
  const totalIncome = Object.values(totals).reduce((sum, val) => sum + val, 0);

  const columns: GridColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      width: 110,
      valueFormatter: (params) => format(params.value, 'MM/dd/yyyy'),
    },
    {
      field: 'source',
      headerName: 'Source',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 150,
      renderCell: (params) => (
        <Chip label={params.value.replace('_', ' ')} size="small" color="success" variant="outlined" />
      ),
    },
    {
      field: 'payerName',
      headerName: 'Payer',
      width: 140,
      renderCell: (params) => params.value || '--',
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
      cellClassName: 'positive-amount',
    },
    {
      field: 'paymentMethod',
      headerName: 'Method',
      width: 120,
    },
    {
      field: 'season',
      headerName: 'Season',
      width: 120,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {isAdmin && (
            <>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => openEditDialog(params.row as Income)}
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
          Income
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view income records.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Income</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
          Add Income
        </Button>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'white' }}>
            <Typography variant="body2">Total Income</Typography>
            <Typography variant="h5">${totalIncome.toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">Player Payments</Typography>
            <Typography variant="h6">${totals.playerPayments.toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">Sponsorships</Typography>
            <Typography variant="h6">${totals.sponsorships.toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">Fundraisers</Typography>
            <Typography variant="h6">${totals.fundraisers.toFixed(2)}</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
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
          <Grid item xs={12} sm={6}>
            <TextField
              label="Category"
              select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All Categories</MenuItem>
              <MenuItem value="player_payments">Player Payments</MenuItem>
              <MenuItem value="sponsorships">Sponsorships</MenuItem>
              <MenuItem value="fundraisers">Fundraisers</MenuItem>
              <MenuItem value="donations">Donations</MenuItem>
              <MenuItem value="grants">Grants</MenuItem>
              <MenuItem value="merchandise">Merchandise</MenuItem>
              <MenuItem value="concessions">Concessions</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
        <DataGrid
          rows={filteredIncome}
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
          sx={{
            '& .positive-amount': {
              color: 'success.main',
              fontWeight: 'bold',
            },
          }}
        />
      </Paper>

      {/* Income Form Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingIncome ? 'Edit Income' : 'Add Income'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Date"
              type="date"
              value={incomeForm.date}
              onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Source"
              value={incomeForm.source}
              onChange={(e) => setIncomeForm({ ...incomeForm, source: e.target.value })}
              required
              fullWidth
              helperText="e.g., Parent payment, Tournament fundraiser, Sponsor name"
            />
            <TextField
              select
              label="Category"
              value={incomeForm.category}
              onChange={(e) =>
                setIncomeForm({ ...incomeForm, category: e.target.value as IncomeCategory })
              }
              fullWidth
            >
              {INCOME_CATEGORIES.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Description"
              value={incomeForm.description}
              onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            <TextField
              label="Amount ($)"
              type="number"
              value={incomeForm.amount}
              onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
              required
              fullWidth
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              select
              label="Payment Method"
              value={incomeForm.paymentMethod}
              onChange={(e) =>
                setIncomeForm({
                  ...incomeForm,
                  paymentMethod: e.target.value as IncomeFormState['paymentMethod'],
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
            <TextField
              select
              label="Season"
              value={incomeForm.season}
              onChange={(e) => setIncomeForm({ ...incomeForm, season: e.target.value })}
              fullWidth
            >
              {dynamicSeasonOptions.map(s => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Payer Name"
              value={incomeForm.payerName}
              onChange={(e) => setIncomeForm({ ...incomeForm, payerName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Payer Email"
              type="email"
              value={incomeForm.payerEmail}
              onChange={(e) => setIncomeForm({ ...incomeForm, payerEmail: e.target.value })}
              fullWidth
            />
            <TextField
              label="Notes"
              value={incomeForm.notes}
              onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })}
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
            {editingIncome ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default IncomePage;
