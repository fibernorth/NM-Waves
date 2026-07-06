import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Switch,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import EventIcon from '@mui/icons-material/Event';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlaceIcon from '@mui/icons-material/Place';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tryoutSessionsApi, type TryoutSession, type TryoutSessionData } from '@/lib/api/tryoutSessions';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const AGE_GROUPS = ['8U', '9U', '10U', '11U', '12U', '13U', '14U', '16U', '18U'];

interface FormState {
  dateStr: string; // yyyy-MM-dd
  startTime: string;
  endTime: string;
  location: string;
  ageGroups: string[];
  notes: string;
  active: boolean;
}

const emptyForm: FormState = {
  dateStr: '',
  startTime: '',
  endTime: '',
  location: '',
  ageGroups: [],
  notes: '',
  active: true,
};

/**
 * Admin/coach card for defining the tryout dates and locations families can
 * choose from. Shown at the top of the Tryout Signups page.
 */
const TryoutSessionsManager = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<TryoutSession | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data: sessions = [] } = useQuery({
    queryKey: ['tryoutSessionsAll'],
    queryFn: () => tryoutSessionsApi.getAll(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tryoutSessionsAll'] });
    queryClient.invalidateQueries({ queryKey: ['tryoutSessionsUpcoming'] });
  };

  const openNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (s: TryoutSession) => {
    setEditing(s);
    setForm({
      dateStr: format(s.date, 'yyyy-MM-dd'),
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
      ageGroups: s.ageGroups,
      notes: s.notes,
      active: s.active,
    });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      const data: TryoutSessionData = {
        // Noon avoids timezone edge cases shifting the calendar day.
        date: new Date(`${form.dateStr}T12:00:00`),
        startTime: form.startTime.trim(),
        endTime: form.endTime.trim(),
        location: form.location.trim(),
        ageGroups: form.ageGroups,
        notes: form.notes.trim(),
        active: form.active,
      };
      if (editing) await tryoutSessionsApi.update(editing.id, data);
      else await tryoutSessionsApi.create(data);
    },
    onSuccess: () => { invalidate(); setOpen(false); toast.success(editing ? 'Tryout date updated' : 'Tryout date added'); },
    onError: (err: any) => toast.error(err?.message || 'Failed to save'),
  });

  const remove = useMutation({
    mutationFn: (s: TryoutSession) => tryoutSessionsApi.remove(s.id),
    onSuccess: () => { invalidate(); toast.success('Tryout date removed'); },
    onError: (err: any) => toast.error(err?.message || 'Failed to remove'),
  });

  const canSave = form.dateStr && form.location.trim();

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EventIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>Tryout Dates & Locations</Typography>
        </Box>
        <Button size="small" startIcon={<AddIcon />} onClick={openNew}>Add date</Button>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
        These appear on the public signup page and let families choose which session they'll attend.
      </Typography>

      {sessions.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No tryout dates yet — add the first one so families can pick a session.
        </Typography>
      ) : (
        sessions.map((s) => (
          <Box key={s.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', '&:last-child': { borderBottom: 'none' }, flexWrap: 'wrap' }}>
            <Typography variant="body2" fontWeight={600} sx={{ minWidth: 150 }}>
              {format(s.date, 'EEE, MMM d, yyyy')}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
              {s.startTime}{s.endTime ? `–${s.endTime}` : ''}
            </Typography>
            {s.location && <Chip icon={<PlaceIcon />} label={s.location} size="small" variant="outlined" />}
            {s.ageGroups.length > 0 && (
              <Typography variant="caption" color="text.secondary">({s.ageGroups.join(', ')})</Typography>
            )}
            {!s.active && <Chip label="Hidden" size="small" color="default" />}
            <Box sx={{ flexGrow: 1 }} />
            <Tooltip title="Edit">
              <IconButton size="small" onClick={() => openEdit(s)}><EditIcon fontSize="small" /></IconButton>
            </Tooltip>
            <Tooltip title="Remove">
              <IconButton size="small" color="error" onClick={() => { if (confirm('Remove this tryout date? Families who chose it keep their registration but will need to pick a new date.')) remove.mutate(s); }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        ))
      )}

      <Dialog open={open} onClose={() => !save.isPending && setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Tryout Date' : 'Add Tryout Date'}</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Date" type="date" fullWidth margin="normal" InputLabelProps={{ shrink: true }}
            value={form.dateStr} onChange={(e) => setForm((f) => ({ ...f, dateStr: e.target.value }))}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Start time" fullWidth margin="normal" placeholder="9:00 AM"
              value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            />
            <TextField
              label="End time" fullWidth margin="normal" placeholder="12:00 PM"
              value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            />
          </Box>
          <TextField
            label="Location" fullWidth margin="normal" placeholder="e.g. Twin Birch Fields, Kalkaska"
            value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
          />
          <Autocomplete
            multiple options={AGE_GROUPS} value={form.ageGroups}
            onChange={(_, v) => setForm((f) => ({ ...f, ageGroups: v }))}
            renderInput={(params) => (
              <TextField {...params} label="Divisions (optional)" margin="normal" helperText="Leave empty if this session is open to all divisions" />
            )}
          />
          <TextField
            label="Notes (optional)" fullWidth margin="normal" multiline minRows={2}
            placeholder="What to bring, check-in details, rain plan…"
            value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <FormControlLabel
            control={<Switch checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />}
            label="Visible to families"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)} disabled={save.isPending}>Cancel</Button>
          <Button variant="contained" onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TryoutSessionsManager;
