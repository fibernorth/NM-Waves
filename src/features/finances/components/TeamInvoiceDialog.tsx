import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api/teams';
import { playerFinancesApi } from '@/lib/api/finances';
import { teamInvoiceBatchesApi } from '@/lib/api/teamInvoiceBatches';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

interface TeamInvoiceDialogProps {
  open: boolean;
  onClose: () => void;
}

const TeamInvoiceDialog = ({ open, onClose }: TeamInvoiceDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const [teamId, setTeamId] = useState('');
  const [amountPerPlayer, setAmountPerPlayer] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [season, setSeason] = useState(new Date().getFullYear().toString());

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const { data: teamFinances = [] } = useQuery({
    queryKey: ['playerFinances', 'team', teamId],
    queryFn: () => playerFinancesApi.getByTeam(teamId),
    enabled: !!teamId,
  });

  const seasonFinances = teamFinances.filter((f) => f.season === season);
  const selectedTeam = teams.find((t) => t.id === teamId);
  const totalAmount = amountPerPlayer * seasonFinances.length;

  const invoiceMutation = useMutation({
    mutationFn: () =>
      teamInvoiceBatchesApi.invoiceTeam({
        teamId,
        teamName: selectedTeam?.name || '',
        season,
        amountPerPlayer,
        description,
        createdBy: user?.uid || 'unknown',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      queryClient.invalidateQueries({ queryKey: ['teamInvoiceBatches'] });
      toast.success(
        `Invoiced ${seasonFinances.length} players at $${amountPerPlayer.toFixed(2)} each`
      );
      onClose();
      setTeamId('');
      setAmountPerPlayer(0);
      setDescription('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to invoice team');
    },
  });

  const canSubmit =
    teamId &&
    amountPerPlayer > 0 &&
    description.trim() &&
    seasonFinances.length > 0 &&
    !invoiceMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Invoice Team</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Alert severity="info">
            Record a payment on every player's billing record for this team. This supports payment
            plan workflows (e.g., $150-$250/month).
          </Alert>

          <TextField
            label="Team"
            select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            fullWidth
          >
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Season"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            fullWidth
          />

          <TextField
            label="Amount Per Player"
            type="number"
            value={amountPerPlayer}
            onChange={(e) => setAmountPerPlayer(Number(e.target.value))}
            fullWidth
            InputProps={{ startAdornment: '$' }}
            inputProps={{ step: '0.01', min: '0' }}
          />

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            placeholder="e.g., February payment plan installment"
          />

          {teamId && (
            <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
              <Typography variant="body2">
                <strong>Team:</strong> {selectedTeam?.name}
              </Typography>
              <Typography variant="body2">
                <strong>Players with finance records:</strong> {seasonFinances.length}
              </Typography>
              <Typography variant="body2">
                <strong>Amount per player:</strong> ${amountPerPlayer.toFixed(2)}
              </Typography>
              <Typography variant="body1" fontWeight="bold" sx={{ mt: 1 }}>
                Total batch: ${totalAmount.toFixed(2)}
              </Typography>
            </Box>
          )}

          {teamId && seasonFinances.length === 0 && (
            <Alert severity="warning">
              No player finance records found for this team in season {season}. Players need billing
              records first.
            </Alert>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => invoiceMutation.mutate()}
          disabled={!canSubmit}
          startIcon={invoiceMutation.isPending ? <CircularProgress size={18} /> : undefined}
        >
          {invoiceMutation.isPending
            ? 'Processing...'
            : `Invoice ${seasonFinances.length} Players`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TeamInvoiceDialog;
