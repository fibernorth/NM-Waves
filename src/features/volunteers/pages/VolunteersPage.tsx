import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  MenuItem,
  TextField,
  Chip,
  Select,
} from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VolunteerActivismIcon from '@mui/icons-material/VolunteerActivism';
import { volunteersApi } from '@/lib/api/volunteers';
import { schedulesApi } from '@/lib/api/schedules';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import type { Volunteer } from '@/types/models';
import toast from 'react-hot-toast';
import VolunteerFormDialog from '../components/VolunteerFormDialog';

const STATUS_CONFIG: Record<
  Volunteer['status'],
  { color: 'warning' | 'info' | 'success'; label: string }
> = {
  assigned: { color: 'warning', label: 'Assigned' },
  confirmed: { color: 'info', label: 'Confirmed' },
  completed: { color: 'success', label: 'Completed' },
};

const VolunteersPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';
  const isCoach = user?.role === 'coach' || isAdmin;

  const [teamFilter, setTeamFilter] = useState('all');
  const [eventFilter, setEventFilter] = useState('all');
  const [openForm, setOpenForm] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<Volunteer | null>(null);

  const { data: volunteers = [], isLoading } = useQuery({
    queryKey: ['volunteers'],
    queryFn: () => volunteersApi.getAll(),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedulesApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => volunteersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      toast.success('Volunteer assignment deleted');
    },
    onError: () => {
      toast.error('Failed to delete assignment');
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Volunteer['status'] }) =>
      volunteersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteers'] });
      toast.success('Status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  const filteredVolunteers = useMemo(() => {
    return volunteers.filter((v) => {
      if (teamFilter !== 'all' && v.teamId !== teamFilter) return false;
      if (eventFilter !== 'all' && v.eventId !== eventFilter) return false;
      return true;
    });
  }, [volunteers, teamFilter, eventFilter]);

  const handleAdd = () => {
    setSelectedVolunteer(null);
    setOpenForm(true);
  };

  const handleEdit = (volunteer: Volunteer) => {
    setSelectedVolunteer(volunteer);
    setOpenForm(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this assignment?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setSelectedVolunteer(null);
  };

  const handleStatusChange = (id: string, newStatus: Volunteer['status']) => {
    statusMutation.mutate({ id, status: newStatus });
  };

  const columns: GridColDef[] = [
    {
      field: 'eventTitle',
      headerName: 'Event',
      flex: 1,
      minWidth: 180,
      valueGetter: (params: any) => {
        return params.row.eventTitle || events.find((e: any) => e.id === params.row.eventId)?.title || params.row.eventId;
      },
    },
    {
      field: 'teamName',
      headerName: 'Team',
      width: 150,
      valueGetter: (params: any) => {
        return params.row.teamName || teams.find((t: any) => t.id === params.row.teamId)?.name || params.row.teamId;
      },
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 150,
    },
    {
      field: 'assignedToName',
      headerName: 'Assigned To',
      flex: 1,
      minWidth: 150,
      valueGetter: (params: any) => {
        return params.row.assignedToName || params.row.assignedTo;
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 160,
      renderCell: (params: GridRenderCellParams<Volunteer>) => {
        const status = params.value as Volunteer['status'];
        const config = STATUS_CONFIG[status];

        if (isCoach) {
          return (
            <Select
              value={status}
              size="small"
              variant="standard"
              onChange={(e) =>
                handleStatusChange(params.row.id, e.target.value as Volunteer['status'])
              }
              sx={{ minWidth: 120 }}
              onClick={(e) => e.stopPropagation()}
            >
              <MenuItem value="assigned">
                <Chip label="Assigned" color="warning" size="small" sx={{ cursor: 'pointer' }} />
              </MenuItem>
              <MenuItem value="confirmed">
                <Chip label="Confirmed" color="info" size="small" sx={{ cursor: 'pointer' }} />
              </MenuItem>
              <MenuItem value="completed">
                <Chip label="Completed" color="success" size="small" sx={{ cursor: 'pointer' }} />
              </MenuItem>
            </Select>
          );
        }

        return <Chip label={config.label} color={config.color} size="small" />;
      },
    },
    ...(isCoach
      ? [
          {
            field: 'actions',
            headerName: 'Actions',
            width: 160,
            sortable: false,
            renderCell: (params: GridRenderCellParams<Volunteer>) => (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleEdit(params.row as Volunteer)}
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
          } as GridColDef,
        ]
      : []),
  ];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <VolunteerActivismIcon sx={{ fontSize: 36, color: 'primary.main' }} />
          <Typography variant="h4">Volunteer Assignments</Typography>
        </Box>
        {isCoach && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Assign Volunteer
          </Button>
        )}
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Team"
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="all">All Teams</MenuItem>
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Event"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            size="small"
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="all">All Events</MenuItem>
            {events.map((ev) => (
              <MenuItem key={ev.id} value={ev.id}>
                {ev.title}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {/* Data Grid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredVolunteers}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* Volunteer Form Dialog */}
      {isCoach && (
        <VolunteerFormDialog
          open={openForm}
          onClose={handleCloseForm}
          volunteer={selectedVolunteer}
          events={events}
          teams={teams}
        />
      )}
    </Box>
  );
};

export default VolunteersPage;
