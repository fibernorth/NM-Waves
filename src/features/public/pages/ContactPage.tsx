import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  Grid,
  Divider,
} from '@mui/material';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import EmailIcon from '@mui/icons-material/Email';
import ShareIcon from '@mui/icons-material/Share';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import SendIcon from '@mui/icons-material/Send';

const CONTACT_EMAIL = 'tcwavessoftball@gmail.com';

const ContactPage = () => {
  useDocumentTitle('Contact Us');

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
            Contact Us
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Get in touch with Northern Michigan Waves
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Grid container spacing={4}>
          {/* Send Email CTA */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Email Us
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Typography variant="body1" paragraph sx={{ lineHeight: 1.8 }}>
                Have a question about tryouts, fees, schedules, or anything else? We&apos;d love to
                hear from you! Click the button below to send us an email directly.
              </Typography>

              <Typography variant="body1" paragraph sx={{ lineHeight: 1.8, color: 'text.secondary' }}>
                Whether you&apos;re a new family interested in joining, a current parent with
                questions, or a potential sponsor — don&apos;t hesitate to reach out.
              </Typography>

              <Button
                variant="contained"
                size="large"
                startIcon={<SendIcon />}
                href={`mailto:${CONTACT_EMAIL}`}
                sx={{ mt: 2, minWidth: 200 }}
              >
                Email Us
              </Button>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {CONTACT_EMAIL}
              </Typography>
            </Paper>
          </Grid>

          {/* Contact Info */}
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Organization Info
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <LocationOnIcon color="primary" sx={{ mt: 0.25 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Location
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Traverse City, Michigan
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Practice fields and game schedules vary by team
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <EmailIcon color="primary" sx={{ mt: 0.25 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Email
                    </Typography>
                    <Typography
                      variant="body2"
                      component="a"
                      href={`mailto:${CONTACT_EMAIL}`}
                      sx={{ color: 'text.secondary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      {CONTACT_EMAIL}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <ShareIcon color="primary" sx={{ mt: 0.25 }} />
                  <Box>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Social Media
                    </Typography>
                    <Typography
                      variant="body2"
                      component="a"
                      href="https://www.facebook.com/TCWavesBallClub/"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      Facebook: @TCWavesBallClub
                    </Typography>
                    <Typography
                      variant="body2"
                      component="a"
                      href="https://www.instagram.com/tcwavessoftball/"
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: 'text.secondary', display: 'block' }}
                    >
                      Instagram: @tcwavessoftball
                    </Typography>
                  </Box>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="body2" color="text.secondary">
                We typically respond to inquiries within 24-48 hours.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default ContactPage;
