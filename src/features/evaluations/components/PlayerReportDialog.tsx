import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Link as MuiLink,
  CircularProgress,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  evalScoresApi,
  type EvalEvent,
  type EvalScore,
  type ParticipantRanking,
} from '@/lib/api/evaluations';
import { format } from 'date-fns';

/** Percentage bar reused for category/skill visuals. */
const PctBar = ({ label, pct, extra }: { label: string; pct: number | null; extra?: string }) => (
  <Box sx={{ mb: 1 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
      <Typography variant="body2">{label}</Typography>
      <Typography variant="body2" color="text.secondary">
        {pct == null ? 'not scored' : `${pct}%`}{extra ? ` · ${extra}` : ''}
      </Typography>
    </Box>
    <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
      <Box sx={{ width: `${pct ?? 0}%`, height: '100%', bgcolor: pct != null && pct >= 70 ? 'success.main' : pct != null && pct >= 40 ? 'warning.main' : 'error.main', borderRadius: 4 }} />
    </Box>
  </Box>
);

interface Props {
  event: EvalEvent;
  ranking: ParticipantRanking | null;
  scores: EvalScore[];
  onClose: () => void;
}

/**
 * SkillShark-style player report card: weighted overall, category breakdown,
 * per-skill averages with every evaluator's comment, attached media, and —
 * for rostered players — progress across previous evaluation events.
 */
const PlayerReportDialog = ({ event, ranking, scores, onClose }: Props) => {
  const p = ranking?.participant;
  const mine = scores.filter((s) => s.participantId === p?.id);

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ['playerEvalHistory', p?.playerId],
    queryFn: () => evalScoresApi.getByPlayer(p!.playerId!),
    enabled: !!p?.playerId,
  });

  if (!ranking || !p) return null;

  // Per-skill: average + individual evaluator entries.
  const bySkill = new Map<string, EvalScore[]>();
  for (const s of mine) {
    if (!bySkill.has(s.skillId)) bySkill.set(s.skillId, []);
    bySkill.get(s.skillId)!.push(s);
  }

  // Progress: average pct per event (from the player's full history).
  const byEvent = new Map<string, { when: Date; pcts: number[] }>();
  for (const s of history) {
    const e = byEvent.get(s.eventId) || { when: s.createdAt, pcts: [] };
    e.pcts.push((s.score / s.maxScore) * 100);
    if (s.createdAt < e.when) e.when = s.createdAt;
    byEvent.set(s.eventId, e);
  }
  const progress = [...byEvent.entries()]
    .map(([eventId, v]) => ({ eventId, when: v.when, pct: Math.round(v.pcts.reduce((a, b) => a + b, 0) / v.pcts.length) }))
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  const media = mine.flatMap((s) => s.mediaUrls || []);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={p.number || '—'} color="primary" sx={{ fontWeight: 700 }} />
          <Box sx={{ flexGrow: 1 }}>
            {p.name}
            <Typography variant="body2" color="text.secondary">
              {p.division || ''} · {ranking.scoreCount} scores from {ranking.evaluatorCount} evaluator{ranking.evaluatorCount === 1 ? '' : 's'}
            </Typography>
          </Box>
          <Chip
            label={ranking.overall == null ? '—' : `${ranking.overall}`}
            color={ranking.overall != null && ranking.overall >= 70 ? 'success' : 'default'}
            sx={{ fontWeight: 700, fontSize: 18, height: 36 }}
          />
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>By category</Typography>
        {Object.values(ranking.byCategory).map((c) => (
          <PctBar key={c.name} label={c.name} pct={c.pct} extra={c.count ? `${c.count} scores` : undefined} />
        ))}

        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Skill detail</Typography>
        {event.categories.map((cat) => {
          const rows = cat.skills.filter((s) => bySkill.has(s.id));
          if (rows.length === 0) return null;
          return (
            <Paper key={cat.id} variant="outlined" sx={{ p: 1.5, mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>{cat.name}</Typography>
              {rows.map((s) => {
                const entries = bySkill.get(s.id)!;
                const avg = entries.reduce((a, b) => a + b.score / b.maxScore, 0) / entries.length;
                return (
                  <Box key={s.id} sx={{ mt: 1 }}>
                    <PctBar label={s.name} pct={Math.round(avg * 100)} extra={`${entries.length}×`} />
                    {entries.filter((e) => e.comment).map((e) => (
                      <Typography key={e.id} variant="caption" color="text.secondary" sx={{ display: 'block', ml: 1 }}>
                        “{e.comment}” — {e.evaluatorName}
                      </Typography>
                    ))}
                  </Box>
                );
              })}
            </Paper>
          );
        })}

        {media.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Photos & video</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {media.map((url, i) => (
                <MuiLink key={i} href={url} target="_blank" rel="noopener">
                  <Chip label={`Media ${i + 1}`} clickable size="small" />
                </MuiLink>
              ))}
            </Box>
          </>
        )}

        {p.playerId && (
          <>
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>Progress over time</Typography>
            {historyLoading ? (
              <CircularProgress size={20} />
            ) : progress.length <= 1 ? (
              <Typography variant="body2" color="text.secondary">
                First recorded evaluation — future events will chart progress here.
              </Typography>
            ) : (
              progress.map((e) => (
                <PctBar key={e.eventId} label={format(e.when, 'MMM d, yyyy')} pct={e.pct} />
              ))
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlayerReportDialog;
