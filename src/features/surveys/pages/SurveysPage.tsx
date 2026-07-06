import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  TextField,
  Radio,
  RadioGroup,
  Checkbox,
  FormGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  FormHelperText,
  Rating,
  CircularProgress,
  LinearProgress,
  IconButton,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import PollIcon from '@mui/icons-material/Poll';
import LockIcon from '@mui/icons-material/Lock';
import EventIcon from '@mui/icons-material/Event';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  surveysApi,
  surveyResponsesApi,
  surveyMatchesAudience,
  surveyIsClosed,
  ANSWER_SEPARATOR,
} from '@/lib/api/surveys';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import type { Survey, SurveyAnswer, SurveyQuestion } from '@/types/models';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

/**
 * Responses are anonymous, so completion can't be tracked server-side without
 * defeating that. Persist "I already took this" locally per account so a page
 * refresh doesn't re-offer a survey the parent already submitted.
 */
const completedKey = (uid: string) => `nmw-surveys-completed-${uid}`;
const loadCompleted = (uid: string): Set<string> => {
  try {
    return new Set(JSON.parse(localStorage.getItem(completedKey(uid)) || '[]'));
  } catch {
    return new Set();
  }
};
const saveCompleted = (uid: string, ids: Set<string>) => {
  try {
    localStorage.setItem(completedKey(uid), JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — in-memory tracking still applies */
  }
};

/** Is this question answered well enough to count toward progress/required? */
const isAnswered = (q: SurveyQuestion, value: string | undefined): boolean => {
  if (q.type === 'ranking') return true; // the current order IS an answer
  if (!value || !value.trim()) return false;
  if (q.type === 'rating') return Number(value) > 0;
  return true;
};

const SurveysPage = () => {
  const { user } = useAuthStore();
  const uid = user?.uid || 'anon';
  const linkedPlayerIds = user?.linkedPlayerIds || [];

  const [active, setActive] = useState<Survey | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completedIds, setCompletedIds] = useState<Set<string>>(() => loadCompleted(uid));

  // Re-read the completion list if the signed-in account changes (or auth
  // finishes hydrating after first render) so one account's history never
  // hides or re-shows surveys for another.
  useEffect(() => {
    setCompletedIds(loadCompleted(uid));
  }, [uid]);

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['activeSurveys'],
    queryFn: () => surveysApi.getActive(),
  });

  // The parent's children determine which targeted surveys apply to them.
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
        value:
          q.type === 'ranking'
            ? (answers[q.id] ?? (q.options || []).join(ANSWER_SEPARATOR))
            : (answers[q.id] ?? ''),
      }));
      await surveyResponsesApi.submit(active, payload);
    },
    onSuccess: () => {
      if (active) {
        setCompletedIds((prev) => {
          const next = new Set(prev).add(active.id);
          saveCompleted(uid, next);
          return next;
        });
      }
      toast.success('Thank you — your response was submitted anonymously.');
      setActive(null);
      setAnswers({});
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to submit. Please try again.'),
  });

  const openSurvey = (s: Survey) => {
    setActive(s);
    // Ranking questions start with the options in their given order.
    const initial: Record<string, string> = {};
    for (const q of s.questions) {
      if (q.type === 'ranking') initial[q.id] = (q.options || []).join(ANSWER_SEPARATOR);
    }
    setAnswers(initial);
  };

  const visible = surveys
    .filter((s) => !surveyIsClosed(s))
    .filter((s) => surveyMatchesAudience(s, childTeamIds, linkedPlayerIds))
    .filter((s) => !completedIds.has(s.id));

  const answeredCount = active
    ? active.questions.filter((q) => isAnswered(q, answers[q.id])).length
    : 0;
  const missingRequired =
    active?.questions.some((q) => q.required && !isAnswered(q, answers[q.id])) ?? false;

  const moveRankOption = (q: SurveyQuestion, index: number, dir: -1 | 1) => {
    const current = (answers[q.id] || (q.options || []).join(ANSWER_SEPARATOR)).split(ANSWER_SEPARATOR);
    const target = index + dir;
    if (target < 0 || target >= current.length) return;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    setAnswers((p) => ({ ...p, [q.id]: next.join(ANSWER_SEPARATOR) }));
  };

  const renderQuestion = (q: SurveyQuestion, idx: number) => {
    const value = answers[q.id] ?? '';
    const set = (v: string) => setAnswers((p) => ({ ...p, [q.id]: v }));

    return (
      <Paper key={q.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
        <FormControl fullWidth>
          <FormLabel sx={{ mb: 1, fontWeight: 600, color: 'text.primary' }}>
            {idx + 1}. {q.text}
            {q.required ? <Box component="span" sx={{ color: 'error.main' }}> *</Box> : ''}
          </FormLabel>

          {q.type === 'text' && (
            <TextField
              multiline
              minRows={2}
              placeholder="Type your answer…"
              value={value}
              onChange={(e) => set(e.target.value)}
            />
          )}

          {q.type === 'multiple_choice' && (
            <RadioGroup value={value} onChange={(e) => set(e.target.value)}>
              {(q.options || []).map((opt) => (
                <FormControlLabel key={opt} value={opt} control={<Radio />} label={opt} />
              ))}
            </RadioGroup>
          )}

          {q.type === 'yes_no' && (
            <ToggleButtonGroup
              exclusive
              value={value}
              onChange={(_, v) => v !== null && set(v)}
              sx={{ mt: 0.5 }}
            >
              <ToggleButton value="Yes" sx={{ px: 4 }}>Yes</ToggleButton>
              <ToggleButton value="No" sx={{ px: 4 }}>No</ToggleButton>
            </ToggleButtonGroup>
          )}

          {q.type === 'checkbox' && (() => {
            const chosen = value ? value.split(ANSWER_SEPARATOR) : [];
            const limit = q.maxSelections && q.maxSelections > 0 ? q.maxSelections : undefined;
            const atLimit = !!limit && chosen.length >= limit;
            return (
              <>
                {limit && (
                  <FormHelperText sx={{ ml: 0, mb: 0.5 }}>
                    Select up to {limit} ({chosen.length}/{limit} selected)
                  </FormHelperText>
                )}
                <FormGroup>
                  {(q.options || []).map((opt) => {
                    const checked = chosen.includes(opt);
                    return (
                      <FormControlLabel
                        key={opt}
                        control={
                          <Checkbox
                            checked={checked}
                            disabled={!checked && atLimit}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...chosen, opt]
                                : chosen.filter((o) => o !== opt);
                              set(next.join(ANSWER_SEPARATOR));
                            }}
                          />
                        }
                        label={opt}
                      />
                    );
                  })}
                </FormGroup>
              </>
            );
          })()}

          {q.type === 'rating' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Rating
                size="large"
                value={Number(value) || 0}
                onChange={(_, v) => set(String(v ?? ''))}
              />
              {Number(value) > 0 && (
                <Typography variant="body2" color="text.secondary">{value} / 5</Typography>
              )}
            </Box>
          )}

          {q.type === 'ranking' && (() => {
            const order = (value || (q.options || []).join(ANSWER_SEPARATOR)).split(ANSWER_SEPARATOR);
            return (
              <>
                <FormHelperText sx={{ ml: 0, mb: 0.5 }}>
                  Use the arrows to order from most important (top) to least important (bottom).
                </FormHelperText>
                {order.map((opt, i) => (
                  <Paper
                    key={opt}
                    variant="outlined"
                    sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, mb: 0.75 }}
                  >
                    <Chip label={i + 1} size="small" color="primary" sx={{ fontWeight: 700, minWidth: 32 }} />
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>{opt}</Typography>
                    <IconButton size="small" disabled={i === 0} onClick={() => moveRankOption(q, i, -1)}>
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" disabled={i === order.length - 1} onClick={() => moveRankOption(q, i, 1)}>
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </Paper>
                ))}
              </>
            );
          })()}
        </FormControl>
      </Paper>
    );
  };

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
          <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
          <Typography color="text.secondary">
            {completedIds.size > 0
              ? "You're all caught up — no surveys waiting for you."
              : 'No surveys available right now.'}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visible.map((s) => (
            <Card key={s.id}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>{s.title}</Typography>
                  {s.closesAt && (
                    <Chip
                      icon={<EventIcon />}
                      label={`Closes ${format(s.closesAt, 'MMM d')}`}
                      size="small"
                      color="warning"
                      variant="outlined"
                    />
                  )}
                </Box>
                {s.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {s.description}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  {s.questions.length} question{s.questions.length === 1 ? '' : 's'} · ~
                  {Math.max(1, Math.round(s.questions.length / 3))} min
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

      <Dialog
        open={!!active}
        onClose={() => !submitMutation.isPending && setActive(null)}
        maxWidth="sm"
        fullWidth
        fullScreen={typeof window !== 'undefined' && window.innerWidth < 600}
      >
        <DialogTitle sx={{ pb: 1 }}>
          {active?.title}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <LinearProgress
              variant="determinate"
              value={active ? (answeredCount / Math.max(1, active.questions.length)) * 100 : 0}
              sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {answeredCount}/{active?.questions.length ?? 0}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {active?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {active.description}
            </Typography>
          )}
          {active?.questions.map((q, idx) => renderQuestion(q, idx))}
          {missingRequired && (
            <Alert severity="warning" sx={{ mt: 1 }}>
              Please answer all required questions (marked with *).
            </Alert>
          )}
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
