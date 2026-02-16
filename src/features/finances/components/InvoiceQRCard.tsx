import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
} from '@mui/material';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import PrintIcon from '@mui/icons-material/Print';
import QrCodeIcon from '@mui/icons-material/QrCode';
import { useMutation } from '@tanstack/react-query';
import { invoiceTokensApi } from '@/lib/api/invoiceTokens';
import { APP_URL } from '@/lib/stripe-config';
import toast from 'react-hot-toast';

interface InvoiceQRCardProps {
  financeId: string;
  playerId: string;
  playerName: string;
  teamName: string;
  amountDue: number;
  open: boolean;
  onClose: () => void;
}

const InvoiceQRCard = ({
  financeId,
  playerId,
  playerName,
  teamName,
  amountDue,
  open,
  onClose,
}: InvoiceQRCardProps) => {
  const [tokenData, setTokenData] = useState<{ token: string; amountDue: number } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const generateMutation = useMutation({
    mutationFn: () => invoiceTokensApi.generate(financeId, playerId),
    onSuccess: (data) => {
      setTokenData(data);
      toast.success('QR invoice generated');
    },
    onError: () => {
      toast.error('Failed to generate QR code');
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice - ${playerName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
            .card { border: 2px solid #333; border-radius: 12px; padding: 30px; max-width: 400px; margin: 0 auto; }
            h1 { color: #1565c0; margin-bottom: 5px; }
            h2 { margin-top: 20px; }
            .amount { font-size: 24px; color: #d32f2f; font-weight: bold; }
            .instructions { font-size: 12px; color: #666; margin-top: 20px; }
            canvas { margin: 20px 0; }
          </style>
        </head>
        <body>
          ${printRef.current.innerHTML}
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const paymentUrl = tokenData ? `${APP_URL}/pay/${tokenData.token}` : '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QrCodeIcon color="primary" />
          QR Invoice for {playerName}
        </Box>
      </DialogTitle>
      <DialogContent>
        {!tokenData ? (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Generate a QR code that anyone can scan to make a payment for this player.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Player: {playerName} | Team: {teamName} | Balance: ${amountDue.toFixed(2)}
            </Typography>
            <Button
              variant="contained"
              onClick={handleGenerate}
              disabled={generateMutation.isPending}
              startIcon={generateMutation.isPending ? <CircularProgress size={20} /> : <QrCodeIcon />}
            >
              {generateMutation.isPending ? 'Generating...' : 'Generate QR Invoice'}
            </Button>
          </Box>
        ) : (
          <Box>
            {/* Printable area */}
            <div ref={printRef}>
              <Box sx={{ textAlign: 'center', p: 3 }}>
                <Typography variant="h5" fontWeight={700} color="primary.main">
                  TC Waves Ball Club
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Payment Invoice
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="h6" fontWeight={600}>
                  {playerName}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {teamName}
                </Typography>
                <Box sx={{ my: 3, display: 'flex', justifyContent: 'center' }}>
                  <QRCode value={paymentUrl} size={200} level="H" />
                </Box>
                <Typography variant="h5" color="error.main" fontWeight={700}>
                  ${tokenData.amountDue.toFixed(2)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Amount Due
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Typography variant="caption" color="text.secondary">
                  Scan the QR code above to make a payment online.
                  Accepts credit/debit cards via secure Stripe checkout.
                </Typography>
              </Box>
            </div>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {tokenData && (
          <Button startIcon={<PrintIcon />} onClick={handlePrint}>
            Print
          </Button>
        )}
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceQRCard;
