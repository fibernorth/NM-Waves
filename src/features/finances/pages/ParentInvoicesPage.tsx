import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Stack,
  Tooltip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import PaymentIcon from '@mui/icons-material/Payment';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LinkIcon from '@mui/icons-material/Link';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { playerFinancesApi } from '@/lib/api/finances';
import { invoiceTokensApi } from '@/lib/api/invoiceTokens';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import { isParent as checkIsParent } from '@/lib/auth/roles';
import { APP_URL } from '@/lib/stripe-config';
import { useNavigate } from 'react-router-dom';
import LinkChildDialog from '@/features/players/components/LinkChildDialog';
import toast from 'react-hot-toast';

const fmt = (n: number) => `$${n.toFixed(2)}`;

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  venmo: 'Venmo',
  zelle: 'Zelle',
  card: 'Card',
  credit_card: 'Credit Card',
  bank_transfer: 'Bank Transfer',
  sponsor: 'Sponsor',
  stripe: 'Stripe',
  other: 'Other',
};

/** Safely convert a Firestore Timestamp, Date, or string into a JS Date. */
const toDate = (v: unknown): Date | null => {
  try {
    if (!v) return null;
    // Firestore Timestamp
    if (typeof v === 'object' && v !== null && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
      return (v as { toDate: () => Date }).toDate();
    }
    const d = v instanceof Date ? v : new Date(v as string | number);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

const ParentInvoicesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isParent = checkIsParent(user);
  const linkedPlayerIds = user?.linkedPlayerIds || [];
  const [linkChildOpen, setLinkChildOpen] = useState(false);
  const [expandedFees, setExpandedFees] = useState<Set<string>>(new Set());

  // Fetch linked children
  const { data: linkedChildren = [], isLoading: loadingChildren, isError: errorChildren } = useQuery({
    queryKey: ['linkedChildren', ...linkedPlayerIds],
    queryFn: async () => {
      const results = await Promise.all(
        linkedPlayerIds.map(id => playersApi.getById(id))
      );
      return results.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof playersApi.getById>>>[];
    },
    enabled: linkedPlayerIds.length > 0,
  });

  // Fetch finances for linked children
  const { data: childFinances = [], isLoading: loadingFinances, isError: errorFinances } = useQuery({
    queryKey: ['childFinances', ...linkedPlayerIds],
    queryFn: async () => {
      const results = await Promise.all(
        linkedPlayerIds.map(id => playerFinancesApi.getByPlayer(id))
      );
      return results.flat();
    },
    enabled: linkedPlayerIds.length > 0,
  });

  // Fetch invoices for linked children
  const { data: childInvoices = [], isLoading: loadingInvoices, isError: errorInvoices } = useQuery({
    queryKey: ['childInvoices', ...linkedPlayerIds],
    queryFn: async () => {
      const results = await Promise.all(
        linkedPlayerIds.map(id => invoiceTokensApi.getByPlayer(id))
      );
      return results.flat();
    },
    enabled: linkedPlayerIds.length > 0,
  });

  const isLoading = loadingChildren || loadingFinances || loadingInvoices;
  const isError = errorChildren || errorFinances || errorInvoices;

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Payment link copied!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  if (!isParent || linkedPlayerIds.length === 0) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>My Invoices</Typography>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <ChildCareIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No children linked to your account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Link your children to see their invoices and make payments.
          </Typography>
          <Button
            variant="contained"
            startIcon={<LinkIcon />}
            onClick={() => setLinkChildOpen(true)}
          >
            Link a Child
          </Button>
          <LinkChildDialog open={linkChildOpen} onClose={() => setLinkChildOpen(false)} />
        </Paper>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>My Invoices</Typography>
        <Alert severity="error">Failed to load invoice data. Please refresh the page or try again later.</Alert>
      </Box>
    );
  }

  // Build a map of financeId -> balanceDue for accurate invoice remaining amounts
  const financeBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of childFinances) {
      map.set(f.id, f.balanceDue);
    }
    return map;
  }, [childFinances]);

  // Compute actual remaining amount per invoice token using finance data
  const invoiceRemainingMap = useMemo(() => {
    const result: Record<string, { remaining: number; isPaid: boolean }> = {};

    // Group non-used tokens by financeId
    const tokensByFinance = new Map<string, typeof childInvoices>();
    for (const token of childInvoices) {
      if (token.used) {
        result[token.id] = { remaining: 0, isPaid: true };
        continue;
      }
      const existing = tokensByFinance.get(token.financeId) || [];
      existing.push(token);
      tokensByFinance.set(token.financeId, existing);
    }

    for (const [financeId, tokens] of tokensByFinance) {
      const balanceDue = financeBalanceMap.get(financeId);

      if (balanceDue === undefined) {
        for (const t of tokens) {
          const amt = t.chargeAmount || t.amountDue || 0;
          result[t.id] = { remaining: amt, isPaid: false };
        }
        continue;
      }

      if (balanceDue <= 0) {
        for (const t of tokens) {
          result[t.id] = { remaining: 0, isPaid: true };
        }
      } else {
        const totalInvoiced = tokens.reduce((s, t) => s + (t.chargeAmount || t.amountDue || 0), 0);
        for (const t of tokens) {
          const originalAmt = t.chargeAmount || t.amountDue || 0;
          const remaining = totalInvoiced > 0
            ? Math.round((originalAmt / totalInvoiced) * balanceDue * 100) / 100
            : balanceDue;
          result[t.id] = { remaining, isPaid: remaining <= 0 };
        }
      }
    }

    return result;
  }, [childInvoices, financeBalanceMap]);

  // Summarize by child
  const now = new Date();

  return (
    <Box>
      <Typography variant="h4" gutterBottom>My Invoices & Payments</Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        View outstanding invoices for your children and make payments online.
      </Typography>

      {linkedChildren.map((child) => {
        const finances = childFinances.filter(f => f.playerId === child.id);
        const invoices = childInvoices.filter(i => i.playerId === child.id);
        // Use finance-aware remaining map to determine truly outstanding invoices
        const activeInvoices = invoices.filter(i => {
          const info = invoiceRemainingMap[i.id];
          if (info?.isPaid) return false;
          return !i.used && i.expiresAt > now;
        });
        const paidInvoices = invoices.filter(i => {
          const info = invoiceRemainingMap[i.id];
          return i.used || info?.isPaid;
        });

        const totalOwed = finances.reduce((s, f) => s + f.totalOwed, 0);
        const totalPaid = finances.reduce((s, f) => s + f.totalPaid, 0);
        // Use balanceDue which correctly accounts for scholarships
        const balance = finances.reduce((s, f) => s + (f.balanceDue ?? (f.totalOwed - f.totalPaid)), 0);

        return (
          <Paper key={child.id} sx={{ mb: 3, overflow: 'hidden' }}>
            {/* Child header */}
            <Box sx={{ px: 3, py: 2, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <ChildCareIcon />
                <Box>
                  <Typography
                    variant="h6"
                    sx={{ lineHeight: 1.2, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                    onClick={() => navigate(`/players/${child.id}`)}
                  >
                    {child.firstName} {child.lastName}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85 }}>
                    {child.teamName || 'Unassigned'}
                  </Typography>
                </Box>
              </Box>
              {balance > 0 && (
                <Chip
                  label={`${fmt(balance)} owed`}
                  sx={{ bgcolor: 'error.main', color: 'white', fontWeight: 700 }}
                />
              )}
              {balance <= 0 && (
                <Chip
                  icon={<CheckCircleIcon />}
                  label="Paid in Full"
                  sx={{ bgcolor: 'success.main', color: 'white', fontWeight: 700 }}
                />
              )}
            </Box>

            {/* Financial summary */}
            {finances.length > 0 && (
              <Box sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
                <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mb: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Total Charged</Typography>
                    <Typography variant="body1" fontWeight={600}>{fmt(totalOwed)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Total Paid</Typography>
                    <Typography variant="body1" fontWeight={600} color="success.main">{fmt(totalPaid)}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Balance Due</Typography>
                    <Typography variant="body1" fontWeight={700} color={balance > 0 ? 'error.main' : 'success.main'}>
                      {fmt(Math.max(0, balance))}
                    </Typography>
                  </Box>
                </Box>

                {/* Fee breakdown toggle */}
                {finances.map((fin) => {
                  const feeKey = `${child.id}-${fin.id}`;
                  const isExpanded = expandedFees.has(feeKey);
                  const hasFees = fin.registrationFee > 0 || fin.uniformCost > 0 || fin.tournamentFees > 0 ||
                    fin.facilityFees > 0 || fin.equipmentFees > 0 || fin.otherFees > 0;
                  if (!hasFees) return null;
                  return (
                    <Box key={fin.id} sx={{ mt: 1 }}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => {
                          const next = new Set(expandedFees);
                          if (isExpanded) next.delete(feeKey); else next.add(feeKey);
                          setExpandedFees(next);
                        }}
                        endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        sx={{ textTransform: 'none', fontWeight: 500 }}
                      >
                        {fin.season} Fee Breakdown
                      </Button>
                      {isExpanded && (
                        <TableContainer component={Paper} variant="outlined" sx={{ mt: 0.5 }}>
                          <Table size="small">
                            <TableBody>
                              {fin.registrationFee > 0 && (
                                <TableRow>
                                  <TableCell>Registration Fee</TableCell>
                                  <TableCell align="right">{fmt(fin.registrationFee)}</TableCell>
                                </TableRow>
                              )}
                              {fin.uniformCost > 0 && (
                                <TableRow>
                                  <TableCell>Uniform Cost</TableCell>
                                  <TableCell align="right">{fmt(fin.uniformCost)}</TableCell>
                                </TableRow>
                              )}
                              {fin.tournamentFees > 0 && (
                                <TableRow>
                                  <TableCell>Tournament Fees</TableCell>
                                  <TableCell align="right">{fmt(fin.tournamentFees)}</TableCell>
                                </TableRow>
                              )}
                              {fin.facilityFees > 0 && (
                                <TableRow>
                                  <TableCell>Facility Fees</TableCell>
                                  <TableCell align="right">{fmt(fin.facilityFees)}</TableCell>
                                </TableRow>
                              )}
                              {fin.equipmentFees > 0 && (
                                <TableRow>
                                  <TableCell>Equipment Fees</TableCell>
                                  <TableCell align="right">{fmt(fin.equipmentFees)}</TableCell>
                                </TableRow>
                              )}
                              {fin.otherFees > 0 && (
                                <TableRow>
                                  <TableCell>Other Fees</TableCell>
                                  <TableCell align="right">{fmt(fin.otherFees)}</TableCell>
                                </TableRow>
                              )}
                              <TableRow sx={{ bgcolor: 'grey.100' }}>
                                <TableCell sx={{ fontWeight: 700 }}>Total Charges</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 700 }}>{fmt(fin.totalOwed)}</TableCell>
                              </TableRow>
                              {/* Scholarship details hidden from parent view */}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}

            <Divider />

            {/* Active invoices */}
            {activeInvoices.length > 0 ? (
              <Box sx={{ px: 3, py: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Outstanding Invoices
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Invoice #</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell align="right">Invoiced</TableCell>
                        <TableCell align="right">Remaining</TableCell>
                        <TableCell>Due Date</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activeInvoices.map((inv) => {
                        const payUrl = `${APP_URL}/pay/${inv.token}`;
                        const overdue = inv.dueDate && new Date(inv.dueDate) < now;
                        const info = invoiceRemainingMap[inv.id];
                        const remaining = info ? info.remaining : inv.amountDue;
                        return (
                          <TableRow key={inv.id}>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>
                                {inv.invoiceNumber || inv.token.substring(0, 8).toUpperCase()}
                              </Typography>
                            </TableCell>
                            <TableCell>{inv.chargeLabel || 'Payment'}</TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" color="text.secondary">
                                {fmt(inv.chargeAmount || inv.amountDue)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography fontWeight={600} color="error.main">
                                {fmt(remaining)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              {inv.dueDate ? (
                                <Chip
                                  label={new Date(inv.dueDate).toLocaleDateString()}
                                  size="small"
                                  color={overdue ? 'error' : 'default'}
                                  variant={overdue ? 'filled' : 'outlined'}
                                />
                              ) : '--'}
                            </TableCell>
                            <TableCell align="center">
                              <Stack direction="row" spacing={0.5} justifyContent="center">
                                <Button
                                  size="small"
                                  variant="contained"
                                  color="primary"
                                  startIcon={<PaymentIcon />}
                                  onClick={() => window.open(payUrl, '_blank')}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Pay Now
                                </Button>
                                <Tooltip title="Copy payment link">
                                  <IconButton size="small" onClick={() => handleCopyLink(payUrl)}>
                                    <ContentCopyIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            ) : balance > 0 ? (
              <Box sx={{ px: 3, py: 2 }}>
                <Alert severity="info">
                  There is an outstanding balance but no invoices have been generated yet.
                  Please contact the club to request an invoice.
                </Alert>
              </Box>
            ) : null}

            {/* Unified Payment History — manual payments + paid invoice tokens */}
            {(() => {
              // Build unified payment rows from the finance records' payments array
              // Filter out sponsor payments — parents should not see these
              const manualPayments = finances.flatMap(f =>
                (f.payments || []).filter(p => !p.sponsorId && !p.sponsorName).map(p => ({
                  key: `pay-${p.id}`,
                  date: toDate(p.date) || toDate(p.recordedAt),
                  amount: p.amount,
                  method: METHOD_LABELS[p.method] || p.method || '—',
                  payer: p.payerName || '—',
                  reference: p.reference || p.notes || '',
                  season: f.season,
                  source: 'manual' as const,
                }))
              );

              // Build rows from paid invoice tokens
              const invoicePayments = paidInvoices.map(inv => ({
                key: `inv-${inv.id}`,
                date: toDate(inv.usedAt),
                amount: inv.amountDue,
                method: 'Invoice (Stripe)',
                payer: '—',
                reference: inv.chargeLabel
                  ? `${inv.chargeLabel} — ${inv.invoiceNumber || ''}`
                  : inv.invoiceNumber || inv.token?.substring(0, 8).toUpperCase() || '',
                season: '',
                source: 'invoice' as const,
              }));

              // Merge & sort descending by date
              const allPayments = [...manualPayments, ...invoicePayments].sort((a, b) => {
                const da = a.date?.getTime() ?? 0;
                const db = b.date?.getTime() ?? 0;
                return db - da;
              });

              if (allPayments.length === 0) return null;

              return (
                <Box sx={{ px: 3, py: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
                    Payment History
                  </Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Date</TableCell>
                          <TableCell align="right">Amount</TableCell>
                          <TableCell>Method</TableCell>
                          <TableCell>Payer</TableCell>
                          <TableCell>Reference / Note</TableCell>
                          <TableCell>Season</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {allPayments.map(p => (
                          <TableRow key={p.key}>
                            <TableCell>
                              <Typography variant="body2">
                                {p.date ? p.date.toLocaleDateString() : '—'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={600} color="success.main">
                                {fmt(p.amount)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip label={p.method} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2">{p.payer}</Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {p.reference || '—'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {p.season || '—'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              );
            })()}
          </Paper>
        );
      })}

      {linkedChildren.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No children linked to your account yet.
          </Typography>
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            startIcon={<LinkIcon />}
            onClick={() => setLinkChildOpen(true)}
          >
            Link a Child
          </Button>
          <LinkChildDialog open={linkChildOpen} onClose={() => setLinkChildOpen(false)} />
        </Paper>
      )}
    </Box>
  );
};

export default ParentInvoicesPage;
