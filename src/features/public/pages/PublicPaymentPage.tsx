import { useState, useRef } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Paper,
  TextField,
  Button,
  Alert,
  Divider,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Chip,
  Stack,
  Tooltip,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import PrintIcon from '@mui/icons-material/Print';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import { invoiceTokensApi } from '@/lib/api/invoiceTokens';
import { useAuthStore } from '@/stores/authStore';
import { generateInvoiceHTML } from '@/lib/utils/invoicePrintTemplate';
import StripeCheckoutButton from '@/components/common/StripeCheckoutButton';
import type { InvoiceToken } from '@/types/models';
import toast from 'react-hot-toast';

const fmt = (n: number) => `$${n.toFixed(2)}`;

const fmtDate = (d: Date) =>
  new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

interface LineItem {
  label: string;
  amount: number;
}

/** Build line items from a full-balance invoice token */
const getLineItems = (t: InvoiceToken): LineItem[] => {
  const items: LineItem[] = [];
  if (t.registrationFee && t.registrationFee > 0) items.push({ label: 'Registration Fee', amount: t.registrationFee });
  if (t.uniformCost && t.uniformCost > 0) items.push({ label: 'Uniform Cost', amount: t.uniformCost });
  if (t.tournamentFees && t.tournamentFees > 0) items.push({ label: 'Tournament Fees', amount: t.tournamentFees });
  if (t.facilityFees && t.facilityFees > 0) items.push({ label: 'Facility Fees', amount: t.facilityFees });
  if (t.equipmentFees && t.equipmentFees > 0) items.push({ label: 'Equipment Fees', amount: t.equipmentFees });
  if (t.otherFees && t.otherFees > 0) items.push({ label: 'Other Fees', amount: t.otherFees });
  return items;
};

const PublicPaymentPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const qrRef = useRef<HTMLDivElement>(null);

  const [paymentAmount, setPaymentAmount] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');

  const { data: invoiceToken, isLoading } = useQuery({
    queryKey: ['invoiceToken', token],
    queryFn: () => invoiceTokensApi.getByToken(token!),
    enabled: !!token,
  });

  // --- Error / edge-case states ---
  if (isLoading) {
    return (
      <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading invoice...</Typography>
      </Container>
    );
  }

  if (!invoiceToken) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="error" sx={{ mb: 2 }}>Invoice not found</Alert>
          <Typography variant="body1" color="text.secondary">
            This payment link is invalid or has expired. Please contact the club for a new link.
          </Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/')}>Go Home</Button>
        </Paper>
      </Container>
    );
  }

  if (invoiceToken.used) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="warning" sx={{ mb: 2 }}>This invoice has already been paid</Alert>
          <Typography variant="body1" color="text.secondary">
            A payment was already made using this link. If you believe this is an error, please contact the club.
          </Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/')}>Go Home</Button>
        </Paper>
      </Container>
    );
  }

  if (new Date(invoiceToken.expiresAt) < new Date()) {
    return (
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Alert severity="warning" sx={{ mb: 2 }}>This invoice link has expired</Alert>
          <Typography variant="body1" color="text.secondary">
            Please contact the club for a new payment link.
          </Typography>
          <Button variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/')}>Go Home</Button>
        </Paper>
      </Container>
    );
  }

  // --- Invoice data ---
  const isPerCharge = invoiceToken.chargeType && invoiceToken.chargeType !== 'full_balance';

  // Live balance comes from the invoice callable (server-computed, works for
  // anonymous payers) — no direct playerFinances read from the browser.
  const liveBalanceDue = invoiceToken.liveBalanceDue != null ? Math.max(0, invoiceToken.liveBalanceDue) : null;
  const liveTotalPaid = invoiceToken.totalPaid || 0;
  const liveScholarship = invoiceToken.scholarshipAmount || 0;

  // Full-balance invoices default to the live remaining balance. Per-charge
  // invoices default to that charge's amount (capped at the remaining balance),
  // not the whole account balance.
  const fullRemaining = liveBalanceDue !== null ? liveBalanceDue : invoiceToken.amountDue;
  const effectiveAmountDue = isPerCharge
    ? Math.min(invoiceToken.chargeAmount || fullRemaining, fullRemaining || (invoiceToken.chargeAmount || 0))
    : fullRemaining;

  const amount = parseFloat(paymentAmount) || effectiveAmountDue;
  const isLoggedIn = !!user;
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());
  const payerName = isLoggedIn ? (user?.displayName || '') : guestName.trim();
  const payerEmail = isLoggedIn ? (user?.email || '') : guestEmail.trim();
  // Anyone with the link can pay; guests just provide a name + email so the
  // payment is attributed and receipted (the token is validated server-side).
  const canPay = amount >= 0.5 && (isLoggedIn || (guestName.trim().length > 1 && emailOk));
  const invoiceNumber = invoiceToken.invoiceNumber || invoiceToken.token.substring(0, 8).toUpperCase();
  const pageUrl = window.location.href;

  const lineItems = isPerCharge ? [] : getLineItems(invoiceToken);
  const subtotal = lineItems.reduce((s, i) => s + i.amount, 0);
  const scholarship = liveScholarship;
  const totalPaid = liveTotalPaid;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const canvas = qrRef.current?.querySelector('canvas');
    const qrDataUrl = canvas?.toDataURL('image/png') || '';
    printWindow.document.write(generateInvoiceHTML(invoiceToken, qrDataUrl));
    printWindow.document.close();
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      toast.success('Link copied! Share it with anyone to pay.');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Invoice: ${invoiceToken.chargeLabel || 'Payment'} - ${invoiceToken.playerName}`,
      text: `Northern Michigan Waves invoice for ${invoiceToken.playerName}: ${invoiceToken.chargeLabel || 'Payment'} - ${fmt(effectiveAmountDue)}`,
      url: pageUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { handleCopyLink(); }
    } else {
      handleCopyLink();
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 4 }}>
      {/* ====== HEADER ====== */}
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <SportsBaseballIcon sx={{ fontSize: 44, color: 'primary.main', mb: 0.5 }} />
        <Typography variant="h5" fontWeight={700}>Northern Michigan Waves</Typography>
        <Typography variant="body2" color="text.secondary">Invoice #{invoiceNumber}</Typography>
      </Box>

      {/* ====== INVOICE CARD ====== */}
      <Paper
        variant="outlined"
        sx={{ borderRadius: 3, overflow: 'hidden', mb: 3 }}
      >
        {/* Player / meta bar */}
        <Box sx={{ px: 3, py: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
          <Typography variant="subtitle1" fontWeight={700}>{invoiceToken.playerName}</Typography>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            {invoiceToken.teamName} &middot; {invoiceToken.season}
          </Typography>
        </Box>

        {/* Dates + terms */}
        <Box sx={{ px: 3, py: 1.5, display: 'flex', justifyContent: 'space-between', bgcolor: 'grey.50' }}>
          <Typography variant="caption" color="text.secondary">
            Issued {fmtDate(invoiceToken.createdAt)}
          </Typography>
          {invoiceToken.dueDate && (
            <Typography variant="caption" color="text.secondary">
              Due {fmtDate(invoiceToken.dueDate)}
            </Typography>
          )}
          {invoiceToken.paymentTerms && (
            <Typography variant="caption" color="text.secondary">
              {invoiceToken.paymentTerms}
            </Typography>
          )}
        </Box>

        <Divider />

        {/* ---- Per-charge invoice: single line item ---- */}
        {isPerCharge ? (
          <Box sx={{ px: 3, py: 3, textAlign: 'center' }}>
            <Chip
              label={invoiceToken.chargeLabel}
              color="primary"
              variant="outlined"
              sx={{ mb: 2, fontWeight: 600, fontSize: '0.9rem' }}
            />
            <Typography variant="h3" fontWeight={700} color="error.main">
              {fmt(effectiveAmountDue)}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Remaining Balance
            </Typography>
          </Box>
        ) : (
          /* ---- Full-balance invoice: itemized table ---- */
          <>
            {lineItems.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    {lineItems.map((item) => (
                      <TableRow key={item.label}>
                        <TableCell sx={{ pl: 3 }}>{item.label}</TableCell>
                        <TableCell align="right" sx={{ pr: 3 }}>{fmt(item.amount)}</TableCell>
                      </TableRow>
                    ))}

                    {/* Subtotal */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, pl: 3, borderTop: '2px solid', borderColor: 'divider' }}>
                        Subtotal
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 600, pr: 3, borderTop: '2px solid', borderColor: 'divider' }}>
                        {fmt(subtotal)}
                      </TableCell>
                    </TableRow>

                    {/* Scholarship */}
                    {scholarship > 0 && (
                      <TableRow>
                        <TableCell sx={{ color: 'success.main', pl: 3 }}>Less: Scholarship</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', pr: 3 }}>-{fmt(scholarship)}</TableCell>
                      </TableRow>
                    )}

                    {/* Payments made */}
                    {totalPaid > 0 && (
                      <TableRow>
                        <TableCell sx={{ color: 'success.main', pl: 3 }}>Less: Payments Made</TableCell>
                        <TableCell align="right" sx={{ color: 'success.main', pr: 3 }}>-{fmt(totalPaid)}</TableCell>
                      </TableRow>
                    )}

                    {/* Balance Due */}
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, fontSize: '1.1rem', pl: 3, borderTop: '2px solid', borderColor: 'divider' }}>
                        Balance Due
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ fontWeight: 700, fontSize: '1.1rem', color: effectiveAmountDue > 0 ? 'error.main' : 'success.main', pr: 3, borderTop: '2px solid', borderColor: 'divider' }}
                      >
                        {fmt(effectiveAmountDue)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box sx={{ px: 3, py: 3, textAlign: 'center' }}>
                <Typography variant="h4" color={effectiveAmountDue > 0 ? 'error.main' : 'success.main'} fontWeight={700}>
                  {fmt(effectiveAmountDue)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Balance Due
                </Typography>
              </Box>
            )}
          </>
        )}
      </Paper>

      {/* ====== SHARE / PRINT BAR ====== */}
      <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 3 }} className="no-print">
        <Tooltip title="Copy payment link">
          <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopyLink}>
            Copy Link
          </Button>
        </Tooltip>
        <Tooltip title="Share this invoice">
          <Button size="small" variant="outlined" startIcon={<ShareIcon />} onClick={handleShare}>
            Share
          </Button>
        </Tooltip>
        <Tooltip title="Print invoice">
          <Button size="small" variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
            Print
          </Button>
        </Tooltip>
      </Stack>

      {/* ====== PAY NOW ====== */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 3 }} className="no-print">
        <Typography variant="h6" gutterBottom>Pay Now</Typography>

        {isLoggedIn ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Paying as <strong>{payerName}</strong> ({payerEmail})
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Anyone can pay this invoice — just add your name and email so we can
              send a receipt and record the payment.{' '}
              <RouterLink to={`/login?returnTo=/pay/${token}`}>Have an account? Sign in</RouterLink>.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
              <TextField
                label="Your Name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                fullWidth
                required
              />
              <TextField
                label="Your Email"
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                fullWidth
                required
                error={!!guestEmail && !emailOk}
                helperText={guestEmail && !emailOk ? 'Enter a valid email' : ' '}
              />
            </Stack>
          </>
        )}

        <TextField
          label="Payment Amount"
          type="number"
          value={paymentAmount}
          onChange={(e) => setPaymentAmount(e.target.value)}
          placeholder={effectiveAmountDue.toFixed(2)}
          fullWidth
          sx={{ mb: 2 }}
          InputProps={{ startAdornment: '$' }}
          inputProps={{ step: '0.01', min: '0.50' }}
          helperText={`Leave blank to pay ${isPerCharge ? `this charge (${fmt(effectiveAmountDue)})` : `the remaining balance (${fmt(effectiveAmountDue)})`}`}
        />

        <Alert severity="info" sx={{ mb: 2 }}>
          A card processing fee applies to card payments.
        </Alert>

        <StripeCheckoutButton
          financeId={invoiceToken.financeId}
          playerId={invoiceToken.playerId}
          amount={amount}
          invoiceToken={invoiceToken.token}
          payerName={payerName}
          payerEmail={payerEmail}
          label={`Pay ${fmt(amount)}`}
          disabled={!canPay}
          fullWidth
        />
      </Paper>

      {/* Hidden QR code for print template */}
      <div ref={qrRef} style={{ position: 'absolute', left: '-9999px' }}>
        <QRCode value={pageUrl} size={180} level="H" />
      </div>
    </Container>
  );
};

export default PublicPaymentPage;
