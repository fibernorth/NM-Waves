import { Box, Typography, Grid, Card, CardContent, Button, Chip, List, ListItem, ListItemText, ListItemIcon } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api/teams';
import { playersApi } from '@/lib/api/players';
import { playerFinancesApi } from '@/lib/api/finances';
import { useAuthStore } from '@/stores/authStore';
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
import { format } from 'date-fns';
import {
  collection,
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
  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getActive(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getActive(),
  });

  const { data: finances = [] } = useQuery({
    queryKey: ['finances'],
    queryFn: () => playerFinancesApi.getAll(),
    enabled: isAdmin,
  });

  const { data: announcements = [] } = useQuery({
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

  const { data: upcomingEvents = [] } = useQuery({
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

  const totalOwed = finances.reduce((sum, f) => sum + f.totalOwed, 0);
  const totalPaid = finances.reduce((sum, f) => sum + f.totalPaid, 0);
  const totalBalance = totalPaid - totalOwed;

  const stats = [
    {
      title: 'Active Teams',
      value: teams.length,
      icon: <GroupsIcon sx={{ fontSize: 40 }} />,
      color: 'primary.main',
      action: () => navigate('/teams'),
    },
    {
      title: 'Active Players',
      value: players.length,
      icon: <PersonIcon sx={{ fontSize: 40 }} />,
      color: 'success.main',
      action: () => navigate('/players'),
    },
    ...(isAdmin
      ? [
          {
            title: 'Total Collected',
            value: `$${totalPaid.toLocaleString()}`,
            icon: <AttachMoneyIcon sx={{ fontSize: 40 }} />,
            color: 'info.main',
            action: () => navigate('/finances/billing'),
          },
          {
            title: 'Outstanding Balance',
            value: `$${Math.abs(totalBalance).toLocaleString()}`,
            icon: <TrendingUpIcon sx={{ fontSize: 40 }} />,
            color: totalBalance < 0 ? 'error.main' : 'success.main',
            action: () => navigate('/finances/billing'),
          },
        ]
      : []),
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome back, {user?.displayName}!
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
        Here's an overview of the TC Waves organization
      </Typography>

      <Grid container spacing={3}>
        {stats.map((stat, index) => (
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
        ))}
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
              {announcements.length === 0 ? (
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
                <Button size="small" onClick={() => navigate('/schedules')}>View All</Button>
              </Box>
              {upcomingEvents.length === 0 ? (
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
                <Button variant="outlined" fullWidth onClick={() => navigate('/teams')}>
                  Manage Teams
                </Button>
                <Button variant="outlined" fullWidth onClick={() => navigate('/players')}>
                  Manage Players
                </Button>
                <Button variant="outlined" fullWidth onClick={() => navigate('/schedules')}>
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
                Active Teams
              </Typography>
              {teams.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No active teams
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
    </Box>
  );
};

export default DashboardPage;
