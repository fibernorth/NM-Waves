import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Chip,
  CircularProgress,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Tabs,
  Tab,
} from '@mui/material';
import SportsIcon from '@mui/icons-material/Sports';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { format, isToday, isTomorrow } from 'date-fns';
import type { ScheduleEvent } from '@/types/models';
import { schedulesApi } from '@/lib/api/schedules';
import SponsorBanner from '@/components/common/SponsorBanner';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const EVENT_TYPE_COLORS: Record<string, 'primary' | 'success' | 'secondary' | 'warning' | 'info'> = {
  game: 'primary',
  practice: 'success',
  tournament: 'secondary',
  meeting: 'warning',
  other: 'info',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  game: 'Game',
  practice: 'Practice',
  tournament: 'Tournament',
  meeting: 'Meeting',
  other: 'Event',
};

const GC_TEAMS = [
  { label: '12U', target: '#gc-schedule-widget-o35l', widgetId: '287ff589-cb51-4351-8d24-266df34087e6' },
  { label: '13U', target: '#gc-schedule-widget-8626', widgetId: 'd2dfb59d-745d-4c90-b013-10e3a79bdaed' },
];

const PublicSchedulePage = () => {
  useDocumentTitle('Schedule');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gcTab, setGcTab] = useState(0);

  // Load GameChanger SDK and initialize all team widgets
  useEffect(() => {
    const scriptId = 'gc-sdk-script';
    const initWidgets = () => {
      for (const team of GC_TEAMS) {
        (window as any).GC?.team?.schedule?.init({
          target: team.target,
          widgetId: team.widgetId,
          maxVerticalGamesVisible: 4,
        });
      }
    };

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://widgets.gc.com/static/js/sdk.v1.js';
      script.onload = initWidgets;
      document.body.appendChild(script);
    } else if ((window as any).GC) {
      initWidgets();
    }
  }, []);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const eventsData = await schedulesApi.getUpcoming();
        setEvents(eventsData);
      } catch (err) {
        console.error('Error fetching schedule:', err);
        setError('Unable to load schedule at this time. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  // Group events by date
  const groupedEvents: Record<string, ScheduleEvent[]> = {};
  events.forEach((event) => {
    const dateKey = format(event.startTime, 'yyyy-MM-dd');
    if (!groupedEvents[dateKey]) {
      groupedEvents[dateKey] = [];
    }
    groupedEvents[dateKey].push(event);
  });

  const getDateLabel = (dateKey: string): string => {
    const date = new Date(dateKey + 'T00:00:00');
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'EEEE, MMMM d, yyyy');
  };

  const exportToICal = () => {
    if (events.length === 0) return;
    const pad = (n: number) => String(n).padStart(2, '0');
    const toICalDate = (d: Date) =>
      `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Northern Michigan Waves//Schedule//EN',
      'CALSCALE:GREGORIAN',
    ];

    for (const event of events) {
      lines.push(
        'BEGIN:VEVENT',
        `DTSTART:${toICalDate(event.startTime)}`,
        `DTEND:${toICalDate(event.endTime)}`,
        `SUMMARY:${event.title.replace(/[,;\\]/g, ' ')}`,
        ...(event.location ? [`LOCATION:${event.location.replace(/[,;\\]/g, ' ')}`] : []),
        ...(event.teamName ? [`DESCRIPTION:Team: ${event.teamName}`] : []),
        `UID:${event.id}@tcwaves`,
        'END:VEVENT',
      );
    }

    lines.push('END:VCALENDAR');
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tc-waves-schedule.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{
          backgroundColor: 'primary.main',
          color: 'white',
          py: { xs: 4, md: 6 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h3"
            component="h1"
            fontWeight={700}
            sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' } }}
          >
            Schedule
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Upcoming games, practices, and events
          </Typography>
        </Container>
      </Box>

      {/* GameChanger Live Scores */}
      <Container maxWidth="md" sx={{ py: { xs: 3, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SportsIcon color="primary" />
          <Typography variant="h5" fontWeight={600}>
            Live Scores &amp; Results
          </Typography>
        </Box>
        <Paper sx={{ mb: 2 }}>
          <Tabs
            value={gcTab}
            onChange={(_, v) => setGcTab(v)}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            {GC_TEAMS.map((team) => (
              <Tab key={team.label} label={team.label} />
            ))}
          </Tabs>
          {GC_TEAMS.map((team, idx) => (
            <Box key={team.label} sx={{ p: 2, display: gcTab === idx ? 'block' : 'none' }}>
              <div id={team.target.replace('#', '')} />
            </Box>
          ))}
        </Paper>
      </Container>

      <Divider />

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        {events.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="outlined"
              startIcon={<FileDownloadIcon />}
              onClick={exportToICal}
              size="small"
            >
              Export to Calendar
            </Button>
          </Box>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : events.length === 0 ? (
          <Alert severity="info">
            No upcoming events scheduled at this time. Check back soon!
          </Alert>
        ) : (
          Object.entries(groupedEvents).map(([dateKey, dateEvents]) => (
            <Box key={dateKey} sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <CalendarTodayIcon color="primary" fontSize="small" />
                <Typography variant="h6" fontWeight={600}>
                  {getDateLabel(dateKey)}
                </Typography>
              </Box>
              <List disablePadding>
                {dateEvents.map((event, index) => (
                  <Paper key={event.id} sx={{ mb: 1.5 }}>
                    <ListItem
                      sx={{
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        gap: 1,
                        py: 2,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                        <ListItemIcon sx={{ minWidth: 'auto' }}>
                          <Chip
                            label={EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                            color={EVENT_TYPE_COLORS[event.eventType] || 'default'}
                            size="small"
                            sx={{ fontWeight: 600, minWidth: 90 }}
                          />
                        </ListItemIcon>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" fontWeight={600}>
                              {event.title}
                            </Typography>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                                <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                <Typography variant="body2" color="text.secondary">
                                  {format(event.startTime, 'h:mm a')} - {format(event.endTime, 'h:mm a')}
                                </Typography>
                              </Box>
                              {event.location && (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <LocationOnIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                  <Typography variant="body2" color="text.secondary">
                                    {event.location}
                                  </Typography>
                                </Box>
                              )}
                              {event.teamName && (
                                <Chip
                                  label={event.teamName}
                                  size="small"
                                  variant="outlined"
                                  sx={{ mt: 0.5, fontSize: '0.75rem' }}
                                />
                              )}
                            </Box>
                          }
                        />
                      </Box>
                    </ListItem>
                    {index < dateEvents.length - 1 && <Divider />}
                  </Paper>
                ))}
              </List>
            </Box>
          ))
        )}
      </Container>

      <SponsorBanner mode="carousel" />
    </Box>
  );
};

export default PublicSchedulePage;
