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
import { incomeApi } from '@/lib/api/accounting';
import { useAuthStore } from '@/stores/authStore';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const IncomePage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';

  const [selectedSeason, setSelectedSeason] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const { data: incomes = [], isLoading } = useQuery({
    queryKey: ['income'],
    queryFn: () => incomeApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => incomeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income'] });
      toast.success('Income record deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete income record');
    },
  });

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this income record?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filter income
  const filteredIncome = incomes.filter((income) => {
    if (selectedSeason !== 'all' && income.season !== selectedSeason) return false;
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
        <Button variant="contained" startIcon={<AddIcon />}>
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
              <MenuItem value="2024 Spring">2024 Spring</MenuItem>
              <MenuItem value="2024 Summer">2024 Summer</MenuItem>
              <MenuItem value="2024 Fall">2024 Fall</MenuItem>
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
      <Paper sx={{ height: 600, width: '100%' }}>
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
    </Box>
  );
};

export default IncomePage;
