import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  FormControlLabel,
  Checkbox,
  Typography,
  IconButton,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { homepagePostsApi } from '@/lib/api/homepagePosts';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import type { HomepagePost, HomepagePostType } from '@/types/models';
import toast from 'react-hot-toast';

const postSchema = z.object({
  type: z.enum(['news', 'announcement', 'photo', 'video', 'score', 'highlight']),
  title: z.string().min(1, 'Title is required'),
  body: z.string().optional(),
  videoUrl: z.string().optional(),
  teamId: z.string().optional(),
  teamName: z.string().optional(),
  opponent: z.string().optional(),
  scoreUs: z.coerce.number().optional(),
  scoreThem: z.coerce.number().optional(),
  gameDate: z.string().optional(),
  result: z.enum(['W', 'L', 'T']).optional(),
  published: z.boolean(),
});

type PostFormData = z.infer<typeof postSchema>;

const ALL_TYPES: { value: HomepagePostType; label: string }[] = [
  { value: 'news', label: 'News Article' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'photo', label: 'Photo' },
  { value: 'video', label: 'Video' },
  { value: 'score', label: 'Score' },
  { value: 'highlight', label: 'Stat Highlight' },
];

const COACH_TYPES: HomepagePostType[] = ['photo', 'video', 'score', 'highlight'];

interface PostFormDialogProps {
  open: boolean;
  onClose: () => void;
  post: HomepagePost | null;
}

const PostFormDialog = ({ open, onClose, post }: PostFormDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [statHighlights, setStatHighlights] = useState<{ playerName: string; stat: string; value: string }[]>([]);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const availableTypes = isAdmin ? ALL_TYPES : ALL_TYPES.filter((t) => COACH_TYPES.includes(t.value));

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<PostFormData>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      type: availableTypes[0]?.value || 'photo',
      title: '',
      body: '',
      videoUrl: '',
      teamId: '',
      teamName: '',
      opponent: '',
      scoreUs: undefined,
      scoreThem: undefined,
      gameDate: '',
      result: undefined,
      published: true,
    },
  });

  const watchType = watch('type');

  useEffect(() => {
    if (post) {
      reset({
        type: post.type,
        title: post.title,
        body: post.body || '',
        videoUrl: post.videoUrl || '',
        teamId: post.teamId || '',
        teamName: post.teamName || '',
        opponent: post.opponent || '',
        scoreUs: post.scoreUs,
        scoreThem: post.scoreThem,
        gameDate: post.gameDate ? new Date(post.gameDate).toISOString().split('T')[0] : '',
        result: post.result,
        published: post.published,
      });
      setStatHighlights(post.statHighlights || []);
      setImagePreview(post.imageUrl || null);
      setImageFile(null);
    } else {
      reset({
        type: availableTypes[0]?.value || 'photo',
        title: '',
        body: '',
        videoUrl: '',
        teamId: '',
        teamName: '',
        opponent: '',
        scoreUs: undefined,
        scoreThem: undefined,
        gameDate: '',
        result: undefined,
        published: true,
      });
      setStatHighlights([]);
      setImagePreview(null);
      setImageFile(null);
    }
  }, [post, reset, availableTypes]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const addHighlight = () => {
    setStatHighlights([...statHighlights, { playerName: '', stat: '', value: '' }]);
  };

  const removeHighlight = (index: number) => {
    setStatHighlights(statHighlights.filter((_, i) => i !== index));
  };

  const updateHighlight = (index: number, field: string, value: string) => {
    const updated = [...statHighlights];
    updated[index] = { ...updated[index], [field]: value };
    setStatHighlights(updated);
  };

  const createMutation = useMutation({
    mutationFn: async (data: PostFormData) => {
      let imageUrl = post?.imageUrl;
      if (imageFile) {
        imageUrl = await homepagePostsApi.uploadImage(imageFile);
      }

      const selectedTeam = teams.find((t) => t.id === data.teamId);

      await homepagePostsApi.create({
        type: data.type,
        title: data.title,
        body: data.body || undefined,
        imageUrl: imageUrl || undefined,
        videoUrl: data.videoUrl || undefined,
        teamId: data.teamId || undefined,
        teamName: selectedTeam?.name || data.teamName || undefined,
        opponent: data.opponent || undefined,
        scoreUs: data.scoreUs,
        scoreThem: data.scoreThem,
        gameDate: data.gameDate ? new Date(data.gameDate) : undefined,
        result: data.result,
        statHighlights: data.type === 'highlight' ? statHighlights : undefined,
        pinned: false,
        published: data.published,
        createdBy: user?.uid || '',
        createdByName: user?.displayName || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepagePosts'] });
      toast.success('Post created');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create post');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PostFormData) => {
      let imageUrl = post?.imageUrl;
      if (imageFile) {
        imageUrl = await homepagePostsApi.uploadImage(imageFile);
      }

      const selectedTeam = teams.find((t) => t.id === data.teamId);

      await homepagePostsApi.update(post!.id, {
        type: data.type,
        title: data.title,
        body: data.body || undefined,
        imageUrl: imageUrl || undefined,
        videoUrl: data.videoUrl || undefined,
        teamId: data.teamId || undefined,
        teamName: selectedTeam?.name || data.teamName || undefined,
        opponent: data.opponent || undefined,
        scoreUs: data.scoreUs,
        scoreThem: data.scoreThem,
        gameDate: data.gameDate ? new Date(data.gameDate) : undefined,
        result: data.result,
        statHighlights: data.type === 'highlight' ? statHighlights : undefined,
        published: data.published,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepagePosts'] });
      toast.success('Post updated');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update post');
    },
  });

  const onSubmit = (data: PostFormData) => {
    if (post) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{post ? 'Edit Post' : 'New Post'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Post Type" fullWidth>
                  {availableTypes.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <TextField
              label="Title"
              {...register('title')}
              error={!!errors.title}
              helperText={errors.title?.message}
              fullWidth
            />

            {['news', 'announcement', 'photo', 'highlight'].includes(watchType) && (
              <TextField
                label="Body"
                {...register('body')}
                fullWidth
                multiline
                rows={4}
              />
            )}

            {['photo', 'news', 'announcement'].includes(watchType) && (
              <Box>
                <Button variant="outlined" component="label">
                  {imagePreview ? 'Change Image' : 'Upload Image'}
                  <input type="file" hidden accept="image/*" onChange={handleImageChange} />
                </Button>
                {imagePreview && (
                  <Box
                    component="img"
                    src={imagePreview}
                    alt="Preview"
                    sx={{ mt: 1, maxWidth: '100%', maxHeight: 200, borderRadius: 1 }}
                  />
                )}
              </Box>
            )}

            {watchType === 'video' && (
              <TextField
                label="Video URL (YouTube, Vimeo, etc.)"
                {...register('videoUrl')}
                fullWidth
                placeholder="https://www.youtube.com/watch?v=..."
              />
            )}

            {watchType === 'score' && (
              <>
                <Controller
                  name="teamId"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select label="Team" fullWidth>
                      <MenuItem value="">Select Team</MenuItem>
                      {teams.map((team) => (
                        <MenuItem key={team.id} value={team.id}>
                          {team.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <TextField label="Opponent" {...register('opponent')} fullWidth />
                <Stack direction="row" spacing={2}>
                  <TextField label="Our Score" type="number" {...register('scoreUs')} fullWidth />
                  <TextField label="Their Score" type="number" {...register('scoreThem')} fullWidth />
                </Stack>
                <TextField
                  label="Game Date"
                  type="date"
                  {...register('gameDate')}
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
                <Controller
                  name="result"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select label="Result" fullWidth>
                      <MenuItem value="W">Win</MenuItem>
                      <MenuItem value="L">Loss</MenuItem>
                      <MenuItem value="T">Tie</MenuItem>
                    </TextField>
                  )}
                />
              </>
            )}

            {watchType === 'highlight' && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="subtitle2">Stat Highlights</Typography>
                  <IconButton size="small" onClick={addHighlight}>
                    <AddIcon />
                  </IconButton>
                </Box>
                {statHighlights.map((h, i) => (
                  <Stack key={i} direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                    <TextField
                      size="small"
                      label="Player"
                      value={h.playerName}
                      onChange={(e) => updateHighlight(i, 'playerName', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label="Stat"
                      value={h.stat}
                      onChange={(e) => updateHighlight(i, 'stat', e.target.value)}
                      sx={{ flex: 1 }}
                    />
                    <TextField
                      size="small"
                      label="Value"
                      value={h.value}
                      onChange={(e) => updateHighlight(i, 'value', e.target.value)}
                      sx={{ width: 80 }}
                    />
                    <IconButton size="small" onClick={() => removeHighlight(i)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                ))}
                {statHighlights.length === 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Click + to add stat highlights
                  </Typography>
                )}
              </Box>
            )}

            <FormControlLabel
              control={
                <Controller
                  name="published"
                  control={control}
                  render={({ field }) => (
                    <Checkbox checked={field.value} onChange={field.onChange} />
                  )}
                />
              }
              label="Published (visible on public homepage)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {post ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PostFormDialog;
