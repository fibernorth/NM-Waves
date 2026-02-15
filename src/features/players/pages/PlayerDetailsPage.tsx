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
import { playersApi } from '@/lib/api/players';
import { equipmentApi } from '@/lib/api/equipment';
import { playerFinancesApi } from '@/lib/api/finances';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import GCStatsPanel from '@/features/gamechanger/components/GCStatsPanel';
import { format, differenceInYears } from 'date-fns';
import PlayerFormDialog from '../components/PlayerFormDialog';
import PlayerDocumentsCard from '../components/PlayerDocumentsCard';

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

  // Fetch financial records for this player (admin only)
  const { data: finances = [] } = useQuery({
    queryKey: ['playerFinances', 'player', id],
    queryFn: () => playerFinancesApi.getByPlayer(id!),
    enabled: !!id && isAdmin,
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
          onClick={() => navigate('/players')}
          sx={{ mb: 2 }}
        >
          Back to Players
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

  const fullName = `${player.firstName} ${player.lastName}`;
  const age = player.dateOfBirth ? differenceInYears(new Date(), player.dateOfBirth) : null;
  const ageGroup = player.dateOfBirth ? getAgeGroup(player.dateOfBirth) : null;

  // Aggregate financial summary across all seasons
  const financialSummary = finances.reduce(
    (acc, fin) => ({
      totalOwed: acc.totalOwed + fin.totalOwed,
      totalPaid: acc.totalPaid + fin.totalPaid,
      balance: acc.balance + fin.balance,
    }),
    { totalOwed: 0, totalPaid: 0, balance: 0 }
  );

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
            onClick={() => navigate('/players')}
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
                  label={player.active ? 'Active' : 'Inactive'}
                  size="small"
                  color={player.active ? 'success' : 'default'}
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

        {/* Equipment */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Assigned Equipment
              </Typography>
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
                        <TableCell sx={{ fontWeight: 600 }}>Number</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Size</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Condition</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {equipment.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell sx={{ textTransform: 'capitalize' }}>
                            {item.type.replace('_', ' ')}
                          </TableCell>
                          <TableCell>
                            {item.number !== undefined && item.number !== null
                              ? `#${item.number}`
                              : '--'}
                          </TableCell>
                          <TableCell>{item.size || '--'}</TableCell>
                          <TableCell>
                            <Chip
                              label={item.condition}
                              size="small"
                              color={
                                item.condition === 'new'
                                  ? 'success'
                                  : item.condition === 'good'
                                  ? 'primary'
                                  : item.condition === 'fair'
                                  ? 'warning'
                                  : 'error'
                              }
                              variant="outlined"
                              sx={{ textTransform: 'capitalize' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={item.status}
                              size="small"
                              color={
                                item.status === 'assigned'
                                  ? 'info'
                                  : item.status === 'available'
                                  ? 'success'
                                  : item.status === 'damaged'
                                  ? 'error'
                                  : 'default'
                              }
                              sx={{ textTransform: 'capitalize' }}
                            />
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

        {/* Financial Summary (admin only) */}
        {isAdmin && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  Financial Summary
                </Typography>
                <Divider sx={{ mb: 2 }} />

                {finances.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No financial records found for this player.
                  </Typography>
                ) : (
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={4}>
                      <Paper
                        sx={{
                          p: 2.5,
                          textAlign: 'center',
                          bgcolor: 'grey.50',
                          borderRadius: 2,
                        }}
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 0.5, fontWeight: 500 }}
                        >
                          Total Owed
                        </Typography>
                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                          ${financialSummary.totalOwed.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper
                        sx={{
                          p: 2.5,
                          textAlign: 'center',
                          bgcolor: 'success.50',
                          borderRadius: 2,
                        }}
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 0.5, fontWeight: 500 }}
                        >
                          Total Paid
                        </Typography>
                        <Typography
                          variant="h5"
                          color="success.main"
                          sx={{ fontWeight: 700 }}
                        >
                          ${financialSummary.totalPaid.toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                      <Paper
                        sx={{
                          p: 2.5,
                          textAlign: 'center',
                          bgcolor:
                            financialSummary.balance >= 0 ? 'success.50' : 'error.50',
                          borderRadius: 2,
                        }}
                      >
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ mb: 0.5, fontWeight: 500 }}
                        >
                          Balance
                        </Typography>
                        <Typography
                          variant="h5"
                          color={
                            financialSummary.balance >= 0
                              ? 'success.main'
                              : 'error.main'
                          }
                          sx={{ fontWeight: 700 }}
                        >
                          ${Math.abs(financialSummary.balance).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          {financialSummary.balance < 0 && ' owed'}
                        </Typography>
                      </Paper>
                    </Grid>

                    {/* Per-season breakdown */}
                    {finances.length > 1 && (
                      <Grid item xs={12}>
                        <Typography
                          variant="subtitle2"
                          color="text.secondary"
                          sx={{ mt: 1, mb: 1.5, fontWeight: 600 }}
                        >
                          By Season
                        </Typography>
                        <TableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Season</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                  Total Owed
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                  Total Paid
                                </TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>
                                  Balance
                                </TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {finances.map((fin) => (
                                <TableRow key={fin.id}>
                                  <TableCell>{fin.season}</TableCell>
                                  <TableCell align="right">
                                    $
                                    {fin.totalOwed.toLocaleString('en-US', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                  <TableCell align="right">
                                    $
                                    {fin.totalPaid.toLocaleString('en-US', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                  </TableCell>
                                  <TableCell
                                    align="right"
                                    sx={{
                                      color:
                                        fin.balance >= 0
                                          ? 'success.main'
                                          : 'error.main',
                                      fontWeight: 600,
                                    }}
                                  >
                                    $
                                    {Math.abs(fin.balance).toLocaleString('en-US', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}
                                    {fin.balance < 0 ? ' owed' : ''}
                                  </TableCell>
                                  <TableCell>
                                    <Chip
                                      label={fin.status}
                                      size="small"
                                      color={
                                        fin.status === 'paid'
                                          ? 'success'
                                          : fin.status === 'overdue'
                                          ? 'error'
                                          : 'warning'
                                      }
                                      sx={{ textTransform: 'capitalize' }}
                                    />
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                    )}
                  </Grid>
                )}
              </CardContent>
            </Card>
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
