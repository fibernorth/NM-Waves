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
import { mediaApi } from '@/lib/api/media';
import { teamsApi } from '@/lib/api/teams';
import { MediaItem } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';

const MediaPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const theme = useTheme();
  const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
  const isMdDown = useMediaQuery(theme.breakpoints.down('md'));

  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';
  const isCoach = user?.role === 'coach' || isAdmin;
  const canUpload = isCoach || user?.permissions?.canUploadMedia;

  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('');
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const { data: mediaItems = [], isLoading } = useQuery({
    queryKey: ['media'],
    queryFn: () => mediaApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (item: MediaItem) => mediaApi.delete(item.id, item.fileUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Media deleted successfully');
      setLightboxItem(null);
    },
    onError: () => {
      toast.error('Failed to delete media');
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
    if (filterTeam !== 'all') {
      result = result.filter((m) => m.teamId === filterTeam);
    }
    if (filterTag.trim()) {
      const tagLower = filterTag.trim().toLowerCase();
      result = result.filter((m) =>
        m.tags?.some((t) => t.toLowerCase().includes(tagLower))
      );
    }
    return result;
  }, [mediaItems, filterTeam, filterTag]);

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

      {/* Media Grid */}
      {isLoading ? (
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
                transition: 'box-shadow 0.2s',
              }}
              onClick={() => setLightboxItem(item)}
            >
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
}

const LightboxDialog = ({ item, onClose, canDelete, onDelete, teamNameMap }: LightboxDialogProps) => {
  if (!item) return null;

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
          {item.tags && item.tags.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {item.tags.map((tag) => (
                <Chip key={tag} label={tag} size="small" />
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>
      {canDelete && (
        <DialogActions>
          <Button
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => onDelete(item)}
          >
            Delete
          </Button>
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

      const { url, fileName, mediaType } = await mediaApi.uploadMedia(
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
