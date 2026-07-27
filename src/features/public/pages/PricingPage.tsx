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
  Skeleton,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import SportsIcon from '@mui/icons-material/Sports';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SponsorBanner from '@/components/common/SponsorBanner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useQuery } from '@tanstack/react-query';
import { costAssumptionsApi } from '@/lib/api/finances';
import type { GlobalCostAssumptions } from '@/types/models';

/** Format a number as currency, e.g. 150 -> "$150" */
const fmt = (n: number): string =>
  n > 0
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '$0';

/** Build the fee category cards from cost data or fall back to static ranges */
const buildFeeCategories = (costs: GlobalCostAssumptions | null | undefined) => {
  const hasData = costs && (costs.registrationFee > 0 || costs.uniformCost > 0 || costs.tournamentFeePerEvent > 0 || costs.facilityFeePerSeason > 0);

  return [
    {
      title: 'Registration Fee',
      icon: <HowToRegIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
      description:
        'Seasonal registration fee covering league enrollment, insurance, and administrative costs.',
      range: hasData
        ? `${fmt(costs.registrationFee)} per player`
        : '$150 - $250 per player',
    },
    {
      title: 'Uniforms & Equipment',
      icon: <CheckroomIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
      description:
        'Includes team jersey, pants, socks, helmet, belt, and equipment bag with Northern Michigan Waves branding. Some items are player-owned and carry over between seasons.',
      range: hasData
        ? `${fmt(costs.uniformCost + costs.equipmentFeePerSeason)} per player`
        : '$200 - $350 per player',
    },
    {
      title: 'Tournament Fees',
      icon: <EmojiEventsIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
      description:
        'Entry fees for tournament competitions throughout the season. Teams typically compete in 5-8 tournaments \u2014 the total depends on the number of events your team enters.',
      range: hasData
        ? `${fmt(costs.tournamentFeePerEvent)} per tournament`
        : '$300 - $500 per season',
    },
    {
      title: 'Facility & Training',
      icon: <SportsIcon sx={{ fontSize: 32, color: 'primary.main' }} />,
      description:
        'Indoor training facility rental, dome time during winter months, and practice field access throughout the season.',
      range: hasData
        ? costs.facilityFeePerSeason > 0
          ? `${fmt(costs.facilityFeePerSeason)} per season`
          : 'Included in season fees'
        : 'Included in season fees',
    },
  ];
};

/** Calculate the approximate total from cost assumptions */
const estimateTotal = (costs: GlobalCostAssumptions | null | undefined): string | null => {
  if (!costs) return null;
  const total =
    costs.registrationFee +
    costs.uniformCost +
    costs.equipmentFeePerSeason +
    costs.facilityFeePerSeason +
    // Assume ~6 tournaments for the estimate
    costs.tournamentFeePerEvent * 6;

  if (total <= 0) return null;

  // Round to nearest $50 for a clean display
  const rounded = Math.round(total / 50) * 50;
  return `~${fmt(rounded)}`;
};

const includedItems = [
  'Professional coaching and player development',
  'Team uniforms and branded equipment',
  'Tournament entry fees (varies by team)',
  'Practice facility access',
  'GameChanger live stats and scorekeeping',
  'Player evaluation and progress tracking',
  'Liability insurance coverage',
  'End-of-season awards and recognition',
];

const PricingPage = () => {
  useDocumentTitle('Fees & Pricing');

  const { data: costs, isLoading } = useQuery({
    queryKey: ['costAssumptions', 'global'],
    queryFn: () => costAssumptionsApi.get(),
    staleTime: 10 * 60_000, // Cache for 10 minutes
  });

  const feeCategories = buildFeeCategories(costs);
  const totalEstimate = estimateTotal(costs);
  const seasonLabel = costs?.season || '';

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
            Fees & Pricing
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Transparent breakdown of costs{seasonLabel ? ` for ${seasonLabel}` : ' for the upcoming season'}
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Season Overview Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Season Cost Overview
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Box sx={{ textAlign: 'center', my: 2 }}>
            {isLoading ? (
              <Skeleton variant="text" width={180} height={60} sx={{ mx: 'auto' }} />
            ) : (
              <Typography variant="h3" fontWeight={800} color="primary.main">
                {totalEstimate || '~$1,000'}
              </Typography>
            )}
            <Typography variant="h6" color="text.secondary" sx={{ mt: 0.5 }}>
              per player, per season
            </Typography>
          </Box>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Northern Michigan Waves strives to keep costs affordable while maintaining competitive programs. The
            total cost per player is approximately {totalEstimate || '$1,000'} per season, depending on the number of
            tournaments, age group, and equipment needs. This covers registration, uniforms, facility
            access, coaching, and tournament entry fees.
          </Typography>
          <Chip label="Final cost depends on tournament schedule and team needs" color="warning" variant="outlined" />
        </Paper>

        {/* Fee Categories Section */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {feeCategories.map((category) => (
            <Grid item xs={12} sm={6} key={category.title}>
              <Card sx={{ height: '100%', bgcolor: 'white' }}>
                <CardContent>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      bgcolor: 'primary.light',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 2,
                    }}
                  >
                    {category.icon}
                  </Box>
                  <Typography variant="h6" fontWeight={700} gutterBottom>
                    {category.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {category.description}
                  </Typography>
                  {isLoading ? (
                    <Skeleton variant="rounded" width={140} height={24} />
                  ) : (
                    <Chip label={category.range} color="primary" variant="outlined" size="small" />
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* What's Included Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            What&apos;s Included
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={0}>
            {includedItems.map((item) => (
              <Grid item xs={12} sm={6} key={item}>
                <List disablePadding>
                  <ListItem disableGutters>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <CheckCircleIcon sx={{ color: 'success.main' }} />
                    </ListItemIcon>
                    <ListItemText primary={item} />
                  </ListItem>
                </List>
              </Grid>
            ))}
          </Grid>
        </Paper>

        {/* Payment Information Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Payment Options
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Northern Michigan Waves accepts payments via our secure online portal. Payment plans are available for
            families who need flexibility.
          </Typography>
          <List>
            <ListItem>
              <ListItemText primary="Full payment at registration for best value" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Monthly payment plans available" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Scholarship assistance for qualifying families" />
            </ListItem>
          </List>
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/contact"
            sx={{ mt: 2 }}
          >
            Contact Us About Payment Options
          </Button>
        </Paper>

        {/* Financial Assistance Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, bgcolor: 'secondary.light' }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Scholarships & Financial Assistance
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            At Northern Michigan Waves, no player is turned away due to financial hardship. We believe every young
            athlete deserves the opportunity to compete, grow, and be part of a team. Scholarship
            funds are available to help offset costs for families in need.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            All financial assistance inquiries are handled with complete confidentiality. Please
            reach out to learn more about available options.
          </Typography>
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/contact"
            sx={{ mt: 1 }}
          >
            Inquire About Financial Aid
          </Button>
        </Paper>
      </Container>

      <SponsorBanner mode="carousel" />
    </Box>
  );
};

export default PricingPage;
