import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  CardActions,
  TextField,
  Radio,
  RadioGroup,
  Checkbox,
  FormGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Rating,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import PollIcon from '@mui/icons-material/Poll';
import LockIcon from '@mui/icons-material/Lock';
import { useQuery, useMutation } from '@tanstack/react-query';
import { surveysApi, surveyResponsesApi, surveyMatchesAudience } from '@/lib/api/surveys';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import type { Survey, SurveyAnswer } from '@/types/models';
import toast from 'react-hot-toast';

const SurveysPage = () => {
  const [active, setActive] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());

  const { user } = useAuthStore();
  const linkedPlayerIds = user?.linkedPlayerIds || [];

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['activeSurveys'],
    queryFn: () => surveysApi.getActive(),
  });

  // Fetch the parent's linked children to know which teams/players they belong
  // to, so we only show surveys targeted at them.
  const { data: children = [] } = useQuery({
    queryKey: ['linkedChildrenForSurveys', ...linkedPlayerIds],
    queryFn: async () => {
      const results = await Promise.all(linkedPlayerIds.map((id) => playersApi.getById(id)));
      return results.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof playersApi.getById>>>[];
    },
    enabled: linkedPlayerIds.length > 0,
  });

  const childTeamIds = children.map((c) => c.teamId).filter(Boolean) as string[];

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!active) return;
      const payload: SurveyAnswer[] = active.questions.map((q) => ({
        questionId: q.id,
        questionText: q.text,
        value: answers[q.id] ?? '',
      }));
      await surveyResponsesApi.submit(active, payload);
    },
    onSuccess: () => {
      if (active) setCompletedIds((prev) => new Set(prev).add(active.id));
      toast.success('Thank you — your response was submitted anonymously.');
      setActive(null);
      setAnswers({});
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to submit. Please try again.'),
  });

  const openSurvey = (s: Survey) => {
    setActive(s);
    setAnswers({});
  };

  const missingRequired =
    active?.questions.some((q) => q.required && !(answers[q.id] ?? '').trim()) ?? false;

  const visible = surveys
    .filter((s) => surveyMatchesAudience(s, childTeamIds, linkedPlayerIds))
    .filter((s) => !completedIds.has(s.id));

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <PollIcon color="primary" />
        <Typography variant="h4">Surveys</Typography>
      </Box>
      <Alert icon={<LockIcon fontSize="inherit" />} severity="info" sx={{ mb: 3 }}>
        Responses are anonymous and are not visible to coaches. Please be candid.
      </Alert>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : visible.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">No surveys available right now.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visible.map((s) => (
            <Card key={s.id}>
              <CardContent>
                <Typography variant="h6">{s.title}</Typography>
                {s.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {s.description}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {s.questions.length} question{s.questions.length === 1 ? '' : 's'}
                </Typography>
              </CardContent>
              <CardActions>
                <Button variant="contained" onClick={() => openSurvey(s)}>
                  Take Survey
                </Button>
              </CardActions>
            </Card>
          ))}
        </Box>
      )}

      <Dialog open={!!active} onClose={() => !submitMutation.isPending && setActive(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{active?.title}</DialogTitle>
        <DialogContent dividers>
          {active?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {active.description}
            </Typography>
          )}
          {active?.questions.map((q, idx) => (
            <Box key={q.id} sx={{ mb: 3 }}>
              <FormControl fullWidth>
                <FormLabel sx={{ mb: 1, fontWeight: 500 }}>
                  {idx + 1}. {q.text}{q.required ? ' *' : ''}
                </FormLabel>
                {q.type === 'text' && (
                  <TextField
                    multiline
                    minRows={2}
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                  />
                )}
                {q.type === 'multiple_choice' && (
                  <RadioGroup
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((p) => ({ ...p, [q.id]: e.target.value }))}
                  >
                    {(q.options || []).map((opt) => (
                      <FormControlLabel key={opt} value={opt} control={<Radio />} label={opt} />
                    ))}
                  </RadioGroup>
                )}
                {q.type === 'checkbox' && (
                  <FormGroup>
                    {(q.options || []).map((opt) => {
                      const chosen = (answers[q.id] ? answers[q.id].split(' | ') : []);
                      return (
                        <FormControlLabel
                          key={opt}
                          control={
                            <Checkbox
                              checked={chosen.includes(opt)}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...chosen, opt]
                                  : chosen.filter((o) => o !== opt);
                                setAnswers((p) => ({ ...p, [q.id]: next.join(' | ') }));
                              }}
                            />
                          }
                          label={opt}
                        />
                      );
                    })}
                  </FormGroup>
                )}
                {q.type === 'rating' && (
                  <Rating
                    value={Number(answers[q.id]) || 0}
                    onChange={(_, v) => setAnswers((p) => ({ ...p, [q.id]: String(v ?? '') }))}
                  />
                )}
              </FormControl>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActive(null)} disabled={submitMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || missingRequired}
          >
            {submitMutation.isPending ? 'Submitting…' : 'Submit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SurveysPage;
