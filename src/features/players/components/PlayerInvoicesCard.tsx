import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Box,
  CircularProgress,
} from '@mui/material';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaymentIcon from '@mui/icons-material/Payment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AddIcon from '@mui/icons-material/Add';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { invoiceTokensApi } from '@/lib/api/invoiceTokens';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { format } from 'date-fns';
import InvoiceQRCard from '@/features/finances/components/InvoiceQRCard';
import type { PlayerFinance, InvoiceToken } from '@/types/models';

interface PlayerInvoicesCardProps {
  playerId: string;
  playerName: string;
  finances: PlayerFinance[];
}

const PlayerInvoicesCard = ({ playerId, finances }: PlayerInvoicesCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [qrDialogFinance, setQrDialogFinance] = useState<PlayerFinance | null>(null);

  const { data: invoiceTokens = [], isLoading } = useQuery({
    queryKey: ['invoiceTokens', 'player', playerId],
    queryFn: () => invoiceTokensApi.getByPlayer(playerId),
    enabled: !!playerId,
  });

  // Sort invoices: outstanding first, then by creation date descending
  const sortedTokens = [...invoiceTokens].sort((a, b) => {
    const aOutstanding = !a.used && new Date(a.expiresAt) > new Date();
    const bOutstanding = !b.used && new Date(b.expiresAt) > new Date();
    if (aOutstanding && !bOutstanding) return -1;
    if (!aOutstanding && bOutstanding) return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const getStatus = (token: InvoiceToken): { label: string; color: 'success' | 'warning' | 'default' } => {
    if (token.used) return { label: 'Paid', color: 'success' };
    if (new Date(token.expiresAt) < new Date()) return { label: 'Expired', color: 'default' };
    return { label: 'Outstanding', color: 'warning' };
  };

  return (
    <>
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReceiptLongIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Invoices
              </Typography>
            </Box>
            {isAdmin && finances.length > 0 && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setQrDialogFinance(finances[0])}
              >
                Generate Invoice
              </Button>
            )}
          </Box>
          <Divider sx={{ mb: 2 }} />

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : sortedTokens.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              No invoices found for this player.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Invoice #</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Charge</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Due Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedTokens.map((token) => {
                    const status = getStatus(token);
                    const isOutstanding = !token.used && new Date(token.expiresAt) > new Date();
                    return (
                      <TableRow key={token.id}>
                        <TableCell>{token.invoiceNumber || '--'}</TableCell>
                        <TableCell>{token.chargeLabel || 'Full Balance'}</TableCell>
                        <TableCell align="right">
                          ${(token.chargeAmount || token.amountDue || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          {token.dueDate ? format(new Date(token.dueDate), 'MMM d, yyyy') : '--'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={status.label}
                            size="small"
                            color={status.color}
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell>
                          {isOutstanding ? (
                            <Button
                              size="small"
                              variant="contained"
                              color="primary"
                              startIcon={<PaymentIcon />}
                              onClick={() => navigate(`/pay/${token.token}`)}
                            >
                              Pay Now
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<VisibilityIcon />}
                              onClick={() => navigate(`/pay/${token.token}`)}
                            >
                              View
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Generate Invoice Dialog (admin only) */}
      {qrDialogFinance && (
        <InvoiceQRCard
          finance={qrDialogFinance}
          open={!!qrDialogFinance}
          onClose={() => setQrDialogFinance(null)}
        />
      )}
    </>
  );
};

export default PlayerInvoicesCard;
