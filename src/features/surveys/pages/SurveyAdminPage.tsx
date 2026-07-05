import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  Stack,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
} from '@mui/material';
import PollIcon from '@mui/icons-material/Poll';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { surveysApi, surveyResponsesApi } from '@/lib/api/surveys';
import { useAuthStore } from '@/stores/authStore';
import type { Survey, SurveyQuestion, SurveyQuestionType } from '@/types/models';
import toast from 'react-hot-toast';

const newQuestion = (): SurveyQuestion => ({
  id: crypto.randomUUID(),
  text: '',
  type: 'text',
  options: [],
  required: false,
});

const SurveyAdminPage = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<Survey | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([newQuestion()]);
  const [resultsSurvey, setResultsSurvey] = useState<Survey | null>(null);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['allSurveys'],
    queryFn: () => surveysApi.getAll(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['allSurveys'] });

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setQuestions([newQuestion()]);
    setBuilderOpen(true);
  };

  const openEdit = (s: Survey) => {
    setEditing(s);
    setTitle(s.title);
    setDescription(s.description || '');
    setQuestions(s.questions.length ? s.questions : [newQuestion()]);
    setBuilderOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleanQuestions = questions
        .filter((q) => q.text.trim())
        .map((q) => ({
          ...q,
          text: q.text.trim(),
          options: q.type === 'multiple_choice' ? (q.options || []).filter((o) => o.trim()) : [],
        }));
      if (editing) {
        await surveysApi.update(editing.id, { title: title.trim(), description: description.trim(), questions: cleanQuestions });
      } else {
        await surveysApi.create({
          title: title.trim(),
          description: description.trim(),
          questions: cleanQuestions,
          active: false,
          anonymous: true,
          createdBy: user?.uid || '',
        });
      }
    },
    onSuccess: () => {
      invalidate();
      setBuilderOpen(false);
      toast.success(editing ? 'Survey updated' : 'Survey created (inactive — activate it when ready)');
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to save survey'),
  });

  const toggleActive = useMutation({
    mutationFn: (s: Survey) => surveysApi.update(s.id, { active: !s.active }),
    onSuccess: invalidate,
    onError: (err: any) => toast.error(err?.message || 'Failed to update'),
  });

  const removeMutation = useMutation({
    mutationFn: (s: Survey) => surveysApi.remove(s.id),
    onSuccess: () => { invalidate(); toast.success('Survey deleted'); },
    onError: (err: any) => toast.error(err?.message || 'Failed to delete'),
  });

  const canSave = title.trim().length > 0 && questions.some((q) => q.text.trim());

  const updateQuestion = (id: string, patch: Partial<SurveyQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PollIcon color="primary" />
          <Typography variant="h4">Surveys</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          New Survey
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Responses are anonymous and visible only to admins — coaches cannot see them.
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : surveys.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No surveys yet. Create your first one.</Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {surveys.map((s) => (
            <Paper key={s.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Typography variant="h6">{s.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {s.questions.length} question{s.questions.length === 1 ? '' : 's'}
                </Typography>
              </Box>
              <Chip label={s.active ? 'Active' : 'Inactive'} color={s.active ? 'success' : 'default'} size="small" />
              <Button size="small" onClick={() => setResultsSurvey(s)}>Results</Button>
              <Button size="small" onClick={() => openEdit(s)}>Edit</Button>
              <Button size="small" onClick={() => toggleActive.mutate(s)} disabled={toggleActive.isPending}>
                {s.active ? 'Deactivate' : 'Activate'}
              </Button>
              <IconButton size="small" color="error" onClick={() => { if (confirm('Delete this survey? Responses are kept.')) removeMutation.mutate(s); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))}
        </Stack>
      )}

      {/* Builder */}
      <Dialog open={builderOpen} onClose={() => !saveMutation.isPending && setBuilderOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Edit Survey' : 'New Survey'}</DialogTitle>
        <DialogContent dividers>
          <TextField label="Title" fullWidth margin="normal" value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField label="Description (optional)" fullWidth margin="normal" multiline minRows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          <Divider sx={{ my: 2 }}><Typography variant="overline">Questions</Typography></Divider>

          {questions.map((q, idx) => (
            <Paper key={q.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  label={`Question ${idx + 1}`}
                  fullWidth
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                />
                <IconButton color="error" onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))} disabled={questions.length === 1}>
                  <DeleteIcon />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  select
                  label="Type"
                  size="small"
                  sx={{ minWidth: 180 }}
                  value={q.type}
                  onChange={(e) => updateQuestion(q.id, { type: e.target.value as SurveyQuestionType })}
                >
                  <MenuItem value="text">Text answer</MenuItem>
                  <MenuItem value="multiple_choice">Multiple choice</MenuItem>
                  <MenuItem value="rating">Rating (1–5)</MenuItem>
                </TextField>
                <FormControlLabel
                  control={<Checkbox checked={!!q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} />}
                  label="Required"
                />
              </Box>
              {q.type === 'multiple_choice' && (
                <TextField
                  label="Options (one per line)"
                  fullWidth
                  multiline
                  minRows={2}
                  sx={{ mt: 1 }}
                  value={(q.options || []).join('\n')}
                  onChange={(e) => updateQuestion(q.id, { options: e.target.value.split('\n') })}
                  helperText="Enter each choice on its own line"
                />
              )}
            </Paper>
          ))}
          <Button startIcon={<AddIcon />} onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>
            Add question
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuilderOpen(false)} disabled={saveMutation.isPending}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Results */}
      <SurveyResultsDialog survey={resultsSurvey} onClose={() => setResultsSurvey(null)} />
    </Box>
  );
};

const SurveyResultsDialog = ({ survey, onClose }: { survey: Survey | null; onClose: () => void }) => {
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['surveyResponses', survey?.id],
    queryFn: () => surveyResponsesApi.getBySurvey(survey!.id),
    enabled: !!survey,
  });

  return (
    <Dialog open={!!survey} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Results — {survey?.title}
        <Typography variant="body2" color="text.secondary">
          {responses.length} anonymous response{responses.length === 1 ? '' : 's'}
        </Typography>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : responses.length === 0 ? (
          <Typography color="text.secondary">No responses yet.</Typography>
        ) : (
          responses.map((r, i) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="overline" color="text.secondary">Response #{i + 1}</Typography>
              <List dense disablePadding>
                {r.answers.map((a) => (
                  <ListItem key={a.questionId} disablePadding sx={{ display: 'block', py: 0.5 }}>
                    <ListItemText
                      primary={a.questionText}
                      secondary={a.value || '(no answer)'}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          ))
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default SurveyAdminPage;
