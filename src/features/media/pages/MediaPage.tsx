import { useState, useMemo, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  TextField,
  MenuItem,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Tooltip,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BlockIcon from '@mui/icons-material/Block';
import GoogleIcon from '@mui/icons-material/Google';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import LabelIcon from '@mui/icons-material/Label';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import Checkbox from '@mui/material/Checkbox';
import { mediaApi } from '@/lib/api/media';
import { teamsApi } from '@/lib/api/teams';
import MediaAnalysisPanel from '@/features/media/components/MediaAnalysisPanel';
import { googleDriveApi } from '@/lib/api/googleDrive';
import { appSettingsApi } from '@/lib/api/appSettings';
import { MediaItem } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin, isCoach as checkIsCoach } from '@/lib/auth/roles';

const MediaPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'));

  const isAdmin = checkIsAdmin(user);
  const isCoach = checkIsCoach(user);
  const canUpload = isCoach || user?.permissions?.canUploadMedia;

  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('');
  const [filterAnalysis, setFilterAnalysis] = useState<string>('all');
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Bulk selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTeamId, setBulkTeamId] = useState<string>('');
  const [bulkTagsInput, setBulkTagsInput] = useState<string>('');

  const { data: firebaseMedia = [], isLoading, isError: mediaError } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const { data: integrationSettings } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => appSettingsApi.getIntegrations(),
  });

  const { data: drivePhotos = [] } = useQuery({
    queryKey: ['drivePhotos'],
    queryFn: () => googleDriveApi.listPhotos(),
    enabled: !!integrationSettings?.googleDrive?.enabled,
  });

  // Merge Firebase media with Google Drive photos
  const mediaItems = useMemo(() => {
    const all = [...firebaseMedia, ...drivePhotos];
    return all.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [firebaseMedia, drivePhotos]);

  const deleteMutation = useMutation({
    mutationFn: (item: MediaItem) => mediaApi.delete(item.id, item.fileUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Media deleted successfully');
      setLightboxItem(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete media');
    },
  });

  // Collect all unique tags for tag display
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    mediaItems.forEach((item) => {
      item.tags?.forEach((tag) => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [mediaItems]);

  const filteredMedia = useMemo(() => {
    let result = mediaItems;
    // Non-admins don't see rejected items
    if (!isAdmin) {
      result = result.filter((m) => m.moderationStatus !== 'rejected');
    }
    if (filterTeam !== 'all') {
      result = result.filter((m) => m.teamId === filterTeam);
    }
    if (filterTag.trim()) {
      const tagLower = filterTag.trim().toLowerCase();
      result = result.filter((m) =>
        m.tags?.some((t) => t.toLowerCase().includes(tagLower))
      );
    }
    if (filterAnalysis !== 'all') {
      if (filterAnalysis === 'unanalyzed') {
        result = result.filter((m) => !m.analysisStatus);
      } else {
        result = result.filter((m) => m.analysisStatus === filterAnalysis);
      }
    }
    return result;
  }, [mediaItems, filterTeam, filterTag, filterAnalysis, isAdmin]);

  const updateItemMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<MediaItem, 'tags' | 'showInGallery'>> }) =>
      mediaApi.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update media item');
    },
  });

  const moderationMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'approved' | 'rejected' }) =>
      mediaApi.overrideModeration(id, status, user?.uid || ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Moderation status updated');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update moderation status');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) throw new Error('No items selected');
      const updates: { teamId?: string; teamName?: string; tags?: string[] } = {};
      if (bulkTeamId) {
        updates.teamId = bulkTeamId;
        const team = teams.find((t) => t.id === bulkTeamId);
        updates.teamName = team?.name || '';
      }
      if (bulkTagsInput.trim()) {
        const newTags = bulkTagsInput.split(',').map((t) => t.trim()).filter(Boolean);
        updates.tags = newTags;
      }
      if (!updates.teamId && !updates.tags) throw new Error('Select a team or enter tags');
      await mediaApi.bulkUpdate(ids, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success(`Updated ${selectedIds.size} items`);
      setSelectedIds(new Set());
      setSelectMode(false);
      setBulkTeamId('');
      setBulkTagsInput('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Bulk update failed');
    },
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredMedia.map((m) => m.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkTeamId('');
    setBulkTagsInput('');
  };

  const teamNameMap = useMemo(() => {
    const map: Record<string, string> = { all: 'All Teams' };
    teams.forEach((t) => {
      map[t.id] = t.name;
    });
    return map;
  }, [teams]);

  const getCols = (): number => {
    if (isSmDown) return 1;
    if (isMdDown) return 2;
    return 3;
  };

  const canDeleteItem = (item: MediaItem): boolean => {
    if (isAdmin) return true;
    if (item.uploadedBy === user?.uid) return true;
    return false;
  };

  const handleDelete = (item: MediaItem) => {
    if (window.confirm('Are you sure you want to delete this media item?')) {
      deleteMutation.mutate(item);
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <PhotoLibraryIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4">Media Gallery</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {isAdmin && (
            <Button
              variant={selectMode ? 'contained' : 'outlined'}
              color={selectMode ? 'secondary' : 'primary'}
              startIcon={<SelectAllIcon />}
              onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </Button>
          )}
          {canUpload && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload
            </Button>
          )}
        </Box>
      </Box>

      {/* Analysis Panel (admin only) */}
      {isAdmin && (
        <MediaAnalysisPanel mediaItems={mediaItems} teams={teams} />
      )}

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Filter by Team"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
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
          <TextField
            label="Filter by Tag"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
            placeholder="Type to filter tags..."
          />
          {isAdmin && (
            <TextField
              select
              label="Analysis Status"
              value={filterAnalysis}
              onChange={(e) => setFilterAnalysis(e.target.value)}
              size="small"
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="unanalyzed">Unanalyzed</MenuItem>
              <MenuItem value="analyzed">Analyzed</MenuItem>
              <MenuItem value="pending">Processing</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </TextField>
          )}
        </Box>
        {allTags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
            {allTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant={filterTag === tag ? 'filled' : 'outlined'}
                color={filterTag === tag ? 'primary' : 'default'}
                onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}
      </Paper>

      {/* Bulk Action Bar */}
      {selectMode && (
        <Paper
          sx={{
            p: 2,
            mb: 2,
            bgcolor: 'primary.50',
            border: '2px solid',
            borderColor: 'primary.main',
            position: 'sticky',
            top: 64,
            zIndex: 10,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="subtitle2" sx={{ mr: 1 }}>
              {selectedIds.size} selected
            </Typography>
            <Button size="small" variant="outlined" onClick={selectAll}>
              Select All ({filteredMedia.length})
            </Button>
            <Button size="small" variant="outlined" onClick={deselectAll} disabled={selectedIds.size === 0}>
              Deselect All
            </Button>
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <TextField
              select
              label="Assign Team"
              value={bulkTeamId}
              onChange={(e) => setBulkTeamId(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">-- No Change --</MenuItem>
              <MenuItem value="all">All Teams</MenuItem>
              {teams
                .filter((t) => t.active)
                .map((team) => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Set Tags"
              value={bulkTagsInput}
              onChange={(e) => setBulkTagsInput(e.target.value)}
              size="small"
              sx={{ minWidth: 250 }}
              placeholder="e.g. Archives, Game Day"
              helperText="Comma separated. Replaces existing tags."
            />
            <Button
              variant="contained"
              startIcon={<LabelIcon />}
              onClick={() => bulkUpdateMutation.mutate()}
              disabled={selectedIds.size === 0 || bulkUpdateMutation.isPending || (!bulkTeamId && !bulkTagsInput.trim())}
            >
              {bulkUpdateMutation.isPending ? 'Updating...' : `Apply to ${selectedIds.size}`}
            </Button>
          </Box>
          {allTags.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Quick tags (click to add):
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                {allTags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    variant={bulkTagsInput.split(',').map(t => t.trim()).includes(tag) ? 'filled' : 'outlined'}
                    color={bulkTagsInput.split(',').map(t => t.trim()).includes(tag) ? 'primary' : 'default'}
                    onClick={() => {
                      const current = bulkTagsInput.split(',').map(t => t.trim()).filter(Boolean);
                      if (current.includes(tag)) {
                        setBulkTagsInput(current.filter(t => t !== tag).join(', '));
                      } else {
                        setBulkTagsInput([...current, tag].join(', '));
                      }
                    }}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}
        </Paper>
      )}

      {/* Media Grid */}
      {mediaError ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="error">
            Failed to load media. Please refresh the page.
          </Typography>
        </Paper>
      ) : isLoading ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <LinearProgress />
          <Typography sx={{ mt: 2 }}>Loading media...</Typography>
        </Paper>
      ) : filteredMedia.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {mediaItems.length === 0
              ? 'No media has been uploaded yet.'
              : 'No media matches the current filters.'}
          </Typography>
        </Paper>
      ) : (
        <ImageList cols={getCols()} gap={16}>
          {filteredMedia.map((item) => (
            <ImageListItem
              key={item.id}
              sx={{
                cursor: 'pointer',
                borderRadius: 1,
                overflow: 'hidden',
                boxShadow: 1,
                '&:hover': { boxShadow: 4 },
                transition: 'box-shadow 0.2s, outline 0.15s',
                ...(item.moderationStatus === 'rejected' && {
                  border: '3px solid',
                  borderColor: 'error.main',
                }),
                ...(item.moderationStatus === 'pending' && {
                  border: '2px solid',
                  borderColor: 'warning.main',
                }),
                ...(selectMode && selectedIds.has(item.id) && {
                  outline: '3px solid',
                  outlineColor: 'primary.main',
                  outlineOffset: -1,
                }),
                position: 'relative',
              }}
              onClick={() => selectMode ? toggleSelect(item.id) : setLightboxItem(item)}
            >
              {/* Selection checkbox */}
              {selectMode && (
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  onClick={(e) => e.stopPropagation()}
                  icon={<CheckBoxOutlineBlankIcon />}
                  checkedIcon={<CheckBoxIcon />}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    left: 4,
                    zIndex: 2,
                    bgcolor: 'rgba(255,255,255,0.8)',
                    borderRadius: 1,
                    p: 0.25,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.95)' },
                  }}
                />
              )}
              {item.mediaType === 'video' ? (
                <Box
                  sx={{
                    width: '100%',
                    height: 240,
                    bgcolor: 'grey.900',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <PlayCircleOutlineIcon sx={{ fontSize: 64, color: 'white' }} />
                </Box>
              ) : (
                <img
                  src={item.thumbnailUrl || item.fileUrl}
                  alt={item.caption || item.fileName || 'Media'}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: 240,
                    objectFit: 'cover',
                  }}
                />
              )}
              {/* Moderation badges */}
              {isAdmin && item.moderationStatus === 'rejected' && (
                <Chip
                  label="Flagged"
                  color="error"
                  size="small"
                  sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
                />
              )}
              {isAdmin && item.moderationStatus === 'pending' && (
                <Chip
                  label="Pending"
                  color="warning"
                  size="small"
                  sx={{ position: 'absolute', top: 8, left: 8, zIndex: 1 }}
                />
              )}
              {isAdmin && item.analysisStatus === 'analyzed' && (
                <Chip
                  icon={<AutoFixHighIcon />}
                  label="Analyzed"
                  size="small"
                  color="success"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: selectMode ? 40 : (item.moderationStatus === 'rejected' || item.moderationStatus === 'pending' ? 90 : 8),
                    zIndex: 1,
                    bgcolor: 'rgba(255,255,255,0.85)',
                  }}
                />
              )}
              {item.source === 'google_drive' && (
                <Chip
                  icon={<GoogleIcon />}
                  label="Drive"
                  size="small"
                  sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'rgba(255,255,255,0.85)' }}
                />
              )}
              <ImageListItemBar
                title={item.caption || item.fileName || ''}
                subtitle={
                  <Box>
                    <Typography variant="caption" display="block">
                      {teamNameMap[item.teamId] || (item.teamName || item.teamId)}
                      {item.uploadedByName ? ` - ${item.uploadedByName}` : ''}
                    </Typography>
                    <Typography variant="caption" display="block">
                      {item.createdAt ? format(item.createdAt, 'MM/dd/yyyy') : ''}
                    </Typography>
                    {item.tags && item.tags.length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                        {item.tags.map((tag) => (
                          <Chip
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              bgcolor: 'rgba(255,255,255,0.2)',
                              color: 'white',
                            }}
                          />
                        ))}
                      </Box>
                    )}
                  </Box>
                }
                actionIcon={
                  canDeleteItem(item) ? (
                    <Tooltip title="Delete">
                      <IconButton
                        sx={{ color: 'rgba(255,255,255,0.7)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item);
                        }}
                        size="small"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  ) : undefined
                }
              />
            </ImageListItem>
          ))}
        </ImageList>
      )}

      {/* Lightbox Dialog */}
      <LightboxDialog
        item={lightboxItem}
        onClose={() => setLightboxItem(null)}
        canDelete={lightboxItem ? canDeleteItem(lightboxItem) : false}
        onDelete={handleDelete}
        teamNameMap={teamNameMap}
        isAdmin={isAdmin}
        onModerate={(id, status) => moderationMutation.mutate({ id, status })}
        onUpdateItem={(id, updates) => updateItemMutation.mutate({ id, updates })}
      />

      {/* Upload Dialog */}
      <UploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        teams={teams}
      />
    </Box>
  );
};

// ---- Lightbox Dialog ----

interface LightboxDialogProps {
  item: MediaItem | null;
  onClose: () => void;
  canDelete: boolean;
  onDelete: (item: MediaItem) => void;
  teamNameMap: Record<string, string>;
  isAdmin?: boolean;
  onModerate?: (id: string, status: 'approved' | 'rejected') => void;
  onUpdateItem?: (id: string, updates: Partial<Pick<MediaItem, 'tags' | 'showInGallery'>>) => void;
}

const LightboxDialog = ({ item, onClose, canDelete, onDelete, teamNameMap, isAdmin, onModerate, onUpdateItem }: LightboxDialogProps) => {
  const [editTags, setEditTags] = useState('');
  const [galleryChecked, setGalleryChecked] = useState(false);
  const [tagsChanged, setTagsChanged] = useState(false);

  // Sync local state when item changes
  useEffect(() => {
    if (item) {
      setEditTags(item.tags?.join(', ') || '');
      setGalleryChecked(item.showInGallery ?? false);
      setTagsChanged(false);
    }
  }, [item?.id]);

  if (!item) return null;

  const handleGalleryToggle = () => {
    const newVal = !galleryChecked;
    setGalleryChecked(newVal);
    onUpdateItem?.(item.id, { showInGallery: newVal });
  };

  const handleTagsSave = () => {
    const newTags = editTags.split(',').map((t) => t.trim()).filter(Boolean);
    onUpdateItem?.(item.id, { tags: newTags });
    setTagsChanged(false);
  };

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6" noWrap sx={{ flex: 1 }}>
          {item.caption || item.fileName || 'Media'}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ textAlign: 'center', p: 2 }}>
        {item.mediaType === 'video' ? (
          <video
            src={item.fileUrl}
            controls
            style={{ maxWidth: '100%', maxHeight: '70vh' }}
          />
        ) : (
          <img
            src={item.fileUrl}
            alt={item.caption || item.fileName || 'Media'}
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        )}
        <Box sx={{ mt: 2, textAlign: 'left' }}>
          {/* Gallery checkbox + Tags editor (admin) */}
          {isAdmin && (
            <Box sx={{ mb: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Checkbox
                  checked={galleryChecked}
                  onChange={handleGalleryToggle}
                  size="small"
                />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Show in public gallery
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  label="Tags"
                  value={editTags}
                  onChange={(e) => { setEditTags(e.target.value); setTagsChanged(true); }}
                  size="small"
                  fullWidth
                  helperText="Comma separated"
                />
                {tagsChanged && (
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleTagsSave}
                    sx={{ mt: 0.5, whiteSpace: 'nowrap' }}
                  >
                    Save Tags
                  </Button>
                )}
              </Box>
            </Box>
          )}
          {item.caption && (
            <Typography variant="body1" gutterBottom>
              {item.caption}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary">
            Team: {teamNameMap[item.teamId] || item.teamName || item.teamId}
          </Typography>
          {item.uploadedByName && (
            <Typography variant="body2" color="text.secondary">
              Uploaded by: {item.uploadedByName}
            </Typography>
          )}
          {item.createdAt && (
            <Typography variant="body2" color="text.secondary">
              Date: {format(item.createdAt, 'MMMM d, yyyy')}
            </Typography>
          )}
          {item.tags && item.tags.length > 0 && !isAdmin && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {item.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" />
              ))}
            </Box>
          )}
          {isAdmin && item.analysisStatus === 'analyzed' && (
            <Box sx={{ mt: 2, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Analysis Results
              </Typography>
              {item.detectedLabels && item.detectedLabels.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Labels: {item.detectedLabels.join(', ')}
                </Typography>
              )}
              {item.detectedJerseyNumbers && item.detectedJerseyNumbers.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Jersey numbers: #{item.detectedJerseyNumbers.join(', #')}
                </Typography>
              )}
              {item.suggestedPlayerNames && item.suggestedPlayerNames.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Suggested players: {item.suggestedPlayerNames.join(', ')}
                </Typography>
              )}
              {item.photoDate && (
                <Typography variant="body2" color="text.secondary">
                  Photo date: {format(item.photoDate, 'MMMM d, yyyy')}
                </Typography>
              )}
            </Box>
          )}
        </Box>
      </DialogContent>
      {(canDelete || isAdmin) && (
        <DialogActions>
          {isAdmin && item.moderationStatus === 'rejected' && onModerate && (
            <Button
              color="success"
              startIcon={<CheckCircleIcon />}
              onClick={() => onModerate(item.id, 'approved')}
            >
              Approve
            </Button>
          )}
          {isAdmin && item.moderationStatus === 'approved' && onModerate && (
            <Button
              color="warning"
              startIcon={<BlockIcon />}
              onClick={() => onModerate(item.id, 'rejected')}
            >
              Reject
            </Button>
          )}
          {isAdmin && item.moderationStatus === 'pending' && onModerate && (
            <>
              <Button
                color="success"
                startIcon={<CheckCircleIcon />}
                onClick={() => onModerate(item.id, 'approved')}
              >
                Approve
              </Button>
              <Button
                color="warning"
                startIcon={<BlockIcon />}
                onClick={() => onModerate(item.id, 'rejected')}
              >
                Reject
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => onDelete(item)}
            >
              Delete
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

// ---- Upload Dialog ----

interface UploadDialogProps {
  open: boolean;
  onClose: () => void;
  teams: { id: string; name: string; active: boolean }[];
}

const UploadDialog = ({ open, onClose, teams }: UploadDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string>('all');
  const [caption, setCaption] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const resetForm = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setTeamId('all');
    setCaption('');
    setTagsInput('');
    setUploadProgress(0);
    setIsUploading(false);
  };

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Create preview for images
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('Please select a file');

      setIsUploading(true);
      setUploadProgress(0);

      const { url, thumbnailUrl, fileName, mediaType } = await mediaApi.uploadMedia(
        selectedFile,
        (progress) => setUploadProgress(progress)
      );

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const team = teams.find((t) => t.id === teamId);

      await mediaApi.create({
        fileUrl: url,
        thumbnailUrl,
        fileName,
        teamId,
        teamName: team?.name || (teamId === 'all' ? 'All Teams' : ''),
        uploadedBy: user?.uid || '',
        uploadedByName: user?.displayName || '',
        tags,
        caption: caption.trim() || undefined,
        mediaType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Media uploaded successfully');
      setIsUploading(false);
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload media');
      setIsUploading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }
    uploadMutation.mutate();
  };

  const isBusy = uploadMutation.isPending;

  return (
    <Dialog open={open} onClose={isBusy ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>Upload Media</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* File Input */}
            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="media-file-input"
              />
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
                disabled={isBusy}
                sx={{ py: 1.5 }}
              >
                {selectedFile ? selectedFile.name : 'Select Image or Video *'}
              </Button>
              {!selectedFile && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Accepted: Images (JPG, PNG, GIF, etc.) and Videos (MP4, MOV, etc.)
                </Typography>
              )}
            </Box>

            {/* Preview */}
            {previewUrl && (
              <Box sx={{ textAlign: 'center' }}>
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: 200,
                    objectFit: 'contain',
                    borderRadius: 8,
                  }}
                />
              </Box>
            )}

            {/* Upload Progress */}
            {isUploading && uploadProgress > 0 && (
              <Box>
                <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary">
                  {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Upload complete'}
                </Typography>
              </Box>
            )}

            <TextField
              select
              label="Team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              fullWidth
              required
            >
              <MenuItem value="all">All Teams</MenuItem>
              {teams
                .filter((t) => t.active)
                .map((team) => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name}
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              label="Caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />

            <TextField
              label="Tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              fullWidth
              helperText="Comma separated, e.g.: tournament, action shots, team photo"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isBusy}>
            {isBusy ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default MediaPage;
