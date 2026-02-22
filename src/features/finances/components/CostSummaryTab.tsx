import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import SyncIcon from '@mui/icons-material/Sync';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { costCalculationApi, PlayerCostBreakdown } from '@/lib/api/costCalculation';
import toast from 'react-hot-toast';
import PlayerCostBreakdownDialog from './PlayerCostBreakdownDialog';

interface CostSummaryTabProps {
  season: string;
}

const CostSummaryTab = ({ season }: CostSummaryTabProps) => {
  const queryClient = useQueryClient();
  const [breakdownDialog, setBreakdownDialog] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<PlayerCostBreakdown | null>(null);

  const { data: breakdowns = [], isLoading } = useQuery({
    queryKey: ['costBreakdowns', season],
    queryFn: () => costCalculationApi.calculatePlayerBreakdowns(season),
  });

  const { data: teamSummaries = [] } = useQuery({
    queryKey: ['teamCostSummaries', season],
    queryFn: () => costCalculationApi.calculateTeamSummaries(season),
  });

  const syncMutation = useMutation({
    mutationFn: () => costCalculationApi.syncToBilling(season),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      queryClient.invalidateQueries({ queryKey: ['costBreakdowns'] });
      if (result.errors.length > 0) {
        toast.error(`Synced ${result.updated} records, ${result.errors.length} errors`);
      } else {
        toast.success(`Synced costs to ${result.updated} player billing records`);
      }
    },
    onError: () => toast.error('Failed to sync costs to billing'),
  });

  const totalPerPlayerAvg =
    breakdowns.length > 0
      ? breakdowns.reduce((sum, b) => sum + b.grandTotal, 0) / breakdowns.length
      : 0;

  const columns: GridColDef[] = [
    { field: 'playerName', headerName: 'Player', flex: 1, minWidth: 180 },
    { field: 'teamName', headerName: 'Team', width: 150 },
    {
      field: 'orgTotal',
      headerName: 'Org Share',
      width: 110,
      valueGetter: (params) =>
        params.row.orgCosts.reduce((s: number, c: any) => s + c.perPlayerAmount, 0),
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'teamTotal',
      headerName: 'Team Share',
      width: 110,
      valueGetter: (params) =>
        params.row.teamCosts.reduce((s: number, c: any) => s + c.perPlayerAmount, 0),
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'playerTotal',
      headerName: 'Player Costs',
      width: 120,
      valueGetter: (params) =>
        params.row.playerCosts.reduce((s: number, c: any) => s + c.perPlayerAmount, 0),
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'grandTotal',
      headerName: 'Grand Total',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ fontWeight: 'bold' }}>${(params.value || 0).toFixed(2)}</Box>
      ),
    },
    {
      field: 'actions',
      headerName: '',
      width: 60,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="View Breakdown">
          <IconButton
            size="small"
            onClick={() => {
              setSelectedBreakdown(params.row);
              setBreakdownDialog(true);
            }}
          >
            <VisibilityIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  // Create row IDs from playerId+teamId
  const rows = breakdowns.map((b) => ({
    ...b,
    id: `${b.playerId}_${b.teamId}`,
  }));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Cost Summary</Typography>
          <Typography variant="body2" color="text.secondary">
            Per-player cost breakdown showing how org, team, and player costs roll up.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={syncMutation.isPending ? <CircularProgress size={18} /> : <SyncIcon />}
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending || breakdowns.length === 0}
        >
          {syncMutation.isPending ? 'Syncing...' : 'Sync to Billing'}
        </Button>
      </Box>

      {/* Team summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {teamSummaries.map((ts) => (
          <Grid item xs={12} sm={6} md={4} key={ts.teamId}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2">{ts.teamName}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {ts.playerCount} players
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    Org share: ${ts.orgCostPerPlayer.toFixed(2)}/player
                  </Typography>
                  <Typography variant="body2">
                    Team share: ${ts.teamCostPerPlayer.toFixed(2)}/player
                  </Typography>
                  <Typography variant="body1" fontWeight="bold">
                    Total: ${ts.totalPerPlayer.toFixed(2)}/player
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Alert severity="info" sx={{ mb: 2 }}>
        Average per-player cost: <strong>${totalPerPlayerAvg.toFixed(2)}</strong> across{' '}
        {breakdowns.length} player{breakdowns.length !== 1 ? 's' : ''}. Click "Sync to Billing" to
        write these amounts to each player's finance record.
      </Alert>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper sx={{ height: 500, width: '100%' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
              sorting: { sortModel: [{ field: 'playerName', sort: 'asc' }] },
            }}
            disableRowSelectionOnClick
          />
        </Paper>
      )}

      <PlayerCostBreakdownDialog
        open={breakdownDialog}
        onClose={() => {
          setBreakdownDialog(false);
          setSelectedBreakdown(null);
        }}
        breakdown={selectedBreakdown}
      />
    </Box>
  );
};

export default CostSummaryTab;
