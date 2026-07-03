import { useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  MenuItem,
  TextField,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playerFinancesApi } from '@/lib/api/finances';
import { playersApi } from '@/lib/api/players';
import { costCalculationApi } from '@/lib/api/costCalculation';
import { sponsorsApi } from '@/lib/api/sponsors';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import PaymentIcon from '@mui/icons-material/Payment';
import VisibilityIcon from '@mui/icons-material/Visibility';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import QrCodeIcon from '@mui/icons-material/QrCode';
import HistoryIcon from '@mui/icons-material/History';
import AddIcon from '@mui/icons-material/Add';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PaymentDialog from '../components/PaymentDialog';
import RecordSponsorPaymentDialog from '../components/RecordSponsorPaymentDialog';
import ApplySponsorFundsDialog from '../components/ApplySponsorFundsDialog';
import InvoiceQRCard from '../components/InvoiceQRCard';
import TeamInvoiceDialog from '../components/TeamInvoiceDialog';
import { PlayerFinance, Payment, Sponsor } from '@/types/models';
import GroupsIcon from '@mui/icons-material/Groups';
import Divider from '@mui/material/Divider';
import SchoolIcon from '@mui/icons-material/School';
import toast from 'react-hot-toast';

const TAB_MAP: Record<string, number> = { players: 0, sponsors: 1 };

const getSponsorStatus = (s: Sponsor): 'active' | 'expired' | 'upcoming' | 'no-dates' => {
  if (!s.sponsorshipStart && !s.sponsorshipEnd) return 'no-dates';
  const now = new Date();
  if (s.sponsorshipStart && now < s.sponsorshipStart) return 'upcoming';
  if (s.sponsorshipEnd && now > s.sponsorshipEnd) return 'expired';
  return 'active';
};

const SPONSOR_STATUS_CHIP: Record<string, { label: string; color: 'success' | 'error' | 'warning' | 'default' }> = {
  active: { label: 'Active', color: 'success' },
  expired: { label: 'Expired', color: 'error' },
  upcoming: { label: 'Upcoming', color: 'warning' },
  'no-dates': { label: 'No Dates', color: 'default' },
};

const BillingPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialTab = TAB_MAP[searchParams.get('tab') || ''] ?? 0;
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync tab changes back to URL
  const handleTabChange = (_: unknown, newValue: number) => {
    setActiveTab(newValue);
    const tabName = Object.entries(TAB_MAP).find(([, v]) => v === newValue)?.[0];
    if (tabName && tabName !== 'players') {
      setSearchParams({ tab: tabName }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };
  const [selectedTeam, setSelectedTeam] = useState<string>(searchParams.get('team') || 'all');
  const [balanceFilter, setBalanceFilter] = useState<string>('all');
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [recordSponsorPaymentOpen, setRecordSponsorPaymentOpen] = useState(false);
  const [applySponsorFundsOpen, setApplySponsorFundsOpen] = useState(false);
  const [selectedFinance, setSelectedFinance] = useState<PlayerFinance | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrFinance, setQrFinance] = useState<PlayerFinance | null>(null);
  const [teamInvoiceDialogOpen, setTeamInvoiceDialogOpen] = useState(false);
  const [historyFinance, setHistoryFinance] = useState<PlayerFinance | null>(null);
  const [selectedSponsorForApply, setSelectedSponsorForApply] = useState<Sponsor | null>(null);
  const [sponsorHistoryOpen, setSponsorHistoryOpen] = useState(false);
  const [sponsorHistory, setSponsorHistory] = useState<Sponsor | null>(null);

  const { data: allFinances = [], isLoading, isError: financesError } = useQuery({
    queryKey: ['playerFinances'],
    queryFn: () => playerFinancesApi.getAll(),
  });

  const { data: sponsors = [], isLoading: sponsorsLoading } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => sponsorsApi.getAll(),
  });

  const { data: teams = [], isError: teamsError } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  // Filter finances
  const finances = useMemo(() => {
    let filtered = allFinances;
    if (selectedTeam !== 'all') {
      filtered = filtered.filter(f => f.teamId === selectedTeam);
    }
    if (balanceFilter === 'owed') {
      filtered = filtered.filter(f => f.balanceDue > 0);
    } else if (balanceFilter === 'paid') {
      filtered = filtered.filter(f => f.balanceDue <= 0);
    }
    return filtered;
  }, [allFinances, selectedTeam, balanceFilter]);

  // Player stats
  const playerStats = useMemo(() => {
    const totalOwed = finances.reduce((sum, f) => sum + f.totalOwed, 0);
    const totalPaid = finances.reduce((sum, f) => sum + f.totalPaid, 0);
    const totalScholarships = finances.reduce((sum, f) => sum + (f.scholarshipAmount || 0), 0);
    const totalOutstanding = finances.reduce((sum, f) => sum + Math.max(0, f.balanceDue), 0);
    const playersWithBalance = finances.filter(f => f.balanceDue > 0).length;
    // Collection rate: what % of the collectible amount (after scholarships) has been paid
    const collectibleAmount = totalOwed - totalScholarships;
    return {
      totalOwed,
      totalPaid,
      totalScholarships,
      totalOutstanding,
      playersWithBalance,
      collectionRate: collectibleAmount > 0 ? (totalPaid / collectibleAmount) * 100 : totalPaid > 0 ? 100 : 0,
    };
  }, [finances]);

  // Sponsor stats
  const sponsorStats = useMemo(() => {
    const totalContributed = sponsors.reduce((sum, s) => sum + (s.totalContributed || 0), 0);
    const totalApplied = sponsors.reduce((sum, s) => sum + (s.totalSponsored || 0), 0);
    const availableBalance = totalContributed - totalApplied;
    return { totalContributed, totalApplied, availableBalance, count: sponsors.length };
  }, [sponsors]);

  const handleRecordPayment = (finance: PlayerFinance) => {
    setSelectedFinance(finance);
    setPaymentDialogOpen(true);
  };

  const handleClosePaymentDialog = () => {
    setPaymentDialogOpen(false);
    setSelectedFinance(null);
  };

  const handleApplyFunds = (sponsor: Sponsor) => {
    setSelectedSponsorForApply(sponsor);
    setApplySponsorFundsOpen(true);
  };

  // Mark player as quit: zero out fees, remove from team, redistribute
  const quitMutation = useMutation({
    mutationFn: async (finance: PlayerFinance) => {
      // 1. Mark player as quit
      await playersApi.markAsQuit(finance.playerId);

      // 2. Zero out the quit player's fees
      await playerFinancesApi.update(finance.id, {
        registrationFee: 0,
        uniformCost: 0,
        tournamentFees: 0,
        facilityFees: 0,
        equipmentFees: 0,
        otherFees: 0,
      });

      // 3. Redistribute team costs to remaining active players
      if (finance.teamId && finance.season) {
        await costCalculationApi.redistributeAfterQuit(finance.teamId, finance.season);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Player marked as quit. Fees zeroed and team costs redistributed.');
      setHistoryFinance(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to process player quit');
    },
  });

  // Player columns
  const playerColumns: GridColDef[] = [
    {
      field: 'playerName',
      headerName: 'Player Name',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Typography
          variant="body2"
          sx={{ cursor: 'pointer', color: 'primary.main', fontWeight: 500, '&:hover': { textDecoration: 'underline' } }}
          onClick={() => setHistoryFinance(params.row)}
        >
          {params.value}
        </Typography>
      ),
    },
    {
      field: 'teamName',
      headerName: 'Team',
      width: 150,
      renderCell: (params) => (
        <Chip label={params.value} size="small" color="primary" variant="outlined" />
      ),
    },
    {
      field: 'season',
      headerName: 'Season',
      width: 110,
    },
    {
      field: 'totalOwed',
      headerName: 'Total Invoiced',
      width: 130,
      valueFormatter: (params) => `$${params.value.toFixed(2)}`,
    },
    {
      field: 'totalPaid',
      headerName: 'Total Paid',
      width: 120,
      valueFormatter: (params) => `$${params.value.toFixed(2)}`,
    },
    {
      field: 'scholarshipAmount',
      headerName: 'Scholarship',
      width: 120,
      renderCell: (params) => {
        const amt = params.value as number || 0;
        return amt > 0 ? (
          <Chip
            icon={<SchoolIcon />}
            label={`$${amt.toFixed(2)}`}
            size="small"
            color="info"
            variant="outlined"
          />
        ) : (
          <Typography variant="body2" color="text.secondary">--</Typography>
        );
      },
    },
    {
      field: 'balanceDue',
      headerName: 'Balance Due',
      width: 120,
      renderCell: (params) => {
        const bal = params.value as number;
        return (
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: bal > 0 ? 'error.main' : 'success.main',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            ${Math.abs(bal).toFixed(2)}
          </Box>
        );
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 100,
      renderCell: (params) => {
        const status = params.value as string || 'current';
        return (
          <Chip
            label={status}
            size="small"
            color={status === 'paid' ? 'success' : status === 'overdue' ? 'error' : 'warning'}
            sx={{ textTransform: 'capitalize', fontWeight: 600 }}
          />
        );
      },
    },
    {
      field: 'payments',
      headerName: 'Payments',
      width: 100,
      valueGetter: (params) => (params.row.payments || []).length,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'primary' : 'default'}
          onClick={() => setHistoryFinance(params.row)}
          sx={{ cursor: 'pointer' }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Payment History">
            <IconButton size="small" color="secondary" onClick={() => setHistoryFinance(params.row)}>
              <HistoryIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <>
              <Tooltip title="Record Payment">
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleRecordPayment(params.row)}
                >
                  <PaymentIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="QR Invoice">
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => {
                    setQrFinance(params.row);
                    setQrDialogOpen(true);
                  }}
                >
                  <QrCodeIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      ),
    },
  ];

  // Sponsor columns
  const sponsorColumns: GridColDef[] = [
    {
      field: 'businessName',
      headerName: 'Sponsor',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'level',
      headerName: 'Level',
      width: 100,
      renderCell: (params) => (
        <Chip
          label={(params.value || '').charAt(0).toUpperCase() + (params.value || '').slice(1)}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'sponsorStatus',
      headerName: 'Status',
      width: 100,
      valueGetter: (params) => getSponsorStatus(params.row),
      renderCell: (params) => {
        const cfg = SPONSOR_STATUS_CHIP[params.value] || SPONSOR_STATUS_CHIP['no-dates'];
        return <Chip label={cfg.label} color={cfg.color} size="small" variant="outlined" />;
      },
    },
    {
      field: 'totalContributed',
      headerName: 'Contributed',
      width: 130,
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'totalSponsored',
      headerName: 'Applied to Players',
      width: 150,
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'availableBalance',
      headerName: 'Available',
      width: 120,
      valueGetter: (params) => (params.row.totalContributed || 0) - (params.row.totalSponsored || 0),
      renderCell: (params) => {
        const avail = params.value as number;
        return (
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: avail > 0 ? 'success.main' : avail < 0 ? 'error.main' : 'grey.400',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            ${avail.toFixed(2)}
          </Box>
        );
      },
    },
    {
      field: 'sponsoredPlayers',
      headerName: 'Players Covered',
      width: 160,
      valueGetter: (params) => (params.row.sponsoredPlayers || []).length,
      renderCell: (params) => {
        const count = params.value as number;
        return count > 0 ? (
          <Chip
            label={`${count} player${count !== 1 ? 's' : ''}`}
            size="small"
            color="primary"
            variant="outlined"
            onClick={() => {
              setSponsorHistory(params.row);
              setSponsorHistoryOpen(true);
            }}
            sx={{ cursor: 'pointer' }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">None yet</Typography>
        );
      },
    },
    {
      field: 'contributions',
      headerName: 'Payments',
      width: 100,
      valueGetter: (params) => (params.row.contributions || []).length,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value > 0 ? 'primary' : 'default'}
          onClick={() => {
            setSponsorHistory(params.row);
            setSponsorHistoryOpen(true);
          }}
          sx={{ cursor: 'pointer' }}
        />
      ),
    },
    ...(isAdmin ? [{
      field: 'actions' as const,
      headerName: 'Actions',
      width: 180,
      sortable: false,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              color="secondary"
              onClick={() => {
                setSponsorHistory(params.row);
                setSponsorHistoryOpen(true);
              }}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Apply Funds to Players">
            <IconButton
              size="small"
              color="success"
              onClick={() => handleApplyFunds(params.row)}
            >
              <AssignmentIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    }] : []),
  ];

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Billing & Payments</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view billing information.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>Billing & Payments</Typography>

      {(financesError || teamsError) && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to load billing data. Please refresh the page.</Alert>
      )}

      <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 3 }}>
        <Tab icon={<PeopleIcon />} iconPosition="start" label="Players" />
        <Tab icon={<BusinessIcon />} iconPosition="start" label="Sponsors" />
      </Tabs>

      {/* ============ PLAYERS TAB ============ */}
      {activeTab === 0 && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={playerStats.totalScholarships > 0 ? 2.4 : 3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AttachMoneyIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">Total Invoiced</Typography>
                  </Box>
                  <Typography variant="h5">${playerStats.totalOwed.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={playerStats.totalScholarships > 0 ? 2.4 : 3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PaymentIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">Total Collected</Typography>
                  </Box>
                  <Typography variant="h5">${playerStats.totalPaid.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            {playerStats.totalScholarships > 0 && (
              <Grid item xs={12} sm={6} md={2.4}>
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <SchoolIcon color="info" sx={{ mr: 1 }} />
                      <Typography variant="body2" color="text.secondary">Scholarships</Typography>
                    </Box>
                    <Typography variant="h5" color="info.main">${playerStats.totalScholarships.toFixed(2)}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            )}
            <Grid item xs={12} sm={6} md={playerStats.totalScholarships > 0 ? 2.4 : 3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingUpIcon color="error" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">Outstanding</Typography>
                  </Box>
                  <Typography variant="h5" color="error">${playerStats.totalOutstanding.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={playerStats.totalScholarships > 0 ? 2.4 : 3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PeopleIcon color="warning" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">Players w/ Balance</Typography>
                  </Box>
                  <Typography variant="h5">{playerStats.playersWithBalance}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Collection Rate: {playerStats.collectionRate.toFixed(1)}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Filters */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Filter by Team"
                  select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="all">All Teams</MenuItem>
                  {teams.map((team) => (
                    <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={4}>
                <TextField
                  label="Filter by Balance"
                  select
                  value={balanceFilter}
                  onChange={(e) => setBalanceFilter(e.target.value)}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="all">All</MenuItem>
                  <MenuItem value="owed">Owed (Balance Due)</MenuItem>
                  <MenuItem value="paid">Paid in Full</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={12} md={4}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<GroupsIcon />}
                    onClick={() => setTeamInvoiceDialogOpen(true)}
                  >
                    Invoice Team
                  </Button>
                  <Button variant="outlined" size="small" onClick={() => {
                    const csvRows = ['Player Name,Team,Season,Total Invoiced,Total Paid,Scholarship,Balance Due,Status'];
                    finances.forEach(f => {
                      csvRows.push(`"${f.playerName}","${f.teamName}","${f.season}",${f.totalOwed.toFixed(2)},${f.totalPaid.toFixed(2)},${(f.scholarshipAmount || 0).toFixed(2)},${f.balanceDue.toFixed(2)},${f.status || 'current'}`);
                    });
                    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `billing-export-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>
                    Export CSV
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Player Data Grid */}
          <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
            <DataGrid
              rows={finances}
              columns={playerColumns}
              loading={isLoading}
              pageSizeOptions={[10, 25, 50, 100]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                sorting: { sortModel: [{ field: 'balanceDue', sort: 'desc' }] },
              }}
              disableRowSelectionOnClick
            />
          </Paper>
        </>
      )}

      {/* ============ SPONSORS TAB ============ */}
      {activeTab === 1 && (
        <>
          {/* Sponsor Summary Cards */}
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <BusinessIcon color="primary" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">Total Sponsors</Typography>
                  </Box>
                  <Typography variant="h5">{sponsorStats.count}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AttachMoneyIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">Total Contributed</Typography>
                  </Box>
                  <Typography variant="h5" color="success.main">${sponsorStats.totalContributed.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <AssignmentIcon color="info" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">Applied to Players</Typography>
                  </Box>
                  <Typography variant="h5">${sponsorStats.totalApplied.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingUpIcon color={sponsorStats.availableBalance > 0 ? 'success' : 'warning'} sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">Available Balance</Typography>
                  </Box>
                  <Typography variant="h5" color={sponsorStats.availableBalance > 0 ? 'success.main' : 'text.primary'}>
                    ${sponsorStats.availableBalance.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Sponsor Actions */}
          <Paper sx={{ p: 2, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => setRecordSponsorPaymentOpen(true)}
                >
                  Record Sponsor Payment
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  color="secondary"
                  startIcon={<AssignmentIcon />}
                  onClick={() => {
                    setSelectedSponsorForApply(null);
                    setApplySponsorFundsOpen(true);
                  }}
                >
                  Apply Funds to Players
                </Button>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<OpenInNewIcon />}
                onClick={() => navigate('/sponsors/manage')}
              >
                Manage Sponsors
              </Button>
            </Box>
          </Paper>

          {/* Sponsor Data Grid */}
          <Paper sx={{ height: { xs: 350, md: 500 }, width: '100%' }}>
            <DataGrid
              rows={sponsors}
              columns={sponsorColumns}
              loading={sponsorsLoading}
              pageSizeOptions={[10, 25]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              disableRowSelectionOnClick
            />
          </Paper>
        </>
      )}

      {/* Payment Dialog */}
      {selectedFinance && (
        <PaymentDialog
          open={paymentDialogOpen}
          onClose={handleClosePaymentDialog}
          financeId={selectedFinance.id}
          playerName={selectedFinance.playerName}
          currentBalance={selectedFinance.balanceDue}
        />
      )}

      {/* Record Sponsor Payment Dialog */}
      <RecordSponsorPaymentDialog
        open={recordSponsorPaymentOpen}
        onClose={() => setRecordSponsorPaymentOpen(false)}
      />

      {/* Apply Sponsor Funds Dialog */}
      <ApplySponsorFundsDialog
        open={applySponsorFundsOpen}
        onClose={() => {
          setApplySponsorFundsOpen(false);
          setSelectedSponsorForApply(null);
        }}
        finances={allFinances}
        preselectedSponsor={selectedSponsorForApply}
      />

      {/* QR Invoice Dialog */}
      {qrFinance && (
        <InvoiceQRCard
          open={qrDialogOpen}
          onClose={() => {
            setQrDialogOpen(false);
            setQrFinance(null);
          }}
          finance={qrFinance}
        />
      )}

      {/* Team Invoice Dialog */}
      <TeamInvoiceDialog
        open={teamInvoiceDialogOpen}
        onClose={() => setTeamInvoiceDialogOpen(false)}
      />

      {/* Payment History Dialog */}
      <PaymentHistoryDialog
        open={!!historyFinance}
        onClose={() => setHistoryFinance(null)}
        finance={historyFinance}
        isAdmin={isAdmin}
        onPlayerQuit={(finance) => quitMutation.mutate(finance)}
        quitLoading={quitMutation.isPending}
      />

      {/* Sponsor History Dialog */}
      <SponsorHistoryDialog
        open={sponsorHistoryOpen}
        onClose={() => {
          setSponsorHistoryOpen(false);
          setSponsorHistory(null);
        }}
        sponsor={sponsorHistory}
      />
    </Box>
  );
};

// --- Payment History Dialog ---

const PAYMENT_METHOD_LABELS: Record<string, string> = {
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

function formatPaymentDate(date: unknown): string {
  try {
    if (date && typeof date === 'object' && 'toDate' in (date as Record<string, unknown>)) {
      const d = (date as { toDate: () => Date }).toDate();
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    }
    const d = new Date(date as string | number | Date);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '--';
  }
}

interface PaymentHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  finance: PlayerFinance | null;
  isAdmin?: boolean;
  onPlayerQuit?: (finance: PlayerFinance) => void;
  quitLoading?: boolean;
}

const PaymentHistoryDialog = ({ open, onClose, finance, isAdmin, onPlayerQuit, quitLoading }: PaymentHistoryDialogProps) => {
  // Hooks must be called unconditionally (before the null-finance early return
  // below) to keep hook order stable across renders. finance is guaranteed
  // non-null wherever the mutation actually fires, since we return null otherwise.
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => playerFinancesApi.removePayment(finance!.id, paymentId),
    onSuccess: () => {
      toast.success('Payment deleted');
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      queryClient.invalidateQueries({ queryKey: ['income'] });
      queryClient.invalidateQueries({ queryKey: ['generalLedger'] });
      queryClient.invalidateQueries({ queryKey: ['financialReport'] });
      setDeletingPaymentId(null);
      onClose();
    },
    onError: (err: any) => {
      toast.error(`Failed to delete: ${err.message}`);
      setDeletingPaymentId(null);
    },
  });

  if (!finance) return null;
  const payments: Payment[] = finance.payments || [];

  const sortedPayments = [...payments].sort((a, b) => {
    try {
      const dateA = new Date(a.date as unknown as string | number | Date).getTime();
      const dateB = new Date(b.date as unknown as string | number | Date).getTime();
      return dateB - dateA;
    } catch {
      return 0;
    }
  });

  const hasFees = finance.registrationFee > 0 || finance.uniformCost > 0 ||
    finance.tournamentFees > 0 || finance.facilityFees > 0 ||
    finance.equipmentFees > 0 || finance.otherFees > 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Payment History &mdash; {finance.playerName}
        <Typography variant="body2" color="text.secondary">
          {finance.teamName} &middot; {finance.season}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {hasFees && (
          <>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
              Fee Breakdown
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableBody>
                  {finance.registrationFee > 0 && (
                    <TableRow><TableCell>Registration Fee</TableCell><TableCell align="right">${finance.registrationFee.toFixed(2)}</TableCell></TableRow>
                  )}
                  {finance.uniformCost > 0 && (
                    <TableRow><TableCell>Uniform Cost</TableCell><TableCell align="right">${finance.uniformCost.toFixed(2)}</TableCell></TableRow>
                  )}
                  {finance.tournamentFees > 0 && (
                    <TableRow><TableCell>Tournament Fees</TableCell><TableCell align="right">${finance.tournamentFees.toFixed(2)}</TableCell></TableRow>
                  )}
                  {finance.facilityFees > 0 && (
                    <TableRow><TableCell>Facility Fees</TableCell><TableCell align="right">${finance.facilityFees.toFixed(2)}</TableCell></TableRow>
                  )}
                  {finance.equipmentFees > 0 && (
                    <TableRow><TableCell>Equipment Fees</TableCell><TableCell align="right">${finance.equipmentFees.toFixed(2)}</TableCell></TableRow>
                  )}
                  {finance.otherFees > 0 && (
                    <TableRow><TableCell>Other Fees</TableCell><TableCell align="right">${finance.otherFees.toFixed(2)}</TableCell></TableRow>
                  )}
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Total Charges</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>${finance.totalOwed.toFixed(2)}</TableCell>
                  </TableRow>
                  {finance.scholarshipAmount > 0 && (
                    <TableRow>
                      <TableCell sx={{ color: 'info.main' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <SchoolIcon fontSize="small" />
                          Scholarship / Financial Aid
                        </Box>
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'info.main', fontWeight: 600 }}>
                        -${finance.scholarshipAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell sx={{ color: 'success.main', fontWeight: 600 }}>Total Paid</TableCell>
                    <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>
                      ${finance.totalPaid.toFixed(2)}
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: finance.balanceDue <= 0 ? 'success.50' : 'error.50' }}>
                    <TableCell sx={{ fontWeight: 700 }}>Balance Due</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: finance.balanceDue > 0 ? 'error.main' : 'success.main' }}>
                      ${finance.balanceDue.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
            <Divider sx={{ mb: 2 }} />
          </>
        )}

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
          Payments ({payments.length})
        </Typography>
        {payments.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
            No payments recorded yet.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 90 }}>Date</TableCell>
                  <TableCell sx={{ width: 80 }}>Amount</TableCell>
                  <TableCell sx={{ width: 90 }}>Method</TableCell>
                  <TableCell sx={{ width: 100 }}>Payer</TableCell>
                  <TableCell sx={{ width: 90 }}>Reference</TableCell>
                  <TableCell>Notes</TableCell>
                  {isAdmin && <TableCell sx={{ width: 60 }} align="center">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedPayments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatPaymentDate(p.date)}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'success.main', whiteSpace: 'nowrap' }}>
                      ${p.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Chip label={PAYMENT_METHOD_LABELS[p.method] || p.method} size="small" />
                    </TableCell>
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.sponsorName ? (
                        <Chip label={`Sponsor: ${p.sponsorName}`} size="small" color="info" variant="outlined" />
                      ) : (
                        p.payerName || '--'
                      )}
                    </TableCell>
                    <TableCell sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.reference || '--'}</TableCell>
                    <TableCell sx={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>{p.notes || '--'}</TableCell>
                    {isAdmin && (
                      <TableCell align="center">
                        {deletingPaymentId === p.id ? (
                          <CircularProgress size={20} />
                        ) : (
                          <Tooltip title="Delete payment">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                if (window.confirm(`Delete $${p.amount.toFixed(2)} payment?`)) {
                                  setDeletingPaymentId(p.id);
                                  deletePaymentMutation.mutate(p.id);
                                }
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', bgcolor: 'grey.50', p: 2, borderRadius: 1 }}>
          <Typography variant="subtitle2">Total Payments: {payments.length}</Typography>
          <Typography variant="subtitle2" color="success.main">
            Total Paid: ${payments.reduce((s, p) => s + p.amount, 0).toFixed(2)}
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Box>
          {isAdmin && onPlayerQuit && !confirmQuit && (
            <Button
              color="error"
              variant="outlined"
              size="small"
              startIcon={<ExitToAppIcon />}
              onClick={() => setConfirmQuit(true)}
            >
              Mark Player as Quit
            </Button>
          )}
          {isAdmin && confirmQuit && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="error">
                This will zero out fees and redistribute to remaining players. Are you sure?
              </Typography>
              <Button
                color="error"
                variant="contained"
                size="small"
                disabled={quitLoading}
                startIcon={quitLoading ? <CircularProgress size={16} /> : <ExitToAppIcon />}
                onClick={() => {
                  onPlayerQuit?.(finance);
                  setConfirmQuit(false);
                }}
              >
                {quitLoading ? 'Processing...' : 'Confirm Quit'}
              </Button>
              <Button size="small" onClick={() => setConfirmQuit(false)}>Cancel</Button>
            </Box>
          )}
        </Box>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

// --- Sponsor History Dialog ---

interface SponsorHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  sponsor: Sponsor | null;
}

const SponsorHistoryDialog = ({ open, onClose, sponsor }: SponsorHistoryDialogProps) => {
  if (!sponsor) return null;

  const contributions = sponsor.contributions || [];
  const sponsoredPlayers = sponsor.sponsoredPlayers || [];
  const totalContributed = sponsor.totalContributed || 0;
  const totalApplied = sponsor.totalSponsored || 0;
  const availableBalance = totalContributed - totalApplied;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {sponsor.businessName}
        <Typography variant="body2" color="text.secondary">
          {sponsor.level.charAt(0).toUpperCase() + sponsor.level.slice(1)} Sponsor &middot; {sponsor.season}
        </Typography>
      </DialogTitle>
      <DialogContent>
        {/* Summary */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <Chip label={`Contributed: $${totalContributed.toFixed(2)}`} color="primary" />
          <Chip label={`Applied: $${totalApplied.toFixed(2)}`} />
          <Chip
            label={`Available: $${availableBalance.toFixed(2)}`}
            color={availableBalance > 0 ? 'success' : 'default'}
          />
        </Box>

        {/* Contributions */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Payments Received ({contributions.length})
        </Typography>
        {contributions.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No payments recorded yet. Use "Record Sponsor Payment" to add one.
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Reference</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contributions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{formatPaymentDate(c.date)}</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: 'success.main' }}>${c.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Chip label={PAYMENT_METHOD_LABELS[c.method] || c.method} size="small" />
                    </TableCell>
                    <TableCell>{c.reference || '--'}</TableCell>
                    <TableCell>{c.notes || '--'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Allocations */}
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Funds Applied to Players ({sponsoredPlayers.length})
        </Typography>
        {sponsoredPlayers.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            No funds applied to players yet. Use "Apply Funds to Players" to allocate.
          </Typography>
        ) : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Player</TableCell>
                  <TableCell>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sponsoredPlayers.map((sp, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatPaymentDate(sp.date)}</TableCell>
                    <TableCell>{sp.playerName}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>${sp.amount.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default BillingPage;
