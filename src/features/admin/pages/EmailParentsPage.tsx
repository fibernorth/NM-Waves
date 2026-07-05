import { useState } from 'react';
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
  Autocomplete,
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import { useQuery, useMutation } from '@tanstack/react-query';
import { emailAllParents, type BroadcastResult } from '@/lib/api/emailBroadcast';
import { teamsApi } from '@/lib/api/teams';
import { playersApi } from '@/lib/api/players';
import type { Team, Player } from '@/types/models';
import toast from 'react-hot-toast';

type Mode = 'all' | 'teams' | 'players';

const EmailParentsPage = () => {
  const [mode, setMode] = useState<Mode>('all');
  const [selectedTeams, setSelectedTeams] = useState<Team[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<BroadcastResult | null>(null);

  const { data: teams = [] } = useQuery({ queryKey: ['activeTeams'], queryFn: () => teamsApi.getActive() });
  const { data: players = [] } = useQuery({ queryKey: ['activePlayers'], queryFn: () => playersApi.getActive() });

  const sendMutation = useMutation({
    mutationFn: () =>
      emailAllParents(subject.trim(), message.trim(), {
        teamIds: mode === 'teams' ? selectedTeams.map((t) => t.id) : [],
        playerIds: mode === 'players' ? selectedPlayers.map((p) => p.id) : [],
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

  const audienceChosen =
    mode === 'all' ||
    (mode === 'teams' && selectedTeams.length > 0) ||
    (mode === 'players' && selectedPlayers.length > 0);
  const canSend = subject.trim().length > 0 && message.trim().length > 0 && audienceChosen;

  const audienceLabel =
    mode === 'all'
      ? "all active players' parents"
      : mode === 'teams'
      ? `parents on ${selectedTeams.length} team${selectedTeams.length === 1 ? '' : 's'}`
      : `parents of ${selectedPlayers.length} player${selectedPlayers.length === 1 ? '' : 's'}`;

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

      <Paper sx={{ p: 3, maxWidth: 700 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Recipients</Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mode}
          onChange={(_, v) => v && setMode(v)}
          sx={{ mb: 2 }}
        >
          <ToggleButton value="all">Everyone</ToggleButton>
          <ToggleButton value="teams">By team</ToggleButton>
          <ToggleButton value="players">Specific players</ToggleButton>
        </ToggleButtonGroup>

        {mode === 'teams' && (
          <Autocomplete
            multiple
            options={teams}
            getOptionLabel={(t) => t.name}
            value={selectedTeams}
            onChange={(_, v) => setSelectedTeams(v)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Select teams" placeholder="Choose one or more teams" />}
            sx={{ mb: 1 }}
          />
        )}

        {mode === 'players' && (
          <Autocomplete
            multiple
            options={players}
            getOptionLabel={(p) => `${p.firstName} ${p.lastName}${p.teamName ? ` (${p.teamName})` : ''}`}
            value={selectedPlayers}
            onChange={(_, v) => setSelectedPlayers(v)}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={(params) => <TextField {...params} label="Select players" placeholder="Search players by name" />}
            sx={{ mb: 1 }}
          />
        )}

        <TextField
          label="Subject"
          fullWidth
          margin="normal"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Practice moved to 5pm on Saturday"
          inputProps={{ maxLength: 150 }}
        />
        <TextField
          label="Message"
          fullWidth
          margin="normal"
          multiline
          minRows={8}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message here..."
          helperText="Plain text. Line breaks are preserved."
        />
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            disabled={!canSend || sendMutation.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            Send
          </Button>
        </Box>
      </Paper>

      <Dialog open={confirmOpen} onClose={() => !sendMutation.isPending && setConfirmOpen(false)}>
        <DialogTitle>Send this message?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will email {audienceLabel}. This can't be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={sendMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending}
            startIcon={sendMutation.isPending ? <CircularProgress size={18} /> : <EmailIcon />}
          >
            {sendMutation.isPending ? 'Sending…' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmailParentsPage;
