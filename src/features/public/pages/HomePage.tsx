import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  Grid,
  Stack,
} from '@mui/material';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';

const features = [
  {
    icon: <EmojiEventsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    title: 'Competition',
    description:
      'Compete in top-tier tournaments and leagues across Northern Michigan and beyond. Our teams play to win and grow.',
  },
  {
    icon: <SchoolIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    title: 'Player Development',
    description:
      'Experienced coaches focus on individual skill development, game strategy, and building well-rounded student-athletes.',
  },
  {
    icon: <GroupsIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    title: 'Teamwork',
    description:
      'Work as a team, win as a team. Our players build accountability, confidence, and lasting friendships on and off the field.',
  },
  {
    icon: <SportsBaseballIcon sx={{ fontSize: 48, color: 'primary.main' }} />,
    title: 'Fun',
    description:
      'At the end of the day, it is a game, and we never lose sight of that. Our players have a blast while becoming better every time.',
  },
];

const teamPhotos = [
  { src: '/images/waves_day_2023.jpg', label: 'Waves Day 2023' },
  { src: '/images/2024_14u_dome_tourney.jpg', label: '14U Dome Tournament' },
  { src: '/images/2024_15u.jpg', label: '15U Team' },
  { src: '/images/2023_13u_sault_champions.jpg', label: '13U Sault Champions' },
];

const HomePage = () => {
  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #001240 0%, #001f5b 50%, #9bcbeb 100%)',
          color: 'white',
          py: { xs: 6, md: 10 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Box
            component="img"
            src="/images/logo.png"
            alt="TC Waves Logo"
            sx={{
              width: { xs: 120, md: 160 },
              height: 'auto',
              mb: 2,
              filter: 'brightness(0) invert(1)',
            }}
          />
          <Typography
            variant="h2"
            component="h1"
            fontWeight={700}
            gutterBottom
            sx={{ fontSize: { xs: '2rem', md: '3rem' } }}
          >
            TC Waves Ball Club
          </Typography>
          <Typography
            variant="h5"
            sx={{
              mb: 1,
              opacity: 0.95,
              fontWeight: 500,
              fontSize: { xs: '1rem', md: '1.3rem' },
              fontStyle: 'italic',
            }}
          >
            Work as a Team, Win as a Team, Better Every Time
          </Typography>
          <Typography
            variant="h6"
            sx={{
              mb: 4,
              opacity: 0.85,
              fontWeight: 300,
              fontSize: { xs: '1rem', md: '1.2rem' },
            }}
          >
            Traverse City, Michigan
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            justifyContent="center"
          >
            <Button
              component={RouterLink}
              to="/tryouts"
              variant="contained"
              size="large"
              sx={{
                backgroundColor: 'white',
                color: 'primary.main',
                fontWeight: 600,
                px: 4,
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.9)',
                },
              }}
            >
              Register for Tryouts
            </Button>
            <Button
              component={RouterLink}
              to="/about"
              variant="outlined"
              size="large"
              sx={{
                borderColor: 'white',
                color: 'white',
                fontWeight: 600,
                px: 4,
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                },
              }}
            >
              Learn More
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Team Photos Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Grid container spacing={2}>
          {teamPhotos.map((photo) => (
            <Grid item xs={12} sm={6} md={3} key={photo.label}>
              <Card sx={{ overflow: 'hidden' }}>
                <CardMedia
                  component="img"
                  height="200"
                  image={photo.src}
                  alt={photo.label}
                  sx={{ objectFit: 'cover' }}
                />
                <CardContent sx={{ py: 1, px: 2 }}>
                  <Typography variant="body2" color="text.secondary" align="center">
                    {photo.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Why Join Us Section */}
      <Box sx={{ backgroundColor: 'grey.50', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            align="center"
            fontWeight={600}
            gutterBottom
            sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, mb: 1 }}
          >
            Why Join TC Waves?
          </Typography>
          <Typography
            variant="body1"
            align="center"
            color="text.secondary"
            sx={{ mb: 6, maxWidth: 600, mx: 'auto' }}
          >
            A non-profit organization helping young athletes build confidence and athleticism through competitive sports.
          </Typography>

          <Grid container spacing={3}>
            {features.map((feature) => (
              <Grid item xs={12} sm={6} md={3} key={feature.title}>
                <Card
                  sx={{
                    height: '100%',
                    textAlign: 'center',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ mb: 2 }}>{feature.icon}</Box>
                    <Typography variant="h6" fontWeight={600} gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Quick Links Section */}
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 8 } }}>
        <Typography
          variant="h4"
          align="center"
          fontWeight={600}
          gutterBottom
          sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 4 }}
        >
          Get Started
        </Typography>
        <Grid container spacing={2} justifyContent="center">
          <Grid item xs={12} sm={6} md={4}>
            <Button
              component={RouterLink}
              to="/teams-roster"
              variant="outlined"
              fullWidth
              size="large"
              sx={{ py: 1.5 }}
            >
              View Our Teams
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              component={RouterLink}
              to="/schedule"
              variant="outlined"
              fullWidth
              size="large"
              sx={{ py: 1.5 }}
            >
              Upcoming Schedule
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              component={RouterLink}
              to="/gallery"
              variant="outlined"
              fullWidth
              size="large"
              sx={{ py: 1.5 }}
            >
              Photo Gallery
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              component={RouterLink}
              to="/sponsors"
              variant="outlined"
              fullWidth
              size="large"
              sx={{ py: 1.5 }}
            >
              Our Sponsors
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              component={RouterLink}
              to="/contact"
              variant="outlined"
              fullWidth
              size="large"
              sx={{ py: 1.5 }}
            >
              Contact Us
            </Button>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Button
              component={RouterLink}
              to="/tryouts"
              variant="contained"
              fullWidth
              size="large"
              sx={{ py: 1.5 }}
            >
              Tryout Registration
            </Button>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default HomePage;
