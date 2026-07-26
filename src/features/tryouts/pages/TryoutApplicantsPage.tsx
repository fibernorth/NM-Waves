import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  Divider,
  Rating,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tryoutApplicantsApi, type TryoutApplicant, type TryoutStatus } from '@/lib/api/tryoutApplicants';
import ProspectSkillTracker from '../components/ProspectSkillTracker';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { computeLeagueAge, computeDivision } from '@/lib/utils/leagueAge';
import { userProvisioningApi } from '@/lib/api/userProvisioning';
import { appSettingsApi } from '@/lib/api/appSettings';
import TryoutSessionsManager from '../components/TryoutSessionsManager';
import type { Player } from '@/types/models';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<TryoutStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  new: 'info',
  evaluated: 'warning',
  invited: 'success',
  declined: 'error',
  converted: 'default',
};

const TryoutApplicantsPage = () => {
  const { user } = useAuthStore();
  const admin = checkIsAdmin(user);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<TryoutApplicant | null>(null);

  const { data: applicants = [], isLoading, isError } = useQuery({
    queryKey: ['tryoutApplicants'],
    queryFn: () => tryoutApplicantsApi.getAll(),
  });

  // Default the view to the current tryout season so next-season coaches land
  // on the relevant signups; they can switch to another season or "All".
  const { data: seasonSettings } = useQuery({
    queryKey: ['appSettings', 'season'],
    queryFn: () => appSettingsApi.getSeason(),
  });
  const tryoutSeason = seasonSettings?.tryoutSeason || '';
  const [seasonFilter, setSeasonFilter] = useState<string>('');
  // Once settings load, adopt the tryout season as the default filter (once).
  if (!seasonFilter && tryoutSeason) setSeasonFilter(tryoutSeason);

  // Season options: every season present on a signup, plus the tryout season.
  const seasonOptions = Array.from(
    new Set([tryoutSeason, ...applicants.map((a) => a.season).filter(Boolean)] as string[])
  ).sort();

  const visibleApplicants = applicants.filter((a) => {
    if (seasonFilter === 'all' || !seasonFilter) return true;
    // Legacy signups with no season show under the current tryout season so
    // they aren't hidden before the backfill stamps a season on them.
    return a.season === seasonFilter || (!a.season && seasonFilter === tryoutSeason);
  });

  const columns: GridColDef<TryoutApplicant>[] = [
    {
      field: 'name',
      headerName: 'Player',
      flex: 1,
      minWidth: 150,
      valueGetter: (params) => `${params.row.playerFirstName} ${params.row.playerLastName}`,
    },
    {
      field: 'age',
      headerName: 'Age (Sept 1)',
      width: 100,
      type: 'number',
      valueGetter: (params) => computeLeagueAge(params.row.dateOfBirth, params.row.season),
    },
    {
      field: 'division',
      headerName: 'Division',
      width: 100,
      valueGetter: (params) => computeDivision(params.row.dateOfBirth, params.row.season),
    },
    { field: 'ageGroup', headerName: 'Requested', width: 110 },
    {
      field: 'season',
      headerName: 'Season',
      width: 110,
      valueGetter: (params) => params.row.season || '',
      renderCell: (params) =>
        params.value ? (
          <span>{params.value}</span>
        ) : (
          <Chip size="small" label="—" variant="outlined" />
        ),
    },
    {
      field: 'sessionLabel',
      headerName: 'Tryout Date',
      flex: 1,
      minWidth: 160,
      valueGetter: (params) => params.row.sessionLabel || '',
      renderCell: (params) =>
        params.value ? (
          <span>{params.value}</span>
        ) : (
          <Chip size="small" label="No date chosen" variant="outlined" color="warning" />
        ),
    },
    { field: 'location', headerName: 'Location', flex: 0.8, minWidth: 130 },
    { field: 'positionsInterested', headerName: 'Positions', flex: 0.8, minWidth: 120 },
    { field: 'priorExperience', headerName: 'Experience', flex: 1.4, minWidth: 200 },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip size="small" label={params.value} color={STATUS_COLORS[params.value as TryoutStatus]} />
      ),
    },
    {
      field: 'submittedAt',
      headerName: 'Submitted',
      width: 120,
      type: 'date',
      valueGetter: (params) => params.row.submittedAt,
    },
    {
      field: 'actions',
      headerName: '',
      width: 130,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Button size="small" variant="outlined" onClick={() => setSelected(params.row)}>
          View / Evaluate
        </Button>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <HowToRegIcon color="primary" />
        <Typography variant="h4">Tryout Signups</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Click any column header to sort (age, location, experience, status…). Use the toolbar to filter or export.
      </Typography>

      <TryoutSessionsManager />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="Season"
          value={seasonFilter || 'all'}
          onChange={(e) => setSeasonFilter(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {seasonOptions.map((s) => (
            <MenuItem key={s} value={s}>
              {s}{s === tryoutSeason ? ' (current tryouts)' : ''}
            </MenuItem>
          ))}
          <MenuItem value="all">All seasons</MenuItem>
        </TextField>
        <Typography variant="body2" color="text.secondary">
          Showing {visibleApplicants.length} of {applicants.length} signups
        </Typography>
      </Box>

      {isError ? (
        <Alert severity="error">Failed to load tryout signups.</Alert>
      ) : (
        <Paper sx={{ height: 640, width: '100%' }}>
          <DataGrid
            rows={visibleApplicants}
            columns={columns}
            loading={isLoading}
            slots={{ toolbar: GridToolbar }}
            slotProps={{ toolbar: { showQuickFilter: true } }}
            initialState={{
              sorting: { sortModel: [{ field: 'submittedAt', sort: 'desc' }] },
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            pageSizeOptions={[25, 50, 100]}
            disableRowSelectionOnClick
          />
        </Paper>
      )}

      <ApplicantDialog
        applicant={selected}
        isAdmin={admin}
        evaluatorId={user?.uid || ''}
        evaluatorName={user?.displayName || user?.email || 'Coach'}
        onClose={() => setSelected(null)}
        onChanged={() => queryClient.invalidateQueries({ queryKey: ['tryoutApplicants'] })}
      />
    </Box>
  );
};

interface DialogProps {
  applicant: TryoutApplicant | null;
  isAdmin: boolean;
  evaluatorId: string;
  evaluatorName: string;
  onClose: () => void;
  onChanged: () => void;
}

const ApplicantDialog = ({ applicant, isAdmin, evaluatorId, evaluatorName, onClose, onChanged }: DialogProps) => {
  const queryClient = useQueryClient();
  const [confirmInvite, setConfirmInvite] = useState(false);
  const [overall, setOverall] = useState<number | null>(0);
  const [hitting, setHitting] = useState<number | null>(0);
  const [fielding, setFielding] = useState<number | null>(0);
  const [throwing, setThrowing] = useState<number | null>(0);
  const [speed, setSpeed] = useState<number | null>(0);
  const [notes, setNotes] = useState('');

  const { data: evaluations = [], isLoading: evalsLoading } = useQuery({
    queryKey: ['tryoutEvals', applicant?.id],
    queryFn: () => tryoutApplicantsApi.getEvaluations(applicant!.id),
    enabled: !!applicant,
  });

  const addEval = useMutation({
    mutationFn: () =>
      tryoutApplicantsApi.addEvaluation(applicant!.id, {
        evaluatorId,
        evaluatorName,
        overallRating: overall || 0,
        hitting: hitting || undefined,
        fielding: fielding || undefined,
        throwing: throwing || undefined,
        speed: speed || undefined,
        notes: notes.trim(),
      }),
    onSuccess: async () => {
      await tryoutApplicantsApi.updateStatus(applicant!.id, 'evaluated');
      queryClient.invalidateQueries({ queryKey: ['tryoutEvals', applicant!.id] });
      onChanged();
      setOverall(0); setHitting(0); setFielding(0); setThrowing(0); setSpeed(0); setNotes('');
      toast.success('Evaluation saved');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save evaluation'),
  });

  const setStatus = useMutation({
    mutationFn: (status: TryoutStatus) => tryoutApplicantsApi.updateStatus(applicant!.id, status),
    onSuccess: () => { setConfirmInvite(false); onChanged(); toast.success('Status updated'); },
    onError: (err: any) => toast.error(err?.message || 'Failed to update status'),
  });

  const sendOffer = useMutation({
    mutationFn: () => tryoutApplicantsApi.sendOffer(applicant!.id),
    onSuccess: (res) => {
      setConfirmInvite(false);
      onChanged();
      toast.success(`Offer email sent to ${res.email} — marked invited`);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to send offer email'),
  });

  const convert = useMutation({
    mutationFn: async () => {
      const a = applicant!;

      // Returning player who registered through the parent portal: the player
      // record already exists — link it instead of creating a duplicate.
      if (a.playerId) {
        await tryoutApplicantsApi.updateStatus(a.id, 'converted', a.playerId);
        return { linked: true };
      }

      // Carry the tryout evaluations onto the player so they aren't stranded
      // on the applicant record.
      const evalSummary = evaluations.length
        ? ` Tryout evals: ${evaluations
            .map((e) => `${e.overallRating}/5 by ${e.evaluatorName}${e.notes ? ` (${e.notes})` : ''}`)
            .join(' | ')}.`
        : '';

      const player: Omit<Player, 'id' | 'createdAt' | 'updatedAt'> = {
        firstName: a.playerFirstName,
        lastName: a.playerLastName,
        dateOfBirth: a.dateOfBirth ? new Date(a.dateOfBirth) : undefined,
        positions: a.positionsInterested ? a.positionsInterested.split(/[,;/]/).map((s) => s.trim()).filter(Boolean) : [],
        // Populate contacts[] — parent provisioning and most contact flows key
        // off this array, so leaving it empty orphaned the family downstream.
        contacts: a.parentName || a.email || a.phone
          ? [{
              name: a.parentName || '',
              relationship: 'Parent/Guardian',
              email: a.email || '',
              phone: a.phone || '',
              isPrimaryContact: true,
              isFinancialParty: true,
            }]
          : [],
        parentName: a.parentName,
        parentEmail: a.email,
        parentPhone: a.phone,
        emergencyContact: '',
        emergencyPhone: '',
        notes: `From tryout signup. Age group: ${a.ageGroup}. Location: ${a.location}. Experience: ${a.priorExperience}.${evalSummary}`,
        active: true,
        status: 'active',
      };
      const playerId = await playersApi.create(player);
      await tryoutApplicantsApi.updateStatus(a.id, 'converted', playerId);

      // Stage the parent for an account (pendingUsers) so they show up in
      // Account Provisioning ready to invite. Best-effort — the conversion
      // itself already succeeded.
      try {
        const created = await playersApi.getById(playerId);
        if (created) await userProvisioningApi.provisionAllContacts(created);
      } catch (err) {
        console.warn('Parent provisioning after convert failed (player created):', err);
      }
      return { linked: false };
    },
    onSuccess: (res) => {
      onChanged();
      toast.success(
        res?.linked
          ? 'Linked to their existing player record'
          : 'Player created — parent staged for an account invite'
      );
      onClose();
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to convert'),
  });

  if (!applicant) return null;
  const age = computeLeagueAge(applicant.dateOfBirth, applicant.season);
  const division = computeDivision(applicant.dateOfBirth, applicant.season);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {applicant.playerFirstName} {applicant.playerLastName}
        <Chip size="small" sx={{ ml: 1 }} label={applicant.status} color={STATUS_COLORS[applicant.status]} />
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Info label="Age (as of Sept 1)" value={age != null ? String(age) : '—'} />
          <Info label="Division" value={division} />
          <Info label="Requested Group" value={applicant.ageGroup} />
          <Info label="Location" value={applicant.location || '—'} />
          <Info label="Positions" value={applicant.positionsInterested || '—'} />
          <Info label="Parent/Guardian" value={applicant.parentName} />
          <Info label="Email" value={applicant.email} />
          <Info label="Phone" value={applicant.phone} />
          <Info label="Experience" value={applicant.priorExperience || '—'} full />
        </Grid>

        <ProspectSkillTracker applicant={applicant} evaluatorId={evaluatorId} />

        <Divider sx={{ my: 2 }}><Typography variant="overline">Quick tryout-day rating</Typography></Divider>
        {evalsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={24} /></Box>
        ) : evaluations.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No evaluations yet.</Typography>
        ) : (
          <List dense>
            {evaluations.map((e) => (
              <ListItem key={e.id} alignItems="flex-start" sx={{ display: 'block' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Rating value={e.overallRating} readOnly size="small" />
                  <Typography variant="caption" color="text.secondary">by {e.evaluatorName}</Typography>
                </Box>
                <ListItemText
                  secondary={[
                    e.hitting ? `Hit ${e.hitting}` : '',
                    e.fielding ? `Field ${e.fielding}` : '',
                    e.throwing ? `Throw ${e.throwing}` : '',
                    e.speed ? `Speed ${e.speed}` : '',
                    e.notes,
                  ].filter(Boolean).join(' · ')}
                />
              </ListItem>
            ))}
          </List>
        )}

        <Divider sx={{ my: 2 }}><Typography variant="overline">Add your evaluation</Typography></Divider>
        <Grid container spacing={2} alignItems="center">
          <RatingField label="Overall" value={overall} onChange={setOverall} />
          <RatingField label="Hitting" value={hitting} onChange={setHitting} />
          <RatingField label="Fielding" value={fielding} onChange={setFielding} />
          <RatingField label="Throwing" value={throwing} onChange={setThrowing} />
          <RatingField label="Speed" value={speed} onChange={setSpeed} />
        </Grid>
        <TextField label="Notes" fullWidth multiline minRows={2} sx={{ mt: 2 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={() => addEval.mutate()} disabled={!overall || addEval.isPending}>
            {addEval.isPending ? 'Saving…' : 'Save Evaluation'}
          </Button>
        </Box>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button size="small" onClick={() => setConfirmInvite(true)} disabled={setStatus.isPending || sendOffer.isPending}>Mark Invited</Button>
        <Button size="small" color="error" onClick={() => setStatus.mutate('declined')} disabled={setStatus.isPending}>Decline</Button>
        {isAdmin && applicant.status !== 'converted' && (
          <Button size="small" variant="contained" color="success" onClick={() => convert.mutate()} disabled={convert.isPending}>
            {convert.isPending ? 'Converting…' : 'Convert to Player'}
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      <Dialog open={confirmInvite} onClose={() => !sendOffer.isPending && setConfirmInvite(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Send offer email?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            Send offer email to {applicant.parentName || 'the parent/guardian'} ({applicant.email || 'no email on file'}) and mark invited?
          </Typography>
          <Button
            size="small"
            sx={{ mt: 2, textTransform: 'none' }}
            onClick={() => setStatus.mutate('invited')}
            disabled={setStatus.isPending || sendOffer.isPending}
          >
            {setStatus.isPending ? 'Marking…' : 'Mark invited without emailing'}
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmInvite(false)} disabled={sendOffer.isPending}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => sendOffer.mutate()}
            disabled={sendOffer.isPending || setStatus.isPending || !applicant.email}
            startIcon={sendOffer.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {sendOffer.isPending ? 'Sending…' : 'Send Offer & Mark Invited'}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

const Info = ({ label, value, full }: { label: string; value: string; full?: boolean }) => (
  <Grid item xs={full ? 12 : 6} sm={full ? 12 : 4}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2">{value}</Typography>
  </Grid>
);

const RatingField = ({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) => (
  <Grid item xs={6} sm={4}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Rating value={value} onChange={(_, v) => onChange(v)} size="small" />
  </Grid>
);

export default TryoutApplicantsPage;
