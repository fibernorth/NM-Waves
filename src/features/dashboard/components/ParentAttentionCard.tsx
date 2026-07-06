import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Link as MuiLink,
} from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import PollIcon from '@mui/icons-material/Poll';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import GoogleIcon from '@mui/icons-material/Google';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  surveysApi,
  surveyMatchesAudience,
  surveyIsClosed,
  loadCompletedSurveys,
} from '@/lib/api/surveys';
import { tryoutApplicantsApi } from '@/lib/api/tryoutApplicants';
import { tryoutSessionsApi } from '@/lib/api/tryoutSessions';
import { useAuthStore } from '@/stores/authStore';
import { googleCalendarUrl, timeOnDate, type CalendarEvent } from '@/lib/utils/calendarLinks';
import type { Player } from '@/types/models';

interface Props {
  linkedChildren: Player[];
}

/**
 * Parent dashboard notice card: pending surveys, tryout registration status
 * (including "pick a date" nudges), and confirmed tryout dates with an
 * add-to-Google-Calendar link.
 */
const ParentAttentionCard = ({ linkedChildren }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const uid = user?.uid || 'anon';
  const email = user?.email || '';
  const linkedPlayerIds = user?.linkedPlayerIds || [];

  const { data: surveys = [] } = useQuery({
    queryKey: ['activeSurveys'],
    queryFn: () => surveysApi.getActive(),
  });
  const { data: myRegs = [] } = useQuery({
    queryKey: ['myTryoutRegs', email],
    queryFn: () => tryoutApplicantsApi.getByEmail(email),
    enabled: !!email,
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ['tryoutSessionsUpcoming'],
    queryFn: () => tryoutSessionsApi.getUpcoming(),
  });

  const childTeamIds = linkedChildren.map((c) => c.teamId).filter(Boolean) as string[];
  const completed = loadCompletedSurveys(uid);
  const pendingSurveys = surveys
    .filter((s) => !surveyIsClosed(s))
    .filter((s) => surveyMatchesAudience(s, childTeamIds, linkedPlayerIds))
    .filter((s) => !completed.has(s.id));

  const regFor = (c: Player) =>
    myRegs.find((r) => r.playerId === c.id) ||
    myRegs.find(
      (r) =>
        r.playerFirstName.trim().toLowerCase() === c.firstName.trim().toLowerCase() &&
        r.playerLastName.trim().toLowerCase() === c.lastName.trim().toLowerCase()
    );

  const needDate = linkedChildren.filter((c) => {
    const r = regFor(c);
    return !!r && !r.sessionId && sessions.length > 0;
  });
  const registeredWithDate = linkedChildren
    .map((c) => ({ child: c, reg: regFor(c) }))
    .filter((x) => !!x.reg?.sessionId);
  const notRegistered = linkedChildren.filter((c) => !regFor(c));

  const hasWarnings = pendingSurveys.length > 0 || needDate.length > 0 || (notRegistered.length > 0 && sessions.length > 0);
  if (!hasWarnings && registeredWithDate.length === 0) return null;

  const tryoutCalEvent = (regSessionId?: string): CalendarEvent | null => {
    const s = sessions.find((x) => x.id === regSessionId);
    if (!s) return null;
    return {
      title: 'NM Waves Tryouts',
      start: timeOnDate(s.date, s.startTime, 9),
      end: timeOnDate(s.date, s.endTime, 12),
      location: s.location,
      description: s.notes || 'Northern Michigan Waves tryouts',
    };
  };

  return (
    <Card variant="outlined" sx={{ mb: 3, borderColor: hasWarnings ? 'warning.main' : 'success.main' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <NotificationsActiveIcon color={hasWarnings ? 'warning' : 'success'} />
          <Typography variant="h6">
            {hasWarnings ? 'Needs your attention' : "You're all set"}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {pendingSurveys.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <PollIcon fontSize="small" color="warning" />
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {pendingSurveys.length === 1
                  ? `Survey waiting for you: "${pendingSurveys[0].title}"`
                  : `${pendingSurveys.length} surveys are waiting for your input`}
              </Typography>
              <Button size="small" variant="contained" onClick={() => navigate('/surveys')}>
                Take Survey{pendingSurveys.length > 1 ? 's' : ''}
              </Button>
            </Box>
          )}

          {needDate.map((c) => (
            <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <HowToRegIcon fontSize="small" color="warning" />
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                {c.firstName} is registered for tryouts — please choose which date you'll attend.
              </Typography>
              <Button size="small" variant="contained" onClick={() => navigate('/register-tryouts')}>
                Choose Date
              </Button>
            </Box>
          ))}

          {notRegistered.length > 0 && sessions.length > 0 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <HowToRegIcon fontSize="small" color="action" />
              <Typography variant="body2" sx={{ flexGrow: 1 }}>
                Tryouts are open! {notRegistered.map((c) => c.firstName).join(' and ')}{' '}
                {notRegistered.length === 1 ? "isn't" : "aren't"} registered yet.
              </Typography>
              <Button size="small" variant="outlined" onClick={() => navigate('/register-tryouts')}>
                Register
              </Button>
            </Box>
          )}

          {registeredWithDate.map(({ child, reg }) => {
            const cal = tryoutCalEvent(reg?.sessionId);
            return (
              <Box key={child.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <EventAvailableIcon fontSize="small" color="success" />
                <Typography variant="body2" sx={{ flexGrow: 1 }}>
                  {child.firstName} is registered for tryouts
                  {reg?.sessionLabel ? ` — ${reg.sessionLabel}` : ''}
                </Typography>
                <Chip size="small" color="success" label="Registered" />
                {cal && (
                  <MuiLink href={googleCalendarUrl(cal)} target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 13 }}>
                    <GoogleIcon sx={{ fontSize: 16 }} /> Add to Calendar
                  </MuiLink>
                )}
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ParentAttentionCard;
