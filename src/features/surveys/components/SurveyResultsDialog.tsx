import { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  Tabs,
  Tab,
  Rating,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import { useQuery } from '@tanstack/react-query';
import { surveyResponsesApi, ANSWER_SEPARATOR } from '@/lib/api/surveys';
import { useAuthStore } from '@/stores/authStore';
import type { Survey, SurveyQuestion, SurveyResponse } from '@/types/models';
import { format } from 'date-fns';

interface Props {
  survey: Survey | null;
  isAdmin: boolean;
  onClose: () => void;
}

/** Horizontal count bar for choice aggregates. */
const CountBar = ({ label, count, total }: { label: string; count: number; total: number }) => {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {count} ({pct}%)
        </Typography>
      </Box>
      <Box sx={{ height: 10, borderRadius: 5, bgcolor: 'action.hover', overflow: 'hidden' }}>
        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 5 }} />
      </Box>
    </Box>
  );
};

/** Values for a question across all responses (blank answers dropped). */
const valuesFor = (q: SurveyQuestion, responses: SurveyResponse[]): string[] =>
  responses
    .map((r) => r.answers.find((a) => a.questionId === q.id)?.value ?? '')
    .filter((v) => v.trim().length > 0);

const QuestionSummary = ({ q, responses }: { q: SurveyQuestion; responses: SurveyResponse[] }) => {
  const values = valuesFor(q, responses);

  if (values.length === 0) {
    return <Typography variant="body2" color="text.secondary">No answers yet.</Typography>;
  }

  if (q.type === 'multiple_choice' || q.type === 'yes_no') {
    const opts = q.type === 'yes_no' ? ['Yes', 'No'] : (q.options || []);
    const counts = new Map<string, number>(opts.map((o) => [o, 0]));
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1);
    return (
      <>
        {[...counts.entries()].map(([opt, count]) => (
          <CountBar key={opt} label={opt} count={count} total={values.length} />
        ))}
      </>
    );
  }

  if (q.type === 'checkbox') {
    const counts = new Map<string, number>((q.options || []).map((o) => [o, 0]));
    for (const v of values) {
      for (const part of v.split(ANSWER_SEPARATOR)) {
        if (part.trim()) counts.set(part, (counts.get(part) || 0) + 1);
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return (
      <>
        {sorted.map(([opt, count]) => (
          <CountBar key={opt} label={opt} count={count} total={values.length} />
        ))}
        <Typography variant="caption" color="text.secondary">
          Percentages are of {values.length} respondent{values.length === 1 ? '' : 's'} (multiple selections allowed).
        </Typography>
      </>
    );
  }

  if (q.type === 'rating') {
    const nums = values.map(Number).filter((n) => n >= 1 && n <= 5);
    const avg = nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
    return (
      <>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Rating value={avg} precision={0.1} readOnly />
          <Typography variant="body1" fontWeight={600}>{avg.toFixed(1)}</Typography>
          <Typography variant="body2" color="text.secondary">
            average from {nums.length} rating{nums.length === 1 ? '' : 's'}
          </Typography>
        </Box>
        {[5, 4, 3, 2, 1].map((star) => (
          <CountBar
            key={star}
            label={`${star} star${star === 1 ? '' : 's'}`}
            count={nums.filter((n) => n === star).length}
            total={nums.length}
          />
        ))}
      </>
    );
  }

  if (q.type === 'ranking') {
    // Average position per option (1 = ranked first). Lower = more important.
    const positions = new Map<string, number[]>();
    for (const v of values) {
      v.split(ANSWER_SEPARATOR).forEach((opt, i) => {
        if (!positions.has(opt)) positions.set(opt, []);
        positions.get(opt)!.push(i + 1);
      });
    }
    const averaged = [...positions.entries()]
      .map(([opt, arr]) => ({ opt, avg: arr.reduce((s, n) => s + n, 0) / arr.length }))
      .sort((a, b) => a.avg - b.avg);
    return (
      <>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Ordered by average rank across {values.length} response{values.length === 1 ? '' : 's'} (1 = most important).
        </Typography>
        {averaged.map((row, i) => (
          <Box key={row.opt} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <Chip label={i + 1} size="small" color="primary" sx={{ fontWeight: 700, minWidth: 32 }} />
            <Typography variant="body2" sx={{ flexGrow: 1 }}>{row.opt}</Typography>
            <Typography variant="body2" color="text.secondary">avg {row.avg.toFixed(1)}</Typography>
          </Box>
        ))}
      </>
    );
  }

  // text
  return (
    <List dense disablePadding>
      {values.map((v, i) => (
        <ListItem key={i} sx={{ display: 'list-item', listStyle: 'disc', ml: 3, py: 0.25 }} disablePadding>
          <Typography variant="body2">{v}</Typography>
        </ListItem>
      ))}
    </List>
  );
};

const csvEscape = (v: string) => `"${v.replace(/"/g, '""')}"`;

const SurveyResultsDialog = ({ survey, isAdmin, onClose }: Props) => {
  const [tab, setTab] = useState(0);
  const { user } = useAuthStore();

  const { data: responses = [], isLoading } = useQuery({
    queryKey: ['surveyResponses', survey?.id, isAdmin, user?.uid],
    queryFn: () =>
      isAdmin
        ? surveyResponsesApi.getBySurvey(survey!.id)
        : surveyResponsesApi.getCoachVisibleBySurvey(survey!.id, user?.uid),
    enabled: !!survey,
  });

  // Coaches only ever see the questions marked visible to them. Admins must be
  // able to see EVERYTHING ever collected — including answers to questions
  // later deleted or edited out of the survey — so synthesize entries for any
  // answered question ids the survey no longer contains.
  const questions = useMemo(() => {
    if (!survey) return [];
    const base = survey.questions.filter((q) => isAdmin || q.visibleToCoaches);
    if (!isAdmin) return base;
    const known = new Set(base.map((q) => q.id));
    const orphans: SurveyQuestion[] = [];
    for (const r of responses) {
      for (const a of r.answers) {
        if (!known.has(a.questionId)) {
          known.add(a.questionId);
          orphans.push({
            id: a.questionId,
            text: `${a.questionText} (question since removed)`,
            type: 'text',
          });
        }
      }
    }
    return [...base, ...orphans];
  }, [survey, isAdmin, responses]);

  const exportCsv = () => {
    if (!survey) return;
    const header = ['Submitted', ...questions.map((q) => q.text)];
    const rows = responses.map((r) => [
      format(r.submittedAt, 'yyyy-MM-dd HH:mm'),
      ...questions.map((q) => r.answers.find((a) => a.questionId === q.id)?.value ?? ''),
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${survey.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-responses.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={!!survey} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
          <Box>
            Results — {survey?.title}
            <Typography variant="body2" color="text.secondary">
              {responses.length} response{responses.length === 1 ? '' : 's'}
              {isAdmin ? '' : ' · showing only questions marked visible to coaches'}
            </Typography>
          </Box>
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            onClick={exportCsv}
            disabled={responses.length === 0}
          >
            Export CSV
          </Button>
        </Box>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mt: 1 }}>
          <Tab label="Summary" />
          <Tab label={`Individual (${responses.length})`} />
        </Tabs>
      </DialogTitle>
      <DialogContent dividers>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress /></Box>
        ) : responses.length === 0 ? (
          <Typography color="text.secondary">No responses yet.</Typography>
        ) : tab === 0 ? (
          questions.map((q, i) => (
            <Paper key={q.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1.5 }}>
                {i + 1}. {q.text}
              </Typography>
              <QuestionSummary q={q} responses={responses} />
            </Paper>
          ))
        ) : (
          responses.map((r, i) => (
            <Paper key={r.id} variant="outlined" sx={{ p: 2, mb: 2 }}>
              <Typography variant="overline" color="text.secondary">
                Response #{i + 1} · {format(r.submittedAt, 'MMM d, yyyy h:mm a')}
              </Typography>
              <List dense disablePadding>
                {r.answers
                  .filter((a) => isAdmin || questions.some((q) => q.id === a.questionId))
                  .map((a) => (
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
      <DialogActions><Button onClick={onClose}>Close</Button></DialogActions>
    </Dialog>
  );
};

export default SurveyResultsDialog;
