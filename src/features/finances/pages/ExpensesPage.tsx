import { useState } from 'react';
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
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/lib/api/accounting';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const ExpensesPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';

  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paidFilter, setSelectedPaidFilter] = useState<string>('all');

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => expensesApi.getAll(),
  });

  const { data: _teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete expense');
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: ({ id, date }: { id: string; date: Date }) => expensesApi.markAsPaid(id, date),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense marked as paid');
    },
    onError: () => {
      toast.error('Failed to update expense');
    },
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleMarkAsPaid = (id: string) => {
    markAsPaidMutation.mutate({ id, date: new Date() });
  };

  // Filter expenses
  const filteredExpenses = expenses.filter((expense) => {
    if (selectedSeason !== 'all' && expense.season !== selectedSeason) return false;
    if (selectedCategory !== 'all' && expense.category !== selectedCategory) return false;
    if (paidFilter === 'paid' && !expense.isPaid) return false;
    if (paidFilter === 'unpaid' && expense.isPaid) return false;
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
                <IconButton size="small" color="primary">
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
        <Button variant="contained" startIcon={<AddIcon />}>
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
          <Grid item xs={12} sm={4}>
            <TextField
              label="Season"
              select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All Seasons</MenuItem>
              <MenuItem value="2024 Spring">2024 Spring</MenuItem>
              <MenuItem value="2024 Summer">2024 Summer</MenuItem>
              <MenuItem value="2024 Fall">2024 Fall</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Category"
              select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All Categories</MenuItem>
              <MenuItem value="facilities">Facilities</MenuItem>
              <MenuItem value="equipment">Equipment</MenuItem>
              <MenuItem value="uniforms">Uniforms</MenuItem>
              <MenuItem value="tournaments">Tournaments</MenuItem>
              <MenuItem value="travel">Travel</MenuItem>
              <MenuItem value="insurance">Insurance</MenuItem>
              <MenuItem value="league_fees">League Fees</MenuItem>
              <MenuItem value="coaching">Coaching</MenuItem>
              <MenuItem value="administrative">Administrative</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
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
      <Paper sx={{ height: 600, width: '100%' }}>
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
    </Box>
  );
};

export default ExpensesPage;
