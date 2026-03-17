import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import PersonIcon from '@mui/icons-material/Person';
import LockIcon from '@mui/icons-material/Lock';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import SchoolIcon from '@mui/icons-material/School';
import PaymentIcon from '@mui/icons-material/Payment';
import { playersApi } from '@/lib/api/players';
import { equipmentApi } from '@/lib/api/equipment';
import { playerFinancesApi } from '@/lib/api/finances';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin, isCoach as checkIsCoach, canViewPlayer, canViewPlayerFinances } from '@/lib/auth/roles';
import GCStatsPanel from '@/features/gamechanger/components/GCStatsPanel';
import { format, differenceInYears } from 'date-fns';
import PlayerFormDialog from '../components/PlayerFormDialog';
import PlayerDocumentsCard from '../components/PlayerDocumentsCard';
import PlayerComplianceCard from '../components/PlayerComplianceCard';
import PlayerInvoicesCard from '../components/PlayerInvoicesCard';

/**
 * Derives a softball age group label from a date of birth.
 * Age groups are typically 8U, 10U, 12U, 14U, 16U, 18U.
 */
const getAgeGroup = (dob: Date): string => {
  const age = differenceInYears(new Date(), dob);
  if (age <= 8) return '8U';
  if (age <= 10) return '10U';
  if (age <= 12) return '12U';
  if (age <= 14) return '14U';
  if (age <= 16) return '16U';
  return '18U';
};

const formatBatsThrows = (value?: 'L' | 'R' | 'S'): string => {
  if (!value) return '--';
  switch (value) {
    case 'L':
      return 'Left';
    case 'R':
      return 'Right';
    case 'S':
      return 'Switch';
    default:
      return value;
  }
};

const methodLabels: Record<string, string> = {
  cash: 'Cash',
  check: 'Check',
  venmo: 'Venmo',
  zelle: 'Zelle',
  credit_card: 'Credit Card',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  sponsor: 'Sponsor',
  stripe: 'Stripe',
  other: 'Other',
};

/** Safely format a date that may be a Date, Firestore Timestamp, or string. */
const safeFormatDate = (value: unknown): string => {
  try {
    if (!value) return '--';
    // Firestore Timestamp has a toDate() method
    const dateObj =
      value instanceof Date
        ? value
        : typeof value === 'object' && value !== null && 'toDate' in value
        ? (value as { toDate: () => Date }).toDate()
        : new Date(value as string);
    if (isNaN(dateObj.getTime())) return '--';
    return format(dateObj, 'MMM d, yyyy');
  } catch {
    return '--';
  }
};

/** Extract a sortable timestamp (ms) from an unknown date value. */
const safeGetTime = (value: unknown): number => {
  try {
    if (!value) return 0;
    const dateObj =
      value instanceof Date
        ? value
        : typeof value === 'object' && value !== null && 'toDate' in value
        ? (value as { toDate: () => Date }).toDate()
        : new Date(value as string);
    const t = dateObj.getTime();
    return isNaN(t) ? 0 : t;
  } catch {
    return 0;
  }
};

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Box sx={{ display: 'flex', py: 0.75 }}>
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ width: 160, flexShrink: 0, fontWeight: 500 }}
    >
      {label}
    </Typography>
    <Typography variant="body2">{value || '--'}</Typography>
  </Box>
);

const PlayerDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const isCoachOrAbove = checkIsCoach(user);

  const [editDialogOpen, setEditDialogOpen] = useState(false);

  // Fetch player data
  const {
    data: player,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['player', id],
    queryFn: () => playersApi.getById(id!),
    enabled: !!id,
  });

  // Fetch equipment assigned to this player
  const { data: equipment = [] } = useQuery({
    queryKey: ['equipment', 'player', id],
    queryFn: () => equipmentApi.getByPlayer(id!),
    enabled: !!id,
  });

  const showFinances = canViewPlayerFinances(user, player ?? null);

  // Fetch financial records for this player (admin or parent-with-linked-child)
  const { data: finances = [] } = useQuery({
    queryKey: ['playerFinances', 'player', id],
    queryFn: () => playerFinancesApi.getByPlayer(id!),
    enabled: !!id && showFinances,
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !player) {
    return (
      <Box sx={{ p: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(isCoachOrAbove ? '/players' : '/dashboard')}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Player not found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The player you are looking for does not exist or has been removed.
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (!canViewPlayer(user, player)) {
    return (
      <Box sx={{ p: 4 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/dashboard')}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <LockIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
          <Typography variant="h6" color="text.secondary">
            Access Denied
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            You do not have permission to view this player's profile.
          </Typography>
        </Paper>
      </Box>
    );
  }

  const fullName = `${player.firstName} ${player.lastName}`;
  const age = player.dateOfBirth ? differenceInYears(new Date(), player.dateOfBirth) : null;
  const ageGroup = player.dateOfBirth ? getAgeGroup(player.dateOfBirth) : null;

  // Aggregate financial summary across all seasons
  const financialSummary = finances.reduce(
    (acc, fin) => ({
      totalOwed: acc.totalOwed + fin.totalOwed,
      totalPaid: acc.totalPaid + fin.totalPaid,
      balance: acc.balance + fin.balance,
      balanceDue: acc.balanceDue + (fin.balanceDue ?? (fin.totalOwed - fin.totalPaid)),
    }),
    { totalOwed: 0, totalPaid: 0, balance: 0, balanceDue: 0 }
  );

  const isParentOnly = !isAdmin && !isCoachOrAbove;

  // Flatten all payments from all finance records, enriched with season.
  // Non-admins should not see sponsor payment details.
  const allPayments = finances
    .flatMap((fin) =>
      (fin.payments ?? []).map((p) => ({
        ...p,
        season: fin.season,
      }))
    )
    .filter((p) => isAdmin || p.method !== 'sponsor')
    .sort((a, b) => safeGetTime(b.date) - safeGetTime(a.date));

  const paymentsTotalAmount = allPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(isCoachOrAbove ? '/players' : '/dashboard')}
            color="inherit"
          >
            Back
          </Button>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PersonIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box>
              <Typography variant="h4" sx={{ lineHeight: 1.2 }}>
                {fullName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                <Chip
                  label={
                    player.status === 'quit'
                      ? 'Quit'
                      : player.active
                      ? 'Active'
                      : 'Inactive'
                  }
                  size="small"
                  color={
                    player.status === 'quit'
                      ? 'error'
                      : player.active
                      ? 'success'
                      : 'default'
                  }
                />
                {player.playingUpFrom && (
                  <Chip
                    label={`Playing Up from ${player.playingUpFrom}`}
                    size="small"
                    color="warning"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>
          </Box>
        </Box>
        {isAdmin && (
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => setEditDialogOpen(true)}
          >
            Edit Player
          </Button>
        )}
      </Box>

      <Grid container spacing={3}>
        {/* Player Information */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Player Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <InfoRow label="Full Name" value={fullName} />
              <InfoRow
                label="Date of Birth"
                value={
                  player.dateOfBirth
                    ? format(player.dateOfBirth, 'MMMM d, yyyy')
                    : '--'
                }
              />
              <InfoRow
                label="Age"
                value={age !== null ? `${age} years old` : '--'}
              />
              <InfoRow label="Age Group" value={ageGroup} />
              <InfoRow
                label="Graduation Year"
                value={player.gradYear ? String(player.gradYear) : '--'}
              />
              <InfoRow
                label="Team"
                value={
                  player.teamName ? (
                    <Chip
                      label={player.teamName}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  ) : (
                    'Unassigned'
                  )
                }
              />
              <InfoRow
                label="Jersey Number"
                value={
                  player.jerseyNumber !== undefined && player.jerseyNumber !== null
                    ? `#${player.jerseyNumber}`
                    : '--'
                }
              />
              <InfoRow
                label="Positions"
                value={
                  player.positions.length > 0 ? (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {player.positions.map((pos) => (
                        <Chip key={pos} label={pos} size="small" variant="outlined" />
                      ))}
                    </Box>
                  ) : (
                    '--'
                  )
                }
              />
              <InfoRow label="Bats" value={formatBatsThrows(player.bats)} />
              <InfoRow label="Throws" value={formatBatsThrows(player.throws)} />
              {player.playingUpFrom && (
                <InfoRow label="Playing Up From" value={player.playingUpFrom} />
              )}
              {player.status === 'quit' && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="subtitle2" color="error" sx={{ mb: 0.5, fontWeight: 600 }}>
                    Player Quit
                  </Typography>
                  {player.quitDate && (
                    <InfoRow label="Quit Date" value={safeFormatDate(player.quitDate)} />
                  )}
                  {player.quitReason && (
                    <InfoRow label="Reason" value={player.quitReason} />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Contact Information */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Contact Information
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {player.contacts.length > 0 ? (
                <>
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>
                    Contacts
                  </Typography>
                  {player.contacts.map((contact, index) => (
                    <Box key={index} sx={{ mb: index < player.contacts.length - 1 ? 2 : 0, pl: 1, borderLeft: '3px solid', borderColor: 'divider' }}>
                      <InfoRow
                        label="Name"
                        value={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {contact.name}
                            {contact.relationship && (
                              <Chip label={contact.relationship} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                            {contact.isPrimaryContact && (
                              <Chip label="Primary" size="small" color="primary" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                            {contact.isFinancialParty && (
                              <Chip label="Financial" size="small" color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                          </Box>
                        }
                      />
                      <InfoRow label="Email" value={contact.email} />
                      <InfoRow label="Phone" value={contact.phone} />
                    </Box>
                  ))}
                </>
              ) : (
                <>
                  <Typography variant="subtitle2" color="primary" sx={{ mb: 1, fontWeight: 600 }}>
                    Parent / Guardian
                  </Typography>
                  <InfoRow label="Name" value={player.parentName} />
                  <InfoRow label="Email" value={player.parentEmail} />
                  <InfoRow label="Phone" value={player.parentPhone} />
                </>
              )}

              <Divider sx={{ my: 2 }} />

              <Typography
                variant="subtitle2"
                color="error"
                sx={{ mb: 1, fontWeight: 600 }}
              >
                Emergency Contact
              </Typography>
              <InfoRow label="Name" value={player.emergencyContact} />
              <InfoRow label="Phone" value={player.emergencyPhone} />
            </CardContent>
          </Card>
        </Grid>

        {/* Notes & Medical */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Notes & Medical
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 0.5, fontWeight: 600 }}
              >
                Notes
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  mb: 2,
                  bgcolor: 'grey.50',
                  minHeight: 60,
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {player.notes || 'No notes recorded.'}
                </Typography>
              </Paper>

              <Typography
                variant="subtitle2"
                color="error.main"
                sx={{ mb: 0.5, fontWeight: 600 }}
              >
                Medical Notes
              </Typography>
              <Paper
                variant="outlined"
                sx={{
                  p: 2,
                  bgcolor: player.medicalNotes ? 'error.50' : 'grey.50',
                  borderColor: player.medicalNotes ? 'error.200' : undefined,
                  minHeight: 60,
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {player.medicalNotes || 'No medical notes recorded.'}
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </Grid>

        {/* Player Documents (birth certificates, etc.) */}
        <Grid item xs={12} md={6}>
          <PlayerDocumentsCard player={player} />
        </Grid>

        {/* Compliance & Agreements */}
        <Grid item xs={12} md={6}>
          <PlayerComplianceCard player={player} />
        </Grid>

        {/* Equipment */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Assigned Equipment
                </Typography>
                {equipment.length > 0 && (
                  <Typography variant="body2" color="primary.main" fontWeight={600}>
                    Total: ${equipment.reduce((s, e) => s + (e.cost || 0), 0).toFixed(2)}
                  </Typography>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />

              {equipment.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                  No equipment currently assigned to this player.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Variant</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Ownership</TableCell>
                        <TableCell sx={{ fontWeight: 600 }} align="right">Cost</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {equipment.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell sx={{ textTransform: 'capitalize' }}>
                            {item.type.replace('_', ' ')}
                            {item.number ? ` #${item.number}` : ''}
                          </TableCell>
                          <TableCell>{item.variant || '--'}</TableCell>
                          <TableCell>{item.size || '--'}</TableCell>
                          <TableCell>
                            <Chip
                              label={item.ownership === 'player' ? 'Player' : item.ownership === 'consumable' ? 'Consumable' : 'Org'}
                              size="small"
                              color={item.ownership === 'player' ? 'primary' : item.ownership === 'consumable' ? 'warning' : 'default'}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            ${(item.cost || 0).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Financial Summary (admin or parent-with-linked-child) */}
        {showFinances && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccountBalanceWalletIcon color="primary" />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Financial Summary
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {isAdmin && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => navigate('/finances/billing')}
                      >
                        Go to Billing
                      </Button>
                    )}
                    {isParentOnly && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PaymentIcon />}
                        onClick={() => navigate('/my-invoices')}
                      >
                        View Invoices & Pay
                      </Button>
                    )}
                  </Box>
                </Box>
                <Divider sx={{ mb: 2 }} />

                {finances.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No financial records found for this player.
                  </Typography>
                ) : (
                  <Grid container spacing={3}>
                    {/* Aggregate summary cards */}
                    <Grid item xs={12} sm={4}>
                      <Paper
                        sx={{
                          p: 2.5,
                          textAlign: 'center',
                          bgcolor: 'grey.50',
                          borderRadius: 2,
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 500 }}>
                          Total Owed
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                          ${financialSummary.totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper sx={{ p: 2.5, textAlign: 'center', bgcolor: 'success.50', borderRadius: 2 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 500 }}>
                          Total Paid
                        </Typography>
                        <Typography variant="h5" color="success.main" sx={{ fontWeight: 700 }}>
                          ${financialSummary.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper
                        sx={{
                          p: 2.5,
                          textAlign: 'center',
                          bgcolor: isAdmin
                            ? (financialSummary.balance >= 0 ? 'success.50' : 'error.50')
                            : (financialSummary.balanceDue > 0 ? 'error.50' : 'success.50'),
                          borderRadius: 2,
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 500 }}>
                          Balance
                        </Typography>
                        <Typography
                          variant="h5"
                          color={isAdmin
                            ? (financialSummary.balance >= 0 ? 'success.main' : 'error.main')
                            : (financialSummary.balanceDue > 0 ? 'error.main' : 'success.main')}
                          sx={{ fontWeight: 700 }}
                        >
                          {isAdmin ? (
                            <>
                              ${Math.abs(financialSummary.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              {financialSummary.balance < 0 && ' owed'}
                            </>
                          ) : (
                            <>
                              ${Math.max(0, financialSummary.balanceDue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              {financialSummary.balanceDue > 0 && ' owed'}
                            </>
                          )}
                        </Typography>
                      </Paper>
                    </Grid>

                    {/* Per-season fee itemization */}
                    {finances.map((fin) => (
                      <Grid item xs={12} key={fin.id}>
                        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                          {/* Season header */}
                          <Box sx={{ px: 2, py: 1.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                {fin.season} — {fin.teamName || 'No Team'}
                              </Typography>
                            </Box>
                            <Chip
                              label={fin.status}
                              size="small"
                              sx={{
                                textTransform: 'capitalize',
                                bgcolor: fin.status === 'paid' ? 'success.main' : fin.status === 'overdue' ? 'error.main' : 'warning.main',
                                color: 'white',
                                fontWeight: 600,
                              }}
                            />
                          </Box>

                          {/* Fee itemization table */}
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 600, width: '60%' }}>Fee Category</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {fin.registrationFee > 0 && (
                                  <TableRow>
                                    <TableCell>Registration Fee</TableCell>
                                    <TableCell align="right">${fin.registrationFee.toFixed(2)}</TableCell>
                                  </TableRow>
                                )}
                                {fin.uniformCost > 0 && (
                                  <TableRow>
                                    <TableCell>Uniform Cost</TableCell>
                                    <TableCell align="right">${fin.uniformCost.toFixed(2)}</TableCell>
                                  </TableRow>
                                )}
                                {fin.tournamentFees > 0 && (
                                  <TableRow>
                                    <TableCell>Tournament Fees</TableCell>
                                    <TableCell align="right">${fin.tournamentFees.toFixed(2)}</TableCell>
                                  </TableRow>
                                )}
                                {fin.facilityFees > 0 && (
                                  <TableRow>
                                    <TableCell>Facility Fees</TableCell>
                                    <TableCell align="right">${fin.facilityFees.toFixed(2)}</TableCell>
                                  </TableRow>
                                )}
                                {fin.equipmentFees > 0 && (
                                  <TableRow>
                                    <TableCell>Equipment Fees</TableCell>
                                    <TableCell align="right">${fin.equipmentFees.toFixed(2)}</TableCell>
                                  </TableRow>
                                )}
                                {fin.otherFees > 0 && (
                                  <TableRow>
                                    <TableCell>Other Fees</TableCell>
                                    <TableCell align="right">${fin.otherFees.toFixed(2)}</TableCell>
                                  </TableRow>
                                )}
                                {/* Total Owed row */}
                                <TableRow sx={{ bgcolor: 'grey.50' }}>
                                  <TableCell sx={{ fontWeight: 700 }}>Total Charges</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700 }}>${fin.totalOwed.toFixed(2)}</TableCell>
                                </TableRow>
                                {/* Scholarship discount */}
                                {isAdmin && fin.scholarshipAmount > 0 && (
                                  <TableRow>
                                    <TableCell sx={{ color: 'info.main' }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <SchoolIcon fontSize="small" />
                                        Scholarship / Financial Aid
                                      </Box>
                                    </TableCell>
                                    <TableCell align="right" sx={{ color: 'info.main', fontWeight: 600 }}>
                                      -${fin.scholarshipAmount.toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                )}
                                {/* Payments total */}
                                <TableRow>
                                  <TableCell sx={{ color: 'success.main', fontWeight: 600 }}>Payments Received</TableCell>
                                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>
                                    -${fin.totalPaid.toFixed(2)}
                                  </TableCell>
                                </TableRow>
                                {/* Balance due row */}
                                <TableRow sx={{ bgcolor: isAdmin ? (fin.balance >= 0 ? 'success.50' : 'error.50') : ((fin.balanceDue ?? 0) > 0 ? 'error.50' : 'success.50') }}>
                                  <TableCell sx={{ fontWeight: 700, fontSize: '0.95rem' }}>Balance Due</TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{
                                      fontWeight: 700,
                                      fontSize: '0.95rem',
                                      color: isAdmin ? (fin.balance >= 0 ? 'success.main' : 'error.main') : ((fin.balanceDue ?? 0) > 0 ? 'error.main' : 'success.main'),
                                    }}
                                  >
                                    {isAdmin ? (
                                      <>
                                        ${Math.abs(fin.balance).toFixed(2)}
                                        {fin.balance < 0 ? ' owed' : fin.balance > 0 ? ' credit' : ''}
                                      </>
                                    ) : (
                                      <>
                                        ${Math.max(0, fin.balanceDue ?? 0).toFixed(2)}
                                        {(fin.balanceDue ?? 0) > 0 && ' owed'}
                                      </>
                                    )}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Payment History (admin or parent-with-linked-child) */}
        {showFinances && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <ReceiptLongIcon color="primary" />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Payment History
                  </Typography>
                </Box>
                <Divider sx={{ mb: 2 }} />

                {allPayments.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No payments recorded yet.
                  </Typography>
                ) : (
                  <>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>Amount</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Method</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Payer</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Reference</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Season</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {allPayments.map((payment, idx) => (
                            <TableRow key={payment.id ?? idx} hover>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                {safeFormatDate(payment.date)}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ color: 'success.main', fontWeight: 700, whiteSpace: 'nowrap' }}
                              >
                                ${(payment.amount ?? 0).toLocaleString('en-US', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={methodLabels[payment.method] ?? payment.method ?? '--'}
                                  size="small"
                                  variant="outlined"
                                  color={
                                    payment.method === 'sponsor'
                                      ? 'secondary'
                                      : payment.method === 'stripe' || payment.method === 'credit_card' || payment.method === 'card'
                                      ? 'info'
                                      : 'default'
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                {payment.payerName || payment.sponsorName || '--'}
                              </TableCell>
                              <TableCell>
                                {payment.reference || '--'}
                              </TableCell>
                              <TableCell>
                                <Chip label={payment.season} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {payment.notes || '--'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Summary footer */}
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 2,
                        pt: 2,
                        borderTop: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Typography variant="body2" color="text.secondary">
                        {allPayments.length} payment{allPayments.length !== 1 ? 's' : ''} recorded
                      </Typography>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'success.main' }}>
                        Total: $
                        {paymentsTotalAmount.toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </Typography>
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Player Invoices (admin or parent-with-linked-child) */}
        {showFinances && (
          <Grid item xs={12}>
            <PlayerInvoicesCard playerId={id!} playerName={fullName} finances={finances} />
          </Grid>
        )}

        {/* GameChanger Stats */}
        <Grid item xs={12}>
          <GCStatsPanel playerId={id} />
        </Grid>
      </Grid>

      {/* Edit Dialog */}
      {isAdmin && (
        <PlayerFormDialog
          open={editDialogOpen}
          onClose={() => setEditDialogOpen(false)}
          player={player}
        />
      )}
    </Box>
  );
};

export default PlayerDetailsPage;
