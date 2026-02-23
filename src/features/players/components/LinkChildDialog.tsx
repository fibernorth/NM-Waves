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
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import SearchIcon from '@mui/icons-material/Search';
import { useQuery } from '@tanstack/react-query';
import { playersApi } from '@/lib/api/players';
import { usersApi } from '@/lib/api/users';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import type { Player } from '@/types/models';

interface LinkChildDialogProps {
  open: boolean;
  onClose: () => void;
}

const LinkChildDialog = ({ open, onClose }: LinkChildDialogProps) => {
  const { user, refreshUser } = useAuthStore();
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState(false);

  const { data: allPlayers = [], isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
    enabled: open,
  });

  const activePlayers = allPlayers.filter(p => p.active);
  const alreadyLinked = user?.linkedPlayerIds || [];

  // Auto-suggest players whose contact email matches the parent's email
  const emailMatches = activePlayers.filter(p => {
    if (alreadyLinked.includes(p.id)) return false;
    const parentEmail = user?.email?.toLowerCase();
    if (!parentEmail) return false;
    // Check parentEmail field
    if (p.parentEmail?.toLowerCase() === parentEmail) return true;
    // Check contacts array
    return p.contacts.some(c => c.email?.toLowerCase() === parentEmail);
  });

  // Filter by search term
  const searchLower = search.toLowerCase().trim();
  const searchResults = searchLower
    ? activePlayers.filter(p => {
        if (alreadyLinked.includes(p.id)) return false;
        const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
        return fullName.includes(searchLower);
      })
    : [];

  const handleLink = async (player: Player) => {
    if (!user) return;
    setLinking(true);
    try {
      await usersApi.addLinkedPlayer(user.uid, player.id);
      await refreshUser();
      toast.success(`Linked ${player.firstName} ${player.lastName} to your account`);
      onClose();
    } catch (err) {
      console.error('Failed to link child:', err);
      toast.error('Failed to link child. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  const renderPlayerItem = (player: Player, showBadge?: boolean) => (
    <ListItem key={player.id} disablePadding>
      <ListItemButton
        onClick={() => handleLink(player)}
        disabled={linking}
      >
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {player.firstName} {player.lastName}
              {showBadge && (
                <Chip label="Email match" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
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
                  {emailMatches.map(p => renderPlayerItem(p, true))}
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
                autoFocus={emailMatches.length === 0}
              />
            </Box>

            {searchLower && searchResults.length === 0 && (
              <Alert severity="info" sx={{ mt: 1 }}>
                No matching players found.
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
