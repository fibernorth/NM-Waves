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
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { format, isToday, isTomorrow } from 'date-fns';
import type { ScheduleEvent } from '@/types/models';
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

const PublicSchedulePage = () => {
  useDocumentTitle('Schedule');
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const now = Timestamp.now();
        const q = query(
          collection(db, 'schedules'),
          where('startTime', '>=', now),
          orderBy('startTime', 'asc')
        );
        const snapshot = await getDocs(q);
        const eventsData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            eventType: data.eventType,
            teamId: data.teamId,
            teamName: data.teamName,
            title: data.title,
            location: data.location,
            startTime: data.startTime?.toDate() || new Date(),
            endTime: data.endTime?.toDate() || new Date(),
            notes: data.notes,
            createdBy: data.createdBy,
          } as ScheduleEvent;
        });
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
      'PRODID:-//TC Waves Ball Club//Schedule//EN',
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
