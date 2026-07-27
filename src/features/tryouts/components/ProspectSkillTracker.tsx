import { useState } from 'react';
import { Box, Typography, Button, Chip, CircularProgress, Divider } from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  evalEventsApi,
  evalScoresApi,
  computeRankings,
  type EvalEvent,
  type EvalScore,
  type ParticipantRanking,
} from '@/lib/api/evaluations';
import { resolveTryoutSeason } from '@/lib/api/prospectAssignment';
import { computeDivision } from '@/lib/utils/leagueAge';
import type { TryoutApplicant } from '@/lib/api/tryoutApplicants';
import PlayerReportDialog from '@/features/evaluations/components/PlayerReportDialog';
import toast from 'react-hot-toast';

interface Props {
  applicant: TryoutApplicant;
  evaluatorId: string;
}

/**
 * Bridges a tryout signup into the skill-tracker (SkillShark-style) rating
 * system: shows the applicant's weighted overall from the season's tryout
 * evaluation event, opens their report card, and jumps into full scoring —
 * creating/attaching the event + participant on demand.
 */
const ProspectSkillTracker = ({ applicant, evaluatorId }: Props) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{
    event: EvalEvent;
    ranking: ParticipantRanking;
    scores: EvalScore[];
  } | null>(null);

  // Read-only: find the existing season tryout event and this applicant's
  // ranking, WITHOUT creating anything just by opening the dialog.
  const { data: summary, isLoading } = useQuery({
    queryKey: ['prospectSkillSummary', applicant.id, applicant.season],
    queryFn: async () => {
      const season = applicant.season || (await resolveTryoutSeason());
      const events = await evalEventsApi.getAll();
      const event = events.find(
        (e) =>
          e.type === 'tryout' &&
          e.status !== 'closed' &&
          (e.season === season || (!e.season && e.name.includes(season)))
      );
      if (!event) return { season, event: null as EvalEvent | null, ranking: null as ParticipantRanking | null, scores: [] as EvalScore[] };
      const participant = event.participants.find((p) => p.applicantId === applicant.id);
      if (!participant) return { season, event, ranking: null, scores: [] };
      const scores = await evalScoresApi.getByEvent(event.id);
      const ranking = computeRankings(event, scores).find((r) => r.participant.id === participant.id) || null;
      return { season, event, ranking, scores };
    },
  });

  const openScoring = async () => {
    setBusy(true);
    try {
      const season = applicant.season || (await resolveTryoutSeason());
      const event = await evalEventsApi.getOrCreateTryoutEvent(season, evaluatorId);
      await evalEventsApi.ensureApplicantParticipant(event, {
        id: applicant.id,
        playerFirstName: applicant.playerFirstName,
        playerLastName: applicant.playerLastName,
        playerId: applicant.playerId,
        division: computeDivision(applicant.dateOfBirth, applicant.season) || applicant.ageGroup,
      });
      navigate(`/evaluations/${event.id}`);
    } catch (e: any) {
      toast.error(e?.message || 'Could not open the skill tracker');
    } finally {
      setBusy(false);
    }
  };

  const openReport = () => {
    if (summary?.event && summary.ranking) {
      setReport({ event: summary.event, ranking: summary.ranking, scores: summary.scores });
    }
  };

  const overall = summary?.ranking?.overall ?? null;

  return (
    <Box>
      <Divider sx={{ my: 2 }}>
        <Typography variant="overline">Skill Tracker</Typography>
      </Divider>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <AssessmentIcon color="primary" />
        {isLoading ? (
          <CircularProgress size={18} />
        ) : overall != null ? (
          <>
            <Chip
              label={`Overall ${overall}`}
              color={overall >= 70 ? 'success' : 'default'}
              sx={{ fontWeight: 700 }}
            />
            <Typography variant="caption" color="text.secondary">
              {summary?.ranking?.scoreCount} scores · {summary?.ranking?.evaluatorCount} evaluator
              {summary?.ranking?.evaluatorCount === 1 ? '' : 's'}
            </Typography>
            <Button size="small" onClick={openReport}>View report card</Button>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Not scored in the skill tracker yet.
          </Typography>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button
          size="small"
          variant="outlined"
          startIcon={busy ? <CircularProgress size={14} /> : <OpenInNewIcon />}
          onClick={openScoring}
          disabled={busy}
        >
          Score in Skill Tracker
        </Button>
      </Box>

      {report && (
        <PlayerReportDialog
          event={report.event}
          ranking={report.ranking}
          scores={report.scores}
          onClose={() => setReport(null)}
        />
      )}
    </Box>
  );
};

export default ProspectSkillTracker;
