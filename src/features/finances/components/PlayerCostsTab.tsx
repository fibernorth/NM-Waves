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
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { costItemsApi } from '@/lib/api/costItems';
import { playerFinancesApi } from '@/lib/api/finances';
import { CostItem } from '@/types/models';
import toast from 'react-hot-toast';
import CostItemFormDialog from './CostItemFormDialog';

interface PlayerCostsTabProps {
  season: string;
}

const PlayerCostsTab = ({ season }: PlayerCostsTabProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<CostItem | null>(null);
  const [playerFilter, setPlayerFilter] = useState<string>('all');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [selectedPlayerName, setSelectedPlayerName] = useState<string>('');

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['costItems', 'player', season],
    queryFn: async () => {
      const items = await costItemsApi.getBySeason(season);
      return items.filter((i) => i.tier === 'player');
    },
  });

  const { data: finances = [] } = useQuery({
    queryKey: ['playerFinances', season],
    queryFn: () => playerFinancesApi.getBySeason(season),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => costItemsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costItems'] });
      toast.success('Cost item deleted');
    },
  });

  const filteredItems =
    playerFilter === 'all'
      ? allItems
      : allItems.filter((i) => i.playerId === playerFilter);

  // Build unique player list from finances
  const playerOptions = finances.map((f) => ({
    id: f.playerId,
    name: f.playerName,
  }));

  const columns: GridColDef[] = [
    { field: 'label', headerName: 'Cost Item', flex: 1, minWidth: 180 },
    {
      field: 'playerName',
      headerName: 'Player',
      width: 150,
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 130,
      renderCell: (params) => {
        const labelMap: Record<string, string> = {
          helmet: 'Helmet',
          bag: 'Bag',
          uniform_piece: 'Uniform',
          special: 'Special',
        };
        return <Chip label={labelMap[params.value] || params.value} size="small" variant="outlined" />;
      },
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'financeField',
      headerName: 'Finance Field',
      width: 140,
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
    if (playerFilter !== 'all') {
      setSelectedPlayerId(playerFilter);
      const player = playerOptions.find((p) => p.id === playerFilter);
      setSelectedPlayerName(player?.name || '');
    } else if (playerOptions.length > 0) {
      setSelectedPlayerId(playerOptions[0].id);
      setSelectedPlayerName(playerOptions[0].name);
    }
    setSelected(null);
    setDialogOpen(true);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Player-Specific Costs</Typography>
          <Typography variant="body2" color="text.secondary">
            Individual costs assigned to specific players (helmets, bags, uniform pieces, etc.)
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddClick}>
          Add Player Cost
        </Button>
      </Box>

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Filter by Player"
          select
          value={playerFilter}
          onChange={(e) => setPlayerFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 250 }}
        >
          <MenuItem value="all">All Players</MenuItem>
          {playerOptions.map((player) => (
            <MenuItem key={player.id} value={player.id}>
              {player.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

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
        tier="player"
        costItem={selected}
        playerId={selected?.playerId || selectedPlayerId}
        playerName={selected?.playerName || selectedPlayerName}
        defaultSeason={season}
      />
    </Box>
  );
};

export default PlayerCostsTab;
