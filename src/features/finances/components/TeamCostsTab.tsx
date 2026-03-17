import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  MenuItem,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { costItemsApi } from '@/lib/api/costItems';
import { teamsApi } from '@/lib/api/teams';
import { CostItem } from '@/types/models';
import toast from 'react-hot-toast';
import CostItemFormDialog from './CostItemFormDialog';

interface TeamCostsTabProps {
  season: string;
}

const TeamCostsTab = ({ season }: TeamCostsTabProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<CostItem | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedTeamName, setSelectedTeamName] = useState<string>('');

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['costItems', 'team', season],
    queryFn: async () => {
      const items = await costItemsApi.getBySeason(season);
      return items.filter((i) => i.tier === 'team');
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => costItemsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costItems'] });
      toast.success('Cost item deleted');
    },
  });

  const filteredItems =
    teamFilter === 'all'
      ? allItems
      : allItems.filter((i) => i.teamId === teamFilter);

  const totalTeamCost = filteredItems.reduce((sum, i) => sum + i.amount, 0);
  const tournamentItems = filteredItems.filter((i) => i.category === 'tournament');

  const columns: GridColDef[] = [
    { field: 'label', headerName: 'Cost Item', flex: 1, minWidth: 200 },
    {
      field: 'teamName',
      headerName: 'Team',
      width: 150,
      renderCell: (params) => (
        <Chip label={params.value || 'Unknown'} size="small" color="primary" variant="outlined" />
      ),
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 130,
      renderCell: (params) => {
        const label =
          params.value === 'tournament'
            ? 'Tournament'
            : params.value === 'equipment'
            ? 'Equipment'
            : params.value === 'facility'
            ? 'Facility'
            : 'Special';
        return <Chip label={label} size="small" variant="outlined" />;
      },
    },
    {
      field: 'amount',
      headerName: 'Total Amount',
      width: 130,
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'tournamentName',
      headerName: 'Tournament',
      width: 150,
      renderCell: (params) => params.value || '--',
    },
    {
      field: 'active',
      headerName: 'Active',
      width: 80,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => {
                setSelected(params.row);
                setDialogOpen(true);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                if (window.confirm('Delete this cost item?')) {
                  deleteMutation.mutate(params.row.id);
                }
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  const handleAddClick = () => {
    if (teamFilter !== 'all') {
      setSelectedTeamId(teamFilter);
      const team = teams.find((t) => t.id === teamFilter);
      setSelectedTeamName(team?.name || '');
    } else if (teams.length > 0) {
      setSelectedTeamId(teams[0].id);
      setSelectedTeamName(teams[0].name);
    }
    setSelected(null);
    setDialogOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Team Costs</Typography>
          <Typography variant="body2" color="text.secondary">
            These costs are split among players on the specific team. Tournament costs auto-appear when tournaments reach "Signed Up" status.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClick}>
          Add Team Cost
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Filter by Team"
          select
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All Teams</MenuItem>
          {teams.map((team) => (
            <MenuItem key={team.id} value={team.id}>
              {team.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {tournamentItems.length > 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {tournamentItems.length} tournament cost{tournamentItems.length !== 1 ? 's' : ''} auto-created from tournament signups.
          Total team costs: <strong>${totalTeamCost.toFixed(2)}</strong>
        </Alert>
      )}

      <Paper sx={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={filteredItems}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      <CostItemFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelected(null);
        }}
        tier="team"
        costItem={selected}
        teamId={selected?.teamId || selectedTeamId}
        teamName={selected?.teamName || selectedTeamName}
        defaultSeason={season}
      />
    </Box>
  );
};

export default TeamCostsTab;
