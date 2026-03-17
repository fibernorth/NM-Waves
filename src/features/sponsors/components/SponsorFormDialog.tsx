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
  Typography,
  Avatar,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { sponsorsApi } from '@/lib/api/sponsors';
import { Sponsor } from '@/types/models';
import toast from 'react-hot-toast';

const fmtDateInput = (d?: Date) =>
  d ? new Date(d).toISOString().split('T')[0] : '';

const sponsorSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  level: z.enum(['gold', 'silver', 'bronze', 'custom']),
  contactName: z.string().optional(),
  contactEmail: z.string().email('Invalid email').optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  websiteUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  logoUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
  amount: z.number().min(0, 'Amount must be 0 or greater').optional(),
  season: z.string().min(1, 'Season is required'),
  sponsorshipStart: z.string().optional().or(z.literal('')),
  sponsorshipEnd: z.string().optional().or(z.literal('')),
  displayOnPublicSite: z.boolean(),
  sponsorshipType: z.string().optional(),
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
    watch,
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
      logoUrl: '',
      amount: 0,
      season: '',
      sponsorshipStart: '',
      sponsorshipEnd: '',
      displayOnPublicSite: false,
      sponsorshipType: '',
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
        logoUrl: sponsor.logoUrl || '',
        amount: sponsor.amount || 0,
        season: sponsor.season,
        sponsorshipStart: fmtDateInput(sponsor.sponsorshipStart),
        sponsorshipEnd: fmtDateInput(sponsor.sponsorshipEnd),
        displayOnPublicSite: sponsor.displayOnPublicSite,
        sponsorshipType: sponsor.sponsorshipType || '',
      });
    } else {
      // Default: Aug 1 current year to Jul 30 next year
      const year = new Date().getFullYear();
      const month = new Date().getMonth();
      const seasonYear = month >= 7 ? year : year - 1; // Aug=7
      reset({
        businessName: '',
        level: 'bronze',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        websiteUrl: '',
        logoUrl: '',
        amount: 0,
        season: `${seasonYear}-${seasonYear + 1}`,
        sponsorshipStart: `${seasonYear}-08-01`,
        sponsorshipEnd: `${seasonYear + 1}-07-30`,
        displayOnPublicSite: false,
        sponsorshipType: '',
      });
    }
  }, [sponsor, reset]);

  const buildSponsorData = (data: SponsorFormData) => ({
    businessName: data.businessName,
    level: data.level,
    contactName: data.contactName,
    contactEmail: data.contactEmail,
    contactPhone: data.contactPhone,
    websiteUrl: data.websiteUrl,
    logoUrl: data.logoUrl || '',
    amount: data.amount,
    season: data.season,
    sponsorshipStart: data.sponsorshipStart ? new Date(data.sponsorshipStart + 'T00:00:00') : undefined,
    sponsorshipEnd: data.sponsorshipEnd ? new Date(data.sponsorshipEnd + 'T23:59:59') : undefined,
    displayOnPublicSite: data.displayOnPublicSite,
    sponsorshipType: (data.sponsorshipType as 'player_sponsor' | 'team_sponsor' | 'general') || undefined,
  });

  const createMutation = useMutation({
    mutationFn: (data: SponsorFormData) => sponsorsApi.create(buildSponsorData(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      toast.success('Sponsor created successfully');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create sponsor');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: SponsorFormData) => sponsorsApi.update(sponsor!.id, buildSponsorData(data)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      toast.success('Sponsor updated successfully');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update sponsor');
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Sponsorship Level"
                select
                {...register('level')}
                error={!!errors.level}
                helperText={errors.level?.message}
                fullWidth
                defaultValue={sponsor?.level || 'bronze'}
              >
                <MenuItem value="gold">Gold ($1,000+)</MenuItem>
                <MenuItem value="silver">Silver ($500+)</MenuItem>
                <MenuItem value="bronze">Bronze ($250+)</MenuItem>
                <MenuItem value="custom">Custom</MenuItem>
              </TextField>
              <TextField
                label="Sponsorship Type"
                select
                {...register('sponsorshipType')}
                fullWidth
                defaultValue={sponsor?.sponsorshipType || ''}
              >
                <MenuItem value="">Not specified</MenuItem>
                <MenuItem value="player_sponsor">Player Sponsor</MenuItem>
                <MenuItem value="team_sponsor">Team Sponsor</MenuItem>
                <MenuItem value="general">General Sponsor</MenuItem>
              </TextField>
            </Box>
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
              type="email"
              {...register('contactEmail')}
              error={!!errors.contactEmail}
              helperText={errors.contactEmail?.message}
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
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                label="Logo URL"
                {...register('logoUrl')}
                error={!!errors.logoUrl}
                helperText={errors.logoUrl?.message || 'Direct link to logo image (PNG, JPG, SVG)'}
                placeholder="https://example.com/logo.png"
                fullWidth
              />
              {watch('logoUrl') && (
                <Avatar
                  src={watch('logoUrl')}
                  variant="rounded"
                  sx={{ width: 56, height: 56, flexShrink: 0, bgcolor: '#fafafa', border: '1px solid #eee' }}
                  imgProps={{ style: { objectFit: 'contain' } }}
                />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
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
                placeholder="e.g., 2025-2026"
                {...register('season')}
                error={!!errors.season}
                helperText={errors.season?.message}
                fullWidth
              />
            </Box>

            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Active Period (sponsor hides from public site outside these dates)
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Start Date"
                type="date"
                {...register('sponsorshipStart')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End Date"
                type="date"
                {...register('sponsorshipEnd')}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Box>

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
