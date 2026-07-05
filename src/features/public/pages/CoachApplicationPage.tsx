import { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControlLabel,
  Checkbox,
  Alert,
  CircularProgress,
} from '@mui/material';
import SportsIcon from '@mui/icons-material/Sports';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { coachApplicationsApi, type CoachApplicationData } from '@/lib/api/coachApplications';

const empty: CoachApplicationData = {
  name: '',
  email: '',
  phone: '',
  location: '',
  ageGroupsInterested: '',
  coachingExperience: '',
  playingExperience: '',
  certifications: '',
  backgroundCheckConsent: false,
  availability: '',
  whyInterested: '',
};

const CoachApplicationPage = () => {
  useDocumentTitle('Coach Application');
  const [form, setForm] = useState<CoachApplicationData>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof CoachApplicationData) => (value: string | boolean) =>
    setForm((f) => ({ ...f, [field]: value }));

  const canSubmit =
    form.name.trim() && form.email.trim() && form.phone.trim() && form.backgroundCheckConsent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await coachApplicationsApi.create({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
      });
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <SportsIcon color="primary" sx={{ fontSize: 56, mb: 1 }} />
          <Typography variant="h5" gutterBottom>Thank you for applying!</Typography>
          <Typography color="text.secondary">
            We've received your coaching application. A club administrator will review it and reach out.
          </Typography>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Box sx={{ textAlign: 'center', mb: 4 }}>
        <SportsIcon color="primary" sx={{ fontSize: 48 }} />
        <Typography variant="h3" fontWeight={700}>Coach With Us</Typography>
        <Typography color="text.secondary">
          Interested in coaching for the Northern Michigan Waves? Tell us about yourself.
        </Typography>
      </Box>

      <Paper sx={{ p: { xs: 2, sm: 4 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField label="Full Name" fullWidth required value={form.name} onChange={(e) => set('name')(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="City / Town" fullWidth value={form.location} onChange={(e) => set('location')(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Email" type="email" fullWidth required value={form.email} onChange={(e) => set('email')(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField label="Phone" fullWidth required value={form.phone} onChange={(e) => set('phone')(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Age groups you'd like to coach" fullWidth placeholder="e.g. 10U, 12U" value={form.ageGroupsInterested} onChange={(e) => set('ageGroupsInterested')(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Coaching experience" fullWidth multiline minRows={2} value={form.coachingExperience} onChange={(e) => set('coachingExperience')(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Playing experience" fullWidth multiline minRows={2} value={form.playingExperience} onChange={(e) => set('playingExperience')(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Certifications (SafeSport, CPR/First Aid, coaching certs)" fullWidth value={form.certifications} onChange={(e) => set('certifications')(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Availability" fullWidth placeholder="Weeknights, weekends, tournaments…" value={form.availability} onChange={(e) => set('availability')(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Why do you want to coach with us?" fullWidth multiline minRows={2} value={form.whyInterested} onChange={(e) => set('whyInterested')(e.target.value)} />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox checked={form.backgroundCheckConsent} onChange={(e) => set('backgroundCheckConsent')(e.target.checked)} />}
                label="I understand a background check is required to coach, and I consent to one. *"
              />
            </Grid>
          </Grid>
          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" variant="contained" size="large" disabled={!canSubmit || submitting}
              startIcon={submitting ? <CircularProgress size={18} /> : <SportsIcon />}>
              {submitting ? 'Submitting…' : 'Submit Application'}
            </Button>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default CoachApplicationPage;
