import { Container, Typography, Box, Paper, Divider } from '@mui/material';
import SponsorBanner from '@/components/common/SponsorBanner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const PrivacyPolicyPage = () => {
  useDocumentTitle('Privacy Policy');
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
            Privacy Policy
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            How we collect, use, and protect your information
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Effective Date: January 1, 2024
        </Typography>

        {/* Information We Collect */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Information We Collect
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            We collect the following types of information to operate our youth softball programs
            and manage our organization:
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Personal information provided during registration, including player name,
            parent/guardian contact information, and emergency contacts.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Payment information processed through Stripe — we do not store credit card numbers
            on our servers.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Usage data from our website, including cookies and analytics.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Photos and videos taken at events, with consent.
          </Typography>
        </Paper>

        {/* How We Use Information */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            How We Use Information
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Manage team rosters and player records.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Process payments and generate invoices.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Communicate with parents and players about schedules, events, and announcements.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Emergency contact purposes.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Reporting for nonprofit compliance.
          </Typography>
        </Paper>

        {/* Information Sharing */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Information Sharing
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            We do not sell or rent personal information to third parties.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            We may share information with tournament organizers as required for event registration.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Payment processing is handled through Stripe and is subject to Stripe's privacy policy.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            We may disclose information as required by law or legal process.
          </Typography>
        </Paper>

        {/* Data Security */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Data Security
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            We use industry-standard security measures including Firebase Authentication and
            encrypted data storage.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Payment processing is handled via Stripe's PCI-compliant infrastructure.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Access to player and financial data is restricted to authorized administrators.
          </Typography>
        </Paper>

        {/* Children's Privacy */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Children's Privacy
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            We collect minimal information about minor players, including name, age group, jersey
            number, and positions.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            All data collection for minors requires parental or guardian consent.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Parents may request deletion of their child's information at any time.
          </Typography>
        </Paper>

        {/* Your Rights */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Your Rights
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            You may access, correct, or delete your personal information at any time.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            You may opt out of non-essential communications.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Contact us at tcwavessoftball@gmail.com for any privacy inquiries.
          </Typography>
        </Paper>

        {/* Contact */}
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Contact
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Northern Michigan Waves, Inc.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Traverse City, Michigan
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            tcwavessoftball@gmail.com
          </Typography>
        </Paper>
      </Container>

      <SponsorBanner mode="carousel" />
    </Box>
  );
};

export default PrivacyPolicyPage;
