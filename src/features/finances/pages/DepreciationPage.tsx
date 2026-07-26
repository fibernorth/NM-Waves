import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/components/common/ConfirmProvider';
import { fixedAssetsApi, calculateMonthlyDepreciation, getDepreciationSchedule } from '@/lib/api/fixedAssets';
import { chartOfAccountsApi } from '@/lib/api/chartOfAccounts';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ScheduleIcon from '@mui/icons-material/Schedule';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import type { FixedAsset, ChartOfAccount } from '@/types/models';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

const ASSET_CATEGORIES = [
  'Equipment',
  'Vehicles',
  'Furniture',
  'Technology',
  'Improvements',
  'Other',
];

interface AssetFormState {
  name: string;
  description: string;
  category: string;
  purchaseDate: string;
  purchaseCost: string;
  salvageValue: string;
  usefulLifeYears: string;
  assetAccountNumber: string;
  depreciationExpenseAccount: string;
  notes: string;
}

const defaultAssetForm: AssetFormState = {
  name: '',
  description: '',
  category: 'Equipment',
  purchaseDate: '',
  purchaseCost: '',
  salvageValue: '0',
  usefulLifeYears: '5',
  assetAccountNumber: '1500',
  depreciationExpenseAccount: '5100',
  notes: '',
};

const DepreciationPage = () => {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [assetForm, setAssetForm] = useState<AssetFormState>(defaultAssetForm);

  // Schedule dialog
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [scheduleAsset, setScheduleAsset] = useState<FixedAsset | null>(null);

  // Status filter
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['fixedAssets'],
    queryFn: () => fixedAssetsApi.getAll(),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['chartOfAccounts'],
    queryFn: () => chartOfAccountsApi.getActive(),
  });

  // Filter accounts by type for dropdowns
  const assetAccounts = useMemo(
    () => accounts.filter((a: ChartOfAccount) => a.type === 'asset'),
    [accounts]
  );
  const expenseAccounts = useMemo(
    () => accounts.filter((a: ChartOfAccount) => a.type === 'expense'),
    [accounts]
  );

  // Filter assets by status
  const filteredAssets = useMemo(() => {
    if (statusFilter === 'all') return assets;
    return assets.filter((a: FixedAsset) => a.status === statusFilter);
  }, [assets, statusFilter]);

  // Summary stats
  const stats = useMemo(() => {
    const active = assets.filter((a: FixedAsset) => a.status === 'active');
    const totalCost = assets.reduce((sum: number, a: FixedAsset) => sum + a.purchaseCost, 0);
    const totalAccDep = assets.reduce((sum: number, a: FixedAsset) => sum + a.accumulatedDepreciation, 0);
    const netBookValue = totalCost - totalAccDep;
    return {
      totalAssets: assets.length,
      activeAssets: active.length,
      totalCost,
      totalAccDep,
      netBookValue,
    };
  }, [assets]);

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: (data: Omit<FixedAsset, 'id' | 'accumulatedDepreciation' | 'status' | 'createdAt' | 'updatedAt'>) =>
      fixedAssetsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
      toast.success('Asset created successfully');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create asset'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FixedAsset> }) =>
      fixedAssetsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
      toast.success('Asset updated successfully');
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update asset'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fixedAssetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
      toast.success('Asset disposed successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to dispose asset'),
  });

  const recordDepreciationMutation = useMutation({
    mutationFn: ({ assetId, amount, date }: { assetId: string; amount: number; date: Date }) =>
      fixedAssetsApi.recordDepreciation(assetId, amount, date, user?.uid || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
      queryClient.invalidateQueries({ queryKey: ['generalLedger'] });
      toast.success('Depreciation recorded successfully');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to record depreciation'),
  });

  const recordAllDepreciationMutation = useMutation({
    mutationFn: async () => {
      const activeAssets = assets.filter((a: FixedAsset) => a.status === 'active');
      const today = new Date();
      let count = 0;
      for (const asset of activeAssets) {
        const monthly = calculateMonthlyDepreciation(asset);
        if (monthly <= 0) continue;
        const maxDep = asset.purchaseCost - asset.salvageValue;
        if (asset.accumulatedDepreciation >= maxDep - 0.01) continue;
        // Cap at remaining depreciable amount
        const remaining = maxDep - asset.accumulatedDepreciation;
        const amount = Math.min(monthly, remaining);
        await fixedAssetsApi.recordDepreciation(asset.id, amount, today, user?.uid || '');
        count++;
      }
      return count;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['fixedAssets'] });
      queryClient.invalidateQueries({ queryKey: ['generalLedger'] });
      toast.success(`Depreciation recorded for ${count} asset(s)`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to record batch depreciation'),
  });

  // ---------------------------------------------------------------------------
  // Dialog helpers
  // ---------------------------------------------------------------------------

  const openAddDialog = () => {
    setEditingAsset(null);
    setAssetForm(defaultAssetForm);
    setDialogOpen(true);
  };

  const openEditDialog = (asset: FixedAsset) => {
    setEditingAsset(asset);
    setAssetForm({
      name: asset.name,
      description: asset.description || '',
      category: asset.category,
      purchaseDate: format(asset.purchaseDate, 'yyyy-MM-dd'),
      purchaseCost: asset.purchaseCost.toString(),
      salvageValue: asset.salvageValue.toString(),
      usefulLifeYears: asset.usefulLifeYears.toString(),
      assetAccountNumber: asset.assetAccountNumber,
      depreciationExpenseAccount: asset.depreciationExpenseAccount,
      notes: asset.notes || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingAsset(null);
    setAssetForm(defaultAssetForm);
  };

  const openScheduleDialog = (asset: FixedAsset) => {
    setScheduleAsset(asset);
    setScheduleDialogOpen(true);
  };

  const handleSave = () => {
    if (!assetForm.name || !assetForm.purchaseDate || !assetForm.purchaseCost) {
      toast.error('Name, purchase date, and cost are required');
      return;
    }

    const cost = parseFloat(assetForm.purchaseCost);
    const salvage = parseFloat(assetForm.salvageValue) || 0;
    const life = parseInt(assetForm.usefulLifeYears) || 1;

    if (isNaN(cost) || cost <= 0) {
      toast.error('Purchase cost must be a positive number');
      return;
    }
    if (salvage < 0 || salvage >= cost) {
      toast.error('Salvage value must be between 0 and purchase cost');
      return;
    }
    if (life <= 0) {
      toast.error('Useful life must be at least 1 year');
      return;
    }

    const payload = {
      name: assetForm.name,
      description: assetForm.description || undefined,
      category: assetForm.category,
      purchaseDate: new Date(assetForm.purchaseDate + 'T00:00:00'),
      purchaseCost: cost,
      salvageValue: salvage,
      usefulLifeYears: life,
      depreciationMethod: 'straight_line' as const,
      assetAccountNumber: assetForm.assetAccountNumber,
      depreciationExpenseAccount: assetForm.depreciationExpenseAccount,
      notes: assetForm.notes || undefined,
      createdBy: user?.uid || '',
    };

    if (editingAsset) {
      updateMutation.mutate({ id: editingAsset.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = async (id: string) => {
    if (await confirm({ message: 'Are you sure you want to dispose of this asset?', confirmText: 'Delete', destructive: true })) {
      deleteMutation.mutate(id);
    }
  };

  const handleRecordDepreciation = (asset: FixedAsset) => {
    const monthly = calculateMonthlyDepreciation(asset);
    if (monthly <= 0) {
      toast.error('No depreciation to record for this asset');
      return;
    }
    const maxDep = asset.purchaseCost - asset.salvageValue;
    const remaining = maxDep - asset.accumulatedDepreciation;
    if (remaining <= 0.01) {
      toast.error('Asset is fully depreciated');
      return;
    }
    const amount = Math.min(monthly, remaining);
    recordDepreciationMutation.mutate({ assetId: asset.id, amount, date: new Date() });
  };

  const handleRecordAllDepreciation = async () => {
    const activeCount = assets.filter((a: FixedAsset) => a.status === 'active').length;
    if (activeCount === 0) {
      toast.error('No active assets to depreciate');
      return;
    }
    if (await confirm({ title: 'Record depreciation?', message: `Record monthly depreciation for all ${activeCount} active asset(s)?`, confirmText: 'Record' })) {
      recordAllDepreciationMutation.mutate();
    }
  };

  // ---------------------------------------------------------------------------
  // Columns
  // ---------------------------------------------------------------------------

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 180 },
    {
      field: 'category',
      headerName: 'Category',
      width: 130,
      renderCell: (params) => <Chip label={params.value} size="small" variant="outlined" />,
    },
    {
      field: 'purchaseDate',
      headerName: 'Purchase Date',
      width: 120,
      valueFormatter: (params) => format(params.value, 'MM/dd/yyyy'),
    },
    {
      field: 'purchaseCost',
      headerName: 'Cost',
      width: 120,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'salvageValue',
      headerName: 'Salvage',
      width: 100,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'usefulLifeYears',
      headerName: 'Life (Yrs)',
      width: 90,
    },
    {
      field: 'accumulatedDepreciation',
      headerName: 'Accum. Depr.',
      width: 130,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'netBookValue',
      headerName: 'Net Book Value',
      width: 130,
      valueGetter: (params) => params.row.purchaseCost - params.row.accumulatedDepreciation,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => {
        const colorMap: Record<string, 'success' | 'warning' | 'error'> = {
          active: 'success',
          fully_depreciated: 'warning',
          disposed: 'error',
        };
        const labelMap: Record<string, string> = {
          active: 'Active',
          fully_depreciated: 'Fully Depr.',
          disposed: 'Disposed',
        };
        return (
          <Chip
            label={labelMap[params.value] || params.value}
            size="small"
            color={colorMap[params.value] || 'default'}
          />
        );
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      renderCell: (params) => {
        const asset = params.row as FixedAsset;
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="View Schedule">
              <IconButton size="small" color="info" onClick={() => openScheduleDialog(asset)}>
                <ScheduleIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {asset.status === 'active' && (
              <Tooltip title="Record Monthly Depreciation">
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleRecordDepreciation(asset)}
                  disabled={recordDepreciationMutation.isPending}
                >
                  <PlayArrowIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {isAdmin && (
              <>
                <Tooltip title="Edit">
                  <IconButton size="small" color="primary" onClick={() => openEditDialog(asset)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {asset.status === 'active' && (
                  <Tooltip title="Dispose">
                    <IconButton size="small" color="error" onClick={() => handleDelete(asset.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}
          </Box>
        );
      },
    },
  ];

  // ---------------------------------------------------------------------------
  // Schedule data
  // ---------------------------------------------------------------------------

  const scheduleData = useMemo(() => {
    if (!scheduleAsset) return [];
    return getDepreciationSchedule(scheduleAsset);
  }, [scheduleAsset]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Fixed Assets & Depreciation</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Fixed Assets & Depreciation</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<PlaylistPlayIcon />}
            onClick={handleRecordAllDepreciation}
            disabled={recordAllDepreciationMutation.isPending}
          >
            Record All Depreciation
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
            Add Asset
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Assets</Typography>
              <Typography variant="h5">{stats.totalAssets}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Cost</Typography>
              <Typography variant="h5">{formatCurrency(stats.totalCost)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Accum. Depr.</Typography>
              <Typography variant="h5" color="warning.main">
                {formatCurrency(stats.totalAccDep)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Net Book Value</Typography>
              <Typography variant="h5" color="success.main">
                {formatCurrency(stats.netBookValue)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              fullWidth
              size="small"
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="fully_depreciated">Fully Depreciated</MenuItem>
              <MenuItem value="disposed">Disposed</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
        <DataGrid
          rows={filteredAssets}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: {
              sortModel: [{ field: 'purchaseDate', sort: 'desc' }],
            },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* Add/Edit Asset Dialog */}
      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingAsset ? 'Edit Asset' : 'Add Fixed Asset'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Asset Name"
              value={assetForm.name}
              onChange={(e) => setAssetForm({ ...assetForm, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={assetForm.description}
              onChange={(e) => setAssetForm({ ...assetForm, description: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
            <TextField
              select
              label="Category"
              value={assetForm.category}
              onChange={(e) => setAssetForm({ ...assetForm, category: e.target.value })}
              fullWidth
            >
              {ASSET_CATEGORIES.map(c => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Purchase Date"
              type="date"
              value={assetForm.purchaseDate}
              onChange={(e) => setAssetForm({ ...assetForm, purchaseDate: e.target.value })}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Purchase Cost ($)"
              type="number"
              value={assetForm.purchaseCost}
              onChange={(e) => setAssetForm({ ...assetForm, purchaseCost: e.target.value })}
              required
              fullWidth
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              label="Salvage Value ($)"
              type="number"
              value={assetForm.salvageValue}
              onChange={(e) => setAssetForm({ ...assetForm, salvageValue: e.target.value })}
              fullWidth
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              label="Useful Life (Years)"
              type="number"
              value={assetForm.usefulLifeYears}
              onChange={(e) => setAssetForm({ ...assetForm, usefulLifeYears: e.target.value })}
              required
              fullWidth
              inputProps={{ min: 1, step: 1 }}
            />
            <TextField
              select
              label="Asset Account (GL)"
              value={assetForm.assetAccountNumber}
              onChange={(e) => setAssetForm({ ...assetForm, assetAccountNumber: e.target.value })}
              fullWidth
            >
              {assetAccounts.map((a: ChartOfAccount) => (
                <MenuItem key={a.accountNumber} value={a.accountNumber}>
                  {a.accountNumber} - {a.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Depreciation Expense Account (GL)"
              value={assetForm.depreciationExpenseAccount}
              onChange={(e) => setAssetForm({ ...assetForm, depreciationExpenseAccount: e.target.value })}
              fullWidth
            >
              {expenseAccounts.map((a: ChartOfAccount) => (
                <MenuItem key={a.accountNumber} value={a.accountNumber}>
                  {a.accountNumber} - {a.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Notes"
              value={assetForm.notes}
              onChange={(e) => setAssetForm({ ...assetForm, notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />

            {/* Preview monthly depreciation */}
            {assetForm.purchaseCost && assetForm.usefulLifeYears && (
              <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                <Typography variant="body2" color="text.secondary">
                  Monthly Depreciation Preview
                </Typography>
                <Typography variant="h6">
                  {formatCurrency(
                    (parseFloat(assetForm.purchaseCost) - (parseFloat(assetForm.salvageValue) || 0))
                    / ((parseInt(assetForm.usefulLifeYears) || 1) * 12)
                  )}
                  /month
                </Typography>
              </Paper>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {editingAsset ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Depreciation Schedule Dialog */}
      <Dialog
        open={scheduleDialogOpen}
        onClose={() => setScheduleDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Depreciation Schedule{scheduleAsset ? ` - ${scheduleAsset.name}` : ''}
        </DialogTitle>
        <DialogContent>
          {scheduleAsset && (
            <Box>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Cost</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {formatCurrency(scheduleAsset.purchaseCost)}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Salvage</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {formatCurrency(scheduleAsset.salvageValue)}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Monthly Depr.</Typography>
                  <Typography variant="body1" fontWeight="bold">
                    {formatCurrency(calculateMonthlyDepreciation(scheduleAsset))}
                  </Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography variant="body2" color="text.secondary">Accum. to Date</Typography>
                  <Typography variant="body1" fontWeight="bold" color="warning.main">
                    {formatCurrency(scheduleAsset.accumulatedDepreciation)}
                  </Typography>
                </Grid>
              </Grid>

              <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Month</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell align="right">Monthly Depr.</TableCell>
                      <TableCell align="right">Accum. Depr.</TableCell>
                      <TableCell align="right">Net Book Value</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {scheduleData.map((row) => {
                      const isPast = row.accumulatedDepreciation <= scheduleAsset.accumulatedDepreciation;
                      return (
                        <TableRow
                          key={row.month}
                          sx={{
                            bgcolor: isPast ? 'action.hover' : 'inherit',
                            '& td': isPast ? { color: 'text.secondary' } : {},
                          }}
                        >
                          <TableCell>{row.month}</TableCell>
                          <TableCell>{format(row.date, 'MMM yyyy')}</TableCell>
                          <TableCell align="right">{formatCurrency(row.monthlyAmount)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.accumulatedDepreciation)}</TableCell>
                          <TableCell align="right">{formatCurrency(row.netBookValue)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DepreciationPage;
