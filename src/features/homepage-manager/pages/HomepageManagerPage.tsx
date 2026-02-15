import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import WebIcon from '@mui/icons-material/Web';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { homepagePostsApi } from '@/lib/api/homepagePosts';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin, isMasterAdmin as checkIsMasterAdmin } from '@/lib/auth/roles';
import type { HomepagePost, HomepagePostType } from '@/types/models';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import PostFormDialog from '../components/PostFormDialog';

const TYPE_LABELS: Record<HomepagePostType, string> = {
  news: 'News',
  announcement: 'Announcement',
  photo: 'Photo',
  video: 'Video',
  score: 'Score',
  highlight: 'Highlight',
};

const TYPE_COLORS: Record<HomepagePostType, 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'error'> = {
  news: 'primary',
  announcement: 'warning',
  photo: 'success',
  video: 'info',
  score: 'error',
  highlight: 'secondary',
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'news', label: 'News' },
  { value: 'announcement', label: 'Announcements' },
  { value: 'photo', label: 'Photos' },
  { value: 'video', label: 'Videos' },
  { value: 'score', label: 'Scores' },
  { value: 'highlight', label: 'Highlights' },
];

const HomepageManagerPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const isMasterAdminUser = checkIsMasterAdmin(user);

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<HomepagePost | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['homepagePosts'],
    queryFn: () => homepagePostsApi.getAll(),
  });

  const filteredPosts = useMemo(() => {
    if (typeFilter === 'all') return posts;
    return posts.filter((p) => p.type === typeFilter);
  }, [posts, typeFilter]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => homepagePostsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepagePosts'] });
      toast.success('Post deleted');
    },
    onError: () => toast.error('Failed to delete post'),
  });

  const togglePinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: string; pinned: boolean }) =>
      homepagePostsApi.togglePin(id, pinned),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepagePosts'] });
      toast.success('Pin status updated');
    },
    onError: () => toast.error('Failed to update pin'),
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) =>
      homepagePostsApi.togglePublish(id, published),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepagePosts'] });
      toast.success('Publish status updated');
    },
    onError: () => toast.error('Failed to update publish status'),
  });

  const handleAdd = () => {
    setSelectedPost(null);
    setOpenDialog(true);
  };

  const handleEdit = (post: HomepagePost) => {
    setSelectedPost(post);
    setOpenDialog(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedPost(null);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <WebIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4">Homepage Manager</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
          New Post
        </Button>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
        {FILTER_OPTIONS.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.label}
            onClick={() => setTypeFilter(opt.value)}
            color={typeFilter === opt.value ? 'primary' : 'default'}
            variant={typeFilter === opt.value ? 'filled' : 'outlined'}
          />
        ))}
      </Stack>

      {filteredPosts.length === 0 ? (
        <Typography variant="body1" color="text.secondary" sx={{ mt: 4 }}>
          No posts found. Create one to get started.
        </Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Published</TableCell>
                <TableCell>Pinned</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPosts.map((post) => (
                <TableRow key={post.id} hover>
                  <TableCell>
                    <Chip
                      label={TYPE_LABELS[post.type]}
                      color={TYPE_COLORS[post.type]}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                      {post.title}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Switch
                        size="small"
                        checked={post.published}
                        onChange={() =>
                          togglePublishMutation.mutate({ id: post.id, published: post.published })
                        }
                      />
                    ) : (
                      <Chip
                        label={post.published ? 'Yes' : 'No'}
                        size="small"
                        color={post.published ? 'success' : 'default'}
                        variant="outlined"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {isAdmin ? (
                      <Tooltip title={post.pinned ? 'Unpin' : 'Pin'}>
                        <IconButton
                          size="small"
                          onClick={() =>
                            togglePinMutation.mutate({ id: post.id, pinned: post.pinned })
                          }
                        >
                          {post.pinned ? (
                            <PushPinIcon fontSize="small" color="primary" />
                          ) : (
                            <PushPinOutlinedIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Tooltip>
                    ) : post.pinned ? (
                      <PushPinIcon fontSize="small" color="primary" />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap>
                      {post.createdByName || 'Unknown'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {format(post.createdAt, 'MMM d, yyyy')}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEdit(post)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {(isMasterAdminUser || (isAdmin && post.createdBy === user?.uid)) && (
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDelete(post.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <PostFormDialog open={openDialog} onClose={handleCloseDialog} post={selectedPost} />
    </Box>
  );
};

export default HomepageManagerPage;
