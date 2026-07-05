import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  Chip,
  Divider,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SponsorBanner from '@/components/common/SponsorBanner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const goldColor = '#FFD700';
const silverColor = '#C0C0C0';
const bronzeColor = '#CD7F32';

const sponsorshipTiers = [
  {
    title: 'Gold Sponsor',
    price: '$1,000+',
    color: goldColor,
    chip: 'Most Popular',
    benefits: [
      'Premier logo placement on website homepage',
      'Logo on all team uniforms and jerseys',
      'Social media spotlight (quarterly features)',
      'Banner at all home tournaments',
      'Recognition at end-of-season awards',
      'Tax-deductible receipt',
      'Exclusive sponsor events invitation',
    ],
  },
  {
    title: 'Silver Sponsor',
    price: '$500+',
    color: silverColor,
    benefits: [
      'Logo on website sponsors page',
      'Logo on team banner',
      'Social media recognition (bi-annual)',
      'Recognition at end-of-season awards',
      'Tax-deductible receipt',
    ],
  },
  {
    title: 'Bronze Sponsor',
    price: '$250+',
    color: bronzeColor,
    benefits: [
      'Name listed on website sponsors page',
      'Social media thank you post',
      'Recognition at end-of-season awards',
      'Tax-deductible receipt',
    ],
  },
];

const SponsorshipPackagesPage = () => {
  useDocumentTitle('Sponsorship Packages');
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
            Sponsorship Packages
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Partner with Northern Michigan Waves and support youth athletics
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Why Sponsor Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Why Sponsor Northern Michigan Waves?
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Your sponsorship directly supports youth athletes in the Traverse City area. As a
            501(c)(3) nonprofit, all sponsorship contributions are tax-deductible. Partners receive
            year-round visibility across our digital platforms, events, and community presence.
          </Typography>
        </Paper>

        {/* Sponsorship Tiers Section */}
        <Typography
          variant="h4"
          fontWeight={600}
          color="primary.main"
          sx={{ mb: 3, textAlign: 'center' }}
        >
          Sponsorship Tiers
        </Typography>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {sponsorshipTiers.map((tier) => (
            <Grid item xs={12} md={4} key={tier.title}>
              <Card
                sx={{
                  height: '100%',
                  borderTop: `4px solid ${tier.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Typography variant="h5" fontWeight={700} gutterBottom>
                      {tier.title}
                    </Typography>
                    <Typography variant="h4" fontWeight={700} color="primary.main">
                      {tier.price}
                    </Typography>
                    {tier.chip && (
                      <Chip
                        label={tier.chip}
                        sx={{
                          mt: 1,
                          bgcolor: tier.color,
                          color: '#000',
                          fontWeight: 600,
                        }}
                      />
                    )}
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <List dense disablePadding>
                    {tier.benefits.map((benefit) => (
                      <ListItem key={benefit} disableGutters>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <CheckCircleIcon sx={{ color: tier.color }} />
                        </ListItemIcon>
                        <ListItemText primary={benefit} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Player Sponsorship Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Sponsor a Player
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Individual players can be directly sponsored to help offset their families&apos; costs.
            Sponsor a specific player or contribute to the general scholarship fund.
          </Typography>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <Card sx={{ height: '100%', bgcolor: 'grey.50' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Direct Player Sponsorship
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Sponsor a specific player — any amount helps offset the cost of registration,
                    equipment, and tournament fees for their family.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card sx={{ height: '100%', bgcolor: 'grey.50' }}>
                <CardContent>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    Scholarship Fund
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Contribute to the general scholarship fund for families in need. Every dollar
                    helps ensure no player is left behind.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/become-sponsor"
          >
            Become a Sponsor
          </Button>
        </Paper>

        {/* Custom Partnerships Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4, bgcolor: 'secondary.light' }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Custom Partnership Opportunities
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            We&apos;re open to creative partnership arrangements — tournament naming rights, equipment
            sponsorship, facility partnerships, and more. Let&apos;s work together to find a
            partnership that fits your goals and supports our athletes.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Contact us at{' '}
            <Typography component="span" fontWeight={600}>
              tcwavessoftball@gmail.com
            </Typography>{' '}
            to discuss custom opportunities.
          </Typography>
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/contact"
          >
            Discuss a Custom Partnership
          </Button>
        </Paper>
      </Container>

      {/* CTA Section */}
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
            variant="h4"
            fontWeight={700}
            gutterBottom
            sx={{ fontSize: { xs: '1.5rem', md: '2rem' } }}
          >
            Ready to Make a Difference?
          </Typography>
          <Typography variant="h6" sx={{ mb: 3, opacity: 0.9, fontWeight: 300 }}>
            Join our growing family of sponsors and help shape the future of youth athletics in
            Northern Michigan.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              variant="outlined"
              size="large"
              component={RouterLink}
              to="/become-sponsor"
              sx={{ color: 'white', borderColor: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              Become a Sponsor
            </Button>
            <Button
              variant="outlined"
              size="large"
              component={RouterLink}
              to="/contact"
              sx={{ color: 'white', borderColor: 'white', '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' } }}
            >
              Contact Us
            </Button>
          </Box>
        </Container>
      </Box>

      <SponsorBanner mode="carousel" />
    </Box>
  );
};

export default SponsorshipPackagesPage;
