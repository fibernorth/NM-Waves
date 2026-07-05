import { useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  CircularProgress,
  Skeleton,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api/teams';
import { playersApi } from '@/lib/api/players';
import { playerFinancesApi } from '@/lib/api/finances';
import { useAuthStore } from '@/stores/authStore';
import {
  isAdmin as checkIsAdmin,
  isParent as checkIsParent,
  isCoach as checkIsCoach,
  hasRole,
} from '@/lib/auth/roles';
import GroupsIcon from '@mui/icons-material/Groups';
import PersonIcon from '@mui/icons-material/Person';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import CampaignIcon from '@mui/icons-material/Campaign';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import EventIcon from '@mui/icons-material/Event';
import PushPinIcon from '@mui/icons-material/PushPin';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import LinkIcon from '@mui/icons-material/Link';
import PaymentIcon from '@mui/icons-material/Payment';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { format } from 'date-fns';
import LinkChildDialog from '@/features/players/components/LinkChildDialog';
import ParentOnboardingDialog from '../components/ParentOnboardingDialog';
import {
  collection,
  doc,
  getDoc,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const eventTypeIcons: Record<string, JSX.Element> = {
  game: <SportsBaseballIcon fontSize="small" color="success" />,
  practice: <FitnessCenterIcon fontSize="small" color="primary" />,
  tournament: <EmojiEventsIcon fontSize="small" sx={{ color: '#ed6c02' }} />,
  meeting: <GroupsIcon fontSize="small" color="secondary" />,
  other: <EventIcon fontSize="small" color="action" />,
};

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const isParent = checkIsParent(user);
  const isCoachOrAbove = checkIsCoach(user);
  // True only for coaches who are NOT also admins
  const isCoachOnly = hasRole(user, 'coach') && !isAdmin;

  const [linkChildOpen, setLinkChildOpen] = useState(false);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  const linkedPlayerIds = user?.linkedPlayerIds || [];
  const coachTeamIds = user?.teamIds || [];

  // Check if parent needs onboarding (first login)
  const { data: needsOnboarding = false } = useQuery({
    queryKey: ['onboardingCheck', user?.uid],
    queryFn: async () => {
      if (!user?.uid) return false;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return false;
      // Only show onboarding if explicitly set to false (new signups)
      // Existing users without this field should NOT see onboarding
      return userDoc.data().onboardingComplete === false;
    },
    enabled: isParent && linkedPlayerIds.length > 0,
  });

  const showOnboarding = needsOnboarding && !onboardingDismissed;

  const { data: allTeams = [], isLoading: teamsLoading, isError: teamsError } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });
  const activeTeams = allTeams.filter(t => t.active);
  // For coaches (non-admin), only show their assigned teams
  const teams = isCoachOnly
    ? activeTeams.filter(t => coachTeamIds.includes(t.id))
    : activeTeams;

  // Only coaches/admins may read the full roster; parents would be denied by
  // the players read rule, so skip the query for parent-only users.
  const { data: allPlayers = [], isLoading: playersLoading, isError: playersError } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
    enabled: isCoachOrAbove,
  });
  const activePlayers = allPlayers.filter(p => p.active);
  // For coaches (non-admin), only show players on their teams
  const players = isCoachOnly
    ? activePlayers.filter(p => p.teamId && coachTeamIds.includes(p.teamId))
    : activePlayers;

  const { data: finances = [], isLoading: financesLoading, isError: financesError } = useQuery({
    queryKey: ['finances'],
    queryFn: () => playerFinancesApi.getAll(),
    enabled: isAdmin,
  });

  const { data: announcements = [], isLoading: announcementsLoading } = useQuery({
    queryKey: ['dashboard-announcements'],
    queryFn: async () => {
      const q = query(
        collection(db, 'announcements'),
        orderBy('pinned', 'desc'),
        orderBy('createdAt', 'desc'),
        limit(5)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      }));
    },
  });

  const { data: upcomingEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['dashboard-events'],
    queryFn: async () => {
      const q = query(
        collection(db, 'schedules'),
        where('startTime', '>=', Timestamp.now()),
        orderBy('startTime'),
        limit(5)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startTime: doc.data().startTime?.toDate() || new Date(),
        endTime: doc.data().endTime?.toDate() || new Date(),
      }));
    },
  });

  // Parent: fetch linked children details and their finances
  const { data: linkedChildren = [], isLoading: childrenLoading } = useQuery({
    queryKey: ['linkedChildren', ...linkedPlayerIds],
    queryFn: async () => {
      const results = await Promise.all(
        linkedPlayerIds.map(id => playersApi.getById(id))
      );
      return results.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof playersApi.getById>>>[];
    },
    enabled: isParent && linkedPlayerIds.length > 0,
  });

  const { data: childFinances = [] } = useQuery({
    queryKey: ['childFinances', ...linkedPlayerIds],
    queryFn: async () => {
      const results = await Promise.all(
        linkedPlayerIds.map(id => playerFinancesApi.getByPlayer(id))
      );
      return results.flat();
    },
    enabled: isParent && linkedPlayerIds.length > 0,
  });

  // Admin financial stats - use balanceDue for scholarship-accurate outstanding balance
  const totalPaid = finances.reduce((sum, f) => sum + f.totalPaid, 0);
  const totalOutstanding = finances.reduce(
    (sum, f) => sum + Math.max(0, f.balanceDue ?? (f.totalOwed - f.totalPaid)),
    0
  );

  const statsLoading = teamsLoading || playersLoading || (isAdmin && financesLoading);

  const stats = [
    // Club-wide team/player counts link to coach/admin-only pages, so only show
    // them to coaches and admins. Parents get their children summary section below.
    ...(isCoachOrAbove
      ? [
          {
            title: isCoachOnly ? 'My Teams' : 'Active Teams',
            value: teams.length,
            icon: <GroupsIcon sx={{ fontSize: 40 }} />,
            color: 'primary.main',
            action: () => navigate('/teams'),
          },
          {
            title: isCoachOnly ? 'My Players' : 'Active Players',
            value: players.length,
            icon: <PersonIcon sx={{ fontSize: 40 }} />,
            color: 'success.main',
            action: () => navigate('/players'),
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            title: 'Total Collected',
            value: `$${totalPaid.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            icon: <AttachMoneyIcon sx={{ fontSize: 40 }} />,
            color: 'info.main',
            action: () => navigate('/finances/billing'),
          },
          {
            title: 'Outstanding Balance',
            value: `$${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
            icon: <TrendingUpIcon sx={{ fontSize: 40 }} />,
            color: totalOutstanding > 0 ? 'error.main' : 'success.main',
            action: () => navigate('/finances/billing'),
          },
        ]
      : []),
  ];

  const hasError = teamsError || playersError || (isAdmin && financesError);

  // Determine the subtitle based on role
  const getSubtitle = () => {
    if (isParent && !isCoachOrAbove) return "Here's an overview of your children's activity";
    if (isCoachOnly) return "Here's an overview of your teams and upcoming events";
    return "Here's an overview of the Northern Michigan Waves organization";
  };

  return (
    <Box>
      {hasError && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to load some dashboard data. Please refresh the page.</Alert>
      )}
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.displayName}!
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
        {getSubtitle()}
      </Typography>

      {/* Parent: Children Cards */}
      {isParent && (
        <Box sx={{ mb: 4 }}>
          {childrenLoading && linkedPlayerIds.length > 0 ? (
            <Grid container spacing={3}>
              {linkedPlayerIds.map((id) => (
                <Grid item xs={12} sm={6} md={4} key={id}>
                  <Card>
                    <CardContent>
                      <Skeleton variant="text" width="60%" height={32} />
                      <Skeleton variant="text" width="40%" />
                      <Skeleton variant="rectangular" height={40} sx={{ mt: 2 }} />
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : linkedChildren.length > 0 ? (
            <>
              <Grid container spacing={3}>
                {linkedChildren.map((child) => {
                  const childFin = childFinances.filter(f => f.playerId === child.id);
                  const totalPaidChild = childFin.reduce((s, f) => s + f.totalPaid, 0);
                  // Use balanceDue which correctly accounts for scholarships
                  const balanceDueChild = childFin.reduce((s, f) => s + (f.balanceDue ?? (f.totalOwed - f.totalPaid)), 0);
                  return (
                    <Grid item xs={12} sm={6} md={4} key={child.id}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          '&:hover': { transform: 'translateY(-4px)', boxShadow: 4 },
                        }}
                        onClick={() => navigate(`/players/${child.id}`)}
                      >
                        <CardContent>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                            <ChildCareIcon sx={{ fontSize: 36, color: 'primary.main' }} />
                            <Box>
                              <Typography variant="h6" sx={{ lineHeight: 1.2 }}>
                                {child.firstName} {child.lastName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {child.teamName || 'Unassigned'}
                              </Typography>
                            </Box>
                          </Box>
                          {childFin.length > 0 && (
                            <>
                              <Divider sx={{ mb: 1.5 }} />
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Box>
                                  <Typography variant="caption" color="text.secondary">Paid</Typography>
                                  <Typography variant="body2" fontWeight={600} color="success.main">
                                    ${totalPaidChild.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </Typography>
                                </Box>
                                <Box>
                                  <Typography variant="caption" color="text.secondary">Balance Due</Typography>
                                  <Typography
                                    variant="body2"
                                    fontWeight={600}
                                    color={balanceDueChild > 0 ? 'error.main' : 'success.main'}
                                  >
                                    ${Math.max(0, balanceDueChild).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    {balanceDueChild > 0 && ' owed'}
                                  </Typography>
                                </Box>
                              </Box>
                              {balanceDueChild > 0 && (
                                <Button
                                  variant="contained"
                                  color="primary"
                                  size="small"
                                  fullWidth
                                  startIcon={<PaymentIcon />}
                                  onClick={(e) => { e.stopPropagation(); navigate('/my-invoices'); }}
                                  sx={{ mt: 1.5 }}
                                >
                                  View Invoices & Pay
                                </Button>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
              {/* Link another child button when children already exist */}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={() => setLinkChildOpen(true)}
                >
                  Link Another Child
                </Button>
              </Box>
            </>
          ) : (
            <Card variant="outlined" sx={{ textAlign: 'center', py: 4 }}>
              <CardContent>
                <ChildCareIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No children linked yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Link your children to see their profiles, teams, and invoices.
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<LinkIcon />}
                  onClick={() => setLinkChildOpen(true)}
                >
                  Link a Child
                </Button>
              </CardContent>
            </Card>
          )}
        </Box>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3}>
        {statsLoading ? (
          stats.map((_, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Skeleton variant="circular" width={40} height={40} sx={{ mb: 2 }} />
                  <Skeleton variant="text" width="50%" height={48} />
                  <Skeleton variant="text" width="70%" />
                </CardContent>
              </Card>
            </Grid>
          ))
        ) : (
          stats.map((stat, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card
                sx={{
                  height: '100%',
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4,
                  },
                }}
                onClick={stat.action}
              >
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ color: stat.color, mr: 2 }}>{stat.icon}</Box>
                  </Box>
                  <Typography variant="h3" component="div" gutterBottom>
                    {stat.value}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {stat.title}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        {/* Announcements */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CampaignIcon color="primary" />
                  <Typography variant="h6">Recent Announcements</Typography>
                </Box>
                <Button size="small" onClick={() => navigate('/announcements')}>View All</Button>
              </Box>
              {announcementsLoading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {[1, 2, 3].map(i => <Skeleton key={i} variant="text" height={32} />)}
                </Box>
              ) : announcements.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No announcements yet
                </Typography>
              ) : (
                <List dense disablePadding>
                  {announcements.map((a: any) => (
                    <ListItem key={a.id} sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {a.pinned ? <PushPinIcon fontSize="small" color="primary" /> : <CampaignIcon fontSize="small" color="action" />}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" fontWeight="medium" noWrap>{a.title}</Typography>
                            {a.priority === 'urgent' && <Chip label="Urgent" size="small" color="error" sx={{ height: 20 }} />}
                          </Box>
                        }
                        secondary={format(a.createdAt, 'MMM d, yyyy')}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Upcoming Events */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CalendarMonthIcon color="primary" />
                  <Typography variant="h6">Upcoming Events</Typography>
                </Box>
                <Button size="small" onClick={() => navigate(isCoachOrAbove ? '/schedules' : '/schedule')}>View All</Button>
              </Box>
              {eventsLoading ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {[1, 2, 3].map(i => <Skeleton key={i} variant="text" height={32} />)}
                </Box>
              ) : upcomingEvents.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No upcoming events
                </Typography>
              ) : (
                <List dense disablePadding>
                  {upcomingEvents.map((e: any) => (
                    <ListItem key={e.id} sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        {eventTypeIcons[e.eventType] || eventTypeIcons.other}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body2" fontWeight="medium" noWrap>{e.title}</Typography>
                        }
                        secondary={`${format(e.startTime, 'EEE, MMM d \'at\' h:mm a')} - ${e.location || 'TBD'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
                {isParent && (
                  <Button variant="contained" color="primary" fullWidth startIcon={<ReceiptLongIcon />} onClick={() => navigate('/my-invoices')}>
                    My Invoices & Payments
                  </Button>
                )}
                {/* Teams/Players pages are coach/admin-only; showing them to
                    parents produced dead buttons that silently bounced back. */}
                {isCoachOrAbove && (
                  <>
                    <Button variant="outlined" fullWidth onClick={() => navigate('/teams')}>
                      {isAdmin ? 'Manage Teams' : 'View Teams'}
                    </Button>
                    <Button variant="outlined" fullWidth onClick={() => navigate('/players')}>
                      {isAdmin ? 'Manage Players' : 'View Players'}
                    </Button>
                  </>
                )}
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => navigate(isCoachOrAbove ? '/schedules' : '/schedule')}
                >
                  View Schedule
                </Button>
                {isAdmin && (
                  <>
                    <Button variant="outlined" fullWidth onClick={() => navigate('/finances/billing')}>
                      View Billing
                    </Button>
                    <Button variant="outlined" fullWidth onClick={() => navigate('/finances/assumptions')}>
                      Update Cost Assumptions
                    </Button>
                  </>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Team Overview */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {isCoachOnly ? 'My Teams' : 'Active Teams'}
              </Typography>
              {teamsLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} />
                </Box>
              ) : teams.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {isCoachOnly ? 'No teams assigned to you yet' : 'No active teams'}
                </Typography>
              ) : (
                <List dense disablePadding>
                  {teams.slice(0, 6).map((team: any) => (
                    <ListItem
                      key={team.id}
                      sx={{ px: 0, cursor: 'pointer' }}
                      onClick={() => navigate(`/teams/${team.id}`)}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <GroupsIcon fontSize="small" color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={team.name}
                        secondary={`${team.ageGroup} - ${team.season}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Link Child Dialog */}
      <LinkChildDialog open={linkChildOpen} onClose={() => setLinkChildOpen(false)} />

      {/* Parent Onboarding Dialog */}
      {isParent && (
        <ParentOnboardingDialog
          open={showOnboarding}
          onClose={() => setOnboardingDismissed(true)}
          linkedPlayerIds={linkedPlayerIds}
        />
      )}
    </Box>
  );
};

export default DashboardPage;
