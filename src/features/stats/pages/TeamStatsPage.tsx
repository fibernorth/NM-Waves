import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  MenuItem,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { teamStatsApi, TeamStatsDoc } from '@/lib/api/teamStats';

const TeamStatsPage = () => {
  const [selectedStatId, setSelectedStatId] = useState<string>('');
  const [activeTab, setActiveTab] = useState(0);

  const { data: allStats = [], isLoading, isError } = useQuery({
    queryKey: ['teamStats'],
    queryFn: () => teamStatsApi.getAll(),
  });

  // Auto-select first stat set when data loads
  const effectiveStatId = selectedStatId || allStats[0]?.id || '';
  const selectedStats: TeamStatsDoc | undefined = allStats.find((s) => s.id === effectiveStatId);

  // ------- Batting Tab -------
  const battingRows = useMemo(() => {
    if (!selectedStats) return [];
    const rows = selectedStats.players.map((p, idx) => ({
      id: `player-${idx}`,
      number: p.number,
      name: `${p.firstName} ${p.lastName}`,
      ...p.batting,
      isTotals: false,
    }));
    if (selectedStats.totals) {
      rows.push({
        id: 'totals',
        number: '',
        name: 'Team Totals',
        ...selectedStats.totals.batting,
        isTotals: true,
      });
    }
    return rows;
  }, [selectedStats]);

  const battingColumns: GridColDef[] = [
    { field: 'number', headerName: '#', width: 60 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'gp', headerName: 'GP', width: 60, type: 'number' },
    { field: 'ab', headerName: 'AB', width: 60, type: 'number' },
    { field: 'avg', headerName: 'AVG', width: 75 },
    { field: 'obp', headerName: 'OBP', width: 75 },
    { field: 'slg', headerName: 'SLG', width: 75 },
    { field: 'ops', headerName: 'OPS', width: 75 },
    { field: 'h', headerName: 'H', width: 55, type: 'number' },
    { field: 'doubles', headerName: '2B', width: 55, type: 'number' },
    { field: 'triples', headerName: '3B', width: 55, type: 'number' },
    { field: 'hr', headerName: 'HR', width: 55, type: 'number' },
    { field: 'rbi', headerName: 'RBI', width: 60, type: 'number' },
    { field: 'r', headerName: 'R', width: 55, type: 'number' },
    { field: 'bb', headerName: 'BB', width: 55, type: 'number' },
    { field: 'so', headerName: 'SO', width: 55, type: 'number' },
    { field: 'sb', headerName: 'SB', width: 55, type: 'number' },
  ];

  // ------- Pitching Tab -------
  const pitchingRows = useMemo(() => {
    if (!selectedStats) return [];
    const rows = selectedStats.players
      .filter((p) => {
        const ip = parseFloat(p.pitching.ip);
        return !isNaN(ip) && ip > 0;
      })
      .map((p, idx) => ({
        id: `pitcher-${idx}`,
        number: p.number,
        name: `${p.firstName} ${p.lastName}`,
        ...p.pitching,
        isTotals: false,
      }));
    if (selectedStats.totals) {
      rows.push({
        id: 'totals',
        number: '',
        name: 'Team Totals',
        ...selectedStats.totals.pitching,
        isTotals: true,
      });
    }
    return rows;
  }, [selectedStats]);

  const pitchingColumns: GridColDef[] = [
    { field: 'number', headerName: '#', width: 60 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'ip', headerName: 'IP', width: 65 },
    { field: 'w', headerName: 'W', width: 55, type: 'number' },
    { field: 'l', headerName: 'L', width: 55, type: 'number' },
    { field: 'era', headerName: 'ERA', width: 75 },
    { field: 'whip', headerName: 'WHIP', width: 80 },
    { field: 'so', headerName: 'SO', width: 55, type: 'number' },
    { field: 'bb', headerName: 'BB', width: 55, type: 'number' },
    { field: 'h', headerName: 'H', width: 55, type: 'number' },
    { field: 'r', headerName: 'R', width: 55, type: 'number' },
    { field: 'er', headerName: 'ER', width: 55, type: 'number' },
    { field: 'baa', headerName: 'BAA', width: 75 },
    { field: 'bf', headerName: 'BF', width: 60, type: 'number' },
    { field: 'np', headerName: '#P', width: 60, type: 'number' },
  ];

  // ------- Fielding Tab -------
  const fieldingRows = useMemo(() => {
    if (!selectedStats) return [];
    const rows = selectedStats.players.map((p, idx) => ({
      id: `fielder-${idx}`,
      number: p.number,
      name: `${p.firstName} ${p.lastName}`,
      ...p.fielding,
      isTotals: false,
    }));
    if (selectedStats.totals) {
      rows.push({
        id: 'totals',
        number: '',
        name: 'Team Totals',
        ...selectedStats.totals.fielding,
        isTotals: true,
      });
    }
    return rows;
  }, [selectedStats]);

  const fieldingColumns: GridColDef[] = [
    { field: 'number', headerName: '#', width: 60 },
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 150 },
    { field: 'tc', headerName: 'TC', width: 60, type: 'number' },
    { field: 'po', headerName: 'PO', width: 60, type: 'number' },
    { field: 'a', headerName: 'A', width: 60, type: 'number' },
    { field: 'e', headerName: 'E', width: 60, type: 'number' },
    { field: 'fpct', headerName: 'FPCT', width: 80 },
    { field: 'dp', headerName: 'DP', width: 60, type: 'number' },
  ];

  // Style the totals row bold
  const getRowClassName = (params: any) => {
    return params.row.isTotals ? 'totals-row' : '';
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Failed to load team stats. Please refresh the page.
      </Alert>
    );
  }

  if (allStats.length === 0) {
    return (
      <Box>
        <Typography variant="h4" sx={{ mb: 3 }}>Team Stats</Typography>
        <Alert severity="info">
          No stats have been imported yet. Use the import script to load team stats.
        </Alert>
      </Box>
    );
  }

  const currentRows = activeTab === 0 ? battingRows : activeTab === 1 ? pitchingRows : fieldingRows;
  const currentColumns = activeTab === 0 ? battingColumns : activeTab === 1 ? pitchingColumns : fieldingColumns;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Typography variant="h4">
          {selectedStats?.teamName || 'Team Stats'}
          {selectedStats ? ` - ${selectedStats.season}` : ''}
        </Typography>
        {allStats.length > 1 && (
          <TextField
            select
            size="small"
            label="Select Stats"
            value={effectiveStatId}
            onChange={(e) => setSelectedStatId(e.target.value)}
            sx={{ minWidth: 250 }}
          >
            {allStats.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.teamName} - {s.season}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Box>

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab label="Batting" />
            <Tab label="Pitching" />
            <Tab label="Fielding" />
          </Tabs>
        </Box>

        <Box sx={{
          height: { xs: 450, md: 600 },
          '& .totals-row': {
            fontWeight: 'bold',
            bgcolor: 'action.hover',
            '& .MuiDataGrid-cell': {
              fontWeight: 'bold',
            },
          },
        }}>
          <DataGrid
            rows={currentRows}
            columns={currentColumns}
            getRowClassName={getRowClassName}
            pageSizeOptions={[25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            disableRowSelectionOnClick
            density="compact"
            sx={{
              '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 'bold',
              },
            }}
          />
        </Box>
      </Paper>
    </Box>
  );
};

export default TeamStatsPage;
