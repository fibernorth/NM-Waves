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
import { fundraisersApi } from '@/lib/api/fundraisers';
import { Fundraiser } from '@/types/models';
import toast from 'react-hot-toast';

const donationSchema = z.object({
  payerName: z.string().min(1, 'Donor name is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  method: z.enum(['cash', 'check', 'venmo', 'zelle', 'card', 'other']),
  date: z.string().min(1, 'Date is required'),
});

type DonationFormData = z.infer<typeof donationSchema>;

interface DonationDialogProps {
  open: boolean;
  onClose: () => void;
  fundraiser: Fundraiser | null;
}

const DonationDialog = ({ open, onClose, fundraiser }: DonationDialogProps) => {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DonationFormData>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      payerName: '',
      amount: 0,
      method: 'cash',
      date: new Date().toISOString().split('T')[0],
    },
  });

  const addDonationMutation = useMutation({
    mutationFn: (data: DonationFormData) => {
      if (!fundraiser) throw new Error('No fundraiser selected');
      const newTotal = fundraiser.currentAmount + data.amount;
      return fundraisersApi.addDonation(
        fundraiser.id,
        {
          payerName: data.payerName,
          amount: data.amount,
          method: data.method,
          date: new Date(data.date),
        },
        newTotal
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
      toast.success('Donation recorded successfully');
      reset({
        payerName: '',
        amount: 0,
        method: 'cash',
        date: new Date().toISOString().split('T')[0],
      });
      onClose();
    },
    onError: () => {
      toast.error('Failed to record donation');
    },
  });

  const onSubmit = (data: DonationFormData) => {
    addDonationMutation.mutate(data);
  };

  const handleClose = () => {
    reset({
      payerName: '',
      amount: 0,
      method: 'cash',
      date: new Date().toISOString().split('T')[0],
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>
          Add Donation{fundraiser ? ` - ${fundraiser.name}` : ''}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Donor Name"
              {...register('payerName')}
              error={!!errors.payerName}
              helperText={errors.payerName?.message}
              fullWidth
            />
            <TextField
              label="Amount"
              type="number"
              {...register('amount', { valueAsNumber: true })}
              error={!!errors.amount}
              helperText={errors.amount?.message}
              fullWidth
              InputProps={{ startAdornment: '$' }}
              inputProps={{ step: '0.01', min: '0.01' }}
            />
            <TextField
              label="Payment Method"
              select
              {...register('method')}
              error={!!errors.method}
              helperText={errors.method?.message}
              fullWidth
              defaultValue="cash"
            >
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="check">Check</MenuItem>
              <MenuItem value="venmo">Venmo</MenuItem>
              <MenuItem value="zelle">Zelle</MenuItem>
              <MenuItem value="card">Card</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>
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
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={addDonationMutation.isPending}>
            {addDonationMutation.isPending ? 'Recording...' : 'Record Donation'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default DonationDialog;
