import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import CampaignIcon from '@mui/icons-material/Campaign';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '@/lib/api/announcements';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isCoach as checkIsCoach } from '@/lib/auth/roles';
import type { Announcement } from '@/types/models';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import AnnouncementFormDialog from '../components/AnnouncementFormDialog';

const AnnouncementsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isCoach = checkIsCoach(user);

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] =
    useState<Announcement | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>('all');

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => announcementsApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const teamsMap = useMemo(() => {
    const map: Record<string, string> = { all: 'All Teams' };
    teams.forEach((t) => {
      map[t.id] = t.name;
    });
    return map;
  }, [teams]);

  const filteredAnnouncements = useMemo(() => {
    if (teamFilter === 'all') return announcements;
    return announcements.filter(
      (a) => a.teamId === teamFilter || a.teamId === 'all'
    );
  }, [announcements, teamFilter]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement deleted');
    },
    onError: () => {
      toast.error('Failed to delete announcement');
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      announcementsApi.togglePin(id, pinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Pin status updated');
    },
    onError: () => {
      toast.error('Failed to update pin status');
    },
  });

  const handleAdd = () => {
    setSelectedAnnouncement(null);
    setOpenDialog(true);
  };

  const handleEdit = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setOpenDialog(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleTogglePin = (id: string, pinned: boolean) => {
    togglePinMutation.mutate({ id, pinned });
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedAnnouncement(null);
  };

  const truncateBody = (text: string, maxLength = 200): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <CampaignIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4">Announcements</Typography>
        </Box>
        {isCoach && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAdd}
          >
            New Announcement
          </Button>
        )}
      </Box>

      <Box sx={{ mb: 3 }}>
        <TextField
          select
          label="Filter by Team"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="all">All Teams</MenuItem>
          {teams.map((team) => (
            <MenuItem key={team.id} value={team.id}>
              {team.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {filteredAnnouncements.length === 0 && (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 4 }}>
          No announcements found.
        </Typography>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {filteredAnnouncements.map((announcement) => (
          <Card
            key={announcement.id}
            sx={{
              border:
                announcement.priority === 'urgent'
                  ? 2
                  : 1,
              borderStyle: 'solid',
              borderColor:
                announcement.priority === 'urgent'
                  ? 'error.main'
                  : 'divider',
              position: 'relative',
            }}
          >
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  mb: 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {announcement.pinned && (
                    <PushPinIcon
                      fontSize="small"
                      color="primary"
                      sx={{ transform: 'rotate(45deg)' }}
                    />
                  )}
                  <Typography variant="h6">{announcement.title}</Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  {announcement.priority === 'urgent' && (
                    <Chip
                      label="Urgent"
                      color="error"
                      size="small"
                    />
                  )}
                  <Chip
                    label={teamsMap[announcement.teamId] || announcement.teamId}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </Box>

              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mb: 2, whiteSpace: 'pre-wrap' }}
              >
                {truncateBody(announcement.body)}
              </Typography>

              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  By {announcement.createdByName || 'Unknown'} on{' '}
                  {format(announcement.createdAt, 'MMM d, yyyy h:mm a')}
                </Typography>
              </Box>
            </CardContent>

            {isCoach && (
              <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
                <Tooltip
                  title={announcement.pinned ? 'Unpin' : 'Pin'}
                >
                  <IconButton
                    size="small"
                    onClick={() =>
                      handleTogglePin(announcement.id, announcement.pinned)
                    }
                  >
                    {announcement.pinned ? (
                      <PushPinIcon fontSize="small" />
                    ) : (
                      <PushPinOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    onClick={() => handleEdit(announcement)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDelete(announcement.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </CardActions>
            )}
          </Card>
        ))}
      </Box>

      {isCoach && (
        <AnnouncementFormDialog
          open={openDialog}
          onClose={handleCloseDialog}
          announcement={selectedAnnouncement}
        />
      )}
    </Box>
  );
};

export default AnnouncementsPage;
