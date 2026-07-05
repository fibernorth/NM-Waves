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
  Menu,
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
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
  Tooltip,
} from '@mui/material';
import PollIcon from '@mui/icons-material/Poll';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { surveysApi, surveyResponsesApi } from '@/lib/api/surveys';
import { teamsApi } from '@/lib/api/teams';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { SURVEY_TEMPLATES, type SurveyTemplate } from '@/features/surveys/templates';
import type { Survey, SurveyQuestion, SurveyQuestionType, Team, Player } from '@/types/models';
import toast from 'react-hot-toast';

type Audience = 'all' | 'teams' | 'players';

const newQuestion = (): SurveyQuestion => ({
  id: crypto.randomUUID(),
  text: '',
  type: 'text',
  options: [],
  required: false,
  visibleToCoaches: false,
});

const SurveyAdminPage = () => {
  const { user } = useAuthStore();
  const admin = checkIsAdmin(user);
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<Survey | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<SurveyQuestion[]>([newQuestion()]);
  const [audience, setAudience] = useState<Audience>('all');
  const [selTeams, setSelTeams] = useState<Team[]>([]);
  const [selPlayers, setSelPlayers] = useState<Player[]>([]);
  const [resultsSurvey, setResultsSurvey] = useState<Survey | null>(null);
  const [templateMenuAnchor, setTemplateMenuAnchor] = useState<null | HTMLElement>(null);

  const { data: allSurveys = [], isLoading } = useQuery({
    queryKey: ['allSurveys'],
    queryFn: () => surveysApi.getAll(),
  });
  const { data: teams = [] } = useQuery({ queryKey: ['activeTeams'], queryFn: () => teamsApi.getActive() });
  const { data: players = [] } = useQuery({ queryKey: ['activePlayers'], queryFn: () => playersApi.getActive() });

  // Admins manage all surveys; coaches manage only the ones they created.
  const surveys = admin ? allSurveys : allSurveys.filter((s) => s.createdBy === user?.uid);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['allSurveys'] });

  const resetBuilder = () => {
    setTitle('');
    setDescription('');
    setQuestions([newQuestion()]);
    setAudience('all');
    setSelTeams([]);
    setSelPlayers([]);
  };

  const openNew = () => { setEditing(null); resetBuilder(); setBuilderOpen(true); };

  const openFromTemplate = (tpl: SurveyTemplate) => {
    setEditing(null);
    setTitle(tpl.title);
    setDescription(tpl.description);
    setQuestions(
      tpl.questions.map((q) => ({
        id: crypto.randomUUID(),
        text: q.text,
        type: q.type,
        options: q.options || [],
        required: q.required || false,
        visibleToCoaches: q.visibleToCoaches || false,
      }))
    );
    setAudience('all');
    setSelTeams([]);
    setSelPlayers([]);
    setTemplateMenuAnchor(null);
    setBuilderOpen(true);
  };

  const openEdit = (s: Survey) => {
    setEditing(s);
    setTitle(s.title);
    setDescription(s.description || '');
    setQuestions(s.questions.length ? s.questions : [newQuestion()]);
    const hasTeams = (s.assignedTeamIds?.length || 0) > 0;
    const hasPlayers = (s.assignedPlayerIds?.length || 0) > 0;
    setAudience(hasPlayers ? 'players' : hasTeams ? 'teams' : 'all');
    setSelTeams(teams.filter((t) => s.assignedTeamIds?.includes(t.id)));
    setSelPlayers(players.filter((p) => s.assignedPlayerIds?.includes(p.id)));
    setBuilderOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const cleanQuestions = questions
        .filter((q) => q.text.trim())
        .map((q) => ({
          ...q,
          text: q.text.trim(),
          options: q.type === 'multiple_choice' || q.type === 'checkbox' ? (q.options || []).filter((o) => o.trim()) : [],
        }));
      const assignedTeamIds = audience === 'teams' ? selTeams.map((t) => t.id) : [];
      const assignedPlayerIds = audience === 'players' ? selPlayers.map((p) => p.id) : [];
      if (editing) {
        await surveysApi.update(editing.id, {
          title: title.trim(),
          description: description.trim(),
          questions: cleanQuestions,
          assignedTeamIds,
          assignedPlayerIds,
        });
      } else {
        await surveysApi.create({
          title: title.trim(),
          description: description.trim(),
          questions: cleanQuestions,
          active: false,
          anonymous: true,
          assignedTeamIds,
          assignedPlayerIds,
          createdBy: user?.uid || '',
          createdByRole: admin ? 'admin' : 'coach',
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

  const canSave =
    title.trim().length > 0 &&
    questions.some((q) => q.text.trim()) &&
    (audience === 'all' || (audience === 'teams' && selTeams.length > 0) || (audience === 'players' && selPlayers.length > 0));

  const updateQuestion = (id: string, patch: Partial<SurveyQuestion>) =>
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const audienceText = (s: Survey) => {
    if ((s.assignedTeamIds?.length || 0) === 0 && (s.assignedPlayerIds?.length || 0) === 0) return 'Everyone';
    const parts: string[] = [];
    if (s.assignedTeamIds?.length) parts.push(`${s.assignedTeamIds.length} team${s.assignedTeamIds.length === 1 ? '' : 's'}`);
    if (s.assignedPlayerIds?.length) parts.push(`${s.assignedPlayerIds.length} player${s.assignedPlayerIds.length === 1 ? '' : 's'}`);
    return parts.join(' + ');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PollIcon color="primary" />
          <Typography variant="h4">Surveys</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}>
            New from Template
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>New Survey</Button>
          <Menu anchorEl={templateMenuAnchor} open={!!templateMenuAnchor} onClose={() => setTemplateMenuAnchor(null)}>
            {SURVEY_TEMPLATES.map((tpl) => (
              <MenuItem key={tpl.key} onClick={() => openFromTemplate(tpl)}>{tpl.name}</MenuItem>
            ))}
          </Menu>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Responses are anonymous. Admins see all answers; a coach who creates a survey sees only the answers to
        questions they mark &ldquo;coaches can see.&rdquo;
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
            <Paper key={s.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Typography variant="h6">{s.title}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {s.questions.length} question{s.questions.length === 1 ? '' : 's'} · To: {audienceText(s)}
                </Typography>
              </Box>
              <Chip label={s.active ? 'Active' : 'Inactive'} color={s.active ? 'success' : 'default'} size="small" />
              <Button size="small" onClick={() => setResultsSurvey(s)}>Results</Button>
              <Button size="small" onClick={() => openEdit(s)}>Edit</Button>
              <Button size="small" onClick={() => toggleActive.mutate(s)} disabled={toggleActive.isPending}>
                {s.active ? 'Deactivate' : 'Activate'}
              </Button>
              <IconButton size="small" color="error" onClick={() => { if (confirm('Delete this survey?')) removeMutation.mutate(s); }}>
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

          <Divider sx={{ my: 2 }}><Typography variant="overline">Who receives it</Typography></Divider>
          <ToggleButtonGroup exclusive size="small" value={audience} onChange={(_, v) => v && setAudience(v)} sx={{ mb: 1 }}>
            <ToggleButton value="all">Everyone</ToggleButton>
            <ToggleButton value="teams">Specific teams</ToggleButton>
            <ToggleButton value="players">Specific players</ToggleButton>
          </ToggleButtonGroup>
          {audience === 'teams' && (
            <Autocomplete
              multiple options={teams} getOptionLabel={(t) => t.name} value={selTeams}
              onChange={(_, v) => setSelTeams(v)} isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label="Select teams" />} sx={{ mb: 1 }}
            />
          )}
          {audience === 'players' && (
            <Autocomplete
              multiple options={players} getOptionLabel={(p) => `${p.firstName} ${p.lastName}${p.teamName ? ` (${p.teamName})` : ''}`}
              value={selPlayers} onChange={(_, v) => setSelPlayers(v)} isOptionEqualToValue={(a, b) => a.id === b.id}
              renderInput={(params) => <TextField {...params} label="Select players" />} sx={{ mb: 1 }}
            />
          )}

          <Divider sx={{ my: 2 }}><Typography variant="overline">Questions</Typography></Divider>
          {questions.map((q, idx) => (
            <Paper key={q.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField label={`Question ${idx + 1}`} fullWidth value={q.text} onChange={(e) => updateQuestion(q.id, { text: e.target.value })} />
                <IconButton color="error" onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))} disabled={questions.length === 1}>
                  <DeleteIcon />
                </IconButton>
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField select label="Type" size="small" sx={{ minWidth: 170 }} value={q.type}
                  onChange={(e) => updateQuestion(q.id, { type: e.target.value as SurveyQuestionType })}>
                  <MenuItem value="text">Text answer</MenuItem>
                  <MenuItem value="multiple_choice">Multiple choice (pick one)</MenuItem>
                  <MenuItem value="checkbox">Checkboxes (pick many)</MenuItem>
                  <MenuItem value="rating">Rating (1–5)</MenuItem>
                </TextField>
                <FormControlLabel
                  control={<Checkbox checked={!!q.required} onChange={(e) => updateQuestion(q.id, { required: e.target.checked })} />}
                  label="Required"
                />
                <Tooltip title="If off, only admins can see answers to this question. If on, the coach who created the survey can see them too.">
                  <FormControlLabel
                    control={<Checkbox icon={<VisibilityIcon color="disabled" />} checkedIcon={<VisibilityIcon color="primary" />} checked={!!q.visibleToCoaches} onChange={(e) => updateQuestion(q.id, { visibleToCoaches: e.target.checked })} />}
                    label="Coaches can see answers"
                  />
                </Tooltip>
              </Box>
              {(q.type === 'multiple_choice' || q.type === 'checkbox') && (
                <TextField label="Options (one per line)" fullWidth multiline minRows={2} sx={{ mt: 1 }}
                  value={(q.options || []).join('\n')} onChange={(e) => updateQuestion(q.id, { options: e.target.value.split('\n') })}
                  helperText="Enter each choice on its own line" />
              )}
            </Paper>
          ))}
          <Button startIcon={<AddIcon />} onClick={() => setQuestions((qs) => [...qs, newQuestion()])}>Add question</Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBuilderOpen(false)} disabled={saveMutation.isPending}>Cancel</Button>
          <Button variant="contained" onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <SurveyResultsDialog survey={resultsSurvey} isAdmin={admin} onClose={() => setResultsSurvey(null)} />
    </Box>
  );
};

const SurveyResultsDialog = ({ survey, isAdmin, onClose }: { survey: Survey | null; isAdmin: boolean; onClose: () => void }) => {
  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['surveyResponses', survey?.id, isAdmin],
    queryFn: () =>
      isAdmin
        ? surveyResponsesApi.getBySurvey(survey!.id)
        : surveyResponsesApi.getCoachVisibleBySurvey(survey!.id),
    enabled: !!survey,
  });

  return (
    <Dialog open={!!survey} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Results — {survey?.title}
        <Typography variant="body2" color="text.secondary">
          {responses.length} response{responses.length === 1 ? '' : 's'}
          {isAdmin ? '' : ' · showing only questions marked visible to coaches'}
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
                    <ListItemText primary={a.questionText} secondary={a.value || '(no answer)'} primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }} />
                  </ListItem>
                ))}
              </List>
            </Paper>
          ))
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
};

export default SurveyAdminPage;
