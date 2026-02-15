import { Container, Typography, Paper, Box, Divider, Grid } from '@mui/material';

const AboutPage = () => {
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
            About TC Waves
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Our mission, philosophy, and story
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Mission Statement */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Our Mission
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography
            variant="h6"
            align="center"
            sx={{ fontStyle: 'italic', mb: 3, color: 'text.secondary' }}
          >
            "Work as a Team, Win as a Team, Better Every Time"
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            TC Waves Ball Club is a Michigan non-profit youth amateur athletic organization
            dedicated to fostering health, sportsmanship, teamwork, and athletic skill
            development in the Traverse City area and surrounding communities.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            We are committed to helping young athletes build confidence and athleticism
            through competitive sports. Our programs serve players across multiple age groups,
            providing a pathway from recreational to competitive travel play.
          </Typography>
        </Paper>

        {/* Team Photo */}
        <Box sx={{ mb: 4, borderRadius: 2, overflow: 'hidden' }}>
          <Box
            component="img"
            src="/images/waves_day_2023.jpg"
            alt="TC Waves team photo"
            sx={{
              width: '100%',
              height: { xs: 200, md: 300 },
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </Box>

        {/* Coaching Philosophy */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Coaching Philosophy
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Our coaching staff emphasizes teamwork, accountability, and developing well-rounded
            student-athletes. While we compete to win, we prioritize long-term player growth
            over short-term results. Every practice and game is an opportunity to improve
            fundamentals and build confidence.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            All TC Waves coaches work to create a positive, encouraging atmosphere where
            players are challenged to push beyond their comfort zones and supported through
            the process of becoming better every time they take the field.
          </Typography>
        </Paper>

        {/* Organization History */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Our History
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            TC Waves traces its roots to the Northern Michigan Waves, which organized
            tournaments in the Traverse City area. After a hiatus, the program was revived
            in 2016 with a single 10U team and a vision to grow competitive ball in
            Northern Michigan.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            The program expanded to two teams in 2017 and has continued growing ever since.
            In 2022, leadership established a new organizational structure focused on
            developing young women through the sport. Today, TC Waves fields competitive
            teams across multiple age divisions, serving the Grand Traverse County area
            and beyond.
          </Typography>
        </Paper>

        {/* What Players Receive */}
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Player Resources
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                Players receive comprehensive equipment and gear including logo helmets,
                embroidered bags, and team uniforms.
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                TC Waves merchandise is available year-round. Follow us on social media
                for the latest updates and opportunities.
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      </Container>
    </Box>
  );
};

export default AboutPage;
