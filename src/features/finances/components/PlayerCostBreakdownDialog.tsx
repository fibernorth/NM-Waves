import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
} from '@mui/material';
import type { PlayerCostBreakdown } from '@/lib/api/costCalculation';

interface PlayerCostBreakdownDialogProps {
  open: boolean;
  onClose: () => void;
  breakdown: PlayerCostBreakdown | null;
}

const PlayerCostBreakdownDialog = ({
  open,
  onClose,
  breakdown,
}: PlayerCostBreakdownDialogProps) => {
  if (!breakdown) return null;

  const renderCostSection = (
    title: string,
    items: { item: { label: string; category: string; amount: number }; perPlayerAmount: number }[],
    description: string
  ) => (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {title}
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
        {description}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          No costs in this tier
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Item</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right">Per Player</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((entry, idx) => (
                <TableRow key={idx}>
                  <TableCell>{entry.item.label}</TableCell>
                  <TableCell>
                    <Chip label={entry.item.category} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="right">${entry.item.amount.toFixed(2)}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    ${entry.perPlayerAmount.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Cost Breakdown: {breakdown.playerName}
        <Typography variant="body2" color="text.secondary">
          Team: {breakdown.teamName}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {renderCostSection(
          'Organization Costs',
          breakdown.orgCosts,
          'Shared across all players in all teams'
        )}
        {renderCostSection(
          'Team Costs',
          breakdown.teamCosts,
          'Shared across players on this team'
        )}
        {renderCostSection(
          'Player-Specific Costs',
          breakdown.playerCosts,
          'Assigned directly to this player'
        )}

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          Finance Field Totals
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Finance Field</TableCell>
                <TableCell align="right">Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(breakdown.totals)
                .filter(([, amount]) => amount > 0)
                .map(([field, amount]) => (
                  <TableRow key={field}>
                    <TableCell>{field}</TableCell>
                    <TableCell align="right">${amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Grand Total</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                  ${breakdown.grandTotal.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlayerCostBreakdownDialog;
