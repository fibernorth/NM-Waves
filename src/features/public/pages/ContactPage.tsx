import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ShareIcon from '@mui/icons-material/Share';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const initialFormData: ContactFormData = {
  name: '',
  email: '',
  subject: '',
  message: '',
};

const ContactPage = () => {
  const [formData, setFormData] = useState<ContactFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({});

  const validate = (): boolean => {
    const errors: Partial<Record<keyof ContactFormData, string>> = {};

    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!formData.subject.trim()) {
      errors.subject = 'Subject is required';
    }
    if (!formData.message.trim()) {
      errors.message = 'Message is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (field: keyof ContactFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear field error on change
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validate()) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'contactSubmissions'), {
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        submittedAt: Timestamp.now(),
        status: 'new',
      });
      setSubmitted(true);
      setFormData(initialFormData);
    } catch (err) {
      console.error('Error submitting contact form:', err);
      setError('There was an error sending your message. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

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
            Get in touch with TC Waves Ball Club
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        <Grid container spacing={4}>
          {/* Contact Form */}
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: { xs: 3, md: 4 } }}>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Send Us a Message
              </Typography>
              <Divider sx={{ mb: 3 }} />

              {submitted ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Thank you for your message! We will get back to you as soon as possible.
                </Alert>
              ) : (
                <Box component="form" onSubmit={handleSubmit} noValidate>
                  {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                      {error}
                    </Alert>
                  )}

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Your Name"
                        value={formData.name}
                        onChange={handleChange('name')}
                        error={!!fieldErrors.name}
                        helperText={fieldErrors.name}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        label="Email Address"
                        type="email"
                        value={formData.email}
                        onChange={handleChange('email')}
                        error={!!fieldErrors.email}
                        helperText={fieldErrors.email}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Subject"
                        value={formData.subject}
                        onChange={handleChange('subject')}
                        error={!!fieldErrors.subject}
                        helperText={fieldErrors.subject}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        label="Message"
                        multiline
                        rows={5}
                        value={formData.message}
                        onChange={handleChange('message')}
                        error={!!fieldErrors.message}
                        helperText={fieldErrors.message}
                        required
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={submitting}
                        sx={{ minWidth: 160 }}
                      >
                        {submitting ? <CircularProgress size={24} /> : 'Send Message'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              )}

              {submitted && (
                <Button
                  variant="outlined"
                  onClick={() => setSubmitted(false)}
                  sx={{ mt: 2 }}
                >
                  Send Another Message
                </Button>
              )}
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
                    <Typography variant="body2" color="text.secondary">
                      tcwavessoftball@gmail.com
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
                We typically respond to inquiries within 24-48 hours. For urgent matters,
                please call us directly.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default ContactPage;
