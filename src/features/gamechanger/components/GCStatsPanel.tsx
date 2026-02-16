import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { gcStatsApi } from '@/lib/api/gamechanger';
import { format } from 'date-fns';

interface GCStatsPanelProps {
  teamId?: string;
  playerId?: string;
  season?: string;
}

const BATTING_COLUMNS = ['avg', 'ab', 'h', 'r', 'rbi', 'hr', '2b', '3b', 'bb', 'so', 'sb', 'obp', 'slg', 'ops'];
const PITCHING_COLUMNS = ['era', 'w', 'l', 'ip', 'h', 'r', 'er', 'bb', 'so', 'whip'];
const FIELDING_COLUMNS = ['tc', 'po', 'a', 'e', 'fpct', 'dp'];

const getColumnsForType = (statType: string): string[] => {
  switch (statType) {
    case 'batting': return BATTING_COLUMNS;
    case 'pitching': return PITCHING_COLUMNS;
    case 'fielding': return FIELDING_COLUMNS;
    default: return [];
  }
};

const GCStatsPanel = ({ teamId, playerId, season }: GCStatsPanelProps) => {
  const [activeTab, setActiveTab] = useState(0);

  const { data: stats = [], isLoading } = useQuery({
    queryKey: ['gcStats', teamId, playerId, season],
    queryFn: async () => {
      if (playerId) return gcStatsApi.getByPlayer(playerId);
      if (teamId) return gcStatsApi.getByTeam(teamId);
      if (season) return gcStatsApi.getBySeason(season);
      return gcStatsApi.getAll();
    },
  });

  const statTypes = ['batting', 'pitching', 'fielding'] as const;
  const currentType = statTypes[activeTab];
  const filteredStats = stats.filter(s => s.statType === currentType);
  const columns = getColumnsForType(currentType);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (stats.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No GameChanger stats available. Stats are synced nightly from GameChanger.
        </Typography>
      </Paper>
    );
  }

  const lastScraped = stats.length > 0
    ? stats.reduce((latest, s) => s.scrapedAt > latest ? s.scrapedAt : latest, stats[0].scrapedAt)
    : null;

  return (
    <Paper variant="outlined">
      <Box sx={{ px: 2, pt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={600}>
          GameChanger Stats
        </Typography>
        {lastScraped && (
          <Chip
            label={`Last synced: ${format(lastScraped, 'MMM d, h:mm a')}`}
            size="small"
            variant="outlined"
          />
        )}
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, v) => setActiveTab(v)}
        sx={{ px: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab label="Batting" />
        <Tab label="Pitching" />
        <Tab label="Fielding" />
      </Tabs>

      <TableContainer sx={{ maxHeight: 500 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600, position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 3 }}>
                Player
              </TableCell>
              {columns.map(col => (
                <TableCell key={col} align="right" sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                  {col}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredStats.map((stat) => (
              <TableRow key={stat.id} hover>
                <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', zIndex: 1, fontWeight: 500 }}>
                  {stat.playerName || stat.playerId}
                </TableCell>
                {columns.map(col => (
                  <TableCell key={col} align="right">
                    {stat.stats[col] !== undefined
                      ? typeof stat.stats[col] === 'number' && stat.stats[col] % 1 !== 0
                        ? stat.stats[col].toFixed(3)
                        : stat.stats[col]
                      : '--'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {filteredStats.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + 1} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary" variant="body2">
                    No {currentType} stats available
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default GCStatsPanel;
