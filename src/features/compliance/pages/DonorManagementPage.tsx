import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import PrintIcon from '@mui/icons-material/Print';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { donorsApi, donorReceiptsApi } from '@/lib/api/donors';
import type { Donor, DonorReceipt } from '@/types/models';

const donorTypeColors: Record<string, 'info' | 'success' | 'secondary' | 'warning'> = {
  individual: 'info',
  business: 'success',
  foundation: 'secondary',
  government: 'warning',
};

const currentYear = new Date().getFullYear();
const taxYearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

interface DonorFormState {
  name: string;
  type: 'individual' | 'business' | 'foundation' | 'government';
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  notes: string;
}

const emptyDonorForm: DonorFormState = {
  name: '',
  type: 'individual',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  notes: '',
};

interface DonationFormState {
  amount: string;
  date: string;
  description: string;
  goodsOrServicesProvided: boolean;
  goodsOrServicesDescription: string;
  goodsOrServicesValue: string;
}

const emptyDonationForm: DonationFormState = {
  amount: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
  goodsOrServicesProvided: false,
  goodsOrServicesDescription: '',
  goodsOrServicesValue: '',
};

const DonorManagementPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [tabValue, setTabValue] = useState(0);
  const [donorDialogOpen, setDonorDialogOpen] = useState(false);
  const [donationDialogOpen, setDonationDialogOpen] = useState(false);
  const [editingDonor, setEditingDonor] = useState<Donor | null>(null);
  const [donatingToDonor, setDonatingToDonor] = useState<Donor | null>(null);
  const [donorForm, setDonorForm] = useState<DonorFormState>(emptyDonorForm);
  const [donationForm, setDonationForm] = useState<DonationFormState>(emptyDonationForm);
  const [receiptYearFilter, setReceiptYearFilter] = useState<number>(currentYear);

  // ---- Queries ----
  const { data: donors = [], isLoading: donorsLoading, isError: donorsError } = useQuery({
    queryKey: ['donors'],
    queryFn: () => donorsApi.getAll(),
  });

  const { data: receipts = [], isLoading: receiptsLoading, isError: receiptsError } = useQuery({
    queryKey: ['donorReceipts', receiptYearFilter],
    queryFn: () => donorReceiptsApi.getByTaxYear(receiptYearFilter),
  });

  // ---- Summary calculations ----
  const totalGiven = useMemo(() => donors.reduce((sum, d) => sum + d.totalGiven, 0), [donors]);
  const activeDonors = useMemo(() => donors.filter((d) => d.active).length, [donors]);
  const avgGift = useMemo(() => {
    const totalDonations = donors.reduce((sum, d) => sum + d.donationCount, 0);
    return totalDonations > 0 ? totalGiven / totalDonations : 0;
  }, [donors, totalGiven]);

  // ---- Mutations ----
  const createDonorMutation = useMutation({
    mutationFn: (data: Omit<Donor, 'id' | 'createdAt' | 'updatedAt' | 'totalGiven' | 'donationCount'>) =>
      donorsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donors'] });
      toast.success('Donor created successfully');
      handleCloseDonorDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create donor');
    },
  });

  const updateDonorMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Donor> }) => donorsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donors'] });
      toast.success('Donor updated successfully');
      handleCloseDonorDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update donor');
    },
  });

  const deleteDonorMutation = useMutation({
    mutationFn: (id: string) => donorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donors'] });
      toast.success('Donor deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete donor');
    },
  });

  const recordDonationMutation = useMutation({
    mutationFn: async (params: {
      donor: Donor;
      amount: number;
      date: Date;
      description: string;
      goodsOrServicesProvided: boolean;
      goodsOrServicesDescription: string;
      goodsOrServicesValue: number;
    }) => {
      await donorsApi.recordDonation(params.donor.id, params.amount, params.date);
      const address = [params.donor.address, params.donor.city, params.donor.state, params.donor.zip]
        .filter(Boolean)
        .join(', ');
      await donorReceiptsApi.generate({
        donorId: params.donor.id,
        donorName: params.donor.name,
        donorAddress: address || undefined,
        amount: params.amount,
        date: params.date,
        description: params.description,
        goodsOrServicesProvided: params.goodsOrServicesProvided,
        goodsOrServicesDescription: params.goodsOrServicesProvided
          ? params.goodsOrServicesDescription
          : undefined,
        goodsOrServicesValue: params.goodsOrServicesProvided
          ? params.goodsOrServicesValue
          : undefined,
        orgName: 'TC Waves Ball Club',
        orgEIN: '88-4060076',
        orgAddress: 'Las Cruces, NM',
        createdBy: user?.uid || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donors'] });
      queryClient.invalidateQueries({ queryKey: ['donorReceipts'] });
      toast.success('Donation recorded and receipt generated');
      handleCloseDonationDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to record donation');
    },
  });

  const deleteReceiptMutation = useMutation({
    mutationFn: (id: string) => donorReceiptsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['donorReceipts'] });
      toast.success('Receipt deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete receipt');
    },
  });

  // ---- Handlers ----
  const handleOpenAddDonor = () => {
    setEditingDonor(null);
    setDonorForm(emptyDonorForm);
    setDonorDialogOpen(true);
  };

  const handleOpenEditDonor = (donor: Donor) => {
    setEditingDonor(donor);
    setDonorForm({
      name: donor.name,
      type: donor.type,
      email: donor.email || '',
      phone: donor.phone || '',
      address: donor.address || '',
      city: donor.city || '',
      state: donor.state || '',
      zip: donor.zip || '',
      notes: donor.notes || '',
    });
    setDonorDialogOpen(true);
  };

  const handleCloseDonorDialog = () => {
    setDonorDialogOpen(false);
    setEditingDonor(null);
    setDonorForm(emptyDonorForm);
  };

  const handleSaveDonor = () => {
    if (!donorForm.name.trim()) {
      toast.error('Donor name is required');
      return;
    }
    if (editingDonor) {
      updateDonorMutation.mutate({ id: editingDonor.id, data: donorForm });
    } else {
      createDonorMutation.mutate({ ...donorForm, active: true });
    }
  };

  const handleDeleteDonor = (id: string) => {
    if (window.confirm('Are you sure you want to delete this donor?')) {
      deleteDonorMutation.mutate(id);
    }
  };

  const handleOpenRecordDonation = (donor: Donor) => {
    setDonatingToDonor(donor);
    setDonationForm(emptyDonationForm);
    setDonationDialogOpen(true);
  };

  const handleCloseDonationDialog = () => {
    setDonationDialogOpen(false);
    setDonatingToDonor(null);
    setDonationForm(emptyDonationForm);
  };

  const handleRecordDonation = () => {
    if (!donatingToDonor) return;
    const amount = parseFloat(donationForm.amount);
    if (!amount || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!donationForm.date) {
      toast.error('Please enter a date');
      return;
    }
    if (!donationForm.description.trim()) {
      toast.error('Please enter a description');
      return;
    }
    recordDonationMutation.mutate({
      donor: donatingToDonor,
      amount,
      date: new Date(donationForm.date),
      description: donationForm.description,
      goodsOrServicesProvided: donationForm.goodsOrServicesProvided,
      goodsOrServicesDescription: donationForm.goodsOrServicesDescription,
      goodsOrServicesValue: parseFloat(donationForm.goodsOrServicesValue) || 0,
    });
  };

  const handlePrintReceipt = (receipt: DonorReceipt) => {
    const html = donorReceiptsApi.generateReceiptHTML(receipt);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.print();
    }
  };

  const handleDeleteReceipt = (id: string) => {
    if (window.confirm('Are you sure you want to delete this receipt?')) {
      deleteReceiptMutation.mutate(id);
    }
  };

  // ---- Column Definitions ----
  const donorColumns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
    {
      field: 'type',
      headerName: 'Type',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
          size="small"
          color={donorTypeColors[params.value] || 'default'}
        />
      ),
    },
    {
      field: 'totalGiven',
      headerName: 'Total Given',
      width: 130,
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'donationCount',
      headerName: 'Donations',
      width: 110,
    },
    {
      field: 'lastDonationDate',
      headerName: 'Last Donation',
      width: 140,
      valueFormatter: (params) =>
        params.value ? new Date(params.value).toLocaleDateString() : '-',
    },
    {
      field: 'active',
      headerName: 'Status',
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          color={params.value ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton size="small" onClick={() => handleOpenEditDonor(params.row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Record Donation">
            <IconButton size="small" color="primary" onClick={() => handleOpenRecordDonation(params.row)}>
              <VolunteerActivismIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDeleteDonor(params.row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const receiptColumns: GridColDef[] = [
    { field: 'receiptNumber', headerName: 'Receipt #', width: 160 },
    { field: 'donorName', headerName: 'Donor Name', flex: 1, minWidth: 180 },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'date',
      headerName: 'Date',
      width: 120,
      valueFormatter: (params) => new Date(params.value).toLocaleDateString(),
    },
    { field: 'taxYear', headerName: 'Tax Year', width: 100 },
    {
      field: 'goodsOrServicesProvided',
      headerName: 'Goods/Services',
      width: 130,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'warning' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'receiptActions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Print Receipt">
            <IconButton size="small" color="primary" onClick={() => handlePrintReceipt(params.row)}>
              <PrintIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDeleteReceipt(params.row.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Donor Management</Typography>
        <Typography variant="body2" color="text.secondary">
          Manage donors and generate IRS-compliant donation receipts for TC Waves Ball Club.
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Donors</Typography>
              <Typography variant="h4">{donors.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Given</Typography>
              <Typography variant="h4" color="success.main">${totalGiven.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Active Donors</Typography>
              <Typography variant="h4">{activeDonors}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Avg Gift</Typography>
              <Typography variant="h4">${avgGift.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {(donorsError || receiptsError) && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to load donor data. Please refresh the page.</Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Donors" />
          <Tab label="Receipts" />
        </Tabs>
      </Box>

      {/* Donors Tab */}
      {tabValue === 0 && (
        <>
          {isAdmin && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenAddDonor}>
                Add Donor
              </Button>
            </Box>
          )}
          <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
            <DataGrid
              rows={donors}
              columns={donorColumns}
              loading={donorsLoading}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              disableRowSelectionOnClick
            />
          </Paper>
        </>
      )}

      {/* Receipts Tab */}
      {tabValue === 1 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <TextField
              select
              label="Tax Year"
              value={receiptYearFilter}
              onChange={(e) => setReceiptYearFilter(Number(e.target.value))}
              size="small"
              sx={{ minWidth: 140 }}
            >
              {taxYearOptions.map((year) => (
                <MenuItem key={year} value={year}>
                  {year}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
            <DataGrid
              rows={receipts}
              columns={receiptColumns}
              loading={receiptsLoading}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              disableRowSelectionOnClick
            />
          </Paper>
        </>
      )}

      {/* Add/Edit Donor Dialog */}
      <Dialog open={donorDialogOpen} onClose={handleCloseDonorDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingDonor ? 'Edit Donor' : 'Add Donor'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              required
              fullWidth
              value={donorForm.name}
              onChange={(e) => setDonorForm({ ...donorForm, name: e.target.value })}
            />
            <TextField
              select
              label="Type"
              fullWidth
              value={donorForm.type}
              onChange={(e) =>
                setDonorForm({
                  ...donorForm,
                  type: e.target.value as DonorFormState['type'],
                })
              }
            >
              <MenuItem value="individual">Individual</MenuItem>
              <MenuItem value="business">Business</MenuItem>
              <MenuItem value="foundation">Foundation</MenuItem>
              <MenuItem value="government">Government</MenuItem>
            </TextField>
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={donorForm.email}
              onChange={(e) => setDonorForm({ ...donorForm, email: e.target.value })}
            />
            <TextField
              label="Phone"
              fullWidth
              value={donorForm.phone}
              onChange={(e) => setDonorForm({ ...donorForm, phone: e.target.value })}
            />
            <TextField
              label="Address"
              fullWidth
              value={donorForm.address}
              onChange={(e) => setDonorForm({ ...donorForm, address: e.target.value })}
            />
            <Grid container spacing={2}>
              <Grid item xs={5}>
                <TextField
                  label="City"
                  fullWidth
                  value={donorForm.city}
                  onChange={(e) => setDonorForm({ ...donorForm, city: e.target.value })}
                />
              </Grid>
              <Grid item xs={3}>
                <TextField
                  label="State"
                  fullWidth
                  value={donorForm.state}
                  onChange={(e) => setDonorForm({ ...donorForm, state: e.target.value })}
                />
              </Grid>
              <Grid item xs={4}>
                <TextField
                  label="Zip"
                  fullWidth
                  value={donorForm.zip}
                  onChange={(e) => setDonorForm({ ...donorForm, zip: e.target.value })}
                />
              </Grid>
            </Grid>
            <TextField
              label="Notes"
              fullWidth
              multiline
              rows={3}
              value={donorForm.notes}
              onChange={(e) => setDonorForm({ ...donorForm, notes: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDonorDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveDonor}
            disabled={createDonorMutation.isPending || updateDonorMutation.isPending}
          >
            {editingDonor ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Record Donation Dialog */}
      <Dialog open={donationDialogOpen} onClose={handleCloseDonationDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Record Donation</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {donatingToDonor && (
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Donor: {donatingToDonor.name}
              </Typography>
            )}
            <TextField
              label="Amount"
              type="number"
              required
              fullWidth
              value={donationForm.amount}
              onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })}
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              label="Date"
              type="date"
              required
              fullWidth
              value={donationForm.date}
              onChange={(e) => setDonationForm({ ...donationForm, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Description"
              required
              fullWidth
              multiline
              rows={2}
              value={donationForm.description}
              onChange={(e) => setDonationForm({ ...donationForm, description: e.target.value })}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <input
                type="checkbox"
                id="goods-services-checkbox"
                checked={donationForm.goodsOrServicesProvided}
                onChange={(e) =>
                  setDonationForm({
                    ...donationForm,
                    goodsOrServicesProvided: e.target.checked,
                  })
                }
              />
              <label htmlFor="goods-services-checkbox">
                Goods or services were provided in exchange
              </label>
            </Box>
            {donationForm.goodsOrServicesProvided && (
              <>
                <TextField
                  label="Goods/Services Description"
                  fullWidth
                  value={donationForm.goodsOrServicesDescription}
                  onChange={(e) =>
                    setDonationForm({
                      ...donationForm,
                      goodsOrServicesDescription: e.target.value,
                    })
                  }
                />
                <TextField
                  label="Goods/Services Value"
                  type="number"
                  fullWidth
                  value={donationForm.goodsOrServicesValue}
                  onChange={(e) =>
                    setDonationForm({
                      ...donationForm,
                      goodsOrServicesValue: e.target.value,
                    })
                  }
                  inputProps={{ min: 0, step: '0.01' }}
                />
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDonationDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRecordDonation}
            disabled={recordDonationMutation.isPending}
          >
            Record Donation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DonorManagementPage;
