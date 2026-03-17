import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import EmailIcon from '@mui/icons-material/Email';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import CircleIcon from '@mui/icons-material/Circle';
import SponsorBanner from '@/components/common/SponsorBanner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const quickLinks = [
  { label: 'Schedule', to: '/schedule', icon: <CalendarMonthIcon sx={{ fontSize: 32, color: 'primary.main' }} /> },
  { label: 'Pricing', to: '/pricing', icon: <AttachMoneyIcon sx={{ fontSize: 32, color: 'primary.main' }} /> },
  { label: 'Contact', to: '/contact', icon: <EmailIcon sx={{ fontSize: 32, color: 'primary.main' }} /> },
  { label: 'Tryouts', to: '/tryouts', icon: <SportsBaseballIcon sx={{ fontSize: 32, color: 'primary.main' }} /> },
];

const faqItems = [
  {
    question: 'What age groups does TC Waves serve?',
    answer:
      'TC Waves fields teams across multiple age divisions, typically ranging from 10U through 18U. Age groups may vary by season based on player interest and registration numbers.',
  },
  {
    question: 'When does the season start?',
    answer:
      'The competitive season generally runs from April through July, with fall ball options in September-October. Indoor training and tryouts begin in the winter months.',
  },
  {
    question: 'How do tryouts work?',
    answer:
      'Tryouts are held annually, typically in late fall or early winter for the following season. Players are evaluated on hitting, fielding, throwing, and base running. Check our Tryout Registration page for current dates.',
  },
  {
    question: 'What is the time commitment?',
    answer:
      'Teams typically practice 2-3 times per week and play in weekend tournaments. Schedules vary by age group and coaching staff. A full season usually includes 8-12 tournaments.',
  },
  {
    question: 'What equipment do players need to provide?',
    answer:
      'Players should have their own glove, cleats, and batting gloves. TC Waves provides helmets, equipment bags, and team uniforms. Some players may want their own bat, though team bats are available.',
  },
  {
    question: 'How are teams formed?',
    answer:
      'Teams are formed based on tryout evaluations, with the goal of creating competitive and balanced rosters. Coaches consider skill level, position flexibility, and team chemistry.',
  },
  {
    question: 'What is the payment policy?',
    answer:
      'Full payment is due at registration, though payment plans are available. See our Pricing page for detailed fee information. Scholarship assistance is available for qualifying families.',
  },
  {
    question: 'How do we communicate with parents?',
    answer:
      'We use our team management app for announcements, schedules, and messaging. Parents receive email notifications for important updates. Coaches may also use text messaging for urgent matters.',
  },
  {
    question: "What if my daughter can't make a practice or tournament?",
    answer:
      'Communication is key. Please notify the coach as far in advance as possible. We understand that family, school, and other commitments sometimes conflict with the schedule.',
  },
  {
    question: 'Is there a code of conduct?',
    answer:
      'Yes. All players and parents are expected to demonstrate good sportsmanship. We have a zero-tolerance policy for abusive behavior toward coaches, umpires, or other players. See our Terms of Service for details.',
  },
  {
    question: 'What about inclement weather?',
    answer:
      'Games and practices may be cancelled due to weather. Coaches will communicate cancellations via the app. Indoor facilities are used during winter months for training.',
  },
  {
    question: 'How can parents get involved?',
    answer:
      'We welcome parent volunteers! Common roles include scorekeeping, field preparation, fundraising, and tournament logistics. Contact your team\'s coach to learn about volunteer opportunities.',
  },
];

const timelineItems = [
  { period: 'November-December', description: 'Tryouts and team formation' },
  { period: 'January-March', description: 'Indoor training and conditioning' },
  { period: 'April', description: 'Season opener / first tournaments' },
  { period: 'May-June', description: 'Peak tournament schedule' },
  { period: 'July', description: 'Championship events and All-Star showcases' },
  { period: 'August', description: 'Off-season break' },
  { period: 'September-October', description: 'Fall ball (optional)' },
];

const ParentResourcesPage = () => {
  useDocumentTitle('Parent Resources');
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
            Parent Resources
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Everything you need to know about TC Waves
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {/* Quick Links Section */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {quickLinks.map((link) => (
            <Grid item xs={6} sm={3} key={link.label}>
              <Card
                component={RouterLink}
                to={link.to}
                sx={{
                  height: '100%',
                  textDecoration: 'none',
                  textAlign: 'center',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: 4,
                  },
                }}
              >
                <CardContent>
                  {link.icon}
                  <Typography variant="body1" fontWeight={600} sx={{ mt: 1 }}>
                    {link.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* FAQ Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Frequently Asked Questions
          </Typography>
          <Divider sx={{ mb: 3 }} />
          {faqItems.map((item) => (
            <Accordion key={item.question} disableGutters elevation={0}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight={600}>{item.question}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                  {item.answer}
                </Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Paper>

        {/* Communication Guide Section */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Staying Connected
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                App &amp; Portal
              </Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                Our parent portal gives you access to your player&apos;s schedule, team
                announcements, and invoice history. View upcoming events, pay invoices, and stay
                up to date with everything happening across the organization.
              </Typography>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography variant="h6" fontWeight={700} gutterBottom>
                Email &amp; Notifications
              </Typography>
              <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
                Parents receive weekly email updates with schedule changes, important
                announcements, and organization news. Coaches send additional notifications for
                practice updates and game-day information.
              </Typography>
            </Grid>
          </Grid>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
            Sign in to the parent portal at{' '}
            <Typography
              component={RouterLink}
              to="/login"
              variant="body2"
              color="primary.main"
              sx={{ textDecoration: 'underline' }}
            >
              /login
            </Typography>{' '}
            to access your account.
          </Typography>
        </Paper>

        {/* Important Dates Section */}
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h4" fontWeight={600} gutterBottom color="primary.main">
            Typical Season Timeline
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <List>
            {timelineItems.map((item) => (
              <ListItem key={item.period}>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <CircleIcon sx={{ fontSize: 10, color: 'primary.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <>
                      <Typography component="span" fontWeight={700}>
                        {item.period}:
                      </Typography>{' '}
                      {item.description}
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Container>

      <SponsorBanner mode="carousel" />
    </Box>
  );
};

export default ParentResourcesPage;
