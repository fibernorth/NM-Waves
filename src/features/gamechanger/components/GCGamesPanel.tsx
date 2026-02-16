import {
  Box,
  Typography,
  Paper,
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
import { gcGamesApi } from '@/lib/api/gamechanger';
import { format } from 'date-fns';

interface GCGamesPanelProps {
  teamId?: string;
  gcTeamId?: string;
  season?: string;
}

const GCGamesPanel = ({ teamId, gcTeamId, season }: GCGamesPanelProps) => {
  const { data: games = [], isLoading } = useQuery({
    queryKey: ['gcGames', teamId, gcTeamId, season],
    queryFn: async () => {
      if (gcTeamId) return gcGamesApi.getByGCTeam(gcTeamId);
      if (teamId) return gcGamesApi.getByTeam(teamId);
      if (season) return gcGamesApi.getBySeason(season);
      return gcGamesApi.getAll();
    },
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  // Calculate record
  const record = games.reduce(
    (acc, g) => ({
      w: acc.w + (g.result === 'W' ? 1 : 0),
      l: acc.l + (g.result === 'L' ? 1 : 0),
      t: acc.t + (g.result === 'T' ? 1 : 0),
    }),
    { w: 0, l: 0, t: 0 }
  );

  if (games.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">
          No GameChanger game results available. Games are synced nightly from GameChanger.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper variant="outlined">
      <Box sx={{ px: 2, pt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" fontWeight={600}>
          Game Results
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Chip
            label={`${record.w}-${record.l}${record.t > 0 ? `-${record.t}` : ''}`}
            color={record.w > record.l ? 'success' : record.w < record.l ? 'error' : 'default'}
            size="small"
          />
        </Box>
      </Box>

      <TableContainer sx={{ mt: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Opponent</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Result</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Score</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Location</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {games.map((game) => (
              <TableRow key={game.id} hover>
                <TableCell>{format(game.date, 'MMM d, yyyy')}</TableCell>
                <TableCell>{game.opponent}</TableCell>
                <TableCell>
                  <Chip
                    label={game.result}
                    size="small"
                    color={game.result === 'W' ? 'success' : game.result === 'L' ? 'error' : 'default'}
                    sx={{ fontWeight: 700, minWidth: 32 }}
                  />
                </TableCell>
                <TableCell>
                  {game.scoreUs} - {game.scoreThem}
                </TableCell>
                <TableCell>{game.location || '--'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default GCGamesPanel;
