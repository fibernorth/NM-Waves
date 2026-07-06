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
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { computeLeagueAge, computeDivision } from '@/lib/utils/leagueAge';
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
      valueGetter: (params) => computeLeagueAge(params.row.dateOfBirth),
    },
    {
      field: 'division',
      headerName: 'Division',
      width: 100,
      valueGetter: (params) => computeDivision(params.row.dateOfBirth),
    },
    { field: 'ageGroup', headerName: 'Requested', width: 110 },
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

      {isError ? (
        <Alert severity="error">Failed to load tryout signups.</Alert>
      ) : (
        <Paper sx={{ height: 640, width: '100%' }}>
          <DataGrid
            rows={applicants}
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
    onSuccess: () => { onChanged(); toast.success('Status updated'); },
    onError: (err: any) => toast.error(err?.message || 'Failed to update status'),
  });

  const convert = useMutation({
    mutationFn: async () => {
      const a = applicant!;
      const player: Omit<Player, 'id' | 'createdAt' | 'updatedAt'> = {
        firstName: a.playerFirstName,
        lastName: a.playerLastName,
        dateOfBirth: a.dateOfBirth ? new Date(a.dateOfBirth) : undefined,
        positions: a.positionsInterested ? a.positionsInterested.split(/[,;/]/).map((s) => s.trim()).filter(Boolean) : [],
        contacts: [],
        parentName: a.parentName,
        parentEmail: a.email,
        parentPhone: a.phone,
        emergencyContact: '',
        emergencyPhone: '',
        notes: `From tryout signup. Age group: ${a.ageGroup}. Location: ${a.location}. Experience: ${a.priorExperience}`,
        active: true,
        status: 'active',
      };
      const playerId = await playersApi.create(player);
      await tryoutApplicantsApi.updateStatus(a.id, 'converted', playerId);
    },
    onSuccess: () => { onChanged(); toast.success('Player created from applicant'); onClose(); },
    onError: (err: any) => toast.error(err?.message || 'Failed to convert'),
  });

  if (!applicant) return null;
  const age = computeLeagueAge(applicant.dateOfBirth);
  const division = computeDivision(applicant.dateOfBirth);

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

        <Divider sx={{ my: 2 }}><Typography variant="overline">Evaluations</Typography></Divider>
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
        <Button size="small" onClick={() => setStatus.mutate('invited')} disabled={setStatus.isPending}>Mark Invited</Button>
        <Button size="small" color="error" onClick={() => setStatus.mutate('declined')} disabled={setStatus.isPending}>Decline</Button>
        {isAdmin && applicant.status !== 'converted' && (
          <Button size="small" variant="contained" color="success" onClick={() => convert.mutate()} disabled={convert.isPending}>
            {convert.isPending ? 'Converting…' : 'Convert to Player'}
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
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
