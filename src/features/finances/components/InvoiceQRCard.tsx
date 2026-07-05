import { useState, useEffect, useRef } from 'react';
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
  IconButton,
  Tooltip,
  Chip,
  Stack,
  Alert,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import PrintIcon from '@mui/icons-material/Print';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareIcon from '@mui/icons-material/Share';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PaymentIcon from '@mui/icons-material/Payment';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceTokensApi } from '@/lib/api/invoiceTokens';
import { playerFinancesApi, computeFeeTotal } from '@/lib/api/finances';
import { useAuthStore } from '@/stores/authStore';
import { APP_URL } from '@/lib/stripe-config';
import { generateInvoiceHTML } from '@/lib/utils/invoicePrintTemplate';
import toast from 'react-hot-toast';
import type { PlayerFinance, InvoiceToken } from '@/types/models';

/** The charge types that can each get their own invoice */
const CHARGE_TYPES: { key: keyof PlayerFinance; label: string }[] = [
  { key: 'registrationFee', label: 'Registration Fee' },
  { key: 'uniformCost', label: 'Uniform Cost' },
  { key: 'tournamentFees', label: 'Tournament Fees' },
  { key: 'facilityFees', label: 'Facility Fees' },
  { key: 'equipmentFees', label: 'Equipment Fees' },
  { key: 'otherFees', label: 'Other Fees' },
];

interface InvoiceDisplay {
  id: string;          // Firestore document ID
  token: string;       // UUID token for payment URL
  invoiceNumber: string;
  amountDue: number;
  chargeType: string;
  chargeLabel: string;
  dueDate: string;
  paymentTerms: string;
  url: string;
  isExisting: boolean;
  used: boolean;
}

interface InvoiceQRCardProps {
  finance: PlayerFinance;
  open: boolean;
  onClose: () => void;
}

const PAYMENT_TERMS_OPTIONS = ['Net 30', 'Net 15', 'Due upon receipt', 'Net 60'];

const InvoiceQRCard = ({ finance, open, onClose }: InvoiceQRCardProps) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [invoiceMap, setInvoiceMap] = useState<Map<string, InvoiceDisplay>>(new Map());
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDisplay | null>(null);
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [paymentTerms, setPaymentTerms] = useState('Net 30');
  const printRef = useRef<HTMLDivElement>(null);

  // Load existing invoices when dialog opens
  useEffect(() => {
    if (!open || !finance.id) return;

    const loadExisting = async () => {
      setLoadingExisting(true);
      try {
        const existing = await invoiceTokensApi.getByFinance(finance.id);
        const now = new Date();
        const map = new Map<string, InvoiceDisplay>();

        // For each charge type, find the most recent active (unused + unexpired) invoice
        for (const inv of existing) {
          const chargeKey = inv.chargeType || 'full_balance';
          const isActive = !inv.used && inv.expiresAt > now;
          const current = map.get(chargeKey);

          // Prefer active invoices; if multiple active, use the newest
          if (!current || (isActive && (!current.isExisting || inv.createdAt > new Date(0)))) {
            map.set(chargeKey, {
              id: inv.id,
              token: inv.token,
              invoiceNumber: inv.invoiceNumber || '',
              amountDue: inv.amountDue,
              chargeType: chargeKey,
              chargeLabel: inv.chargeLabel || chargeKey,
              dueDate: inv.dueDate?.toISOString() || '',
              paymentTerms: inv.paymentTerms || 'Net 30',
              url: `${APP_URL}/pay/${inv.token}`,
              isExisting: true,
              used: inv.used,
            });
          }
        }

        setInvoiceMap(map);

        // Auto-select the first invoice if there's only one
        if (map.size === 1) {
          setSelectedInvoice(map.values().next().value!);
        }
      } catch (err) {
        console.error('Error loading existing invoices:', err);
        toast.error('Failed to load existing invoices');
      } finally {
        setLoadingExisting(false);
      }
    };

    loadExisting();
  }, [open, finance.id]);

  // Charges that have a value > 0
  const activeCharges = CHARGE_TYPES.filter(
    (ct) => (finance[ct.key] as number) > 0
  );

  const fullBalance = Math.max(
    0,
    computeFeeTotal(finance) - finance.totalPaid - (finance.scholarshipAmount || 0)
  );

  const generateMutation = useMutation({
    mutationFn: (chargeType?: string) =>
      invoiceTokensApi.generate(finance.id, finance.playerId, chargeType, dueDate, paymentTerms),
    onSuccess: (data) => {
      const invoice: InvoiceDisplay = {
        id: data.id,
        token: data.token,
        invoiceNumber: data.invoiceNumber,
        amountDue: data.amountDue,
        chargeType: data.chargeType,
        chargeLabel: data.chargeLabel,
        dueDate: data.dueDate,
        paymentTerms: data.paymentTerms,
        url: `${APP_URL}/pay/${data.token}`,
        isExisting: false,
        used: false,
      };
      setInvoiceMap((prev) => new Map(prev).set(data.chargeType, invoice));
      setSelectedInvoice(invoice);
      setGeneratingType(null);
      toast.success(`Invoice created: ${data.chargeLabel}`);
    },
    onError: (err: any) => {
      setGeneratingType(null);
      console.error('Invoice generation error:', err);
      const message = err?.message || err?.code || 'Unknown error';
      toast.error(`Invoice error: ${message}`, { duration: 6000 });
    },
  });

  const handleGenerate = (chargeType?: string) => {
    const key = chargeType || 'full_balance';
    setGeneratingType(key);
    generateMutation.mutate(chargeType);
  };

  const handleGenerateAll = async () => {
    let successCount = 0;
    let failCount = 0;
    let firstInvoice: InvoiceDisplay | null = null;

    for (const charge of activeCharges) {
      const key = charge.key as string;
      const existing = invoiceMap.get(key);
      // Skip if there's already an active (non-used) invoice
      if (existing && !existing.used) continue;

      setGeneratingType(key);
      try {
        const data = await invoiceTokensApi.generate(finance.id, finance.playerId, key, dueDate, paymentTerms);
        const invoice: InvoiceDisplay = {
          id: data.id,
          token: data.token,
          invoiceNumber: data.invoiceNumber,
          amountDue: data.amountDue,
          chargeType: data.chargeType,
          chargeLabel: data.chargeLabel,
          dueDate: data.dueDate,
          paymentTerms: data.paymentTerms,
          url: `${APP_URL}/pay/${data.token}`,
          isExisting: false,
          used: false,
        };
        setInvoiceMap((prev) => new Map(prev).set(data.chargeType, invoice));
        if (!firstInvoice) firstInvoice = invoice;
        successCount++;
      } catch (err: any) {
        failCount++;
        const message = err?.message || 'Unknown error';
        toast.error(`Failed: ${charge.label} — ${message}`);
      }
    }
    setGeneratingType(null);
    if (firstInvoice && !selectedInvoice) setSelectedInvoice(firstInvoice);

    if (failCount === 0 && successCount > 0) {
      toast.success(`All ${successCount} invoices generated!`);
    } else if (successCount > 0 && failCount > 0) {
      toast.error(`${successCount} created, ${failCount} failed`);
    } else if (successCount === 0 && failCount === 0) {
      toast.success('All charges already have active invoices');
    }
  };

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async (invoice: InvoiceDisplay) => {
    const shareData = {
      title: `Invoice: ${invoice.chargeLabel} - ${finance.playerName}`,
      text: `Northern Michigan Waves invoice for ${finance.playerName}: ${invoice.chargeLabel} - $${invoice.amountDue.toFixed(2)}`,
      url: invoice.url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        handleCopyLink(invoice.url);
      }
    } else {
      handleCopyLink(invoice.url);
    }
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }

    setRecordingPayment(true);
    try {
      // 1. Record the payment on the finance record
      await playerFinancesApi.addPayment(finance.id, {
        amount,
        date: new Date(paymentDate),
        method: paymentMethod as any,
        reference: paymentRef || undefined,
        notes: paymentNotes || `Payment for ${selectedInvoice.chargeLabel} (${selectedInvoice.invoiceNumber})`,
        recordedBy: user?.uid || 'unknown',
      });

      // 2. Mark the invoice token as used (by Firestore doc ID)
      if (selectedInvoice.id) {
        await invoiceTokensApi.markUsed(selectedInvoice.id, user?.uid || 'admin');
      }

      // 3. Update local state to show it as paid
      setInvoiceMap((prev) => {
        const updated = new Map(prev);
        updated.set(selectedInvoice.chargeType, { ...selectedInvoice, used: true });
        return updated;
      });

      // 4. Invalidate queries so the parent page refreshes
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      queryClient.invalidateQueries({ queryKey: ['invoiceTokens'] });

      toast.success(`Payment of $${amount.toFixed(2)} recorded for ${selectedInvoice.chargeLabel}`);
      setShowPaymentForm(false);
      setSelectedInvoice({ ...selectedInvoice, used: true });
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
    } catch (err: any) {
      console.error('Payment recording error:', err);
      toast.error(`Failed to record payment: ${err?.message || 'Unknown error'}`);
    } finally {
      setRecordingPayment(false);
    }
  };

  const handlePrint = () => {
    if (!selectedInvoice || !printRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const canvas = printRef.current.querySelector('canvas');
    const qrDataUrl = canvas?.toDataURL('image/png') || '';

    const tokenForPrint: InvoiceToken = {
      id: '',
      financeId: finance.id,
      playerId: finance.playerId,
      playerName: finance.playerName,
      teamName: finance.teamName,
      season: finance.season,
      amountDue: selectedInvoice.amountDue,
      chargeType: selectedInvoice.chargeType,
      chargeLabel: selectedInvoice.chargeLabel,
      registrationFee: finance.registrationFee,
      uniformCost: finance.uniformCost,
      tournamentFees: finance.tournamentFees,
      facilityFees: finance.facilityFees,
      equipmentFees: finance.equipmentFees,
      otherFees: finance.otherFees,
      scholarshipAmount: finance.scholarshipAmount,
      totalPaid: finance.totalPaid,
      token: selectedInvoice.token,
      invoiceNumber: selectedInvoice.invoiceNumber,
      dueDate: new Date(selectedInvoice.dueDate),
      paymentTerms: selectedInvoice.paymentTerms,
      expiresAt: new Date(),
      createdBy: '',
      createdAt: new Date(),
      used: false,
    };

    printWindow.document.write(generateInvoiceHTML(tokenForPrint, qrDataUrl));
    printWindow.document.close();
  };

  const handleClose = () => {
    setSelectedInvoice(null);
    setInvoiceMap(new Map());
    setGeneratingType(null);
    setLoadingExisting(false);
    setShowPaymentForm(false);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentRef('');
    setPaymentNotes('');
    setRecordingPayment(false);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setDueDate(d.toISOString().split('T')[0]);
    setPaymentTerms('Net 30');
    onClose();
  };

  // Count charges that still need invoices
  const chargesNeedingInvoice = activeCharges.filter((c) => {
    const inv = invoiceMap.get(c.key as string);
    return !inv || inv.used;
  });

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReceiptLongIcon color="primary" />
          <Box>
            <Typography variant="h6" component="span">
              Invoices for {finance.playerName}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {finance.teamName} &middot; {finance.season}
            </Typography>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loadingExisting ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <>
            {/* Charge List — one row per charge */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              {invoiceMap.size > 0
                ? 'Click an invoice to view its QR code and payment link:'
                : 'Generate an invoice for each charge:'}
            </Typography>

            <Stack spacing={1} sx={{ mb: 2 }}>
              {activeCharges.map((charge) => {
                const amt = finance[charge.key] as number;
                const key = charge.key as string;
                const invoice = invoiceMap.get(key);
                const hasActiveInvoice = invoice && !invoice.used;
                const isGenerating = generatingType === key;

                return (
                  <Box
                    key={key}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 2,
                      py: 1.5,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: hasActiveInvoice ? 'success.light' : 'divider',
                      bgcolor: hasActiveInvoice ? 'success.50' : 'transparent',
                      cursor: hasActiveInvoice ? 'pointer' : 'default',
                      '&:hover': hasActiveInvoice ? { bgcolor: 'action.hover' } : {},
                    }}
                    onClick={() => hasActiveInvoice && setSelectedInvoice(invoice)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {hasActiveInvoice ? (
                        <CheckCircleIcon color="success" fontSize="small" />
                      ) : (
                        <ReceiptLongIcon color="action" fontSize="small" />
                      )}
                      <Box>
                        <Typography variant="body2" fontWeight={500}>
                          {charge.label}
                        </Typography>
                        {hasActiveInvoice && (
                          <Typography variant="caption" color="text.secondary">
                            {invoice.invoiceNumber}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={600}>
                        ${amt.toFixed(2)}
                      </Typography>
                      {hasActiveInvoice ? (
                        <Stack direction="row" spacing={0.5}>
                          <Tooltip title="Copy payment link">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); handleCopyLink(invoice.url); }}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Share">
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); handleShare(invoice); }}
                            >
                              <ShareIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => { e.stopPropagation(); handleGenerate(key); }}
                          disabled={isGenerating}
                          startIcon={isGenerating ? <CircularProgress size={14} /> : <AddCircleOutlineIcon />}
                          sx={{ minWidth: 100 }}
                        >
                          {isGenerating ? 'Creating...' : 'New Invoice'}
                        </Button>
                      )}
                    </Box>
                  </Box>
                );
              })}

              {/* Full Balance option */}
              {fullBalance > 0 && (
                <>
                  <Divider sx={{ my: 0.5 }} />
                  {(() => {
                    const fbInvoice = invoiceMap.get('full_balance');
                    const hasActiveFB = fbInvoice && !fbInvoice.used;
                    return (
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 2,
                          py: 1.5,
                          borderRadius: 1.5,
                          border: '2px solid',
                          borderColor: hasActiveFB ? 'success.main' : 'primary.main',
                          bgcolor: hasActiveFB ? 'success.50' : 'primary.50',
                          cursor: hasActiveFB ? 'pointer' : 'default',
                          '&:hover': hasActiveFB ? { bgcolor: 'action.hover' } : {},
                        }}
                        onClick={() => hasActiveFB && setSelectedInvoice(fbInvoice)}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          {hasActiveFB ? (
                            <CheckCircleIcon color="success" fontSize="small" />
                          ) : (
                            <ReceiptLongIcon color="primary" fontSize="small" />
                          )}
                          <Box>
                            <Typography variant="body2" fontWeight={700}>
                              Full Balance
                            </Typography>
                            {hasActiveFB && (
                              <Typography variant="caption" color="text.secondary">
                                {fbInvoice.invoiceNumber}
                              </Typography>
                            )}
                          </Box>
                          {(finance.scholarshipAmount || 0) > 0 && (
                            <Chip label="Incl. scholarship" size="small" color="success" variant="outlined" />
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" fontWeight={700} color="error.main">
                            ${fullBalance.toFixed(2)}
                          </Typography>
                          {hasActiveFB ? (
                            <Stack direction="row" spacing={0.5}>
                              <Tooltip title="Copy payment link">
                                <IconButton
                                  size="small"
                                  onClick={(e) => { e.stopPropagation(); handleCopyLink(fbInvoice.url); }}
                                >
                                  <ContentCopyIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Share">
                                <IconButton
                                  size="small"
                                  onClick={(e) => { e.stopPropagation(); handleShare(fbInvoice); }}
                                >
                                  <ShareIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          ) : (
                            <Button
                              size="small"
                              variant="contained"
                              onClick={(e) => { e.stopPropagation(); handleGenerate(undefined); }}
                              disabled={generatingType === 'full_balance'}
                              startIcon={generatingType === 'full_balance' ? <CircularProgress size={14} /> : <AddCircleOutlineIcon />}
                              sx={{ minWidth: 100 }}
                            >
                              {generatingType === 'full_balance' ? 'Creating...' : 'New Invoice'}
                            </Button>
                          )}
                        </Box>
                      </Box>
                    );
                  })()}
                </>
              )}
            </Stack>

            {/* Generate All button — only if some charges still need invoices */}
            {chargesNeedingInvoice.length > 1 && (
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Button
                  variant="text"
                  size="small"
                  onClick={handleGenerateAll}
                  disabled={!!generatingType}
                  startIcon={generatingType ? <CircularProgress size={14} /> : <AddCircleOutlineIcon />}
                >
                  Generate Missing Invoices ({chargesNeedingInvoice.length})
                </Button>
              </Box>
            )}

            {/* New Invoice Settings — only show when there are charges needing invoices */}
            {chargesNeedingInvoice.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Settings for new invoices:
                </Typography>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Due Date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    sx={{ flex: 1 }}
                  />
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <InputLabel>Payment Terms</InputLabel>
                    <Select
                      value={paymentTerms}
                      label="Payment Terms"
                      onChange={(e) => setPaymentTerms(e.target.value)}
                    >
                      {PAYMENT_TERMS_OPTIONS.map((term) => (
                        <MenuItem key={term} value={term}>{term}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Stack>
              </Box>
            )}

            {/* QR Code Preview for selected invoice */}
            {selectedInvoice && (
              <>
                <Divider sx={{ my: 2 }} />
                <div ref={printRef}>
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                      {selectedInvoice.invoiceNumber}
                    </Typography>
                    <Chip
                      label={selectedInvoice.chargeLabel}
                      color="primary"
                      sx={{ mb: 1.5, fontWeight: 600 }}
                    />
                    <Typography variant="h4" color="error.main" fontWeight={700} sx={{ mb: 0.5 }}>
                      ${selectedInvoice.amountDue.toFixed(2)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {finance.playerName} &middot; {finance.teamName}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
                      <QRCode value={selectedInvoice.url} size={180} level="H" />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                      Scan with phone or click below to pay online
                    </Typography>
                    <Button
                      variant="contained"
                      color="primary"
                      size="large"
                      startIcon={<OpenInNewIcon />}
                      href={selectedInvoice.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ fontWeight: 600, px: 4 }}
                    >
                      Pay Now
                    </Button>
                  </Box>
                </div>

                {/* Action buttons for selected invoice */}
                {!selectedInvoice.used && (
                  <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => handleCopyLink(selectedInvoice.url)}
                    >
                      Copy Link
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ShareIcon />}
                      onClick={() => handleShare(selectedInvoice)}
                    >
                      Share
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PrintIcon />}
                      onClick={handlePrint}
                    >
                      Print
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      startIcon={<PaymentIcon />}
                      onClick={() => {
                        setPaymentAmount(selectedInvoice.amountDue.toFixed(2));
                        setShowPaymentForm(true);
                      }}
                    >
                      Record Payment
                    </Button>
                  </Stack>
                )}

                {selectedInvoice.used && (
                  <Alert severity="success" sx={{ mt: 1 }}>
                    This invoice has been paid.
                  </Alert>
                )}

                {/* Payment Form */}
                {showPaymentForm && !selectedInvoice.used && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
                      Record Payment for {selectedInvoice.chargeLabel}
                    </Typography>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.5}>
                        <TextField
                          label="Amount"
                          type="number"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          size="small"
                          sx={{ flex: 1 }}
                          InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>$</Typography> }}
                          inputProps={{ step: '0.01', min: '0.01' }}
                        />
                        <TextField
                          label="Date"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                          size="small"
                          InputLabelProps={{ shrink: true }}
                          sx={{ flex: 1 }}
                        />
                      </Stack>
                      <Stack direction="row" spacing={1.5}>
                        <FormControl size="small" sx={{ flex: 1 }}>
                          <InputLabel>Method</InputLabel>
                          <Select
                            value={paymentMethod}
                            label="Method"
                            onChange={(e) => setPaymentMethod(e.target.value)}
                          >
                            <MenuItem value="cash">Cash</MenuItem>
                            <MenuItem value="check">Check</MenuItem>
                            <MenuItem value="venmo">Venmo</MenuItem>
                            <MenuItem value="zelle">Zelle</MenuItem>
                            <MenuItem value="credit_card">Credit Card</MenuItem>
                            <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
                            <MenuItem value="stripe">Stripe</MenuItem>
                            <MenuItem value="other">Other</MenuItem>
                          </Select>
                        </FormControl>
                        <TextField
                          label="Reference #"
                          value={paymentRef}
                          onChange={(e) => setPaymentRef(e.target.value)}
                          size="small"
                          placeholder="Check #, txn ID..."
                          sx={{ flex: 1 }}
                        />
                      </Stack>
                      <TextField
                        label="Notes"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        size="small"
                        multiline
                        rows={2}
                        fullWidth
                      />
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => setShowPaymentForm(false)}>
                          Cancel
                        </Button>
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={handleRecordPayment}
                          disabled={recordingPayment}
                          startIcon={recordingPayment ? <CircularProgress size={14} /> : <PaymentIcon />}
                        >
                          {recordingPayment ? 'Recording...' : 'Confirm Payment'}
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                )}
              </>
            )}

            {!selectedInvoice && invoiceMap.size > 0 && (
              <Alert severity="success" sx={{ mt: 1 }}>
                Click an invoice above to view its QR code and payment link.
              </Alert>
            )}

            {!selectedInvoice && invoiceMap.size === 0 && !loadingExisting && (
              <Alert severity="info" sx={{ mt: 1 }}>
                No invoices exist yet. Click <strong>New Invoice</strong> next to a charge to create one.
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoiceQRCard;
