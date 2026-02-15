import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  MenuItem,
  Typography,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { playerFinancesApi } from '@/lib/api/finances';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  method: z.enum(['cash', 'check', 'venmo', 'zelle', 'credit_card', 'bank_transfer', 'sponsor', 'other']),
  reference: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  financeId: string;
  playerName: string;
  currentBalance: number;
}

const PaymentDialog = ({ open, onClose, financeId, playerName, currentBalance }: PaymentDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      method: 'cash',
      reference: '',
      notes: '',
    },
  });

  const addPaymentMutation = useMutation({
    mutationFn: (data: PaymentFormData) =>
      playerFinancesApi.addPayment(financeId, {
        amount: data.amount,
        date: new Date(data.date),
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        recordedBy: user?.uid || 'unknown',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      toast.success('Payment recorded successfully');
      reset();
      onClose();
    },
    onError: () => {
      toast.error('Failed to record payment');
    },
  });

  const onSubmit = (data: PaymentFormData) => {
    addPaymentMutation.mutate(data);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>Record Payment for {playerName}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box
              sx={{
                p: 2,
                bgcolor: currentBalance < 0 ? 'error.light' : 'success.light',
                borderRadius: 1,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Current Balance
              </Typography>
              <Typography variant="h6" sx={{ color: currentBalance < 0 ? 'error.dark' : 'success.dark' }}>
                ${Math.abs(currentBalance).toFixed(2)} {currentBalance < 0 ? 'Owed' : 'Credit'}
              </Typography>
            </Box>

            <TextField
              label="Payment Amount"
              type="number"
              {...register('amount', { valueAsNumber: true })}
              error={!!errors.amount}
              helperText={errors.amount?.message}
              fullWidth
              InputProps={{
                startAdornment: '$',
              }}
              inputProps={{ step: '0.01' }}
            />

            <TextField
              label="Payment Date"
              type="date"
              {...register('date')}
              error={!!errors.date}
              helperText={errors.date?.message}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />

            <TextField
              label="Payment Method"
              select
              {...register('method')}
              error={!!errors.method}
              helperText={errors.method?.message}
              fullWidth
            >
              <MenuItem value="cash">Cash</MenuItem>
              <MenuItem value="check">Check</MenuItem>
              <MenuItem value="venmo">Venmo</MenuItem>
              <MenuItem value="zelle">Zelle</MenuItem>
              <MenuItem value="credit_card">Credit Card</MenuItem>
              <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
              <MenuItem value="sponsor">Sponsor</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>

            <TextField
              label="Reference Number"
              placeholder="Check #, Transaction ID, etc."
              {...register('reference')}
              error={!!errors.reference}
              helperText={errors.reference?.message}
              fullWidth
            />

            <TextField
              label="Notes"
              {...register('notes')}
              error={!!errors.notes}
              helperText={errors.notes?.message}
              multiline
              rows={2}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" disabled={addPaymentMutation.isPending}>
            {addPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PaymentDialog;
