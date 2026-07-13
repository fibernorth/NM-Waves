import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Link as MuiLink,
} from '@mui/material';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import PersonIcon from '@mui/icons-material/Person';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { playersApi } from '@/lib/api/players';
import { computeDivision } from '@/lib/utils/leagueAge';

const MAX_SHOWN = 8;

/**
 * Coach/admin dashboard nudge: lists active players who aren't assigned to a
 * team yet (typically players just converted from tryout applicants) so nobody
 * falls through the cracks after tryouts.
 */
const UnassignedPlayersCard = () => {
  const navigate = useNavigate();

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
  });

  const unassigned = players.filter(
    (p) => p.status !== 'quit' && (!p.teamId || p.teamId === '')
  );

  if (unassigned.length === 0) return null;

  const shown = unassigned.slice(0, MAX_SHOWN);
  const extra = unassigned.length - shown.length;

  return (
    <Card variant="outlined" sx={{ mb: 3, borderColor: 'warning.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <GroupAddIcon color="warning" />
          <Typography variant="h6">Players awaiting team placement</Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {shown.map((p) => {
            const division = computeDivision(p.dateOfBirth);
            return (
              <Box
                key={p.id}
                sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
              >
                <PersonIcon fontSize="small" color="warning" />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {p.firstName} {p.lastName}
                  {division ? ` — ${division}` : ''}
                  {p.createdAt ? ` — added ${format(p.createdAt, 'MMM d, yyyy')}` : ''}
                </Typography>
                <Button
                  size="small"
                  variant="contained"
                  color="warning"
                  onClick={() => navigate(`/players/${p.id}`)}
                >
                  Assign team
                </Button>
              </Box>
            );
          })}

          {extra > 0 && (
            <Typography variant="body2" color="text.secondary">
              <MuiLink component={RouterLink} to="/players">
                +{extra} more awaiting placement
              </MuiLink>
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default UnassignedPlayersCard;
