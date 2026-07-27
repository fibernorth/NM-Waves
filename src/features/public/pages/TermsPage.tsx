import { Container, Typography, Box, Paper, Divider } from '@mui/material';
import SponsorBanner from '@/components/common/SponsorBanner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const TermsPage = () => {
  useDocumentTitle('Terms of Service');
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
            Terms of Service
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Terms and conditions for using our services
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          Effective Date: January 1, 2024
        </Typography>

        {/* Acceptance of Terms */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Acceptance of Terms
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            By accessing the Northern Michigan Waves website or registering for our programs, you agree to be
            bound by these Terms of Service. If you do not agree to these terms, please do not use
            our services.
          </Typography>
        </Paper>

        {/* Registration & Eligibility */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Registration & Eligibility
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Registration for minor players requires a parent or guardian to complete the enrollment
            process.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            All information provided during registration must be accurate and up to date.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Players and families agree to follow the Northern Michigan Waves code of conduct.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Medical clearance may be required for participation in certain activities.
          </Typography>
        </Paper>

        {/* Fees & Payments */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Fees & Payments
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Program fees are set on a per-season basis and communicated at the time of registration.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Payment plans may be available upon request.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Refund policy: prorated refunds may be issued for withdrawals before the season midpoint.
            No refunds will be issued after the season midpoint.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            All payments are processed securely through Stripe.
          </Typography>
        </Paper>

        {/* Code of Conduct */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Code of Conduct
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Players and parents are expected to demonstrate good sportsmanship at all times.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            All participants must respect officials, coaches, and opponents.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Abusive language, behavior, or unsportsmanlike conduct will not be tolerated.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Violations of the code of conduct may result in suspension or removal from the program.
          </Typography>
        </Paper>

        {/* Assumption of Risk */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Assumption of Risk
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Participation in sports carries inherent risks of injury. Participants and their
            parents or guardians acknowledge and accept these risks.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Northern Michigan Waves carries liability insurance for its programs and activities.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Medical expenses resulting from injuries are the responsibility of the parent or
            guardian.
          </Typography>
        </Paper>

        {/* Media Release */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Media Release
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Northern Michigan Waves may photograph or video record events for promotional and organizational use.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Parents or guardians may opt out of media release by notifying Northern Michigan Waves in writing.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Photos and videos may appear on the Northern Michigan Waves website and social media channels.
          </Typography>
        </Paper>

        {/* Limitation of Liability */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Limitation of Liability
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Northern Michigan Waves is not liable for injuries sustained during activities beyond what
            is covered by our insurance policy.
          </Typography>
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Northern Michigan Waves is not responsible for loss or damage to personal equipment or belongings.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Northern Michigan Waves is not liable for weather-related cancellations or schedule changes.
          </Typography>
        </Paper>

        {/* Intellectual Property */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Intellectual Property
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            The Northern Michigan Waves name, logo, and branding are the property of Northern Michigan Waves, Inc.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Unauthorized use of Northern Michigan Waves intellectual property is prohibited.
          </Typography>
        </Paper>

        {/* Changes to Terms */}
        <Paper sx={{ p: { xs: 3, md: 4 }, mb: 4 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            Changes to Terms
          </Typography>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
            Northern Michigan Waves reserves the right to update these Terms of Service at any time.
          </Typography>
          <Typography variant="body1" sx={{ lineHeight: 1.8 }}>
            Continued use of our website and services following any changes constitutes acceptance
            of the updated terms.
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

export default TermsPage;
