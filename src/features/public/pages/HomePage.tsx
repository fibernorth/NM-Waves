import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
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
  Chip,
  CircularProgress,
} from '@mui/material';
import SponsorBanner from '@/components/common/SponsorBanner';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SchoolIcon from '@mui/icons-material/School';
import GroupsIcon from '@mui/icons-material/Groups';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import StarIcon from '@mui/icons-material/Star';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { useQuery } from '@tanstack/react-query';
import { homepagePostsApi } from '@/lib/api/homepagePosts';
import { siteSettingsApi } from '@/lib/api/siteSettings';
import { schedulesApi } from '@/lib/api/schedules';
import { teamsApi } from '@/lib/api/teams';
import type { HomepagePost, SwagStoreSettings } from '@/types/models';
import { format } from 'date-fns';

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

const getYouTubeEmbedUrl = (url: string): string | null => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

const NewsCard = ({ post }: { post: HomepagePost }) => (
  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
    {post.imageUrl && (
      <CardMedia component="img" height="180" image={post.imageUrl} alt={post.title} sx={{ objectFit: 'cover' }} />
    )}
    <CardContent sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        {post.pinned && <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />}
        <Chip
          label={post.type === 'news' ? 'News' : 'Announcement'}
          size="small"
          color={post.type === 'news' ? 'primary' : 'warning'}
          variant="outlined"
        />
      </Box>
      <Typography variant="h6" gutterBottom sx={{ fontSize: '1rem', fontWeight: 600 }}>
        {post.title}
      </Typography>
      {post.body && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {post.body.length > 150 ? post.body.substring(0, 150) + '...' : post.body}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {format(post.createdAt, 'MMM d, yyyy')}
      </Typography>
    </CardContent>
  </Card>
);

const ScoreCard = ({ post }: { post: HomepagePost }) => (
  <Card sx={{ textAlign: 'center' }}>
    <CardContent sx={{ py: 2 }}>
      {post.pinned && <StarIcon sx={{ fontSize: 14, color: 'warning.main', mb: 0.5 }} />}
      <Typography variant="caption" color="text.secondary" display="block">
        {post.gameDate ? format(post.gameDate, 'MMM d, yyyy') : ''}
      </Typography>
      <Typography variant="subtitle2" sx={{ mt: 0.5 }}>
        {post.teamName || 'Northern Michigan Waves'}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, my: 1 }}>
        <Typography variant="h4" fontWeight={700} color={post.result === 'W' ? 'success.main' : post.result === 'L' ? 'error.main' : 'text.primary'}>
          {post.scoreUs ?? '-'}
        </Typography>
        <Typography variant="body2" color="text.secondary">vs</Typography>
        <Typography variant="h4" fontWeight={700} color="text.secondary">
          {post.scoreThem ?? '-'}
        </Typography>
      </Box>
      <Typography variant="body2">vs {post.opponent || 'TBD'}</Typography>
      {post.result && (
        <Chip
          label={post.result === 'W' ? 'Win' : post.result === 'L' ? 'Loss' : 'Tie'}
          size="small"
          color={post.result === 'W' ? 'success' : post.result === 'L' ? 'error' : 'default'}
          sx={{ mt: 1 }}
        />
      )}
    </CardContent>
  </Card>
);

const MediaCard = ({ post }: { post: HomepagePost }) => {
  const embedUrl = post.videoUrl ? getYouTubeEmbedUrl(post.videoUrl) : null;

  return (
    <Card sx={{ height: '100%' }}>
      {post.type === 'video' && embedUrl ? (
        <Box sx={{ position: 'relative', paddingTop: '56.25%' }}>
          <Box
            component="iframe"
            src={embedUrl}
            title={post.title}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </Box>
      ) : post.imageUrl ? (
        <CardMedia component="img" height="200" image={post.imageUrl} alt={post.title} sx={{ objectFit: 'cover' }} />
      ) : null}
      <CardContent sx={{ py: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {post.pinned && <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
          <Typography variant="body2" fontWeight={500}>
            {post.title}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// ============================================
// Swag Store Banner
// ============================================
const useCountdown = (closesAt: Date | null) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!closesAt) return;
    const timer = setInterval(() => setNow(new Date()), 60_000); // update every minute
    return () => clearInterval(timer);
  }, [closesAt]);

  if (!closesAt) return null;

  const diff = new Date(closesAt).getTime() - now.getTime();
  if (diff <= 0) return null;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `Store closes in ${days} day${days !== 1 ? 's' : ''}!`;
  if (hours > 0) return `Store closes in ${hours} hour${hours !== 1 ? 's' : ''}!`;
  return `Store closes in ${minutes} minute${minutes !== 1 ? 's' : ''}!`;
};

const SwagStoreBanner = ({ settings }: { settings: SwagStoreSettings }) => {
  const countdown = useCountdown(settings.closesAt);

  // Don't render if store is not active, has no URL, or is past close date
  const isOpen =
    settings.active &&
    settings.url &&
    (settings.closesAt === null || new Date(settings.closesAt) > new Date());

  if (!isOpen) return null;

  return (
    <Box
      sx={{
        background: 'linear-gradient(135deg, #ff6b35 0%, #f7c948 50%, #ff6b35 100%)',
        backgroundSize: '200% 200%',
        animation: 'shimmer 3s ease infinite',
        '@keyframes shimmer': {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        py: { xs: 2.5, md: 3 },
        textAlign: 'center',
      }}
    >
      <Container maxWidth="md">
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 1.5, sm: 2 },
          }}
        >
          <ShoppingBagIcon sx={{ fontSize: { xs: 32, md: 40 }, color: 'white' }} />
          <Box sx={{ textAlign: { xs: 'center', sm: 'left' } }}>
            <Typography
              variant="h5"
              sx={{
                color: 'white',
                fontWeight: 700,
                fontSize: { xs: '1.2rem', md: '1.5rem' },
                textShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
            >
              {settings.label}
            </Typography>
            {countdown && (
              <Typography
                variant="body2"
                sx={{
                  color: 'rgba(255,255,255,0.9)',
                  fontWeight: 500,
                  fontSize: { xs: '0.8rem', md: '0.9rem' },
                }}
              >
                {countdown}
              </Typography>
            )}
          </Box>
          <Button
            variant="contained"
            href={settings.url}
            target="_blank"
            rel="noopener noreferrer"
            size="large"
            sx={{
              backgroundColor: 'white',
              color: '#ff6b35',
              fontWeight: 700,
              px: 4,
              ml: { sm: 2 },
              '&:hover': {
                backgroundColor: 'rgba(255,255,255,0.9)',
              },
            }}
          >
            Shop Now
          </Button>
        </Box>
      </Container>
    </Box>
  );
};

const ORG_SCHEMA = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SportsOrganization',
  name: 'Northern Michigan Waves',
  description: 'Youth travel softball organization in Traverse City, Michigan',
  url: window.location.origin,
  logo: `${window.location.origin}/images/logo.png`,
  sport: 'Softball',
  location: {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Traverse City',
      addressRegion: 'MI',
      addressCountry: 'US',
    },
  },
  email: 'tcwavessoftball@gmail.com',
  nonprofitStatus: '501(c)(3)',
});

const HomePage = () => {
  useDocumentTitle();

  // Inject schema.org JSON-LD for SEO
  useEffect(() => {
    const id = 'tc-waves-schema';
    if (!document.getElementById(id)) {
      const script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      script.textContent = ORG_SCHEMA;
      document.head.appendChild(script);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);

  const { data: allPosts = [], isLoading } = useQuery({
    queryKey: ['homepagePosts', 'published'],
    queryFn: () => homepagePostsApi.getPublished(),
    staleTime: 60_000,
  });

  const { data: swagStore } = useQuery({
    queryKey: ['siteSettings', 'swagStore'],
    queryFn: () => siteSettingsApi.getSwagStore(),
    staleTime: 60_000,
  });

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['schedules', 'upcoming'],
    queryFn: () => schedulesApi.getUpcoming(),
    staleTime: 5 * 60_000,
  });

  const { data: activeTeams = [] } = useQuery({
    queryKey: ['teams', 'active'],
    queryFn: () => teamsApi.getActive(),
    staleTime: 5 * 60_000,
  });

  const newsPosts = allPosts.filter((p) => p.type === 'news' || p.type === 'announcement');
  const scorePosts = allPosts.filter((p) => p.type === 'score');
  const mediaPosts = allPosts.filter((p) => p.type === 'photo' || p.type === 'video');
  const highlightPosts = allPosts.filter((p) => p.type === 'highlight');

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
            alt="Northern Michigan Waves Logo"
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
            Northern Michigan Waves
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
              to="/coach-application"
              variant="contained"
              size="large"
              sx={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                color: 'white',
                fontWeight: 600,
                px: 4,
                border: '1px solid rgba(255,255,255,0.6)',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.25)',
                },
              }}
            >
              Coach With Us
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

      {/* Swag Store Banner */}
      {swagStore && <SwagStoreBanner settings={swagStore} />}

      {/* Latest News & Updates */}
      {!isLoading && newsPosts.length > 0 && (
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
          <Typography
            variant="h4"
            fontWeight={600}
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 3 }}
          >
            Latest News & Updates
          </Typography>
          <Grid container spacing={3}>
            {newsPosts.slice(0, 6).map((post) => (
              <Grid item xs={12} sm={6} md={4} key={post.id}>
                <NewsCard post={post} />
              </Grid>
            ))}
          </Grid>
        </Container>
      )}

      {/* Recent Scores */}
      {!isLoading && scorePosts.length > 0 && (
        <Box sx={{ backgroundColor: 'grey.50', py: { xs: 4, md: 6 } }}>
          <Container maxWidth="lg">
            <Typography
              variant="h4"
              fontWeight={600}
              gutterBottom
              sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 3 }}
            >
              Recent Scores
            </Typography>
            <Grid container spacing={2}>
              {scorePosts.slice(0, 8).map((post) => (
                <Grid item xs={6} sm={4} md={3} key={post.id}>
                  <ScoreCard post={post} />
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>
      )}

      {/* Stat Highlights */}
      {!isLoading && highlightPosts.length > 0 && (
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
          <Typography
            variant="h4"
            fontWeight={600}
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 3 }}
          >
            Player Highlights
          </Typography>
          <Grid container spacing={2}>
            {highlightPosts.slice(0, 4).map((post) => (
              <Grid item xs={12} sm={6} key={post.id}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      {post.pinned && <StarIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
                      <Typography variant="h6" sx={{ fontSize: '1rem' }}>
                        {post.title}
                      </Typography>
                    </Box>
                    {post.body && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {post.body}
                      </Typography>
                    )}
                    {post.statHighlights && post.statHighlights.length > 0 && (
                      <Stack spacing={0.5}>
                        {post.statHighlights.map((h, i) => (
                          <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Typography variant="body2" fontWeight={600}>{h.playerName}</Typography>
                            <Typography variant="body2" color="text.secondary">—</Typography>
                            <Typography variant="body2">{h.stat}: {h.value}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
          <Typography
            variant="h4"
            fontWeight={600}
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 3 }}
          >
            Upcoming Events
          </Typography>
          <Grid container spacing={2}>
            {upcomingEvents.slice(0, 6).map((event) => (
              <Grid item xs={12} sm={6} md={4} key={event.id}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Chip
                      label={event.eventType}
                      size="small"
                      color={
                        event.eventType === 'game'
                          ? 'primary'
                          : event.eventType === 'tournament'
                            ? 'warning'
                            : 'default'
                      }
                      variant="outlined"
                      sx={{ mb: 1, textTransform: 'capitalize' }}
                    />
                    <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.5 }}>
                      {event.title}
                    </Typography>
                    {event.teamName && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        {event.teamName}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {format(event.startTime, 'EEE, MMM d \u2022 h:mm a')}
                      </Typography>
                    </Box>
                    {event.location && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <LocationOnIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">
                          {event.location}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button component={RouterLink} to="/schedule" variant="outlined">
              View Full Schedule
            </Button>
          </Box>
        </Container>
      )}

      {/* Active Teams */}
      {activeTeams.length > 0 && (
        <Box sx={{ backgroundColor: upcomingEvents.length > 0 ? 'grey.50' : 'white', py: { xs: 4, md: 6 } }}>
          <Container maxWidth="lg">
            <Typography
              variant="h4"
              fontWeight={600}
              gutterBottom
              sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 3 }}
            >
              Our Teams
            </Typography>
            <Grid container spacing={2}>
              {activeTeams.map((team) => (
                <Grid item xs={6} sm={4} md={3} key={team.id}>
                  <Card
                    component={RouterLink}
                    to={`/teams-roster/${team.id}`}
                    sx={{
                      textDecoration: 'none',
                      textAlign: 'center',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                    }}
                  >
                    <CardContent sx={{ py: 2 }}>
                      <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>
                        {team.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {team.ageGroup}
                      </Typography>
                      {team.coachName && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Coach: {team.coachName}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Button component={RouterLink} to="/teams-roster" variant="outlined">
                View All Teams
              </Button>
            </Box>
          </Container>
        </Box>
      )}

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

      {/* Photo/Video Highlights */}
      {!isLoading && mediaPosts.length > 0 && (
        <Box sx={{ backgroundColor: 'grey.50', py: { xs: 4, md: 6 } }}>
          <Container maxWidth="lg">
            <Typography
              variant="h4"
              fontWeight={600}
              gutterBottom
              sx={{ fontSize: { xs: '1.5rem', md: '2rem' }, mb: 3 }}
            >
              Photos & Videos
            </Typography>
            <Grid container spacing={2}>
              {mediaPosts.slice(0, 8).map((post) => (
                <Grid item xs={12} sm={6} md={3} key={post.id}>
                  <MediaCard post={post} />
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>
      )}

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      <SponsorBanner mode="carousel" />

      {/* Why Join Us Section */}
      <Box sx={{ backgroundColor: mediaPosts.length > 0 ? 'white' : 'grey.50', py: { xs: 6, md: 10 } }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            align="center"
            fontWeight={600}
            gutterBottom
            sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, mb: 1 }}
          >
            Why Join Northern Michigan Waves?
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
