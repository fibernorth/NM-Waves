import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Stack,
  TextField,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  evalEventsApi,
  instantiateTemplate,
  stationsFromCategories,
  SOFTBALL_TEMPLATE,
  type EvalEventType,
} from '@/lib/api/evaluations';
import { useAuthStore } from '@/stores/authStore';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const TYPE_LABELS: Record<EvalEventType, string> = {
  tryout: 'Tryout',
  camp: 'Camp / clinic',
  practice: 'Practice',
  midseason: 'Mid-season evaluation',
};

const EvaluationsPage = () => {
  useDocumentTitle('Evaluations');
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [type, setType] = useState<EvalEventType>('tryout');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['evalEvents'],
    queryFn: () => evalEventsApi.getAll(),
  });

  const create = useMutation({
    mutationFn: async () => {
      const tpl = instantiateTemplate(SOFTBALL_TEMPLATE);
      const id = await evalEventsApi.create({
        name: name.trim(),
        date: new Date(`${dateStr}T12:00:00`),
        type,
        status: 'draft',
        templateName: tpl.name,
        categories: tpl.categories,
        stations: stationsFromCategories(tpl.categories),
        participants: [],
        createdBy: user?.uid || '',
      });
      return id;
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['evalEvents'] });
      setCreateOpen(false);
      setName(''); setDateStr('');
      toast.success('Event created — add participants and evaluators on the Setup tab');
      navigate(`/evaluations/${id}`);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to create event'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => evalEventsApi.remove(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['evalEvents'] }); toast.success('Event deleted'); },
    onError: (err: any) => toast.error(err?.message || 'Failed to delete'),
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssessmentIcon color="primary" />
          <Typography variant="h4">Evaluations</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          New Evaluation Event
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Run tryouts, camps, and mid-season evaluations station by station: invite evaluators with a link,
        score on any phone, and watch live weighted rankings with full player report cards.
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
      ) : events.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No evaluation events yet — create one for your next tryout or a mid-season check-in.
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {events.map((e) => (
            <Paper key={e.id} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', cursor: 'pointer', '&:hover': { boxShadow: 3 } }}
              onClick={() => navigate(`/evaluations/${e.id}`)}>
              <Box sx={{ flexGrow: 1, minWidth: 200 }}>
                <Typography variant="h6">{e.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {format(e.date, 'EEE, MMM d, yyyy')} · {TYPE_LABELS[e.type]} · {e.participants.length} participants · {e.stations.length} stations
                </Typography>
              </Box>
              <Chip
                label={e.status === 'open' ? 'Open for scoring' : e.status === 'closed' ? 'Closed' : 'Draft'}
                color={e.status === 'open' ? 'success' : 'default'}
                size="small"
              />
              <IconButton size="small" color="error" onClick={(ev) => {
                ev.stopPropagation();
                if (confirm(`Delete "${e.name}"? Scores already recorded will no longer be viewable.`)) remove.mutate(e.id);
              }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog open={createOpen} onClose={() => !create.isPending && setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>New Evaluation Event</DialogTitle>
        <DialogContent>
          <TextField label="Name" fullWidth margin="normal" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. 2027 Season Tryouts — Day 1" />
          <TextField label="Date" type="date" fullWidth margin="normal" InputLabelProps={{ shrink: true }}
            value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
          <TextField select label="Type" fullWidth margin="normal" value={type} onChange={(e) => setType(e.target.value as EvalEventType)}>
            {(Object.keys(TYPE_LABELS) as EvalEventType[]).map((t) => (
              <MenuItem key={t} value={t}>{TYPE_LABELS[t]}</MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" color="text.secondary">
            Starts from the softball scoring template (weighted categories: hitting, fielding, throwing,
            speed, pitching/catching, intangibles) with one station per category — everything editable on the Setup tab.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={create.isPending}>Cancel</Button>
          <Button variant="contained" onClick={() => create.mutate()} disabled={!name.trim() || !dateStr || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EvaluationsPage;
