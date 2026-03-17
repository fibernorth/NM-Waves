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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { equipmentApi } from '@/lib/api/equipment';
import { Equipment } from '@/types/models';
import toast from 'react-hot-toast';

const equipmentSchema = z.object({
  type: z.enum(['jersey', 'pants', 'helmet', 'bag', 'belt', 'socks', 'guest_jersey', 'bat', 'softball', 'glove', 'catcher_gear', 'other']),
  ownership: z.enum(['player', 'organization', 'consumable']),
  number: z.preprocess((val) => (val === '' || Number.isNaN(val) ? undefined : val), z.number().optional()),
  size: z.string().min(1, 'Size is required'),
  variant: z.string().optional(),
  season: z.string().min(1, 'Season is required'),
  condition: z.enum(['new', 'good', 'fair', 'poor']),
  cost: z.number().min(0),
  status: z.enum(['available', 'assigned', 'damaged', 'retired', 'consumed']),
  notes: z.string().optional(),
});

type EquipmentFormData = z.infer<typeof equipmentSchema>;

interface EquipmentFormDialogProps {
  open: boolean;
  onClose: () => void;
  equipment: Equipment | null;
}

const typeLabels: Record<string, string> = {
  jersey: 'Jersey',
  pants: 'Pants',
  helmet: 'Helmet',
  bag: 'Backpack Bag',
  belt: 'Belt',
  socks: 'Socks',
  guest_jersey: 'Guest Jersey',
  bat: 'Bat',
  softball: 'Softball',
  glove: 'Glove',
  catcher_gear: 'Catcher Gear',
  other: 'Other',
};

const ownershipLabels: Record<string, string> = {
  player: 'Player-Owned (purchased for player)',
  organization: 'Organization-Owned (loaned)',
  consumable: 'Consumable (used up)',
};

/** Equipment types that default to player-owned when purchased per player */
const PLAYER_OWNED_DEFAULTS = ['helmet', 'bag', 'belt', 'socks'];

const EquipmentFormDialog = ({ open, onClose, equipment }: EquipmentFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEditMode = !!equipment;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      type: 'jersey',
      ownership: 'organization',
      size: '',
      variant: '',
      season: new Date().getFullYear().toString(),
      condition: 'new',
      cost: 0,
      status: 'available',
      notes: '',
    },
  });

  const watchedType = watch('type');
  const watchedOwnership = watch('ownership');
  const watchedCondition = watch('condition');
  const watchedStatus = watch('status');

  // Auto-set ownership when type changes for common player-owned items
  useEffect(() => {
    if (!equipment) {
      if (PLAYER_OWNED_DEFAULTS.includes(watchedType)) {
        setValue('ownership', 'player');
      } else if (watchedType === 'softball') {
        setValue('ownership', 'consumable');
      }
    }
  }, [watchedType, equipment, setValue]);

  useEffect(() => {
    if (equipment) {
      reset({
        type: equipment.type,
        ownership: equipment.ownership || 'organization',
        number: equipment.number,
        size: equipment.size,
        variant: equipment.variant || '',
        season: equipment.season,
        condition: equipment.condition,
        cost: equipment.cost,
        status: equipment.status,
        notes: equipment.notes || '',
      });
    } else {
      reset({
        type: 'jersey',
        ownership: 'organization',
        size: '',
        variant: '',
        season: new Date().getFullYear().toString(),
        condition: 'new',
        cost: 0,
        status: 'available',
        notes: '',
      });
    }
  }, [equipment, reset, open]);

  const createMutation = useMutation({
    mutationFn: (data: EquipmentFormData) =>
      equipmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipment added successfully');
      reset();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add equipment'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: EquipmentFormData) =>
      equipmentApi.update(equipment!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipment updated successfully');
      onClose();
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update equipment'),
  });

  const onSubmit = (data: EquipmentFormData) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={isBusy ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{isEditMode ? 'Edit Equipment' : 'Add Equipment'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Type"
              select
              {...register('type')}
              error={!!errors.type}
              helperText={errors.type?.message}
              fullWidth
              required
              value={watchedType}
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Ownership"
              select
              {...register('ownership')}
              error={!!errors.ownership}
              helperText={errors.ownership?.message}
              fullWidth
              required
              value={watchedOwnership}
            >
              {Object.entries(ownershipLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Variant / Description"
              {...register('variant')}
              fullWidth
              placeholder="e.g., Navy Blue, DeMarini CF, Evoshield XVT"
              helperText="Color, brand, model, or style"
            />

            <TextField
              label="Number"
              type="number"
              {...register('number', { valueAsNumber: true })}
              error={!!errors.number}
              helperText={errors.number?.message || 'Jersey/uniform number (optional)'}
              fullWidth
            />

            <TextField
              label="Size"
              {...register('size')}
              error={!!errors.size}
              helperText={errors.size?.message}
              fullWidth
              required
              placeholder="e.g., YM, YL, AS, AM, AL"
            />

            <TextField
              label="Season"
              {...register('season')}
              error={!!errors.season}
              helperText={errors.season?.message}
              fullWidth
              required
            />

            <TextField
              label="Condition"
              select
              {...register('condition')}
              error={!!errors.condition}
              helperText={errors.condition?.message}
              fullWidth
              required
              value={watchedCondition}
            >
              <MenuItem value="new">New</MenuItem>
              <MenuItem value="good">Good</MenuItem>
              <MenuItem value="fair">Fair</MenuItem>
              <MenuItem value="poor">Poor</MenuItem>
            </TextField>

            <TextField
              label="Cost"
              type="number"
              {...register('cost', { valueAsNumber: true })}
              error={!!errors.cost}
              helperText={errors.cost?.message}
              fullWidth
              InputProps={{ startAdornment: '$' }}
              inputProps={{ step: '0.01' }}
            />

            <TextField
              label="Status"
              select
              {...register('status')}
              error={!!errors.status}
              helperText={errors.status?.message}
              fullWidth
              required
              value={watchedStatus}
            >
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="damaged">Damaged</MenuItem>
              <MenuItem value="retired">Retired</MenuItem>
              <MenuItem value="consumed">Consumed</MenuItem>
            </TextField>

            <TextField
              label="Notes"
              {...register('notes')}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isBusy}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isBusy}>
            {isBusy ? 'Saving...' : isEditMode ? 'Update' : 'Add Equipment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default EquipmentFormDialog;
