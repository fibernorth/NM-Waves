import { useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  MenuItem,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { metricsApi } from '@/lib/api/metrics';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import type { PlayerMetric } from '@/types/models';
import toast from 'react-hot-toast';

const COMMON_METRIC_TYPES = [
  { value: 'pitch_speed', label: 'Pitch Speed', unit: 'mph' },
  { value: 'exit_velo', label: 'Exit Velocity', unit: 'mph' },
  { value: '60_yard', label: '60 Yard Dash', unit: 'sec' },
  { value: 'batting_avg', label: 'Batting Average', unit: 'avg' },
  { value: 'ERA', label: 'ERA', unit: 'era' },
  { value: 'fielding_pct', label: 'Fielding Percentage', unit: 'pct' },
  { value: 'custom', label: 'Custom...', unit: '' },
];

const metricSchema = z.object({
  playerId: z.string().min(1, 'Player is required'),
  metricType: z.string().min(1, 'Metric type is required'),
  customMetricType: z.string().optional(),
  value: z.coerce.number({ invalid_type_error: 'Value must be a number' }),
  unit: z.string().min(1, 'Unit is required'),
  date: z.string().min(1, 'Date is required'),
});

type MetricFormData = z.infer<typeof metricSchema>;

interface MetricFormDialogProps {
  open: boolean;
  onClose: () => void;
  metric: PlayerMetric | null;
}

const MetricFormDialog = ({ open, onClose, metric }: MetricFormDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<MetricFormData>({
    resolver: zodResolver(metricSchema),
    defaultValues: {
      playerId: '',
      metricType: '',
      customMetricType: '',
      value: 0,
      unit: '',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const watchedMetricType = watch('metricType');

  useEffect(() => {
    if (watchedMetricType && watchedMetricType !== 'custom') {
      const found = COMMON_METRIC_TYPES.find(m => m.value === watchedMetricType);
      if (found) {
        setValue('unit', found.unit);
      }
    }
  }, [watchedMetricType, setValue]);

  useEffect(() => {
    if (metric) {
      const isCommon = COMMON_METRIC_TYPES.some(m => m.value === metric.metricType);
      reset({
        playerId: metric.playerId,
        metricType: isCommon ? metric.metricType : 'custom',
        customMetricType: isCommon ? '' : metric.metricType,
        value: metric.value,
        unit: metric.unit,
        date: metric.date.toISOString().split('T')[0],
      });
    } else {
      reset({
        playerId: '',
        metricType: '',
        customMetricType: '',
        value: 0,
        unit: '',
        date: new Date().toISOString().split('T')[0],
      });
    }
  }, [metric, reset]);

  const createMutation = useMutation({
    mutationFn: (data: MetricFormData) => {
      const player = players.find(p => p.id === data.playerId);
      const resolvedType = data.metricType === 'custom'
        ? (data.customMetricType || 'custom')
        : data.metricType;

      return metricsApi.create({
        playerId: data.playerId,
        playerName: player ? `${player.firstName} ${player.lastName}` : '',
        metricType: resolvedType,
        value: data.value,
        unit: data.unit,
        date: new Date(data.date),
        recordedBy: user?.displayName || '',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      toast.success('Metric recorded successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to record metric');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: MetricFormData) => {
      const player = players.find(p => p.id === data.playerId);
      const resolvedType = data.metricType === 'custom'
        ? (data.customMetricType || 'custom')
        : data.metricType;

      return metricsApi.update(metric!.id, {
        playerId: data.playerId,
        playerName: player ? `${player.firstName} ${player.lastName}` : '',
        metricType: resolvedType,
        value: data.value,
        unit: data.unit,
        date: new Date(data.date),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['metrics'] });
      toast.success('Metric updated successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update metric');
    },
  });

  const onSubmit = (data: MetricFormData) => {
    if (metric) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{metric ? 'Edit Metric' : 'Add Metric'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Controller
              name="playerId"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Player"
                  error={!!errors.playerId}
                  helperText={errors.playerId?.message}
                  fullWidth
                >
                  {players.map(player => (
                    <MenuItem key={player.id} value={player.id}>
                      {player.firstName} {player.lastName}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="metricType"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Metric Type"
                  error={!!errors.metricType}
                  helperText={errors.metricType?.message}
                  fullWidth
                >
                  {COMMON_METRIC_TYPES.map(type => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            {watchedMetricType === 'custom' && (
              <TextField
                label="Custom Metric Name"
                {...register('customMetricType')}
                error={!!errors.customMetricType}
                helperText={errors.customMetricType?.message}
                fullWidth
              />
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Value"
                type="number"
                inputProps={{ step: 'any' }}
                {...register('value')}
                error={!!errors.value}
                helperText={errors.value?.message}
                fullWidth
              />
              <TextField
                label="Unit"
                {...register('unit')}
                error={!!errors.unit}
                helperText={errors.unit?.message}
                fullWidth
              />
            </Box>

            <TextField
              label="Date"
              type="date"
              {...register('date')}
              error={!!errors.date}
              helperText={errors.date?.message}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {metric ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default MetricFormDialog;
