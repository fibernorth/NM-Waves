import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  LinearProgress,
} from '@mui/material';
import { format } from 'date-fns';
import type { Tournament } from '@/types/models';

interface TournamentDepositCardProps {
  tournament: Tournament;
}

const TournamentDepositCard = ({ tournament }: TournamentDepositCardProps) => {
  const hasDeposit = (tournament.depositAmount || 0) > 0;
  const depositPaid = !!tournament.depositPaidDate;
  const balancePaid = !!tournament.balancePaid;
  const totalCost = tournament.cost || 0;
  const depositAmount = tournament.depositAmount || 0;
  const remainingBalance = totalCost - depositAmount;

  const paidAmount = balancePaid
    ? totalCost
    : depositPaid
    ? depositAmount
    : 0;
  const progressPercent = totalCost > 0 ? (paidAmount / totalCost) * 100 : 0;

  if (!hasDeposit && totalCost === 0) return null;

  return (
    <Card variant="outlined" sx={{ mb: 2 }}>
      <CardContent>
        <Typography variant="subtitle2" gutterBottom>
          Payment Tracking
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 1, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              Total Cost
            </Typography>
            <Typography variant="body1" fontWeight="bold">
              ${totalCost.toFixed(2)}
            </Typography>
          </Box>

          {hasDeposit && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Deposit
              </Typography>
              <Typography variant="body1">
                ${depositAmount.toFixed(2)}
                {depositPaid && (
                  <Chip label="Paid" color="success" size="small" sx={{ ml: 1 }} />
                )}
              </Typography>
            </Box>
          )}

          {hasDeposit && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Balance Remaining
              </Typography>
              <Typography variant="body1">
                ${remainingBalance.toFixed(2)}
                {balancePaid && (
                  <Chip label="Paid" color="success" size="small" sx={{ ml: 1 }} />
                )}
              </Typography>
            </Box>
          )}

          {tournament.balanceDueDate && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Balance Due
              </Typography>
              <Typography variant="body1">
                {format(tournament.balanceDueDate, 'MMM d, yyyy')}
              </Typography>
            </Box>
          )}
        </Box>

        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{ height: 8, borderRadius: 4, mt: 1 }}
          color={balancePaid ? 'success' : depositPaid ? 'warning' : 'inherit'}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {progressPercent.toFixed(0)}% paid to tournament vendor
        </Typography>
      </CardContent>
    </Card>
  );
};

export default TournamentDepositCard;
