import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Chip, Link, Grid, Card, CardContent } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PaymentIcon from '@mui/icons-material/Payment';
import { sponsorsApi } from '@/lib/api/sponsors';
import { Sponsor } from '@/types/models';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import SponsorFormDialog from '../components/SponsorFormDialog';

const levelColorMap: Record<string, string> = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  custom: '#6366f1',
};

const getSponsorStatus = (s: Sponsor): 'active' | 'expired' | 'upcoming' | 'no-dates' => {
  if (!s.sponsorshipStart && !s.sponsorshipEnd) return 'no-dates';
  const now = new Date();
  if (s.sponsorshipStart && now < s.sponsorshipStart) return 'upcoming';
  if (s.sponsorshipEnd && now > s.sponsorshipEnd) return 'expired';
  return 'active';
};

const STATUS_CHIP: Record<string, { label: string; color: 'success' | 'error' | 'warning' | 'default' }> = {
  active: { label: 'Active', color: 'success' },
  expired: { label: 'Expired', color: 'error' },
  upcoming: { label: 'Upcoming', color: 'warning' },
  'no-dates': { label: 'No Dates', color: 'default' },
};

const SponsorsPage = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);

  const { data: sponsors = [], isLoading } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => sponsorsApi.getAll(),
  });

  const totalSponsored = useMemo(() => {
    return sponsors.reduce((sum, s) => sum + (s.amount || 0), 0);
  }, [sponsors]);

  const activeCount = useMemo(() => {
    return sponsors.filter(s => getSponsorStatus(s) === 'active' || getSponsorStatus(s) === 'no-dates').length;
  }, [sponsors]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sponsorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      toast.success('Sponsor deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete sponsor');
    },
  });

  const handleEdit = (sponsor: Sponsor) => {
    setSelectedSponsor(sponsor);
    setOpenDialog(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this sponsor?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setSelectedSponsor(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedSponsor(null);
  };

  const columns: GridColDef[] = [
    { field: 'businessName', headerName: 'Business Name', flex: 1, minWidth: 180 },
    {
      field: 'level',
      headerName: 'Level',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
          size="small"
          sx={{
            bgcolor: levelColorMap[params.value] || '#999',
            color: params.value === 'silver' ? '#333' : '#fff',
            fontWeight: 'bold',
          }}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      valueGetter: (params) => getSponsorStatus(params.row),
      renderCell: (params) => {
        const cfg = STATUS_CHIP[params.value] || STATUS_CHIP['no-dates'];
        return <Chip label={cfg.label} color={cfg.color} size="small" variant="outlined" />;
      },
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 100,
      valueFormatter: (params) =>
        params.value ? `$${Number(params.value).toFixed(2)}` : '-',
    },
    { field: 'season', headerName: 'Season', width: 120 },
    {
      field: 'displayOnPublicSite',
      headerName: 'Public',
      width: 80,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'websiteUrl',
      headerName: 'Website',
      width: 100,
      renderCell: (params) =>
        params.value ? (
          <Link href={params.value} target="_blank" rel="noopener noreferrer" underline="hover">
            Visit
          </Link>
        ) : '-',
    },
    ...(isAdmin
      ? [
          {
            field: 'actions' as const,
            headerName: 'Actions',
            width: 180,
            sortable: false,
            renderCell: (params: any) => (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" startIcon={<EditIcon />} onClick={() => handleEdit(params.row)}>
                  Edit
                </Button>
                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={() => handleDelete(params.row.id)}>
                  Delete
                </Button>
              </Box>
            ),
          },
        ]
      : []),
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Sponsors</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<PaymentIcon />}
            onClick={() => navigate('/finances/billing?tab=sponsors')}
          >
            Sponsor Billing
          </Button>
          {isAdmin && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
              Add Sponsor
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Sponsors</Typography>
              <Typography variant="h4">{sponsors.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Active Sponsors</Typography>
              <Typography variant="h4" color="success.main">{activeCount}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Amount</Typography>
              <Typography variant="h4" color="primary.main">${totalSponsored.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Public Display</Typography>
              <Typography variant="h4">{sponsors.filter(s => s.displayOnPublicSite).length}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
        <DataGrid
          rows={sponsors}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {isAdmin && (
        <SponsorFormDialog
          open={openDialog}
          onClose={handleCloseDialog}
          sponsor={selectedSponsor}
        />
      )}
    </Box>
  );
};

export default SponsorsPage;
