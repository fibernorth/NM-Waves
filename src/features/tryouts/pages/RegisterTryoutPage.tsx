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
import EventIcon from '@mui/icons-material/Event';
import EditIcon from '@mui/icons-material/Edit';
import PlaceIcon from '@mui/icons-material/Place';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playersApi } from '@/lib/api/players';
import { tryoutApplicantsApi, type TryoutApplicantData, type TryoutApplicant } from '@/lib/api/tryoutApplicants';
import { tryoutSessionsApi, sessionLabel, type TryoutSession } from '@/lib/api/tryoutSessions';
import { computeDivision } from '@/lib/utils/leagueAge';
import { useAuthStore } from '@/stores/authStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import type { Player } from '@/types/models';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const AGE_GROUPS = ['8U', '9U', '10U', '11U', '12U', '13U', '14U', '16U', '18U'];

const toDateInput = (d?: Date): string => {
  if (!d) return '';
  try { return d.toISOString().split('T')[0]; } catch { return ''; }
};

/** Match an existing registration to a linked child (by playerId, falling back
 * to name + DOB for registrations made before playerId was stored). */
const findRegistration = (child: Player, regs: TryoutApplicant[]): TryoutApplicant | undefined =>
  regs.find((r) => r.playerId === child.id) ||
  regs.find(
    (r) =>
      r.playerFirstName.trim().toLowerCase() === child.firstName.trim().toLowerCase() &&
      r.playerLastName.trim().toLowerCase() === child.lastName.trim().toLowerCase() &&
      (!r.dateOfBirth || !child.dateOfBirth || r.dateOfBirth === toDateInput(child.dateOfBirth))
  );

const RegisterTryoutPage = () => {
  useDocumentTitle('Register for Tryouts');
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const linkedPlayerIds = user?.linkedPlayerIds || [];
  const email = user?.email || '';

  const [active, setActive] = useState<Player | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TryoutApplicantData | null>(null);

  const { data: children = [], isLoading } = useQuery({
    queryKey: ['linkedChildrenForTryout', ...linkedPlayerIds],
    queryFn: async () => {
      const res = await Promise.all(linkedPlayerIds.map((id) => playersApi.getById(id)));
      return res.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof playersApi.getById>>>[];
    },
    enabled: linkedPlayerIds.length > 0,
  });

  // Existing registrations under this parent's email — so a child can't be
  // signed up twice, and existing signups can be edited.
  const { data: myRegs = [], isLoading: regsLoading } = useQuery({
    queryKey: ['myTryoutRegs', email],
    queryFn: () => tryoutApplicantsApi.getByEmail(email),
    enabled: !!email,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['tryoutSessionsUpcoming'],
    queryFn: () => tryoutSessionsApi.getUpcoming(),
  });

  const openFor = (child: Player, existing?: TryoutApplicant) => {
    setActive(child);
    setEditingId(existing?.id || null);
    setForm(
      existing
        ? {
            playerFirstName: existing.playerFirstName,
            playerLastName: existing.playerLastName,
            dateOfBirth: existing.dateOfBirth,
            ageGroup: existing.ageGroup,
            location: existing.location,
            parentName: existing.parentName,
            email: existing.email,
            phone: existing.phone,
            positionsInterested: existing.positionsInterested,
            priorExperience: existing.priorExperience,
            sessionId: existing.sessionId,
            sessionLabel: existing.sessionLabel,
            playerId: existing.playerId || child.id,
          }
        : {
            playerFirstName: child.firstName,
            playerLastName: child.lastName,
            dateOfBirth: toDateInput(child.dateOfBirth),
            ageGroup: computeDivision(child.dateOfBirth) || '',
            location: '',
            parentName: user?.displayName || child.parentName || '',
            email: email || child.parentEmail || '',
            phone: child.parentPhone || '',
            positionsInterested: (child.positions || []).join(', '),
            priorExperience: 'Returning player',
            playerId: child.id,
          }
    );
  };

  const set = (field: keyof TryoutApplicantData) => (value: string) =>
    setForm((f) => (f ? { ...f, [field]: value } : f));

  const chooseSession = (sessionId: string) => {
    const s = sessions.find((x) => x.id === sessionId);
    setForm((f) => (f ? { ...f, sessionId: s?.id || '', sessionLabel: s ? sessionLabel(s) : '' } : f));
  };

  const submit = useMutation({
    mutationFn: async () => {
      if (editingId) {
        await tryoutApplicantsApi.updateDetails(editingId, form!);
      } else {
        await tryoutApplicantsApi.create(form!);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myTryoutRegs'] });
      toast.success(editingId ? 'Registration updated!' : 'Registered for tryouts!');
      setActive(null);
      setEditingId(null);
      setForm(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save. Please try again.'),
  });

  const canSubmit = !!form && form.location.trim() && form.dateOfBirth && form.ageGroup;

  // Sessions this child is eligible for (empty ageGroups on a session = all).
  const eligibleSessions = (ageGroup: string): TryoutSession[] =>
    sessions.filter((s) => s.ageGroups.length === 0 || s.ageGroups.includes(ageGroup));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <HowToRegIcon color="primary" />
        <Typography variant="h4">Register for Tryouts</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Sign your player up for next season's tryouts. We've pre-filled their details — just confirm and submit.
        Already registered? You can edit the registration or change your tryout date any time.
      </Typography>

      {sessions.length > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, maxWidth: 560 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <EventIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" fontWeight={600}>Tryout dates</Typography>
          </Box>
          {sessions.map((s) => (
            <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <Typography variant="body2" sx={{ minWidth: 130 }}>
                {format(s.date, 'EEE, MMM d, yyyy')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {s.startTime}{s.endTime ? `–${s.endTime}` : ''}
              </Typography>
              {s.location && (
                <Chip icon={<PlaceIcon />} label={s.location} size="small" variant="outlined" />
              )}
              {s.ageGroups.length > 0 && (
                <Typography variant="caption" color="text.secondary">({s.ageGroups.join(', ')})</Typography>
              )}
            </Box>
          ))}
        </Paper>
      )}

      {isLoading || regsLoading ? (
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
            const reg = findRegistration(c, myRegs);
            const needsDate = !!reg && !reg.sessionId && sessions.length > 0;
            return (
              <Card key={c.id}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6">{c.firstName} {c.lastName}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Division: {computeDivision(c.dateOfBirth) || '—'}
                    </Typography>
                    {reg?.sessionLabel && (
                      <Typography variant="body2" color="primary.main" sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <EventIcon fontSize="small" /> {reg.sessionLabel}
                      </Typography>
                    )}
                  </Box>
                  {reg && <Chip color="success" label="Registered" size="small" />}
                  {needsDate && <Chip color="warning" label="Choose a date" size="small" />}
                </CardContent>
                <CardActions>
                  {reg ? (
                    <Button variant="outlined" startIcon={<EditIcon />} onClick={() => openFor(c, reg)}>
                      {needsDate ? 'Choose Tryout Date' : 'Edit Registration'}
                    </Button>
                  ) : (
                    <Button variant="contained" onClick={() => openFor(c)}>
                      Register for Tryouts
                    </Button>
                  )}
                </CardActions>
              </Card>
            );
          })}
        </Box>
      )}

      <Dialog open={!!form} onClose={() => !submit.isPending && setForm(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingId ? `Edit ${active?.firstName}'s Registration` : `Register ${active?.firstName} for Tryouts`}
        </DialogTitle>
        <DialogContent dividers>
          {form && (
            <Grid container spacing={2}>
              {sessions.length > 0 && (
                <Grid item xs={12}>
                  <TextField
                    select
                    label="Tryout date you'll attend"
                    fullWidth
                    value={form.sessionId || ''}
                    onChange={(e) => chooseSession(e.target.value)}
                    helperText={
                      eligibleSessions(form.ageGroup).length === 0
                        ? 'No date restricted to this division — any listed date is fine.'
                        : 'Pick the session that works for your family. You can change it later.'
                    }
                  >
                    <MenuItem value="">Not sure yet</MenuItem>
                    {(eligibleSessions(form.ageGroup).length > 0 ? eligibleSessions(form.ageGroup) : sessions).map((s) => (
                      <MenuItem key={s.id} value={s.id}>{sessionLabel(s)}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
              )}
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
                <TextField
                  label="Email"
                  fullWidth
                  value={form.email}
                  onChange={(e) => set('email')(e.target.value)}
                  helperText={editingId ? 'Changing the email is not allowed on an existing registration.' : undefined}
                  disabled={!!editingId}
                />
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
            {submit.isPending ? 'Saving…' : editingId ? 'Save Changes' : 'Submit Registration'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RegisterTryoutPage;
