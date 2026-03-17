import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  MenuItem,
  Chip,
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  Divider,
  Alert,
  FormControlLabel,
  Checkbox,
  Typography,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tournamentsApi } from '@/lib/api/tournaments';
import { teamsApi } from '@/lib/api/teams';
import { Tournament, TournamentWorkflowStatus } from '@/types/models';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import TournamentWorkflowStepper from './TournamentWorkflowStepper';
import TournamentDepositCard from './TournamentDepositCard';

const tournamentSchema = z.object({
  name: z.string().min(1, 'Tournament name is required'),
  location: z.string().min(1, 'Location is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
  teamIds: z.array(z.string()),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
  cost: z.number().min(0, 'Cost must be 0 or greater'),
  notes: z.string().optional(),
  status: z.enum(['upcoming', 'in_progress', 'completed']),
  workflowStatus: z.string().optional(),
  depositAmount: z.number().min(0).optional(),
  balanceDueDate: z.string().optional(),
  registrationUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
  scheduleUrl: z.string().optional(),
  accommodationsInfo: z.string().optional(),
  insuranceSent: z.boolean().optional(),
});

type TournamentFormData = z.infer<typeof tournamentSchema>;

interface TournamentFormDialogProps {
  open: boolean;
  onClose: () => void;
  tournament: Tournament | null;
}

const TournamentFormDialog = ({ open, onClose, tournament }: TournamentFormDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [liveWorkflowStatus, setLiveWorkflowStatus] = useState<TournamentWorkflowStatus>(
    (tournament?.workflowStatus as TournamentWorkflowStatus) || 'wanting'
  );

  // Sync local workflow status when tournament prop changes
  useEffect(() => {
    setLiveWorkflowStatus((tournament?.workflowStatus as TournamentWorkflowStatus) || 'wanting');
  }, [tournament]);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<TournamentFormData>({
    resolver: zodResolver(tournamentSchema),
    defaultValues: {
      name: '',
      location: '',
      startDate: '',
      endDate: '',
      teamIds: [],
      contactName: '',
      contactPhone: '',
      contactEmail: '',
      cost: 0,
      notes: '',
      status: 'upcoming',
      workflowStatus: 'wanting',
      depositAmount: 0,
      balanceDueDate: '',
      registrationUrl: '',
      websiteUrl: '',
      scheduleUrl: '',
      accommodationsInfo: '',
      insuranceSent: false,
    },
  });

  const watchedWorkflowStatus = watch('workflowStatus');

  useEffect(() => {
    if (tournament) {
      reset({
        name: tournament.name,
        location: tournament.location,
        startDate: format(tournament.startDate, 'yyyy-MM-dd'),
        endDate: format(tournament.endDate, 'yyyy-MM-dd'),
        teamIds: tournament.teamIds || [],
        contactName: tournament.contactName || '',
        contactPhone: tournament.contactPhone || '',
        contactEmail: tournament.contactEmail || '',
        cost: tournament.cost,
        notes: tournament.notes || '',
        status: tournament.status || 'upcoming',
        workflowStatus: tournament.workflowStatus || 'wanting',
        depositAmount: tournament.depositAmount || 0,
        balanceDueDate: tournament.balanceDueDate
          ? format(tournament.balanceDueDate, 'yyyy-MM-dd')
          : '',
        registrationUrl: tournament.registrationUrl || '',
        websiteUrl: tournament.websiteUrl || '',
        scheduleUrl: tournament.scheduleUrl || '',
        accommodationsInfo: tournament.accommodationsInfo || '',
        insuranceSent: tournament.insuranceSent || false,
      });
    } else {
      reset({
        name: '',
        location: '',
        startDate: '',
        endDate: '',
        teamIds: [],
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        cost: 0,
        notes: '',
        status: 'upcoming',
        workflowStatus: 'wanting',
        depositAmount: 0,
        balanceDueDate: '',
        registrationUrl: '',
        websiteUrl: '',
        scheduleUrl: '',
        accommodationsInfo: '',
        insuranceSent: false,
      });
    }
  }, [tournament, reset]);

  const handleWorkflowChange = async (newStatus: TournamentWorkflowStatus) => {
    if (!tournament) return;
    try {
      await tournamentsApi.advanceWorkflowStatus(
        tournament,
        newStatus,
        user?.uid || 'unknown'
      );
      setLiveWorkflowStatus(newStatus);
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      queryClient.invalidateQueries({ queryKey: ['costItems'] });
      toast.success(`Workflow advanced to "${newStatus}"`);
      if (newStatus === 'entered') {
        toast.success('Tournament cost items auto-created for each team');
      }
    } catch (err: any) {
      toast.error(`Failed to advance workflow: ${err.message}`);
    }
  };

  const createMutation = useMutation({
    mutationFn: (data: TournamentFormData) =>
      tournamentsApi.create({
        name: data.name,
        location: data.location,
        startDate: new Date(data.startDate + 'T00:00:00'),
        endDate: new Date(data.endDate + 'T00:00:00'),
        teamIds: data.teamIds,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        cost: data.cost,
        notes: data.notes,
        status: data.status,
        workflowStatus: (data.workflowStatus as TournamentWorkflowStatus) || 'wanting',
        depositAmount: data.depositAmount,
        balanceDueDate: data.balanceDueDate ? new Date(data.balanceDueDate + 'T00:00:00') : undefined,
        registrationUrl: data.registrationUrl,
        websiteUrl: data.websiteUrl,
        scheduleUrl: data.scheduleUrl,
        accommodationsInfo: data.accommodationsInfo,
        insuranceSent: data.insuranceSent,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Tournament created successfully');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create tournament');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: TournamentFormData) =>
      tournamentsApi.update(tournament!.id, {
        name: data.name,
        location: data.location,
        startDate: new Date(data.startDate + 'T00:00:00'),
        endDate: new Date(data.endDate + 'T00:00:00'),
        teamIds: data.teamIds,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        contactEmail: data.contactEmail,
        cost: data.cost,
        notes: data.notes,
        status: data.status,
        workflowStatus: (data.workflowStatus as TournamentWorkflowStatus) || 'wanting',
        depositAmount: data.depositAmount,
        balanceDueDate: data.balanceDueDate ? new Date(data.balanceDueDate + 'T00:00:00') : undefined,
        registrationUrl: data.registrationUrl,
        websiteUrl: data.websiteUrl,
        scheduleUrl: data.scheduleUrl,
        accommodationsInfo: data.accommodationsInfo,
        insuranceSent: data.insuranceSent,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tournaments'] });
      toast.success('Tournament updated successfully');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update tournament');
    },
  });

  const onSubmit = (data: TournamentFormData) => {
    if (tournament) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{tournament ? 'Edit Tournament' : 'Add New Tournament'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Workflow Stepper - only for existing tournaments */}
            {tournament && (
              <>
                <TournamentWorkflowStepper
                  currentStatus={liveWorkflowStatus}
                  onStatusChange={handleWorkflowChange}
                />
                <TournamentDepositCard tournament={tournament} />
                <Divider />
              </>
            )}

            <TextField
              label="Tournament Name"
              {...register('name')}
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
            />
            <TextField
              label="Location"
              {...register('location')}
              error={!!errors.location}
              helperText={errors.location?.message}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Date"
                type="date"
                {...register('startDate')}
                error={!!errors.startDate}
                helperText={errors.startDate?.message}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End Date"
                type="date"
                {...register('endDate')}
                error={!!errors.endDate}
                helperText={errors.endDate?.message}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>
            <Controller
              name="teamIds"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth>
                  <InputLabel>Teams</InputLabel>
                  <Select
                    multiple
                    value={field.value}
                    onChange={field.onChange}
                    input={<OutlinedInput label="Teams" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map((id) => {
                          const team = teams.find((t) => t.id === id);
                          return <Chip key={id} label={team?.name || id} size="small" />;
                        })}
                      </Box>
                    )}
                  >
                    {teams.map((team) => (
                      <MenuItem key={team.id} value={team.id}>
                        {team.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            />
            {/* Contact Info */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
              Contact Information
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Contact Name"
                {...register('contactName')}
                fullWidth
              />
              <TextField
                label="Contact Phone"
                {...register('contactPhone')}
                fullWidth
              />
            </Box>
            <TextField
              label="Contact Email"
              {...register('contactEmail')}
              fullWidth
              type="email"
            />

            <Divider />

            {/* Financials */}
            <Typography variant="subtitle2" color="text.secondary">
              Financials
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Total Cost"
                type="number"
                {...register('cost', { valueAsNumber: true })}
                error={!!errors.cost}
                helperText={errors.cost?.message || 'Total cost for the tournament'}
                fullWidth
                InputProps={{ startAdornment: '$' }}
                inputProps={{ step: '0.01', min: '0' }}
              />
              <TextField
                label="Deposit Amount"
                type="number"
                {...register('depositAmount', { valueAsNumber: true })}
                fullWidth
                InputProps={{ startAdornment: '$' }}
                inputProps={{ step: '0.01', min: '0' }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Balance Due Date"
                type="date"
                {...register('balanceDueDate')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Status"
                select
                {...register('status')}
                error={!!errors.status}
                helperText={errors.status?.message}
                fullWidth
                defaultValue={tournament?.status || 'upcoming'}
              >
                <MenuItem value="upcoming">Upcoming</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </TextField>
            </Box>

            <Divider />

            {/* Links */}
            <Typography variant="subtitle2" color="text.secondary">
              Links & Resources
            </Typography>
            <TextField
              label="Registration URL"
              {...register('registrationUrl')}
              fullWidth
              placeholder="https://..."
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Tournament Website"
                {...register('websiteUrl')}
                fullWidth
                placeholder="https://..."
              />
              <TextField
                label="Schedule Link"
                {...register('scheduleUrl')}
                fullWidth
                placeholder="https://..."
              />
            </Box>
            <TextField
              label="Accommodations Info"
              {...register('accommodationsInfo')}
              multiline
              rows={2}
              fullWidth
              placeholder="Hotel details, links, etc."
            />

            <Divider />

            {/* Insurance */}
            <Controller
              name="insuranceSent"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={field.value || false}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="Insurance Certificate Sent"
                />
              )}
            />

            {watchedWorkflowStatus === 'entered' && !tournament && (
              <Alert severity="info">
                Cost items will be auto-created for each team when the tournament is saved and workflow is advanced to "Entered".
              </Alert>
            )}

            <TextField
              label="Notes"
              {...register('notes')}
              error={!!errors.notes}
              helperText={errors.notes?.message}
              multiline
              rows={3}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : tournament ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default TournamentFormDialog;
