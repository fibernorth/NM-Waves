import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupsIcon from '@mui/icons-material/Groups';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { teamsApi } from '@/lib/api/teams';
import { getPublicRoster } from '@/lib/api/publicData';
import type { Team } from '@/types/models';

interface PublicPlayer {
  firstName: string;
  lastInitial: string;
  jerseyNumber?: number;
  positions: string[];
}

const PublicTeamsPage = () => {
  useDocumentTitle('Teams');
  const navigate = useNavigate();
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamPlayers, setTeamPlayers] = useState<Record<string, PublicPlayer[]>>({});
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [playerErrors, setPlayerErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<string | false>(false);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const teamsData = await teamsApi.getActive();
        setTeams(teamsData);
      } catch (err) {
        console.error('Error fetching teams:', err);
        setError('Unable to load teams at this time. Please try again later.');
      } finally {
        setLoadingTeams(false);
      }
    };

    fetchTeams();
  }, []);

  const fetchPlayers = async (teamId: string) => {
    if (teamPlayers[teamId]) return; // Already loaded

    setLoadingPlayers((prev) => ({ ...prev, [teamId]: true }));
    try {
      // Sanitized roster from Cloud Function (safe fields only), sorted by name.
      const roster = await getPublicRoster(teamId);
      const players: PublicPlayer[] = [...roster].sort((a, b) =>
        a.firstName.localeCompare(b.firstName)
      );
      setTeamPlayers((prev) => ({ ...prev, [teamId]: players }));
    } catch (err) {
      console.error('Error fetching players for team:', teamId, err);
      setPlayerErrors(prev => ({ ...prev, [teamId]: 'Failed to load roster' }));
    } finally {
      setLoadingPlayers((prev) => ({ ...prev, [teamId]: false }));
    }
  };

  const handleAccordionChange = (teamId: string) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? teamId : false);
    if (isExpanded) {
      fetchPlayers(teamId);
    }
  };

  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{
          backgroundColor: 'primary.main',
          color: 'white',
          py: { xs: 4, md: 6 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h3"
            component="h1"
            fontWeight={700}
            sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' } }}
          >
            Our Teams
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Browse our active teams and rosters
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {loadingTeams ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : teams.length === 0 ? (
          <Alert severity="info">
            No active teams are available at this time. Check back soon!
          </Alert>
        ) : (
          teams.map((team) => (
            <Accordion
              key={team.id}
              expanded={expanded === team.id}
              onChange={handleAccordionChange(team.id)}
              sx={{ mb: 1 }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', flexWrap: 'wrap' }}>
                  <GroupsIcon color="primary" />
                  <Typography variant="h6" fontWeight={600} sx={{ flexGrow: 1 }}>
                    {team.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Chip label={team.ageGroup} size="small" color="primary" variant="outlined" />
                    <Chip label={team.season} size="small" variant="outlined" />
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate('/teams-roster/' + team.id);
                      }}
                      sx={{ ml: 1, whiteSpace: 'nowrap' }}
                    >
                      View Team Page
                    </Button>
                  </Box>
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                {team.coachName && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Head Coach: {team.coachName}
                  </Typography>
                )}

                {playerErrors[team.id] && <Alert severity="error" sx={{ mt: 1 }}>{playerErrors[team.id]}</Alert>}

                {loadingPlayers[team.id] ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : teamPlayers[team.id] && teamPlayers[team.id].length > 0 ? (
                  <List dense disablePadding>
                    {teamPlayers[team.id].map((player, index) => (
                      <ListItem key={index} divider={index < teamPlayers[team.id].length - 1}>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {player.jerseyNumber != null && (
                                <Chip
                                  label={`#${player.jerseyNumber}`}
                                  size="small"
                                  sx={{ fontWeight: 600, minWidth: 48 }}
                                />
                              )}
                              <Typography variant="body1">
                                {player.firstName} {player.lastInitial}
                              </Typography>
                            </Box>
                          }
                          secondary={
                            player.positions.length > 0 && (
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                                {player.positions.map((pos) => (
                                  <Chip
                                    key={pos}
                                    label={pos}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.75rem' }}
                                  />
                                ))}
                              </Box>
                            )
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                ) : teamPlayers[team.id] ? (
                  <Typography variant="body2" color="text.secondary">
                    Roster is currently being finalized.
                  </Typography>
                ) : null}
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </Container>
    </Box>
  );
};

export default PublicTeamsPage;
