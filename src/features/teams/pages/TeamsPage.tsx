import { useState } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SyncIcon from '@mui/icons-material/Sync';
import { teamsApi } from '@/lib/api/teams';
import { Team } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import TeamFormDialog from '../components/TeamFormDialog';

const TeamsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const syncMutation = useMutation({
    mutationFn: () => teamsApi.syncRosters(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success(`Synced ${result.updated} players across ${result.teams} teams`);
    },
    onError: () => {
      toast.error('Failed to sync rosters');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => teamsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      toast.success('Team deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete team');
    },
  });

  const handleEdit = (team: Team) => {
    setSelectedTeam(team);
    setOpenDialog(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this team?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setSelectedTeam(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedTeam(null);
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Team Name', flex: 1, minWidth: 200 },
    { field: 'ageGroup', headerName: 'Age Group', width: 120 },
    { field: 'season', headerName: 'Season', width: 150 },
    { field: 'coachName', headerName: 'Coach', flex: 1, minWidth: 150 },
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
      field: 'createdAt',
      headerName: 'Created',
      width: 120,
      valueFormatter: (params) => format(params.value, 'MM/dd/yyyy'),
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
            onClick={() => navigate(`/teams/${params.row.id}`)}
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
        <Typography variant="h4">Teams</Typography>
        {isAdmin && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<SyncIcon />}
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
            >
              {syncMutation.isPending ? 'Syncing...' : 'Sync Rosters'}
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
              Add Team
            </Button>
          </Box>
        )}
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={teams}
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
        <TeamFormDialog
          open={openDialog}
          onClose={handleCloseDialog}
          team={selectedTeam}
        />
      )}
    </Box>
  );
};

export default TeamsPage;
