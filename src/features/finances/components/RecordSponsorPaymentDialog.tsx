import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Autocomplete,
  MenuItem,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sponsorsApi } from '@/lib/api/sponsors';
import { useAuthStore } from '@/stores/authStore';
import { Sponsor } from '@/types/models';
import toast from 'react-hot-toast';

const PAYMENT_METHODS = [
  { value: 'check', label: 'Check' },
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'zelle', label: 'Zelle' },
  { value: 'other', label: 'Other' },
];

interface RecordSponsorPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  preselectedSponsor?: Sponsor | null;
}

const RecordSponsorPaymentDialog = ({ open, onClose, preselectedSponsor }: RecordSponsorPaymentDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(preselectedSponsor || null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('check');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');

  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => sponsorsApi.getAll(),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedSponsor) throw new Error('Select a sponsor');
      const amountNum = parseFloat(amount);
      if (!amountNum || amountNum <= 0) throw new Error('Enter a valid amount');

      await sponsorsApi.addContribution(
        selectedSponsor.id,
        {
          amount: amountNum,
          date: new Date(date),
          method,
          reference,
          notes,
          recordedBy: user?.uid || 'unknown',
        },
        user?.uid || 'unknown'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      queryClient.invalidateQueries({ queryKey: ['income'] });
      toast.success('Sponsor payment recorded');
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to record payment');
    },
  });

  const handleClose = () => {
    setSelectedSponsor(preselectedSponsor || null);
    setAmount('');
    setMethod('check');
    setDate(new Date().toISOString().split('T')[0]);
    setReference('');
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Record Sponsor Payment</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Record money received from a sponsor. You can apply these funds to
            specific players later.
          </Typography>

          <Autocomplete
            options={sponsors}
            getOptionLabel={(option) => option.businessName}
            value={selectedSponsor}
            onChange={(_, newValue) => setSelectedSponsor(newValue)}
            renderInput={(params) => (
              <TextField {...params} label="Sponsor" required />
            )}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography> }}
              inputProps={{ step: '0.01', min: '0' }}
              required
              sx={{ flex: 1 }}
            />
            <TextField
              label="Payment Method"
              select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              sx={{ flex: 1 }}
            >
              {PAYMENT_METHODS.map((m) => (
                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
              ))}
            </TextField>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Payment Date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="Reference / Check #"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Box>

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            multiline
            rows={2}
            fullWidth
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !selectedSponsor || !amount}
        >
          {mutation.isPending ? 'Recording...' : 'Record Payment'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecordSponsorPaymentDialog;
