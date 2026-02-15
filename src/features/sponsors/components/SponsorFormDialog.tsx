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
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sponsorsApi } from '@/lib/api/sponsors';
import { Sponsor } from '@/types/models';
import toast from 'react-hot-toast';

const sponsorSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  level: z.enum(['gold', 'silver', 'bronze', 'custom']),
  contactName: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  websiteUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  amount: z.number().min(0, 'Amount must be 0 or greater').optional(),
  season: z.string().min(1, 'Season is required'),
  displayOnPublicSite: z.boolean(),
});

type SponsorFormData = z.infer<typeof sponsorSchema>;

interface SponsorFormDialogProps {
  open: boolean;
  onClose: () => void;
  sponsor: Sponsor | null;
}

const SponsorFormDialog = ({ open, onClose, sponsor }: SponsorFormDialogProps) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SponsorFormData>({
    resolver: zodResolver(sponsorSchema),
    defaultValues: {
      businessName: '',
      level: 'bronze',
      contactName: '',
      contactEmail: '',
      contactPhone: '',
      websiteUrl: '',
      amount: 0,
      season: '',
      displayOnPublicSite: false,
    },
  });

  useEffect(() => {
    if (sponsor) {
      reset({
        businessName: sponsor.businessName,
        level: sponsor.level,
        contactName: sponsor.contactName || '',
        contactEmail: sponsor.contactEmail || '',
        contactPhone: sponsor.contactPhone || '',
        websiteUrl: sponsor.websiteUrl || '',
        amount: sponsor.amount || 0,
        season: sponsor.season,
        displayOnPublicSite: sponsor.displayOnPublicSite,
      });
    } else {
      reset({
        businessName: '',
        level: 'bronze',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        websiteUrl: '',
        amount: 0,
        season: '',
        displayOnPublicSite: false,
      });
    }
  }, [sponsor, reset]);

  const createMutation = useMutation({
    mutationFn: (data: SponsorFormData) =>
      sponsorsApi.create({
        businessName: data.businessName,
        level: data.level,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        websiteUrl: data.websiteUrl,
        amount: data.amount,
        season: data.season,
        displayOnPublicSite: data.displayOnPublicSite,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      toast.success('Sponsor created successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to create sponsor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: SponsorFormData) =>
      sponsorsApi.update(sponsor!.id, {
        businessName: data.businessName,
        level: data.level,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        contactPhone: data.contactPhone,
        websiteUrl: data.websiteUrl,
        amount: data.amount,
        season: data.season,
        displayOnPublicSite: data.displayOnPublicSite,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      toast.success('Sponsor updated successfully');
      onClose();
    },
    onError: () => {
      toast.error('Failed to update sponsor');
    },
  });

  const onSubmit = (data: SponsorFormData) => {
    if (sponsor) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{sponsor ? 'Edit Sponsor' : 'Add New Sponsor'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Business Name"
              {...register('businessName')}
              error={!!errors.businessName}
              helperText={errors.businessName?.message}
              fullWidth
            />
            <TextField
              label="Sponsorship Level"
              select
              {...register('level')}
              error={!!errors.level}
              helperText={errors.level?.message}
              fullWidth
              defaultValue={sponsor?.level || 'bronze'}
            >
              <MenuItem value="gold">Gold</MenuItem>
              <MenuItem value="silver">Silver</MenuItem>
              <MenuItem value="bronze">Bronze</MenuItem>
              <MenuItem value="custom">Custom</MenuItem>
            </TextField>
            <TextField
              label="Contact Name"
              {...register('contactName')}
              error={!!errors.contactName}
              helperText={errors.contactName?.message}
              fullWidth
            />
            <TextField
              label="Contact Email"
              type="email"
              {...register('contactEmail')}
              error={!!errors.contactEmail}
              helperText={errors.contactEmail?.message}
              fullWidth
            />
            <TextField
              label="Contact Phone"
              {...register('contactPhone')}
              error={!!errors.contactPhone}
              helperText={errors.contactPhone?.message}
              fullWidth
            />
            <TextField
              label="Website URL"
              {...register('websiteUrl')}
              error={!!errors.websiteUrl}
              helperText={errors.websiteUrl?.message}
              placeholder="https://example.com"
              fullWidth
            />
            <TextField
              label="Sponsorship Amount"
              type="number"
              {...register('amount', { valueAsNumber: true })}
              error={!!errors.amount}
              helperText={errors.amount?.message}
              fullWidth
              InputProps={{ startAdornment: '$' }}
              inputProps={{ step: '0.01', min: '0' }}
            />
            <TextField
              label="Season"
              placeholder="e.g., 2025 Spring"
              {...register('season')}
              error={!!errors.season}
              helperText={errors.season?.message}
              fullWidth
            />
            <FormControlLabel
              control={<Checkbox {...register('displayOnPublicSite')} defaultChecked={sponsor?.displayOnPublicSite || false} />}
              label="Display on Public Site"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : sponsor ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default SponsorFormDialog;
