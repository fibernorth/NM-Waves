import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Paper,
  CircularProgress,
  Chip,
  Grid,
  Card,
  CardContent,
  Divider,
  Alert,
} from '@mui/material';
import { useParams, Link as RouterLink } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Button } from '@mui/material';
import GroupsIcon from '@mui/icons-material/Groups';
import SportsIcon from '@mui/icons-material/Sports';
import PersonIcon from '@mui/icons-material/Person';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Team } from '@/types/models';

interface PublicPlayer {
  firstName: string;
  lastInitial: string;
  jerseyNumber?: number;
  positions: string[];
}

const PublicTeamDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<PublicPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch team data
  useEffect(() => {
    const fetchTeam = async () => {
      if (!id) {
        setError('Team not found.');
        setLoading(false);
        return;
      }

      try {
        const teamDoc = await getDoc(doc(db, 'teams', id));
        if (!teamDoc.exists()) {
          setError('Team not found.');
          setLoading(false);
          return;
        }

        const data = teamDoc.data();
        const teamData: Team = {
          id: teamDoc.id,
          name: data.name,
          ageGroup: data.ageGroup,
          season: data.season,
          coachIds: data.coachIds || [],
          playerIds: data.playerIds || [],
          coachId: data.coachId,
          coachName: data.coachName,
          gcTeamId: data.gcTeamId,
          active: data.active ?? true,
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };

        setTeam(teamData);
      } catch (err) {
        console.error('Error fetching team:', err);
        setError('Unable to load team details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [id]);

  // Fetch players for this team
  useEffect(() => {
    const fetchPlayers = async () => {
      if (!id) {
        setLoadingPlayers(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'players'),
          where('teamId', '==', id)
        );
        const snapshot = await getDocs(q);
        const playersData: PublicPlayer[] = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              firstName: data.firstName || '',
              lastInitial: data.lastName ? data.lastName.charAt(0) + '.' : '',
              jerseyNumber: data.jerseyNumber,
              positions: data.positions || [],
            };
          })
          .sort((a, b) => {
            // Sort by jersey number first (if available), then by first name
            if (a.jerseyNumber != null && b.jerseyNumber != null) {
              return a.jerseyNumber - b.jerseyNumber;
            }
            if (a.jerseyNumber != null) return -1;
            if (b.jerseyNumber != null) return 1;
            return a.firstName.localeCompare(b.firstName);
          });

        setPlayers(playersData);
      } catch (err) {
        console.error('Error fetching players:', err);
      } finally {
        setLoadingPlayers(false);
      }
    };

    fetchPlayers();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !team) {
    return (
      <Container maxWidth="md" sx={{ py: 8 }}>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || 'Team not found.'}
        </Alert>
        <Button
          component={RouterLink}
          to="/teams-roster"
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to All Teams
        </Button>
      </Container>
    );
  }

  return (
    <Box>
      {/* Team Header */}
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
            {team.name}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              gap: 1.5,
              mt: 2,
              flexWrap: 'wrap',
            }}
          >
            <Chip
              label={team.ageGroup}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 600,
              }}
            />
            <Chip
              label={team.season}
              sx={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontWeight: 600,
              }}
            />
          </Box>
          {team.coachName && (
            <Typography variant="h6" sx={{ mt: 2, opacity: 0.9, fontWeight: 300 }}>
              <SportsIcon sx={{ verticalAlign: 'middle', mr: 0.5, fontSize: '1.2rem' }} />
              Head Coach: {team.coachName}
            </Typography>
          )}
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Back Button */}
        <Button
          component={RouterLink}
          to="/teams-roster"
          startIcon={<ArrowBackIcon />}
          variant="text"
          sx={{ mb: 3 }}
        >
          Back to All Teams
        </Button>

        {/* GameChanger Scoreboard Widget */}
        {team.gcTeamId && (
          <Paper elevation={2} sx={{ mb: 4, overflow: 'hidden' }}>
            <Box
              sx={{
                backgroundColor: 'grey.100',
                px: 3,
                py: 2,
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Typography variant="h6" fontWeight={600}>
                Schedule & Scores
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Powered by GameChanger
              </Typography>
            </Box>
            <Box sx={{ width: '100%' }}>
              <iframe
                src={`https://web.gc.com/teams/${team.gcTeamId}/schedule`}
                width="100%"
                height="600"
                style={{ border: 'none', display: 'block' }}
                title={`${team.name} Schedule`}
                loading="lazy"
                allowFullScreen
              />
            </Box>
            <Divider />
            <Box sx={{ width: '100%' }}>
              <Box
                sx={{
                  backgroundColor: 'grey.100',
                  px: 3,
                  py: 2,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography variant="h6" fontWeight={600}>
                  Standings & Stats
                </Typography>
              </Box>
              <iframe
                src={`https://web.gc.com/teams/${team.gcTeamId}/stats`}
                width="100%"
                height="400"
                style={{ border: 'none', display: 'block' }}
                title={`${team.name} Stats`}
                loading="lazy"
                allowFullScreen
              />
            </Box>
          </Paper>
        )}

        {/* Roster Section */}
        <Paper elevation={2} sx={{ overflow: 'hidden' }}>
          <Box
            sx={{
              backgroundColor: 'grey.100',
              px: 3,
              py: 2,
              borderBottom: '1px solid',
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <GroupsIcon color="primary" />
            <Typography variant="h6" fontWeight={600}>
              Roster
            </Typography>
            {!loadingPlayers && (
              <Chip
                label={`${players.length} player${players.length !== 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
                sx={{ ml: 'auto' }}
              />
            )}
          </Box>

          {loadingPlayers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress size={28} />
            </Box>
          ) : players.length === 0 ? (
            <Box sx={{ px: 3, py: 4, textAlign: 'center' }}>
              <Typography variant="body1" color="text.secondary">
                Roster is currently being finalized. Check back soon!
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={0}>
              {players.map((player, index) => (
                <Grid item xs={12} sm={6} key={index}>
                  <Card
                    elevation={0}
                    sx={{
                      borderRadius: 0,
                      borderBottom: '1px solid',
                      borderRight: { sm: index % 2 === 0 ? '1px solid' : 'none' },
                      borderColor: 'divider',
                    }}
                  >
                    <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        {player.jerseyNumber != null ? (
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              backgroundColor: 'primary.main',
                              color: 'white',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              flexShrink: 0,
                            }}
                          >
                            #{player.jerseyNumber}
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: '50%',
                              backgroundColor: 'grey.300',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <PersonIcon sx={{ color: 'grey.600', fontSize: '1.2rem' }} />
                          </Box>
                        )}
                        <Box>
                          <Typography variant="body1" fontWeight={600}>
                            {player.firstName} {player.lastInitial}
                          </Typography>
                          {player.positions.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                              {player.positions.map((pos) => (
                                <Chip
                                  key={pos}
                                  label={pos}
                                  size="small"
                                  variant="outlined"
                                  sx={{ fontSize: '0.7rem', height: 22 }}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default PublicTeamDetailPage;
