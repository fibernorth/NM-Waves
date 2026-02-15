import { useState } from 'react';
import { Box, Typography, Button, Paper, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { playersApi } from '@/lib/api/players';
import { Player } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import PlayerFormDialog from '../components/PlayerFormDialog';

const PlayersPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);

  const { data: players = [], isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => playersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Player deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete player');
    },
  });

  const handleEdit = (player: Player) => {
    setSelectedPlayer(player);
    setOpenDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this player?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setSelectedPlayer(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPlayer(null);
  };

  const columns: GridColDef[] = [
    {
      field: 'lastName',
      headerName: 'Last Name',
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'firstName',
      headerName: 'First Name',
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'dateOfBirth',
      headerName: 'Date of Birth',
      width: 120,
      valueFormatter: (params) => {
        try {
          return params.value ? format(params.value, 'MM/dd/yyyy') : '-';
        } catch {
          return '-';
        }
      },
    },
    {
      field: 'teamName',
      headerName: 'Team',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        params.value ? (
          <Chip label={params.value} size="small" color="primary" variant="outlined" />
        ) : (
          <Chip label="No Team" size="small" variant="outlined" />
        )
      ),
    },
    {
      field: 'parentName',
      headerName: 'Parent/Guardian',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'parentEmail',
      headerName: 'Email',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'parentPhone',
      headerName: 'Phone',
      width: 130,
    },
    {
      field: 'active',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => (
        <Box
          sx={{
            px: 1,
            py: 0.5,
            borderRadius: 1,
            bgcolor: params.value ? 'success.main' : 'grey.400',
            color: 'white',
            fontSize: '0.75rem',
          }}
        >
          {params.value ? 'Active' : 'Inactive'}
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            startIcon={<VisibilityIcon />}
            onClick={() => navigate(`/players/${params.row.id}`)}
          >
            View
          </Button>
          {isAdmin && (
            <>
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
            </>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Players</Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Player
          </Button>
        )}
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={players}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {isAdmin && (
        <PlayerFormDialog
          open={openDialog}
          onClose={handleCloseDialog}
          player={selectedPlayer}
        />
      )}
    </Box>
  );
};

export default PlayersPage;
