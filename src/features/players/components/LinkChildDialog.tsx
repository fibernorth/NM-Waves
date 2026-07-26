import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Typography,
  Box,
  Chip,
  CircularProgress,
  Divider,
  Alert,
  InputAdornment,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import SearchIcon from '@mui/icons-material/Search';
import PhoneIcon from '@mui/icons-material/Phone';
import { useQuery } from '@tanstack/react-query';
import { searchLinkablePlayers, linkChild, type LinkablePlayer } from '@/lib/api/parentActions';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

interface LinkChildDialogProps {
  open: boolean;
  onClose: () => void;
}

/** Keep only the last 10 digits — used to decide when a phone is "complete". */
const phoneDigits = (v: string) => v.replace(/\D/g, '').slice(-10);

const LinkChildDialog = ({ open, onClose }: LinkChildDialogProps) => {
  const { user, firebaseUser, refreshUser, resendVerification } = useAuthStore();
  const [search, setSearch] = useState('');
  const [phone, setPhone] = useState('');
  const [linking, setLinking] = useState(false);
  const [resending, setResending] = useState(false);

  // Linking requires a verified email (enforced server-side). Surface it up
  // front with a resend option rather than only failing on the link attempt.
  const emailVerified = firebaseUser?.emailVerified !== false;

  const handleResend = async () => {
    setResending(true);
    try {
      await resendVerification();
      toast.success('Verification email sent — check your inbox, then reload this page.');
    } catch (e: any) {
      toast.error(e?.message || 'Could not send the verification email.');
    } finally {
      setResending(false);
    }
  };

  const phoneComplete = phoneDigits(phone).length === 10;

  // Search via Cloud Function — returns only non-sensitive fields (no DOB,
  // medical notes, contacts, or emails). Email- and phone-matched children are
  // always returned; other players appear only when a 2+ char search is entered.
  const { data: linkable = [], isLoading } = useQuery({
    queryKey: ['linkablePlayers', search, phoneComplete ? phoneDigits(phone) : ''],
    queryFn: () => searchLinkablePlayers(search, phoneComplete ? phone : undefined),
    enabled: open,
  });

  const alreadyLinked = user?.linkedPlayerIds || [];
  const available = linkable.filter(p => !alreadyLinked.includes(p.id));
  const emailMatches = available.filter(p => p.emailMatch);
  const phoneMatches = available.filter(p => p.phoneMatch && p.claimable);
  const searchLower = search.toLowerCase().trim();
  const searchResults = available.filter(p => !p.emailMatch && !(p.phoneMatch && p.claimable));

  const handleLink = async (player: LinkablePlayer) => {
    if (!user) return;
    // A player with no parent yet + phone match → claim by phone (writes the
    // parent's details onto the player). Email matches link straight through.
    const claimByPhone = !player.emailMatch && player.phoneMatch && player.claimable;
    if (claimByPhone && !phoneComplete) {
      toast.error('Enter your full phone number to claim this player.');
      return;
    }
    setLinking(true);
    try {
      await linkChild(
        claimByPhone
          ? {
              playerId: player.id,
              phone,
              parentName: user.displayName || '',
              parentEmail: user.email || '',
            }
          : player.id
      );
      await refreshUser();
      toast.success(`Linked ${player.firstName} ${player.lastName} to your account`);
      onClose();
    } catch (err: any) {
      console.error('Failed to link child:', err);
      const message = err?.message || 'Failed to link child. Please try again.';
      toast.error(message);
    } finally {
      setLinking(false);
    }
  };

  const renderPlayerItem = (
    player: LinkablePlayer,
    badge?: 'email' | 'phone'
  ) => (
    <ListItem key={player.id} disablePadding>
      <ListItemButton onClick={() => handleLink(player)} disabled={linking}>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {player.firstName} {player.lastName}
              {badge === 'email' && (
                <Chip label="Email match" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
              )}
              {badge === 'phone' && (
                <Chip label="Phone match" size="small" color="info" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
              )}
            </Box>
          }
          secondary={player.teamName || 'Unassigned'}
        />
      </ListItemButton>
    </ListItem>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LinkIcon color="primary" />
        Link a Child
      </DialogTitle>
      <DialogContent>
        {!emailVerified && (
          <Alert
            severity="warning"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={handleResend} disabled={resending}>
                {resending ? 'Sending…' : 'Resend'}
              </Button>
            }
          >
            Verify your email to link your child. Check your inbox for the link, then reload this page.
          </Alert>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          We'll match your child automatically by the email on your account. If your
          child was registered with your phone number, enter it below to find and claim them.
        </Typography>

        <TextField
          label="Your phone number"
          placeholder="(231) 555-0123"
          variant="outlined"
          size="small"
          fullWidth
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          sx={{ mb: 2 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <PhoneIcon color="action" fontSize="small" />
              </InputAdornment>
            ),
          }}
          helperText={
            phone && !phoneComplete ? 'Enter a full 10-digit phone number' : ' '
          }
        />

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {emailMatches.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Suggested (email matches your account)
                </Typography>
                <List dense disablePadding>
                  {emailMatches.map(p => renderPlayerItem(p, 'email'))}
                </List>
                <Divider sx={{ mt: 1 }} />
              </Box>
            )}

            {phoneMatches.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Matches your phone number
                </Typography>
                <List dense disablePadding>
                  {phoneMatches.map(p => renderPlayerItem(p, 'phone'))}
                </List>
                <Divider sx={{ mt: 1 }} />
              </Box>
            )}

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SearchIcon color="action" />
              <TextField
                placeholder="Search players by name..."
                variant="outlined"
                size="small"
                fullWidth
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Box>

            {searchLower && searchResults.length === 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                No matching players found. If you don't see your child, ask your club
                administrator to link your account.
              </Alert>
            )}

            {searchResults.length > 0 && (
              <List dense disablePadding sx={{ maxHeight: 300, overflow: 'auto' }}>
                {searchResults.slice(0, 20).map(p => renderPlayerItem(p))}
                {searchResults.length > 20 && (
                  <Typography variant="caption" color="text.secondary" sx={{ pl: 2 }}>
                    Showing first 20 results. Refine your search.
                  </Typography>
                )}
              </List>
            )}

            {linking && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={linking}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default LinkChildDialog;
