import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  Avatar,
  Chip,
  Divider,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api/teams';
import SponsorBanner from '@/components/common/SponsorBanner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

interface CoachInfo {
  name: string;
  role: string;
  teams: string[];
}

const leadershipPositions = [
  {
    name: 'Board of Directors',
    role: 'Governance',
    description:
      'Oversees organizational strategy, financial management, and compliance with nonprofit regulations.',
  },
  {
    name: 'Executive Director',
    role: 'Operations',
    description:
      'Manages day-to-day operations, coordinates with coaches, and ensures program quality.',
  },
  {
    name: 'Treasurer',
    role: 'Finance',
    description:
      'Manages organizational finances, budgeting, and financial reporting.',
  },
];

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return parts[0][0]?.toUpperCase() ?? '';
};

const StaffDirectoryPage = () => {
  useDocumentTitle('Coaching Staff');

  const {
    data: teams = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['teams', 'active'],
    queryFn: () => teamsApi.getActive(),
    staleTime: 5 * 60_000,
  });

  // Aggregate coaches from active team data
  const coaches: CoachInfo[] = (() => {
    const coachMap = new Map<string, { teams: string[]; isHead: boolean }>();

    teams.forEach((team) => {
      if (team.coachName && team.coachName.trim()) {
        const coachName = team.coachName.trim();
        const teamLabel = `${team.name} (${team.ageGroup})`;
        const existing = coachMap.get(coachName);
        if (existing) {
          existing.teams.push(teamLabel);
          // If they're the primary coach on any team, mark as head coach
          existing.isHead = true;
        } else {
          coachMap.set(coachName, { teams: [teamLabel], isHead: true });
        }
      }
    });

    return Array.from(coachMap.entries())
      .map(([name, info]) => ({
        name,
        role: info.isHead ? 'Head Coach' : 'Assistant Coach',
        teams: info.teams,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  })();

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
            Our Coaching Staff
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Meet the dedicated coaches behind Northern Michigan Waves
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Coaching Staff Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Coaching Staff
          </Typography>
          <Divider sx={{ mb: 3 }} />

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : isError ? (
            <Alert severity="error" sx={{ my: 2 }}>
              Unable to load coaching staff. Please try again later.
            </Alert>
          ) : coaches.length === 0 ? (
            <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
              No coaching staff information is currently available.
            </Typography>
          ) : (
            <Grid container spacing={3}>
              {coaches.map((coach) => (
                <Grid item xs={12} sm={6} md={4} key={coach.name}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Avatar
                        sx={{
                          bgcolor: 'primary.main',
                          width: 56,
                          height: 56,
                          mx: 'auto',
                          mb: 1.5,
                          fontSize: '1.25rem',
                        }}
                      >
                        {getInitials(coach.name)}
                      </Avatar>
                      <Typography variant="h6" fontWeight={700}>
                        {coach.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 1.5 }}
                      >
                        {coach.role}
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                        {coach.teams.map((team) => (
                          <Chip
                            key={team}
                            label={team}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

        {/* Organization Leadership Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Organization Leadership
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            {leadershipPositions.map((position) => (
              <Grid item xs={12} sm={6} md={4} key={position.name}>
                <Card variant="outlined" sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      {position.name}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="primary.main"
                      fontWeight={600}
                      sx={{ mb: 1 }}
                    >
                      {position.role}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {position.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Join Our Team Section */}
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Join Our Team
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Interested in coaching with Northern Michigan Waves? We're always looking for dedicated
            individuals who share our passion for developing young athletes.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Contact us at{' '}
            <Typography
              component="a"
              href="mailto:tcwavessoftball@gmail.com"
              sx={{ color: 'primary.main', fontWeight: 600 }}
            >
              tcwavessoftball@gmail.com
            </Typography>{' '}
            for more information about coaching opportunities.
          </Typography>
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/contact"
            sx={{ mt: 1 }}
          >
            Contact Us
          </Button>
        </Paper>
      </Container>

      <SponsorBanner mode="carousel" />
    </Box>
  );
};

export default StaffDirectoryPage;
