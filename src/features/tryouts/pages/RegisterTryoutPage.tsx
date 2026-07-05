import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  Grid,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
} from '@mui/material';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import { useQuery, useMutation } from '@tanstack/react-query';
import { playersApi } from '@/lib/api/players';
import { tryoutApplicantsApi, type TryoutApplicantData } from '@/lib/api/tryoutApplicants';
import { computeDivision } from '@/lib/utils/leagueAge';
import { useAuthStore } from '@/stores/authStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Player } from '@/types/models';
import toast from 'react-hot-toast';

const AGE_GROUPS = ['8U', '9U', '10U', '11U', '12U', '13U', '14U', '16U', '18U'];

const toDateInput = (d?: Date): string => {
  if (!d) return '';
  try { return d.toISOString().split('T')[0]; } catch { return ''; }
};

const RegisterTryoutPage = () => {
  useDocumentTitle('Register for Tryouts');
  const { user } = useAuthStore();
  const linkedPlayerIds = user?.linkedPlayerIds || [];
  const [active, setActive] = useState<Player | null>(null);
  const [form, setForm] = useState<TryoutApplicantData | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['linkedChildrenForTryout', ...linkedPlayerIds],
    queryFn: async () => {
      const res = await Promise.all(linkedPlayerIds.map((id) => playersApi.getById(id)));
      return res.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof playersApi.getById>>>[];
    },
    enabled: linkedPlayerIds.length > 0,
  });

  const openFor = (child: Player) => {
    setActive(child);
    setForm({
      playerFirstName: child.firstName,
      playerLastName: child.lastName,
      dateOfBirth: toDateInput(child.dateOfBirth),
      ageGroup: computeDivision(child.dateOfBirth) || '',
      location: '',
      parentName: user?.displayName || child.parentName || '',
      email: user?.email || child.parentEmail || '',
      phone: child.parentPhone || '',
      positionsInterested: (child.positions || []).join(', '),
      priorExperience: 'Returning player',
    });
  };

  const set = (field: keyof TryoutApplicantData) => (value: string) =>
    setForm((f) => (f ? { ...f, [field]: value } : f));

  const submit = useMutation({
    mutationFn: () => tryoutApplicantsApi.create(form!),
    onSuccess: () => {
      if (active) setDoneIds((prev) => new Set(prev).add(active.id));
      toast.success('Registered for tryouts!');
      setActive(null);
      setForm(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to register. Please try again.'),
  });

  const canSubmit = !!form && form.location.trim() && form.dateOfBirth && form.ageGroup;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <HowToRegIcon color="primary" />
        <Typography variant="h4">Register for Tryouts</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Sign your player up for next season's tryouts. We've pre-filled their details — just confirm and submit.
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : children.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No children are linked to your account yet. Link a child from your Dashboard first.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 560 }}>
          {children.map((c) => {
            const done = doneIds.has(c.id);
            return (
              <Card key={c.id}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6">{c.firstName} {c.lastName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Division: {computeDivision(c.dateOfBirth) || '—'}
                    </Typography>
                  </Box>
                  {done && <Chip color="success" label="Registered" size="small" />}
                </CardContent>
                <CardActions>
                  <Button variant="contained" disabled={done} onClick={() => openFor(c)}>
                    {done ? 'Registered' : 'Register for Tryouts'}
                  </Button>
                </CardActions>
              </Card>
            );
          })}
        </Box>
      )}

      <Dialog open={!!form} onClose={() => !submit.isPending && setForm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Register {active?.firstName} for Tryouts</DialogTitle>
        <DialogContent dividers>
          {form && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField label="First Name" fullWidth value={form.playerFirstName} onChange={(e) => set('playerFirstName')(e.target.value)} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Last Name" fullWidth value={form.playerLastName} onChange={(e) => set('playerLastName')(e.target.value)} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Date of Birth" type="date" fullWidth InputLabelProps={{ shrink: true }} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth')(e.target.value)} />
              </Grid>
              <Grid item xs={6}>
                <TextField select label="Age Group / Division" fullWidth value={form.ageGroup} onChange={(e) => set('ageGroup')(e.target.value)}>
                  {AGE_GROUPS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField label="City / Town" fullWidth required value={form.location} onChange={(e) => set('location')(e.target.value)} helperText="Where the player lives" />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Positions" fullWidth value={form.positionsInterested} onChange={(e) => set('positionsInterested')(e.target.value)} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Parent/Guardian" fullWidth value={form.parentName} onChange={(e) => set('parentName')(e.target.value)} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Phone" fullWidth value={form.phone} onChange={(e) => set('phone')(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Email" fullWidth value={form.email} onChange={(e) => set('email')(e.target.value)} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Notes / experience" fullWidth multiline minRows={2} value={form.priorExperience} onChange={(e) => set('priorExperience')(e.target.value)} />
              </Grid>
            </Grid>
          )}
          {!canSubmit && <Alert severity="info" sx={{ mt: 2 }}>Please enter the player's city/town to submit.</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForm(null)} disabled={submit.isPending}>Cancel</Button>
          <Button variant="contained" onClick={() => submit.mutate()} disabled={!canSubmit || submit.isPending}>
            {submit.isPending ? 'Submitting…' : 'Submit Registration'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RegisterTryoutPage;
