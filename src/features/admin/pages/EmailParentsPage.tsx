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
} from '@mui/material';
import EmailIcon from '@mui/icons-material/Email';
import { useMutation } from '@tanstack/react-query';
import { emailAllParents, type BroadcastResult } from '@/lib/api/emailBroadcast';
import toast from 'react-hot-toast';

const EmailParentsPage = () => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastResult, setLastResult] = useState<BroadcastResult | null>(null);

  const sendMutation = useMutation({
    mutationFn: () => emailAllParents(subject.trim(), message.trim()),
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

  const canSend = subject.trim().length > 0 && message.trim().length > 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <EmailIcon color="primary" />
        <Typography variant="h4">Email All Parents</Typography>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Send a message to every active player's parent/guardian. Recipients are BCC'd, so they
        won't see each other's addresses.
      </Typography>

      {lastResult && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setLastResult(null)}>
          Your message was sent to {lastResult.recipientCount} parent email
          {lastResult.recipientCount === 1 ? '' : 's'}
          {lastResult.queued ? ' (queued — email sending is not fully configured, so it was saved for review).' : '.'}
        </Alert>
      )}

      <Paper sx={{ p: 3, maxWidth: 700 }}>
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
          placeholder="Type your message to all parents here..."
          helperText="Plain text. Line breaks are preserved."
        />
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<EmailIcon />}
            disabled={!canSend || sendMutation.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            Send to All Parents
          </Button>
        </Box>
      </Paper>

      <Dialog open={confirmOpen} onClose={() => !sendMutation.isPending && setConfirmOpen(false)}>
        <DialogTitle>Send this message to all parents?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will email every active player's parent/guardian. This can't be undone.
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
