import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  TextField,
  MenuItem,
  Switch,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Alert,
  Autocomplete,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import GroupsIcon from '@mui/icons-material/Groups';
import DownloadIcon from '@mui/icons-material/Download';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  evalEventsApi,
  evalInvitesApi,
  evalScoresApi,
  computeRankings,
  suggestBalancedTeams,
  type EvalEvent,
  type EvalParticipant,
} from '@/lib/api/evaluations';
import { tryoutApplicantsApi } from '@/lib/api/tryoutApplicants';
import { playersApi } from '@/lib/api/players';
import { teamsApi } from '@/lib/api/teams';
import { computeDivision } from '@/lib/utils/leagueAge';
import { useAuthStore } from '@/stores/authStore';
import ScoringBoard from '../components/ScoringBoard';
import PlayerReportDialog from '../components/PlayerReportDialog';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const uuid = () => crypto.randomUUID();

const csvEscape = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const EvaluationEventPage = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [tab, setTab] = useState(0);
  const [reportFor, setReportFor] = useState<string | null>(null);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [teamCount, setTeamCount] = useState(2);

  const { data: event, isLoading } = useQuery({
    queryKey: ['evalEvent', id],
    queryFn: () => evalEventsApi.getById(id),
    enabled: !!id,
  });
  const { data: scores = [] } = useQuery({
    queryKey: ['evalScores', id],
    queryFn: () => evalScoresApi.getByEvent(id),
    enabled: !!id,
    refetchInterval: tab === 2 ? 15000 : false, // live-ish rankings while viewing results
  });
  const { data: invites = [] } = useQuery({
    queryKey: ['evalInvites', id],
    queryFn: () => evalInvitesApi.getByEvent(id),
    enabled: !!id,
  });

  const patch = useMutation({
    mutationFn: (data: Partial<EvalEvent>) => evalEventsApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['evalEvent', id] }),
    onError: (err: any) => toast.error(err?.message || 'Failed to save'),
  });

  const rankings = useMemo(
    () => (event ? computeRankings(event, scores) : []),
    [event, scores]
  );
  const scoredCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of scores) m[s.participantId] = (m[s.participantId] || 0) + 1;
    return m;
  }, [scores]);

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  if (!event) return <Alert severity="error">Evaluation event not found.</Alert>;

  const exportCsv = () => {
    const header = ['Rank', 'Number', 'Name', 'Division', 'Overall', ...event.categories.map((c) => c.name), 'Scores', 'Evaluators'];
    const rows = rankings.map((r, i) => [
      i + 1,
      r.participant.number,
      r.participant.name,
      r.participant.division || '',
      r.overall ?? '',
      ...event.categories.map((c) => r.byCategory[c.id]?.pct ?? ''),
      r.scoreCount,
      r.evaluatorCount,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-rankings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
        <IconButton onClick={() => navigate('/evaluations')}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" sx={{ flexGrow: 1 }}>{event.name}</Typography>
        <Chip label={event.type} size="small" variant="outlined" />
        <Chip
          label={event.status === 'open' ? 'Open for scoring' : event.status === 'closed' ? 'Closed' : 'Draft'}
          color={event.status === 'open' ? 'success' : 'default'}
          size="small"
        />
        {event.status !== 'open' ? (
          <Button size="small" variant="contained" onClick={() => patch.mutate({ status: 'open' })}>Open scoring</Button>
        ) : (
          <Button size="small" onClick={() => patch.mutate({ status: 'closed' })}>Close scoring</Button>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, ml: 6 }}>
        {format(event.date, 'EEEE, MMMM d, yyyy')} · {event.participants.length} participants · {scores.length} scores
      </Typography>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Setup" />
        <Tab label="Score" />
        <Tab label={`Results (${rankings.filter((r) => r.overall != null).length})`} />
      </Tabs>

      {tab === 0 && <SetupTab event={event} invites={invites} onPatch={(d) => patch.mutate(d)} />}

      {tab === 1 && (
        event.status !== 'open' ? (
          <Alert severity="info">Open scoring (top right) to start evaluating.</Alert>
        ) : (
          <ScoringBoard
            eventId={event.id}
            categories={event.categories}
            stations={event.stations}
            participants={event.participants}
            allowMedia
            scoredCounts={scoredCounts}
            onSubmit={async (s) => {
              const cat = event.categories.find((c) => c.skills.some((x) => x.id === s.skillId))!;
              const skill = cat.skills.find((x) => x.id === s.skillId)!;
              const participant = event.participants.find((p) => p.id === s.participantId)!;
              await evalScoresApi.create({
                eventId: event.id,
                participantId: s.participantId,
                participantName: participant.name,
                playerId: participant.playerId,
                skillId: s.skillId,
                skillName: skill.name,
                categoryId: cat.id,
                categoryName: cat.name,
                stationId: s.stationId,
                score: s.score,
                maxScore: skill.scale,
                weight: skill.weight,
                comment: s.comment,
                mediaUrls: s.mediaUrls,
                evaluatorName: user?.displayName || user?.email || 'Coach',
                evaluatorUid: user?.uid,
              });
              queryClient.invalidateQueries({ queryKey: ['evalScores', id] });
            }}
          />
        )
      )}

      {tab === 2 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <Button size="small" startIcon={<DownloadIcon />} onClick={exportCsv} disabled={rankings.length === 0}>
              Export CSV
            </Button>
            <Button size="small" startIcon={<GroupsIcon />} onClick={() => setTeamsOpen(true)} disabled={rankings.length === 0}>
              Suggest balanced teams
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 'auto' }}>
              Rankings refresh live while this tab is open. Click a row for the full report card.
            </Typography>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Player</TableCell>
                  <TableCell>Div</TableCell>
                  <TableCell align="center">Overall</TableCell>
                  {event.categories.map((c) => (
                    <TableCell key={c.id} align="center">{c.name.split(' ')[0]}</TableCell>
                  ))}
                  <TableCell align="center">Evals</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rankings.map((r, i) => (
                  <TableRow key={r.participant.id} hover sx={{ cursor: 'pointer' }} onClick={() => setReportFor(r.participant.id)}>
                    <TableCell>{r.overall != null ? i + 1 : '—'}</TableCell>
                    <TableCell>
                      <b>{r.participant.number || '—'}</b> {r.participant.name}
                    </TableCell>
                    <TableCell>{r.participant.division || ''}</TableCell>
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={r.overall ?? '—'}
                        color={r.overall != null && r.overall >= 70 ? 'success' : r.overall != null ? 'default' : 'default'}
                        sx={{ fontWeight: 700 }}
                      />
                    </TableCell>
                    {event.categories.map((c) => (
                      <TableCell key={c.id} align="center">
                        {r.byCategory[c.id]?.pct ?? '—'}
                      </TableCell>
                    ))}
                    <TableCell align="center">{r.evaluatorCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {reportFor && (
        <PlayerReportDialog
          event={event}
          ranking={rankings.find((r) => r.participant.id === reportFor) || null}
          scores={scores}
          onClose={() => setReportFor(null)}
        />
      )}

      {/* Balanced teams */}
      <Dialog open={teamsOpen} onClose={() => setTeamsOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EmojiEventsIcon color="primary" /> Balanced team suggestion
            <TextField
              select size="small" sx={{ ml: 'auto', width: 120 }} label="Teams"
              value={teamCount} onChange={(e) => setTeamCount(Number(e.target.value))}
            >
              {[2, 3, 4, 5, 6].map((n) => <MenuItem key={n} value={n}>{n} teams</MenuItem>)}
            </TextField>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Snake-drafted from the current rankings so talent spreads evenly. A suggestion — not saved anywhere.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.min(teamCount, 3)}, 1fr)` }, gap: 2 }}>
            {suggestBalancedTeams(rankings, teamCount).map((team, i) => (
              <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
                <Typography variant="subtitle2" gutterBottom>Team {String.fromCharCode(65 + i)}</Typography>
                {team.map((r) => (
                  <Typography key={r.participant.id} variant="body2">
                    <b>{r.participant.number || '—'}</b> {r.participant.name} {r.overall != null ? `(${r.overall})` : ''}
                  </Typography>
                ))}
              </Paper>
            ))}
          </Box>
        </DialogContent>
        <DialogActions><Button onClick={() => setTeamsOpen(false)}>Close</Button></DialogActions>
      </Dialog>
    </Box>
  );
};

// ---------------- Setup tab ----------------

const SetupTab = ({ event, invites, onPatch }: {
  event: EvalEvent;
  invites: Array<{ id: string; token: string; evaluatorName: string; active: boolean }>;
  onPatch: (d: Partial<EvalEvent>) => void;
}) => {
  const queryClient = useQueryClient();
  const [walkOn, setWalkOn] = useState({ name: '', number: '' });
  const [evaluatorName, setEvaluatorName] = useState('');
  const [addApplicantsOpen, setAddApplicantsOpen] = useState(false);
  const [addTeamOpen, setAddTeamOpen] = useState(false);

  const { data: applicants = [] } = useQuery({
    queryKey: ['tryoutApplicants'],
    queryFn: () => tryoutApplicantsApi.getAll(),
    enabled: addApplicantsOpen,
  });
  const { data: players = [] } = useQuery({
    queryKey: ['playersAll'],
    queryFn: () => playersApi.getAll(),
    enabled: addTeamOpen,
  });
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
    enabled: addTeamOpen,
  });
  const [selDivisions, setSelDivisions] = useState<string[]>([]);
  const [selTeam, setSelTeam] = useState<{ id: string; name: string } | null>(null);

  const addParticipants = (items: EvalParticipant[]) => {
    const existingKeys = new Set(
      event.participants.map((p) => p.applicantId || p.playerId || p.id)
    );
    const fresh = items.filter((p) => !existingKeys.has(p.applicantId || p.playerId || p.id));
    if (fresh.length === 0) { toast('Everyone selected is already in this event'); return; }
    // Auto-number continues from the current highest numeric pinnie.
    let next = Math.max(0, ...event.participants.map((p) => parseInt(p.number, 10) || 0)) + 1;
    for (const f of fresh) if (!f.number) f.number = String(next++);
    onPatch({ participants: [...event.participants, ...fresh] });
    toast.success(`Added ${fresh.length} participant${fresh.length === 1 ? '' : 's'}`);
  };

  const updateParticipant = (pid: string, d: Partial<EvalParticipant>) =>
    onPatch({ participants: event.participants.map((p) => (p.id === pid ? { ...p, ...d } : p)) });

  const removeParticipant = (pid: string) =>
    onPatch({ participants: event.participants.filter((p) => p.id !== pid) });

  const addInvite = useMutation({
    mutationFn: () => evalInvitesApi.create(event.id, evaluatorName.trim()),
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ['evalInvites', event.id] });
      setEvaluatorName('');
      navigator.clipboard?.writeText(`${window.location.origin}/evaluate/${inv.token}`).catch(() => {});
      toast.success(`Link created for ${inv.evaluatorName} (copied to clipboard)`);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to create link'),
  });

  const divisions = [...new Set(applicants.map((a) => computeDivision(a.dateOfBirth)).filter(Boolean))].sort();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Stations */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>Stations</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Evaluators pick a station and score its skills. Rename them or add a field location so tryout day runs itself.
        </Typography>
        {event.stations.map((s) => (
          <Box key={s.id} sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
            <TextField
              size="small" label="Station" value={s.name}
              onChange={(e) => onPatch({ stations: event.stations.map((x) => x.id === s.id ? { ...x, name: e.target.value } : x) })}
              sx={{ width: 220 }}
            />
            <TextField
              size="small" label="Location (e.g. Field 2, cage A)" value={s.location || ''}
              onChange={(e) => onPatch({ stations: event.stations.map((x) => x.id === s.id ? { ...x, location: e.target.value } : x) })}
              sx={{ flexGrow: 1, minWidth: 200 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>
              {s.skillIds.length} skills
            </Typography>
          </Box>
        ))}
      </Paper>

      {/* Participants */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" fontWeight={600} sx={{ flexGrow: 1 }}>
            Participants ({event.participants.length})
          </Typography>
          <Button size="small" startIcon={<PersonAddIcon />} onClick={() => setAddApplicantsOpen(true)}>Add tryout signups</Button>
          <Button size="small" startIcon={<GroupsIcon />} onClick={() => setAddTeamOpen(true)}>Add a team</Button>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <TextField size="small" label="Walk-on name" value={walkOn.name} onChange={(e) => setWalkOn((w) => ({ ...w, name: e.target.value }))} />
          <TextField size="small" label="#" sx={{ width: 80 }} value={walkOn.number} onChange={(e) => setWalkOn((w) => ({ ...w, number: e.target.value }))} />
          <Button
            size="small"
            disabled={!walkOn.name.trim()}
            onClick={() => {
              addParticipants([{ id: uuid(), name: walkOn.name.trim(), number: walkOn.number.trim(), checkedIn: true }]);
              setWalkOn({ name: '', number: '' });
            }}
          >
            Add walk-on
          </Button>
        </Box>

        {event.participants.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No participants yet.</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell width={80}>#</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Division</TableCell>
                  <TableCell width={120}>Group</TableCell>
                  <TableCell align="center">Checked in</TableCell>
                  <TableCell width={50} />
                </TableRow>
              </TableHead>
              <TableBody>
                {event.participants.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <TextField variant="standard" value={p.number} sx={{ width: 50 }}
                        onChange={(e) => updateParticipant(p.id, { number: e.target.value })} />
                    </TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>{p.division || ''}</TableCell>
                    <TableCell>
                      <TextField variant="standard" value={p.group || ''} placeholder="A / B…" sx={{ width: 80 }}
                        onChange={(e) => updateParticipant(p.id, { group: e.target.value })} />
                    </TableCell>
                    <TableCell align="center">
                      <Switch size="small" checked={p.checkedIn} onChange={(e) => updateParticipant(p.id, { checkedIn: e.target.checked })} />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" color="error" onClick={() => removeParticipant(p.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Evaluator links */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight={600} gutterBottom>Evaluator links</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Guest evaluators don't need an account — send each one a personal link. Their names appear on every score they enter.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 1.5 }}>
          <TextField size="small" label="Evaluator name" value={evaluatorName} onChange={(e) => setEvaluatorName(e.target.value)} />
          <Button size="small" variant="contained" disabled={!evaluatorName.trim() || addInvite.isPending} onClick={() => addInvite.mutate()}>
            Create link
          </Button>
        </Box>
        {invites.map((inv) => {
          const url = `${window.location.origin}/evaluate/${inv.token}`;
          return (
            <Box key={inv.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5, flexWrap: 'wrap' }}>
              <Chip label={inv.evaluatorName} size="small" color={inv.active ? 'primary' : 'default'} />
              <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {url}
              </Typography>
              <Tooltip title="Copy link">
                <IconButton size="small" onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copied'); }}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Switch size="small" checked={inv.active}
                onChange={(e) => evalInvitesApi.setActive(inv.id, e.target.checked).then(() => queryClient.invalidateQueries({ queryKey: ['evalInvites', event.id] }))} />
            </Box>
          );
        })}
        {invites.length === 0 && <Typography variant="body2" color="text.secondary">No evaluator links yet.</Typography>}
      </Paper>

      {/* Add tryout signups dialog */}
      <Dialog open={addApplicantsOpen} onClose={() => setAddApplicantsOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add tryout signups</DialogTitle>
        <DialogContent>
          <Autocomplete
            multiple options={divisions} value={selDivisions} onChange={(_, v) => setSelDivisions(v)}
            renderInput={(params) => <TextField {...params} label="Divisions (empty = all)" margin="normal" />}
          />
          <Typography variant="caption" color="text.secondary">
            Adds every signup{selDivisions.length ? ` in ${selDivisions.join(', ')}` : ''} not already in the event.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddApplicantsOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => {
            const items = applicants
              .filter((a) => a.status !== 'declined')
              .filter((a) => selDivisions.length === 0 || selDivisions.includes(computeDivision(a.dateOfBirth)))
              .map((a) => ({
                id: uuid(),
                name: `${a.playerFirstName} ${a.playerLastName}`,
                number: '',
                division: computeDivision(a.dateOfBirth) || a.ageGroup,
                checkedIn: false,
                applicantId: a.id,
                playerId: a.playerId,
              }));
            addParticipants(items);
            setAddApplicantsOpen(false);
          }}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add team dialog */}
      <Dialog open={addTeamOpen} onClose={() => setAddTeamOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add a team's players</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={teams} getOptionLabel={(t: any) => t.name} value={selTeam as any}
            onChange={(_, v) => setSelTeam(v)}
            renderInput={(params) => <TextField {...params} label="Team" margin="normal" />}
          />
          <Typography variant="caption" color="text.secondary">
            Great for mid-season evaluations — every player added keeps their link for progress tracking.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddTeamOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!selTeam} onClick={() => {
            const items = players
              .filter((p) => p.teamId === selTeam!.id && p.status !== 'quit')
              .map((p) => ({
                id: uuid(),
                name: `${p.firstName} ${p.lastName}`,
                number: p.jerseyNumber != null ? String(p.jerseyNumber) : '',
                division: computeDivision(p.dateOfBirth) || '',
                checkedIn: false,
                playerId: p.id,
              }));
            addParticipants(items);
            setAddTeamOpen(false);
          }}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EvaluationEventPage;
