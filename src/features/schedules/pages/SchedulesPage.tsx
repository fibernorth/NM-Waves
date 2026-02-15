import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
  CardActions,
  MenuItem,
  TextField,
  ToggleButtonGroup,
  ToggleButton,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Grid,
  Stack,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ViewListIcon from '@mui/icons-material/ViewList';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import GroupsIcon from '@mui/icons-material/Groups';
import EventIcon from '@mui/icons-material/Event';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { schedulesApi } from '@/lib/api/schedules';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import type { ScheduleEvent } from '@/types/models';
import toast from 'react-hot-toast';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns';
import EventFormDialog from '../components/EventFormDialog';

type ViewMode = 'list' | 'calendar';

const EVENT_TYPE_CONFIG: Record<
  ScheduleEvent['eventType'],
  { icon: React.ReactNode; color: string; label: string }
> = {
  game: { icon: <SportsBaseballIcon fontSize="small" />, color: '#4caf50', label: 'Game' },
  practice: { icon: <FitnessCenterIcon fontSize="small" />, color: '#2196f3', label: 'Practice' },
  tournament: { icon: <EmojiEventsIcon fontSize="small" />, color: '#ff9800', label: 'Tournament' },
  meeting: { icon: <GroupsIcon fontSize="small" />, color: '#9c27b0', label: 'Meeting' },
  other: { icon: <EventIcon fontSize="small" />, color: '#757575', label: 'Other' },
};

const EVENT_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'game', label: 'Game' },
  { value: 'practice', label: 'Practice' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
];

const SchedulesPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';
  const isCoach = user?.role === 'coach' || isAdmin;

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [teamFilter, setTeamFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [openForm, setOpenForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [detailEvent, setDetailEvent] = useState<ScheduleEvent | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedulesApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Event deleted successfully');
      setDetailEvent(null);
    },
    onError: () => {
      toast.error('Failed to delete event');
    },
  });

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (teamFilter !== 'all' && ev.teamId !== teamFilter) return false;
      if (typeFilter !== 'all' && ev.eventType !== typeFilter) return false;
      return true;
    });
  }, [events, teamFilter, typeFilter]);

  const groupedByMonth = useMemo(() => {
    const groups: Record<string, ScheduleEvent[]> = {};
    const sorted = [...filteredEvents].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime()
    );
    sorted.forEach((ev) => {
      const key = format(ev.startTime, 'MMMM yyyy');
      if (!groups[key]) groups[key] = [];
      groups[key].push(ev);
    });
    return groups;
  }, [filteredEvents]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [calendarMonth]);

  const eventsForDay = (day: Date) => {
    return filteredEvents.filter((ev) => isSameDay(ev.startTime, day));
  };

  const handleAdd = () => {
    setSelectedEvent(null);
    setOpenForm(true);
  };

  const handleEdit = (event: ScheduleEvent) => {
    setSelectedEvent(event);
    setOpenForm(true);
    setDetailEvent(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setSelectedEvent(null);
  };

  const handleEventClick = (event: ScheduleEvent) => {
    setDetailEvent(event);
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarMonthIcon sx={{ fontSize: 36, color: 'primary.main' }} />
          <Typography variant="h4">Schedule</Typography>
        </Box>
        {isCoach && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Event
          </Button>
        )}
      </Box>

      {/* Filters and View Toggle */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box
          sx={{
            display: 'flex',
            gap: 2,
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              select
              label="Team"
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              size="small"
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="all">All Teams</MenuItem>
              {teams.map((team) => (
                <MenuItem key={team.id} value={team.id}>
                  {team.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Event Type"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              size="small"
              sx={{ minWidth: 160 }}
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) => {
              if (val) setViewMode(val);
            }}
            size="small"
          >
            <ToggleButton value="list">
              <ViewListIcon sx={{ mr: 0.5 }} /> List
            </ToggleButton>
            <ToggleButton value="calendar">
              <CalendarMonthIcon sx={{ mr: 0.5 }} /> Calendar
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Loading state */}
      {isLoading && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography>Loading schedule...</Typography>
        </Paper>
      )}

      {/* Empty state */}
      {!isLoading && filteredEvents.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <CalendarMonthIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">
            No events found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isCoach
              ? 'Click "Add Event" to create your first event.'
              : 'Check back later for upcoming events.'}
          </Typography>
        </Paper>
      )}

      {/* List View */}
      {!isLoading && viewMode === 'list' && filteredEvents.length > 0 && (
        <Box>
          {Object.entries(groupedByMonth).map(([month, monthEvents]) => (
            <Box key={month} sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 1.5, color: 'text.secondary' }}>
                {month}
              </Typography>
              <Stack spacing={1.5}>
                {monthEvents.map((ev) => {
                  const config = EVENT_TYPE_CONFIG[ev.eventType];
                  return (
                    <Card
                      key={ev.id}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { boxShadow: 4 },
                        borderLeft: `4px solid ${config.color}`,
                      }}
                      onClick={() => handleEventClick(ev)}
                    >
                      <CardContent sx={{ pb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                          <Box
                            sx={{
                              bgcolor: config.color,
                              color: 'white',
                              borderRadius: 1,
                              p: 0.75,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mt: 0.25,
                            }}
                          >
                            {config.icon}
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                flexWrap: 'wrap',
                                gap: 1,
                              }}
                            >
                              <Typography variant="subtitle1" fontWeight="bold">
                                {ev.title}
                              </Typography>
                              <Chip
                                label={config.label}
                                size="small"
                                sx={{
                                  bgcolor: config.color,
                                  color: 'white',
                                  fontWeight: 500,
                                }}
                              />
                            </Box>
                            <Box
                              sx={{
                                display: 'flex',
                                gap: 2,
                                mt: 0.5,
                                flexWrap: 'wrap',
                                color: 'text.secondary',
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <AccessTimeIcon sx={{ fontSize: 16 }} />
                                <Typography variant="body2">
                                  {format(ev.startTime, 'EEE, MMM d, yyyy h:mm a')} -{' '}
                                  {format(ev.endTime, 'h:mm a')}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <LocationOnIcon sx={{ fontSize: 16 }} />
                                <Typography variant="body2">{ev.location}</Typography>
                              </Box>
                            </Box>
                            {ev.teamName && (
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                Team: {ev.teamName}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                      </CardContent>
                      {isCoach && (
                        <CardActions sx={{ pt: 0, justifyContent: 'flex-end' }}>
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(ev);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(ev.id);
                            }}
                          >
                            Delete
                          </Button>
                        </CardActions>
                      )}
                    </Card>
                  );
                })}
              </Stack>
            </Box>
          ))}
        </Box>
      )}

      {/* Calendar View */}
      {!isLoading && viewMode === 'calendar' && (
        <Paper sx={{ p: 2 }}>
          {/* Calendar Navigation */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <IconButton onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}>
              <ChevronLeftIcon />
            </IconButton>
            <Typography variant="h6">{format(calendarMonth, 'MMMM yyyy')}</Typography>
            <IconButton onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}>
              <ChevronRightIcon />
            </IconButton>
          </Box>

          {/* Day of week headers */}
          <Grid container spacing={0}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <Grid item xs={12 / 7} key={day}>
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 1,
                    fontWeight: 'bold',
                    color: 'text.secondary',
                    fontSize: '0.875rem',
                  }}
                >
                  {day}
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Calendar grid */}
          <Grid container spacing={0}>
            {calendarDays.map((day) => {
              const dayEvents = eventsForDay(day);
              const inCurrentMonth = isSameMonth(day, calendarMonth);
              const today = isToday(day);
              return (
                <Grid item xs={12 / 7} key={day.toISOString()}>
                  <Box
                    sx={{
                      minHeight: 90,
                      border: '1px solid',
                      borderColor: 'divider',
                      p: 0.5,
                      bgcolor: today
                        ? 'action.selected'
                        : inCurrentMonth
                        ? 'background.paper'
                        : 'action.hover',
                      opacity: inCurrentMonth ? 1 : 0.5,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: today ? 'bold' : 'normal',
                        color: today ? 'primary.main' : 'text.primary',
                        mb: 0.5,
                      }}
                    >
                      {format(day, 'd')}
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      {dayEvents.slice(0, 3).map((ev) => {
                        const config = EVENT_TYPE_CONFIG[ev.eventType];
                        return (
                          <Chip
                            key={ev.id}
                            label={ev.title}
                            size="small"
                            onClick={() => handleEventClick(ev)}
                            sx={{
                              bgcolor: config.color,
                              color: 'white',
                              height: 20,
                              fontSize: '0.65rem',
                              cursor: 'pointer',
                              '& .MuiChip-label': {
                                px: 0.5,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              },
                              maxWidth: '100%',
                            }}
                          />
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontSize: '0.6rem', textAlign: 'center' }}
                        >
                          +{dayEvents.length - 3} more
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Grid>
              );
            })}
          </Grid>
        </Paper>
      )}

      {/* Event Detail Dialog */}
      <Dialog
        open={!!detailEvent}
        onClose={() => setDetailEvent(null)}
        maxWidth="sm"
        fullWidth
      >
        {detailEvent && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    bgcolor: EVENT_TYPE_CONFIG[detailEvent.eventType].color,
                    color: 'white',
                    borderRadius: 1,
                    p: 0.75,
                    display: 'flex',
                  }}
                >
                  {EVENT_TYPE_CONFIG[detailEvent.eventType].icon}
                </Box>
                {detailEvent.title}
              </Box>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Type
                  </Typography>
                  <Chip
                    label={EVENT_TYPE_CONFIG[detailEvent.eventType].label}
                    size="small"
                    sx={{
                      bgcolor: EVENT_TYPE_CONFIG[detailEvent.eventType].color,
                      color: 'white',
                      mt: 0.25,
                    }}
                  />
                </Box>
                <Divider />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Date & Time
                  </Typography>
                  <Typography>
                    {format(detailEvent.startTime, 'EEEE, MMMM d, yyyy')}
                  </Typography>
                  <Typography>
                    {format(detailEvent.startTime, 'h:mm a')} - {format(detailEvent.endTime, 'h:mm a')}
                  </Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Location
                  </Typography>
                  <Typography>{detailEvent.location}</Typography>
                </Box>
                <Divider />
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Team
                  </Typography>
                  <Typography>{detailEvent.teamName || 'All Teams'}</Typography>
                </Box>
                {detailEvent.notes && (
                  <>
                    <Divider />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Notes
                      </Typography>
                      <Typography>{detailEvent.notes}</Typography>
                    </Box>
                  </>
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              {isCoach && (
                <>
                  <Button
                    startIcon={<EditIcon />}
                    onClick={() => handleEdit(detailEvent)}
                  >
                    Edit
                  </Button>
                  <Button
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(detailEvent.id)}
                  >
                    Delete
                  </Button>
                </>
              )}
              <Button onClick={() => setDetailEvent(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Event Form Dialog */}
      {isCoach && (
        <EventFormDialog
          open={openForm}
          onClose={handleCloseForm}
          event={selectedEvent}
        />
      )}
    </Box>
  );
};

export default SchedulesPage;
