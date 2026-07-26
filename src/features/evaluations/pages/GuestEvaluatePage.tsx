import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Paper,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import { useQuery } from '@tanstack/react-query';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase/config';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import ScoringBoard, { type ScoreSubmission } from '../components/ScoringBoard';
import type { EvalCategory, EvalParticipant, EvalStation } from '@/lib/api/evaluations';
import { format } from 'date-fns';

interface GuestEventPayload {
  eventId: string;
  evaluatorName: string;
  event: {
    name: string;
    date: string | null;
    type: string;
    categories: EvalCategory[];
    stations: EvalStation[];
    participants: EvalParticipant[];
  };
}

/**
 * Public evaluator page (/evaluate/:token): no account needed. The token
 * resolves the event server-side and every score is submitted through the
 * tokened Cloud Function with the evaluator's name attached.
 */
const GuestEvaluatePage = () => {
  useDocumentTitle('Evaluate');
  const { token = '' } = useParams();
  const [saved, setSaved] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['guestEvalEvent', token],
    queryFn: async () => {
      const callable = httpsCallable<{ token: string }, GuestEventPayload>(functions, 'getEvalEventByToken');
      const res = await callable({ token });
      return res.data;
    },
    enabled: !!token,
    retry: false,
  });

  const submit = async (s: ScoreSubmission) => {
    const callable = httpsCallable(functions, 'submitEvalScoreByToken');
    await callable({
      token,
      participantId: s.participantId,
      skillId: s.skillId,
      stationId: s.stationId,
      score: s.score,
      comment: s.comment || '',
      mediaUrls: s.mediaUrls || [],
    });
    setSaved((n) => n + 1);
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100' }}>
      <Box sx={{ bgcolor: 'primary.main', color: 'white', py: 2, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={700}>Northern Michigan Waves</Typography>
        <Typography variant="body2" sx={{ opacity: 0.9 }}>Player Evaluation</Typography>
      </Box>
      <Container maxWidth="md" sx={{ py: 3 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : error || !data ? (
          <Alert severity="error">
            This evaluator link is invalid, disabled, or the event isn't open for scoring.
            Please check with the coach who sent it to you.
          </Alert>
        ) : (
          <>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <AssessmentIcon color="primary" />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">{data.event.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {data.event.date ? format(new Date(data.event.date), 'EEEE, MMMM d, yyyy') : ''}
                  </Typography>
                </Box>
                <Chip label={`Scoring as ${data.evaluatorName}`} color="primary" variant="outlined" />
                {saved > 0 && <Chip label={`${saved} saved`} color="success" size="small" />}
              </Box>
            </Paper>
            <ScoringBoard
              eventId={data.eventId}
              categories={data.event.categories}
              stations={data.event.stations}
              participants={data.event.participants}
              mediaPathPrefix={`evalMedia/${token}`}
              uploadToken={token}
              onSubmit={submit}
            />
          </>
        )}
      </Container>
    </Box>
  );
};

export default GuestEvaluatePage;
