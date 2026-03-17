import { useState, useMemo } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Divider,
  Switch,
  FormControlLabel,
  Alert,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { playerFinancesApi } from '@/lib/api/finances';
import { sponsorsApi } from '@/lib/api/sponsors';
import { useAuthStore } from '@/stores/authStore';
import { Sponsor, PlayerFinance } from '@/types/models';
import toast from 'react-hot-toast';

interface PlayerAllocation {
  financeId: string;
  playerName: string;
  teamName: string;
  balanceDue: number;
  amount: number;
}

interface ApplySponsorFundsDialogProps {
  open: boolean;
  onClose: () => void;
  finances: PlayerFinance[];
  preselectedSponsor?: Sponsor | null;
}

const ApplySponsorFundsDialog = ({ open, onClose, finances, preselectedSponsor }: ApplySponsorFundsDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(preselectedSponsor || null);
  const [allocations, setAllocations] = useState<PlayerAllocation[]>([]);
  const [splitEvenly, setSplitEvenly] = useState(false);
  const [totalAmount, setTotalAmount] = useState<string>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => sponsorsApi.getAll(),
  });

  const availableBalance = useMemo(() => {
    if (!selectedSponsor) return 0;
    return (selectedSponsor.totalContributed || 0) - (selectedSponsor.totalSponsored || 0);
  }, [selectedSponsor]);

  const allocatedTotal = useMemo(
    () => allocations.reduce((sum, a) => sum + a.amount, 0),
    [allocations]
  );

  const totalAmountNum = parseFloat(totalAmount) || 0;

  const handleSplitToggle = (checked: boolean) => {
    setSplitEvenly(checked);
    if (checked && allocations.length > 0 && totalAmountNum > 0) {
      const perPlayer = Math.round((totalAmountNum / allocations.length) * 100) / 100;
      setAllocations(prev => prev.map((a, i) => ({
        ...a,
        amount: i === prev.length - 1
          ? Math.round((totalAmountNum - perPlayer * (prev.length - 1)) * 100) / 100
          : perPlayer,
      })));
    }
  };

  const handleTotalChange = (val: string) => {
    setTotalAmount(val);
    if (splitEvenly && allocations.length > 0) {
      const num = parseFloat(val) || 0;
      const perPlayer = Math.round((num / allocations.length) * 100) / 100;
      setAllocations(prev => prev.map((a, i) => ({
        ...a,
        amount: i === prev.length - 1
          ? Math.round((num - perPlayer * (prev.length - 1)) * 100) / 100
          : perPlayer,
      })));
    }
  };

  const handleAddPlayers = (selected: PlayerFinance[]) => {
    const newAllocations = selected
      .filter(f => !allocations.some(a => a.financeId === f.id))
      .map(f => ({
        financeId: f.id,
        playerName: f.playerName,
        teamName: f.teamName,
        balanceDue: f.balanceDue,
        amount: 0,
      }));

    const updated = [...allocations, ...newAllocations];
    setAllocations(updated);

    if (splitEvenly && totalAmountNum > 0 && updated.length > 0) {
      const perPlayer = Math.round((totalAmountNum / updated.length) * 100) / 100;
      setAllocations(updated.map((a, i) => ({
        ...a,
        amount: i === updated.length - 1
          ? Math.round((totalAmountNum - perPlayer * (updated.length - 1)) * 100) / 100
          : perPlayer,
      })));
    }
  };

  const handleRemovePlayer = (financeId: string) => {
    const updated = allocations.filter(a => a.financeId !== financeId);
    setAllocations(updated);
    if (splitEvenly && totalAmountNum > 0 && updated.length > 0) {
      const perPlayer = Math.round((totalAmountNum / updated.length) * 100) / 100;
      setAllocations(updated.map((a, i) => ({
        ...a,
        amount: i === updated.length - 1
          ? Math.round((totalAmountNum - perPlayer * (updated.length - 1)) * 100) / 100
          : perPlayer,
      })));
    }
  };

  const handleAmountChange = (financeId: string, value: string) => {
    setAllocations(prev =>
      prev.map(a => a.financeId === financeId ? { ...a, amount: parseFloat(value) || 0 } : a)
    );
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedSponsor) throw new Error('Select a sponsor');
      if (allocations.length === 0) throw new Error('Add at least one player');
      if (allocatedTotal <= 0) throw new Error('Total allocation must be greater than 0');
      if (allocatedTotal > availableBalance) throw new Error(`Allocation ($${allocatedTotal.toFixed(2)}) exceeds available balance ($${availableBalance.toFixed(2)})`);

      for (const alloc of allocations) {
        if (alloc.amount <= 0) continue;

        const finance = finances.find(f => f.id === alloc.financeId);
        if (!finance) continue;

        const paymentId = await playerFinancesApi.addPayment(alloc.financeId, {
          amount: alloc.amount,
          date: new Date(date),
          method: 'sponsor',
          notes: notes || `Sponsored by ${selectedSponsor.businessName}`,
          reference: '',
          sponsorId: selectedSponsor.id,
          sponsorName: selectedSponsor.businessName,
          recordedBy: user?.uid || 'unknown',
        });

        await sponsorsApi.addSponsoredPlayer(selectedSponsor.id, {
          playerId: finance.playerId,
          playerName: finance.playerName,
          amount: alloc.amount,
          paymentId,
          date: new Date(date),
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      queryClient.invalidateQueries({ queryKey: ['sponsors'] });
      queryClient.invalidateQueries({ queryKey: ['income'] });
      toast.success('Sponsor funds applied to players');
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to apply sponsor funds');
    },
  });

  const handleClose = () => {
    setSelectedSponsor(preselectedSponsor || null);
    setAllocations([]);
    setSplitEvenly(false);
    setTotalAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    onClose();
  };

  const availablePlayers = finances.filter(
    f => !allocations.some(a => a.financeId === f.id) && f.balanceDue > 0
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Apply Sponsor Funds to Players</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Allocate sponsor funds to cover player fees. Only players with outstanding
            balances are shown.
          </Typography>

          <Autocomplete
            options={sponsors}
            getOptionLabel={(option) => {
              const avail = (option.totalContributed || 0) - (option.totalSponsored || 0);
              return `${option.businessName} — Available: $${avail.toFixed(2)}`;
            }}
            value={selectedSponsor}
            onChange={(_, newValue) => setSelectedSponsor(newValue)}
            renderInput={(params) => (
              <TextField {...params} label="Sponsor" required />
            )}
          />

          {selectedSponsor && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Chip label={`Contributed: $${(selectedSponsor.totalContributed || 0).toFixed(2)}`} color="primary" />
              <Chip label={`Applied: $${(selectedSponsor.totalSponsored || 0).toFixed(2)}`} color="default" />
              <Chip
                label={`Available: $${availableBalance.toFixed(2)}`}
                color={availableBalance > 0 ? 'success' : 'error'}
              />
            </Box>
          )}

          {allocatedTotal > availableBalance && availableBalance >= 0 && (
            <Alert severity="warning">
              Allocation total (${allocatedTotal.toFixed(2)}) exceeds available balance (${availableBalance.toFixed(2)}).
            </Alert>
          )}

          <Autocomplete
            multiple
            options={availablePlayers}
            getOptionLabel={(option) =>
              `${option.playerName} (${option.teamName}) — owes $${option.balanceDue.toFixed(2)}`
            }
            value={[]}
            onChange={(_, newValue) => {
              if (newValue.length > 0) handleAddPlayers(newValue);
            }}
            renderInput={(params) => (
              <TextField {...params} label="Add Players" placeholder="Search players..." />
            )}
          />

          {allocations.length > 0 && (
            <>
              <Divider />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={splitEvenly}
                      onChange={(e) => handleSplitToggle(e.target.checked)}
                    />
                  }
                  label="Split evenly"
                />
                {splitEvenly && (
                  <TextField
                    label="Total Amount"
                    type="number"
                    size="small"
                    value={totalAmount}
                    onChange={(e) => handleTotalChange(e.target.value)}
                    InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography> }}
                    inputProps={{ step: '0.01', min: '0' }}
                    sx={{ width: 180 }}
                  />
                )}
              </Box>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Player</TableCell>
                      <TableCell>Team</TableCell>
                      <TableCell align="right">Balance Due</TableCell>
                      <TableCell align="right" sx={{ width: 150 }}>Amount to Apply</TableCell>
                      <TableCell sx={{ width: 48 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allocations.map((alloc) => (
                      <TableRow key={alloc.financeId}>
                        <TableCell>{alloc.playerName}</TableCell>
                        <TableCell>{alloc.teamName}</TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            color={alloc.balanceDue > 0 ? 'error.main' : 'success.main'}
                          >
                            ${alloc.balanceDue.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            size="small"
                            value={alloc.amount || ''}
                            onChange={(e) => handleAmountChange(alloc.financeId, e.target.value)}
                            disabled={splitEvenly}
                            InputProps={{
                              startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography>,
                            }}
                            inputProps={{ step: '0.01', min: '0' }}
                            sx={{ width: 130 }}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() => handleRemovePlayer(alloc.financeId)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 1 }}>
                <Chip
                  label={`${allocations.length} player${allocations.length !== 1 ? 's' : ''}`}
                  size="small"
                />
                <Chip
                  label={`Total: $${allocatedTotal.toFixed(2)}`}
                  color={allocatedTotal > 0 ? 'primary' : 'default'}
                  size="small"
                />
              </Box>
            </>
          )}

          <Divider />

          <TextField
            label="Application Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ maxWidth: 250 }}
          />

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
          disabled={
            mutation.isPending ||
            allocations.length === 0 ||
            allocatedTotal <= 0 ||
            !selectedSponsor ||
            allocatedTotal > availableBalance
          }
        >
          {mutation.isPending ? 'Applying...' : `Apply $${allocatedTotal.toFixed(2)} to Players`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApplySponsorFundsDialog;
