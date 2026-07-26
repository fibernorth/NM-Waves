import { useState } from 'react';
import { Box, Typography, Button, Paper, Chip, Tooltip, IconButton } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import WarningIcon from '@mui/icons-material/Warning';
import { tournamentsApi } from '@/lib/api/tournaments';
import { Tournament, TournamentWorkflowStatus } from '@/types/models';
import toast from 'react-hot-toast';
import { format, isBefore, addDays } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { useConfirm } from '@/components/common/ConfirmProvider';
import { isAdmin as checkIsAdmin, isCoach as checkIsCoach } from '@/lib/auth/roles';
import TournamentFormDialog from '../components/TournamentFormDialog';
import TournamentViewDialog from '../components/TournamentViewDialog';

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

const workflowLabelMap: Record<TournamentWorkflowStatus, string> = {
  wanting: 'Wanting',
  entered: 'Entered',
  deposit_paid: 'Deposit Paid',
  paid_in_full: 'Paid in Full',
  schedule_received: 'Schedule Received',
  playing: 'Playing',
  completed: 'Completed',
};

const workflowColorMap: Record<TournamentWorkflowStatus, 'default' | 'info' | 'warning' | 'success' | 'primary' | 'secondary'> = {
  wanting: 'default',
  entered: 'info',
  deposit_paid: 'primary',
  paid_in_full: 'success',
  schedule_received: 'info',
  playing: 'warning',
  completed: 'success',
};

const TournamentsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const confirm = useConfirm();
  const isAdmin = checkIsAdmin(user);
  const isCoach = checkIsCoach(user);
  const isParent = !isCoach; // not coach/admin/master-admin
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewTournament, setViewTournament] = useState<Tournament | null>(null);

  const { data: tournaments = [], isLoading } = useQuery({
    queryKey: ['tournaments'],
    queryFn: () => tournamentsApi.getAll(),
  });

  // Parents only see tournaments that are at least "entered"
  const visibleTournaments = isParent
    ? tournaments.filter(t => t.workflowStatus && t.workflowStatus !== 'wanting')
    : tournaments;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tournamentsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Tournament deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete tournament');
    },
  });

  const handleEdit = (tournament: Tournament) => {
    setSelectedTournament(tournament);
    setOpenDialog(true);
  };

  const handleView = (tournament: Tournament) => {
    setViewTournament(tournament);
    setViewDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (await confirm({ title: 'Delete tournament?', message: 'This removes the tournament.', confirmText: 'Delete', destructive: true })) {
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

  // --- Column definitions based on role ---

  const baseColumns: GridColDef[] = [
    { field: 'name', headerName: 'Tournament', flex: 1, minWidth: 180 },
    { field: 'location', headerName: 'Location', width: 150 },
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
      width: 80,
      valueGetter: (params) => params.value?.length || 0,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
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
  ];

  // Coaches and admins see workflow + cost columns
  const staffColumns: GridColDef[] = isCoach ? [
    {
      field: 'cost',
      headerName: 'Cost',
      width: 100,
      renderCell: (params) => {
        const row = params.row as Tournament;
        const balanceDue = row.balanceDueDate;
        const balancePaid = row.balancePaid;
        const depositCoversTotal = row.depositAmount && row.depositAmount >= row.cost;
        const isWarning = balanceDue && !balancePaid && !depositCoversTotal && isBefore(balanceDue, addDays(new Date(), 14));
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            ${(params.value || 0).toFixed(0)}
            {isWarning && (
              <Tooltip title={`Balance due ${format(balanceDue, 'MMM d')}`}>
                <WarningIcon color="warning" sx={{ fontSize: 16 }} />
              </Tooltip>
            )}
          </Box>
        );
      },
    },
    {
      field: 'workflowStatus',
      headerName: 'Workflow',
      width: 150,
      renderCell: (params) => {
        const wf = (params.value || 'wanting') as TournamentWorkflowStatus;
        return (
          <Chip
            label={workflowLabelMap[wf] || wf}
            color={workflowColorMap[wf] || 'default'}
            size="small"
            variant="outlined"
          />
        );
      },
    },
  ] : [];

  // Action columns vary by role
  const actionColumn: GridColDef[] = isParent ? [] : [
    {
      field: 'actions',
      headerName: 'Actions',
      width: isAdmin ? 180 : 100,
      sortable: false,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton size="small" onClick={() => handleView(params.row as Tournament)}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <>
              <Tooltip title="Edit">
                <IconButton size="small" color="primary" onClick={() => handleEdit(params.row)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      ),
    },
  ];

  const columns: GridColDef[] = [...baseColumns, ...staffColumns, ...actionColumn];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Tournaments</Typography>
        {isCoach && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Tournament
          </Button>
        )}
      </Box>

      {isParent && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Showing confirmed tournaments for the season.
        </Typography>
      )}

      <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
        <DataGrid
          rows={visibleTournaments}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
          onRowDoubleClick={isParent ? undefined : (params) => handleView(params.row as Tournament)}
        />
      </Paper>

      {/* Form dialog for creating/editing - coaches can create, admins can create + edit */}
      {isCoach && (
        <TournamentFormDialog
          open={openDialog}
          onClose={handleCloseDialog}
          tournament={selectedTournament}
        />
      )}

      {/* Read-only view dialog for coaches */}
      <TournamentViewDialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        tournament={viewTournament}
        showFinancials={isCoach}
      />
    </Box>
  );
};

export default TournamentsPage;
