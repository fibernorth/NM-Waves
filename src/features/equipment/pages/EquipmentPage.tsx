import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import { equipmentApi } from '@/lib/api/equipment';
import { teamsApi } from '@/lib/api/teams';
import { Equipment } from '@/types/models';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import toast from 'react-hot-toast';
import EquipmentFormDialog from '../components/EquipmentFormDialog';
import AssignEquipmentDialog from '../components/AssignEquipmentDialog';

const typeLabels: Record<string, string> = {
  jersey: 'Jersey',
  pants: 'Pants',
  helmet: 'Helmet',
  bag: 'Bag',
  belt: 'Belt',
  socks: 'Socks',
  guest_jersey: 'Guest Jersey',
};

const statusColors: Record<string, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
  available: 'success',
  assigned: 'info',
  damaged: 'warning',
  retired: 'default',
};

const conditionColors: Record<string, 'success' | 'info' | 'warning' | 'error'> = {
  new: 'success',
  good: 'info',
  fair: 'warning',
  poor: 'error',
};

const EquipmentPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTeam, setFilterTeam] = useState<string>('all');

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment'],
    queryFn: () => equipmentApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => equipmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipment deleted');
    },
    onError: () => toast.error('Failed to delete equipment'),
  });

  const filteredEquipment = useMemo(() => {
    let result = equipment;
    if (filterType !== 'all') result = result.filter((e) => e.type === filterType);
    if (filterStatus !== 'all') result = result.filter((e) => e.status === filterStatus);
    if (filterTeam !== 'all') result = result.filter((e) => e.teamId === filterTeam);
    return result;
  }, [equipment, filterType, filterStatus, filterTeam]);

  const handleAdd = () => {
    setSelectedEquipment(null);
    setFormDialogOpen(true);
  };

  const handleEdit = (item: Equipment) => {
    setSelectedEquipment(item);
    setFormDialogOpen(true);
  };

  const handleAssign = (item: Equipment) => {
    setSelectedEquipment(item);
    setAssignDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this equipment?')) {
      deleteMutation.mutate(id);
    }
  };

  const teamNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach((t) => { map[t.id] = t.name; });
    return map;
  }, [teams]);

  const columns: GridColDef[] = [
    {
      field: 'type',
      headerName: 'Type',
      width: 130,
      renderCell: (params) => (
        <Chip label={typeLabels[params.value] || params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: 'number',
      headerName: '#',
      width: 70,
      renderCell: (params) => params.value ?? '-',
    },
    { field: 'size', headerName: 'Size', width: 80 },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params) => (
        <Chip
          label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
          size="small"
          color={statusColors[params.value] || 'default'}
        />
      ),
    },
    {
      field: 'condition',
      headerName: 'Condition',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
          size="small"
          color={conditionColors[params.value] || 'default'}
          variant="outlined"
        />
      ),
    },
    {
      field: 'assignedToName',
      headerName: 'Assigned To',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => params.value || '-',
    },
    {
      field: 'teamId',
      headerName: 'Team',
      width: 150,
      renderCell: (params) =>
        params.value ? (
          <Chip
            label={teamNameMap[params.value] || params.value}
            size="small"
            color="primary"
            variant="outlined"
          />
        ) : '-',
    },
    { field: 'season', headerName: 'Season', width: 90 },
    {
      field: 'cost',
      headerName: 'Cost',
      width: 90,
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    ...(isAdmin
      ? [
          {
            field: 'actions' as const,
            headerName: 'Actions',
            width: 150,
            sortable: false,
            renderCell: (params: any) => (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Assign">
                  <IconButton size="small" color="primary" onClick={() => handleAssign(params.row)}>
                    <PersonAddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => handleEdit(params.row)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton size="small" color="error" onClick={() => handleDelete(params.row.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          },
        ]
      : []),
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SportsBaseballIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4">Equipment</Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Equipment
          </Button>
        )}
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Type"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Types</MenuItem>
            {Object.entries(typeLabels).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="available">Available</MenuItem>
            <MenuItem value="assigned">Assigned</MenuItem>
            <MenuItem value="damaged">Damaged</MenuItem>
            <MenuItem value="retired">Retired</MenuItem>
          </TextField>

          <TextField
            select
            label="Team"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            size="small"
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="all">All Teams</MenuItem>
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredEquipment}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      <EquipmentFormDialog
        open={formDialogOpen}
        onClose={() => {
          setFormDialogOpen(false);
          setSelectedEquipment(null);
        }}
        equipment={selectedEquipment}
      />

      <AssignEquipmentDialog
        open={assignDialogOpen}
        onClose={() => {
          setAssignDialogOpen(false);
          setSelectedEquipment(null);
        }}
        equipment={selectedEquipment}
      />
    </Box>
  );
};

export default EquipmentPage;
