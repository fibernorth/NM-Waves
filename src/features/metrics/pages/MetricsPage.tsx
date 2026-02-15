import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { metricsApi } from '@/lib/api/metrics';
import { playersApi } from '@/lib/api/players';
import type { PlayerMetric } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { isCoach as checkIsCoach } from '@/lib/auth/roles';
import MetricFormDialog from '../components/MetricFormDialog';

const MetricsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isCoachOrAdmin = checkIsCoach(user);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<PlayerMetric | null>(null);
  const [playerFilter, setPlayerFilter] = useState<string>('all');

  const { data: metrics = [], isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => metricsApi.getAll(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => metricsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      toast.success('Metric deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete metric');
    },
  });

  const handleEdit = (metric: PlayerMetric) => {
    setSelectedMetric(metric);
    setOpenDialog(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this metric?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setSelectedMetric(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedMetric(null);
  };

  const filteredMetrics = playerFilter === 'all'
    ? metrics
    : metrics.filter(m => m.playerId === playerFilter);

  const columns: GridColDef[] = [
    {
      field: 'playerName',
      headerName: 'Player',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'metricType',
      headerName: 'Metric Type',
      width: 160,
    },
    {
      field: 'value',
      headerName: 'Value',
      width: 120,
      type: 'number',
    },
    {
      field: 'unit',
      headerName: 'Unit',
      width: 100,
    },
    {
      field: 'date',
      headerName: 'Date',
      width: 120,
      valueFormatter: (params: any) => {
        try {
          return format(params.value, 'MM/dd/yyyy');
        } catch {
          return '-';
        }
      },
    },
    {
      field: 'recordedBy',
      headerName: 'Recorded By',
      width: 150,
    },
    ...(isCoachOrAdmin
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
        <Typography variant="h4">Player Development</Typography>
        {isCoachOrAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Metric
          </Button>
        )}
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          select
          label="Filter by Player"
          value={playerFilter}
          onChange={(e) => setPlayerFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 250 }}
        >
          <MenuItem value="all">All Players</MenuItem>
          {players.map(player => (
            <MenuItem key={player.id} value={player.id}>
              {player.firstName} {player.lastName}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredMetrics}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {isCoachOrAdmin && (
        <MetricFormDialog
          open={openDialog}
          onClose={handleCloseDialog}
          metric={selectedMetric}
        />
      )}
    </Box>
  );
};

export default MetricsPage;
