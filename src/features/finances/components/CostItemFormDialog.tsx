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
import { costItemsApi } from '@/lib/api/costItems';
import { useAuthStore } from '@/stores/authStore';
import {
  CostItem,
  CostItemTier,
  CostItemCategory,
  COST_CATEGORY_FINANCE_FIELD_MAP,
} from '@/types/models';
import toast from 'react-hot-toast';

const ORG_CATEGORIES: { value: CostItemCategory; label: string }[] = [
  { value: 'waves_fee', label: 'Waves Fee' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'administrative', label: 'Administrative' },
];

const TEAM_CATEGORIES: { value: CostItemCategory; label: string }[] = [
  { value: 'tournament', label: 'Tournament' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'special', label: 'Special / Other' },
];

const PLAYER_CATEGORIES: { value: CostItemCategory; label: string }[] = [
  { value: 'helmet', label: 'Helmet' },
  { value: 'bag', label: 'Bag' },
  { value: 'uniform_piece', label: 'Uniform Piece' },
  { value: 'special', label: 'Special / Other' },
];

const costItemSchema = z.object({
  category: z.string().min(1, 'Category is required'),
  label: z.string().min(1, 'Label is required'),
  amount: z.number().min(0, 'Amount must be 0 or greater'),
  season: z.string().min(1, 'Season is required'),
  notes: z.string().optional(),
});

type CostItemFormData = z.infer<typeof costItemSchema>;

interface CostItemFormDialogProps {
  open: boolean;
  onClose: () => void;
  tier: CostItemTier;
  costItem?: CostItem | null;
  teamId?: string;
  teamName?: string;
  playerId?: string;
  playerName?: string;
  defaultSeason?: string;
}

const CostItemFormDialog = ({
  open,
  onClose,
  tier,
  costItem,
  teamId,
  teamName,
  playerId,
  playerName,
  defaultSeason,
}: CostItemFormDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const categories =
    tier === 'organization'
      ? ORG_CATEGORIES
      : tier === 'team'
      ? TEAM_CATEGORIES
      : PLAYER_CATEGORIES;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CostItemFormData>({
    resolver: zodResolver(costItemSchema),
    defaultValues: {
      category: '',
      label: '',
      amount: 0,
      season: defaultSeason || new Date().getFullYear().toString(),
      notes: '',
    },
  });

  const watchedCategory = watch('category');

  useEffect(() => {
    if (costItem) {
      reset({
        category: costItem.category,
        label: costItem.label,
        amount: costItem.amount,
        season: costItem.season,
        notes: costItem.notes || '',
      });
    } else {
      reset({
        category: '',
        label: '',
        amount: 0,
        season: defaultSeason || new Date().getFullYear().toString(),
        notes: '',
      });
    }
  }, [costItem, reset, defaultSeason]);

  const createMutation = useMutation({
    mutationFn: (data: CostItemFormData) => {
      const category = data.category as CostItemCategory;
      const financeField = COST_CATEGORY_FINANCE_FIELD_MAP[category];
      return costItemsApi.create({
        tier,
        category,
        label: data.label,
        amount: data.amount,
        season: data.season,
        teamId,
        teamName,
        playerId,
        playerName,
        financeField,
        notes: data.notes,
        active: true,
        createdBy: user?.uid || 'unknown',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costItems'] });
      toast.success('Cost item created');
      onClose();
    },
    onError: () => toast.error('Failed to create cost item'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: CostItemFormData) => {
      const category = data.category as CostItemCategory;
      const financeField = COST_CATEGORY_FINANCE_FIELD_MAP[category];
      return costItemsApi.update(costItem!.id, {
        category,
        label: data.label,
        amount: data.amount,
        season: data.season,
        financeField,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costItems'] });
      toast.success('Cost item updated');
      onClose();
    },
    onError: () => toast.error('Failed to update cost item'),
  });

  const onSubmit = (data: CostItemFormData) => {
    if (costItem) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const tierLabel =
    tier === 'organization' ? 'Organization' : tier === 'team' ? 'Team' : 'Player';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>
          {costItem ? 'Edit' : 'Add'} {tierLabel} Cost
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Category"
              select
              {...register('category')}
              error={!!errors.category}
              helperText={errors.category?.message}
              fullWidth
              value={watchedCategory}
            >
              {categories.map((cat) => (
                <MenuItem key={cat.value} value={cat.value}>
                  {cat.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Label"
              {...register('label')}
              error={!!errors.label}
              helperText={errors.label?.message || 'e.g. "Spring Insurance" or "Extra Helmet"'}
              fullWidth
            />
            <TextField
              label="Amount"
              type="number"
              {...register('amount', { valueAsNumber: true })}
              error={!!errors.amount}
              helperText={
                errors.amount?.message ||
                (tier === 'organization'
                  ? 'Total org-wide amount (will be split across all players)'
                  : tier === 'team'
                  ? 'Total team amount (will be split across team players)'
                  : 'Amount for this player')
              }
              fullWidth
              InputProps={{ startAdornment: '$' }}
              inputProps={{ step: '0.01', min: '0' }}
            />
            <TextField
              label="Season"
              {...register('season')}
              error={!!errors.season}
              helperText={errors.season?.message}
              fullWidth
            />
            {watchedCategory && (
              <TextField
                label="Maps to Finance Field"
                value={COST_CATEGORY_FINANCE_FIELD_MAP[watchedCategory as CostItemCategory] || ''}
                disabled
                fullWidth
                helperText="This cost will be synced to this field on PlayerFinance records"
              />
            )}
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
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : costItem ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default CostItemFormDialog;
