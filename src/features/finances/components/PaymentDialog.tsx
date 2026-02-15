import { useState } from 'react';
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
import { isSponsor as checkIsSponsor } from '@/lib/auth/roles';
import type { PlayerContact } from '@/types/models';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  method: z.enum(['cash', 'check', 'venmo', 'zelle', 'credit_card', 'bank_transfer', 'sponsor', 'stripe', 'other']),
  reference: z.string().optional(),
  notes: z.string().optional(),
  payerName: z.string().optional(),
  payerEmail: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentDialogProps {
  open: boolean;
  onClose: () => void;
  financeId: string;
  playerName: string;
  currentBalance: number;
  contacts?: PlayerContact[];
}

const PaymentDialog = ({ open, onClose, financeId, playerName, currentBalance, contacts }: PaymentDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [selectedPayer, setSelectedPayer] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      method: 'cash',
      reference: '',
      notes: '',
      payerName: '',
      payerEmail: '',
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
        payerName: data.payerName,
        payerEmail: data.payerEmail,
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
    setSelectedPayer('');
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

            {contacts && contacts.length > 0 && (
              <TextField
                label="Payer (from contacts)"
                select
                value={selectedPayer}
                onChange={(e) => {
                  const contact = contacts.find(c => c.name === e.target.value);
                  if (contact) {
                    setValue('payerName', contact.name);
                    setValue('payerEmail', contact.email);
                  }
                  setSelectedPayer(e.target.value);
                }}
                fullWidth
              >
                <MenuItem value="">Select payer...</MenuItem>
                {(contacts.filter(c => c.isFinancialParty).length > 0
                  ? contacts.filter(c => c.isFinancialParty)
                  : contacts
                ).map((c, i) => (
                  <MenuItem key={i} value={c.name}>{c.name} ({c.relationship})</MenuItem>
                ))}
                <MenuItem value="__other">Other</MenuItem>
              </TextField>
            )}
            <TextField
              label="Payer Name"
              {...register('payerName')}
              fullWidth
            />
            <TextField
              label="Payer Email"
              type="email"
              {...register('payerEmail')}
              fullWidth
            />

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
        <DialogActions sx={{ justifyContent: 'space-between' }}>
          <Button
            size="small"
            onClick={() => {
              handleClose();
              if (checkIsSponsor(user)) {
                navigate('/sponsor/pay');
              } else {
                navigate('/become-sponsor');
              }
            }}
          >
            Sponsor This Player
          </Button>
          <Box>
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={addPaymentMutation.isPending}>
              {addPaymentMutation.isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </Box>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PaymentDialog;
