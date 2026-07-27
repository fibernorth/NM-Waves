import {
  Box,
  Typography,
  Paper,
  Divider,
  Button,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
} from '@mui/material';
import EmojiPeopleIcon from '@mui/icons-material/EmojiPeople';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import SyncIcon from '@mui/icons-material/Sync';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { tryoutApplicantsApi } from '@/lib/api/tryoutApplicants';
import { teamsApi } from '@/lib/api/teams';
import { computeLeagueAge, computeDivision } from '@/lib/utils/leagueAge';
import type { Team } from '@/types/models';
import toast from 'react-hot-toast';

interface Props {
  team: Team;
  isAdmin: boolean;
}

/**
 * Tryout prospects attached to this team — players in the team's division band
 * or one below (playing up), for the team's season. Prospects are seeded
 * automatically when families register and when the team is created, and can be
 * removed here or re-synced from the current applicant pool.
 */
const TeamProspectsSection = ({ team, isAdmin }: Props) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: prospects = [], isLoading } = useQuery({
    queryKey: ['teamProspects', team.id],
    queryFn: () => tryoutApplicantsApi.getProspectsForTeam(team.id),
  });

  // Hide those already converted or declined — they're no longer prospects.
  const active = prospects.filter((p) => p.status !== 'converted' && p.status !== 'declined');

  const removeMutation = useMutation({
    mutationFn: (id: string) => tryoutApplicantsApi.removeProspectTeam(id, team.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teamProspects', team.id] });
      toast.success('Removed from prospects');
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to remove'),
  });

  const syncMutation = useMutation({
    mutationFn: () => teamsApi.syncProspects(team.id),
    onSuccess: (added) => {
      queryClient.invalidateQueries({ queryKey: ['teamProspects', team.id] });
      toast.success(added > 0 ? `Attached ${added} new prospect${added === 1 ? '' : 's'}` : 'No new prospects to attach');
    },
    onError: (e: any) => toast.error(e?.message || 'Sync failed'),
  });

  return (
    <Paper variant="outlined" sx={{ mb: 4 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          pb: 1,
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight={600}>
            <EmojiPeopleIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Tryout Prospects ({active.length})
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {team.ageGroup} players (and one division younger) who tried out for {team.season || 'this season'}
          </Typography>
        </Box>
        {isAdmin && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<SyncIcon />}
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            Sync prospects
          </Button>
        )}
      </Box>
      <Divider />

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : active.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <EmojiPeopleIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography color="text.secondary">
            No tryout prospects for this team yet.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            They attach automatically as families register for {team.season || 'the season'}.
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {active.map((p) => {
            const age = computeLeagueAge(p.dateOfBirth);
            const div = computeDivision(p.dateOfBirth);
            return (
              <ListItem
                key={p.id}
                divider
                secondaryAction={
                  isAdmin && (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Open in Tryouts (evaluate / convert)">
                        <IconButton edge="end" size="small" onClick={() => navigate('/tryouts')}>
                          <OpenInNewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remove from this team's prospects">
                        <IconButton
                          edge="end"
                          size="small"
                          color="error"
                          onClick={() => removeMutation.mutate(p.id)}
                          disabled={removeMutation.isPending}
                        >
                          <PersonRemoveIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography component="span" fontWeight={600}>
                        {p.playerFirstName} {p.playerLastName}
                      </Typography>
                      {div && <Chip label={div} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />}
                      {age != null && (
                        <Typography component="span" variant="caption" color="text.secondary">
                          League age {age}
                        </Typography>
                      )}
                      {p.status === 'invited' && <Chip label="invited" size="small" color="success" sx={{ height: 20, fontSize: '0.7rem' }} />}
                    </Box>
                  }
                  secondary={
                    <>
                      {p.positionsInterested && <span>{p.positionsInterested} · </span>}
                      {p.location && <span>{p.location} · </span>}
                      {p.parentName || p.email || p.phone}
                      {p.sessionLabel ? ` · ${p.sessionLabel}` : ''}
                    </>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
};

export default TeamProspectsSection;
