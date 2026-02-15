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
  type: z.enum(['jersey', 'pants', 'helmet', 'bag', 'belt', 'socks', 'guest_jersey']),
  number: z.number().optional(),
  size: z.string().min(1, 'Size is required'),
  season: z.string().min(1, 'Season is required'),
  condition: z.enum(['new', 'good', 'fair', 'poor']),
  cost: z.number().min(0),
  status: z.enum(['available', 'assigned', 'damaged', 'retired']),
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
  bag: 'Bag',
  belt: 'Belt',
  socks: 'Socks',
  guest_jersey: 'Guest Jersey',
};

const EquipmentFormDialog = ({ open, onClose, equipment }: EquipmentFormDialogProps) => {
  const queryClient = useQueryClient();
  const isEditMode = !!equipment;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      type: 'jersey',
      size: '',
      season: new Date().getFullYear().toString(),
      condition: 'new',
      cost: 0,
      status: 'available',
      notes: '',
    },
  });

  useEffect(() => {
    if (equipment) {
      reset({
        type: equipment.type,
        number: equipment.number,
        size: equipment.size,
        season: equipment.season,
        condition: equipment.condition,
        cost: equipment.cost,
        status: equipment.status,
        notes: equipment.notes || '',
      });
    } else {
      reset({
        type: 'jersey',
        size: '',
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
    onError: () => toast.error('Failed to add equipment'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: EquipmentFormData) =>
      equipmentApi.update(equipment!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipment updated successfully');
      onClose();
    },
    onError: () => toast.error('Failed to update equipment'),
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
              defaultValue={equipment?.type || 'jersey'}
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <MenuItem key={value} value={value}>{label}</MenuItem>
              ))}
            </TextField>

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
              defaultValue={equipment?.condition || 'new'}
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
              defaultValue={equipment?.status || 'available'}
            >
              <MenuItem value="available">Available</MenuItem>
              <MenuItem value="assigned">Assigned</MenuItem>
              <MenuItem value="damaged">Damaged</MenuItem>
              <MenuItem value="retired">Retired</MenuItem>
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
