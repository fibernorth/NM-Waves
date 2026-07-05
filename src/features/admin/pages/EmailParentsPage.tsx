import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Checkbox,
  FormControlLabel,
  Divider,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useQuery, useMutation } from '@tanstack/react-query';
import { emailAllParents, type BroadcastResult } from '@/lib/api/emailBroadcast';
import { teamsApi } from '@/lib/api/teams';
import { playersApi } from '@/lib/api/players';
import type { Player } from '@/types/models';
import toast from 'react-hot-toast';

type Mode = 'all' | 'choose' | 'tryouts';

const EmailParentsPage = () => {
  const [mode, setMode] = useState<Mode>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<BroadcastResult | null>(null);

  const { data: teams = [] } = useQuery({ queryKey: ['allTeams'], queryFn: () => teamsApi.getAll() });
  const { data: players = [], isLoading: playersLoading } = useQuery({ queryKey: ['allPlayers'], queryFn: () => playersApi.getAll() });

  // Group active (non-quit) players by team.
  const { grouped, noTeam } = useMemo(() => {
    const teamIds = new Set(teams.map((t) => t.id));
    const byTeam = new Map<string, Player[]>();
    const other: Player[] = [];
    for (const p of players) {
      if (p.status === 'quit') continue;
      if (p.teamId && teamIds.has(p.teamId)) {
        const arr = byTeam.get(p.teamId) || [];
        arr.push(p);
        byTeam.set(p.teamId, arr);
      } else {
        other.push(p);
      }
    }
    return { grouped: byTeam, noTeam: other };
  }, [teams, players]);

  const togglePlayer = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleTeam = (teamPlayers: Player[]) =>
    setSelected((prev) => {
      const next = new Set(prev);
      const allIn = teamPlayers.every((p) => next.has(p.id));
      teamPlayers.forEach((p) => (allIn ? next.delete(p.id) : next.add(p.id)));
      return next;
    });

  const sendMutation = useMutation({
    mutationFn: () =>
      emailAllParents(subject.trim(), message.trim(), {
        playerIds: mode === 'choose' ? [...selected] : [],
        tryoutSignups: mode === 'tryouts',
      }),
    onSuccess: (result) => {
      setLastResult(result);
      setConfirmOpen(false);
      setSubject('');
      setMessage('');
      toast.success(`Sent to ${result.recipientCount} parent email${result.recipientCount === 1 ? '' : 's'}`);
    },
    onError: (err: any) => {
      setConfirmOpen(false);
      toast.error(err?.message || 'Failed to send. Please try again.');
    },
  });

  const loadLoginTemplate = () => {
    setSubject('Set up your Northern Michigan Waves parent account');
    setMessage(
      `Hi Waves families,\n\n` +
        `You now have access to the Northern Michigan Waves parent portal, where you can view your player's information, pay invoices, see schedules, take surveys, and register for tryouts.\n\n` +
        `To get started:\n` +
        `1. Go to https://tcw-website-builder.web.app and click "Parent Login".\n` +
        `2. If this is your first time, click "Forgot Password" and enter the email address this message was sent to, then follow the link to set your password.\n` +
        `3. Once you're logged in, open your Dashboard and link your child to your account if it isn't already linked.\n\n` +
        `From your account you can also register your player for next season's tryouts.\n\n` +
        `If you have any trouble, just reply to this email.\n\n` +
        `Go Waves!`
    );
  };

  const audienceChosen = mode === 'all' || mode === 'tryouts' || selected.size > 0;
  const canSend = subject.trim().length > 0 && message.trim().length > 0 && audienceChosen;
  const audienceLabel = mode === 'all'
    ? "all active players' parents"
    : mode === 'tryouts'
    ? 'everyone who registered for tryouts'
    : `parents of ${selected.size} selected player${selected.size === 1 ? '' : 's'}`;

  const renderTeam = (label: string, teamPlayers: Player[]) => {
    if (teamPlayers.length === 0) return null;
    const selCount = teamPlayers.filter((p) => selected.has(p.id)).length;
    const allIn = selCount === teamPlayers.length;
    return (
      <Accordion key={label} disableGutters>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <FormControlLabel
            onClick={(e) => e.stopPropagation()}
            control={
              <Checkbox
                checked={allIn}
                indeterminate={selCount > 0 && !allIn}
                onChange={() => toggleTeam(teamPlayers)}
              />
            }
            label={
              <Typography>
                {label}{' '}
                <Typography component="span" variant="caption" color="text.secondary">
                  ({selCount}/{teamPlayers.length})
                </Typography>
              </Typography>
            }
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', pl: 3 }}>
            {teamPlayers.map((p) => (
              <FormControlLabel
                key={p.id}
                control={<Checkbox size="small" checked={selected.has(p.id)} onChange={() => togglePlayer(p.id)} />}
                label={`${p.firstName} ${p.lastName}`}
              />
            ))}
          </Box>
        </AccordionDetails>
      </Accordion>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <EmailIcon color="primary" />
        <Typography variant="h4">Email Parents</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Send a message to parents/guardians. Recipients are BCC'd, so they won't see each other's addresses.
      </Typography>

      {lastResult && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setLastResult(null)}>
          Your message was sent to {lastResult.recipientCount} parent email
          {lastResult.recipientCount === 1 ? '' : 's'}
          {lastResult.queued ? ' (queued — email sending is not fully configured, so it was saved for review).' : '.'}
        </Alert>
      )}

      <Paper sx={{ p: 3, maxWidth: 720 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Recipients</Typography>
        <ToggleButtonGroup exclusive size="small" value={mode} onChange={(_, v) => v && setMode(v)} sx={{ mb: 2 }}>
          <ToggleButton value="all">Everyone</ToggleButton>
          <ToggleButton value="choose">Choose teams / players</ToggleButton>
          <ToggleButton value="tryouts">Tryout signups</ToggleButton>
        </ToggleButtonGroup>

        {mode === 'choose' && (
          <Box sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            {playersLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
            ) : (
              <>
                <Box sx={{ px: 2, py: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Check whole teams, or expand a team to pick individual players.
                  </Typography>
                  {selected.size > 0 && (
                    <Button size="small" onClick={() => setSelected(new Set())}>Clear ({selected.size})</Button>
                  )}
                </Box>
                <Divider />
                {teams.map((t) => renderTeam(t.name, grouped.get(t.id) || []))}
                {renderTeam('Players without a team', noTeam)}
                {teams.length === 0 && noTeam.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>No players found.</Typography>
                )}
              </>
            )}
          </Box>
        )}

        <Box sx={{ mb: 1 }}>
          <Button size="small" variant="text" onClick={loadLoginTemplate}>
            Insert "portal login setup" template
          </Button>
        </Box>
        <TextField label="Subject" fullWidth margin="normal" value={subject} onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Practice moved to 5pm on Saturday" inputProps={{ maxLength: 150 }} />
        <TextField label="Message" fullWidth margin="normal" multiline minRows={8} value={message} onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..." helperText="Plain text. Line breaks are preserved." />
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" startIcon={<EmailIcon />} disabled={!canSend || sendMutation.isPending} onClick={() => setConfirmOpen(true)}>
            Send
          </Button>
        </Box>
      </Paper>

      <Dialog open={confirmOpen} onClose={() => !sendMutation.isPending && setConfirmOpen(false)}>
        <DialogTitle>Send this message?</DialogTitle>
        <DialogContent>
          <DialogContentText>This will email {audienceLabel}. This can't be undone.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={sendMutation.isPending}>Cancel</Button>
          <Button variant="contained" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}
            startIcon={sendMutation.isPending ? <CircularProgress size={18} /> : <EmailIcon />}>
            {sendMutation.isPending ? 'Sending…' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmailParentsPage;
