import { useState, useMemo } from 'react';
import { Box, Typography, Button, Paper, Chip, Link, Grid, Card, CardContent } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
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

const SponsorsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);

  const { data: sponsors = [], isLoading } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => sponsorsApi.getAll(),
  });

  const totalSponsored = useMemo(() => {
    return sponsors.reduce((sum, s) => {
      const playerTotal = (s.sponsoredPlayers || []).reduce((ps: number, sp: any) => ps + sp.amount, 0);
      return sum + playerTotal;
    }, 0);
  }, [sponsors]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => sponsorsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      toast.success('Sponsor deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete sponsor');
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
    { field: 'businessName', headerName: 'Business Name', flex: 1, minWidth: 200 },
    {
      field: 'level',
      headerName: 'Level',
      width: 120,
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
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      valueFormatter: (params) =>
        params.value ? `$${Number(params.value).toFixed(2)}` : '-',
    },
    { field: 'season', headerName: 'Season', width: 140 },
    {
      field: 'sponsoredPlayers',
      headerName: 'Sponsored Players',
      width: 180,
      renderCell: (params) => {
        const players = params.value || [];
        if (players.length === 0) return '-';
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {players.map((sp: any, i: number) => (
              <Chip key={i} label={sp.playerName} size="small" variant="outlined" />
            ))}
          </Box>
        );
      },
    },
    {
      field: 'displayOnPublicSite',
      headerName: 'Public Site',
      width: 110,
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
      width: 160,
      renderCell: (params) =>
        params.value ? (
          <Link
            href={params.value}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
          >
            Visit Site
          </Link>
        ) : (
          '-'
        ),
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
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleEdit(params.row)}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDelete(params.row.id)}
                >
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
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Sponsor
          </Button>
        )}
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Sponsors</Typography>
              <Typography variant="h4">{sponsors.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Sponsored Amount</Typography>
              <Typography variant="h4" color="success.main">${totalSponsored.toFixed(2)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Public Sponsors</Typography>
              <Typography variant="h4">{sponsors.filter(s => s.displayOnPublicSite).length}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper sx={{ height: 600, width: '100%' }}>
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
