import { useState } from 'react';
import { Box, Typography, Button, Paper, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { tournamentsApi } from '@/lib/api/tournaments';
import { Tournament } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import TournamentFormDialog from '../components/TournamentFormDialog';

const statusColorMap: Record<string, 'info' | 'warning' | 'success'> = {
  upcoming: 'info',
  in_progress: 'warning',
  completed: 'success',
};

const statusLabelMap: Record<string, string> = {
  upcoming: 'Upcoming',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const TournamentsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => tournamentsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tournamentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Tournament deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete tournament');
    },
  });

  const handleEdit = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setOpenDialog(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this tournament?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setSelectedTournament(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedTournament(null);
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Tournament', flex: 1, minWidth: 200 },
    { field: 'location', headerName: 'Location', flex: 1, minWidth: 150 },
    {
      field: 'startDate',
      headerName: 'Dates',
      width: 200,
      renderCell: (params) => {
        const start = format(params.row.startDate, 'MMM d, yyyy');
        const end = format(params.row.endDate, 'MMM d, yyyy');
        return `${start} - ${end}`;
      },
    },
    {
      field: 'teamIds',
      headerName: 'Teams',
      width: 100,
      valueGetter: (params) => params.value?.length || 0,
    },
    {
      field: 'cost',
      headerName: 'Cost',
      width: 120,
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => {
        const status = params.value || 'upcoming';
        return (
          <Chip
            label={statusLabelMap[status] || status}
            color={statusColorMap[status] || 'default'}
            size="small"
          />
        );
      },
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
        <Typography variant="h4">Tournaments</Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Tournament
          </Button>
        )}
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={tournaments}
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
        <TournamentFormDialog
          open={openDialog}
          onClose={handleCloseDialog}
          tournament={selectedTournament}
        />
      )}
    </Box>
  );
};

export default TournamentsPage;
