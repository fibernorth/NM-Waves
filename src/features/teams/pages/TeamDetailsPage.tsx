import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Grid,
  Card,
  CardContent,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  TextField,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import GroupIcon from '@mui/icons-material/Group';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BadgeIcon from '@mui/icons-material/Badge';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PaymentIcon from '@mui/icons-material/Payment';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { teamsApi } from '@/lib/api/teams';
import { playersApi } from '@/lib/api/players';
import { playerFinancesApi } from '@/lib/api/finances';
import { costCalculationApi } from '@/lib/api/costCalculation';
import { teamStatsApi, type PlayerStats } from '@/lib/api/teamStats';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import GCStatsPanel from '@/features/gamechanger/components/GCStatsPanel';
import GCGamesPanel from '@/features/gamechanger/components/GCGamesPanel';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import TeamFormDialog from '../components/TeamFormDialog';
import type { Player } from '@/types/models';

const TeamDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addPlayerDialogOpen, setAddPlayerDialogOpen] = useState(false);
  const [selectedPlayerToAdd, setSelectedPlayerToAdd] = useState<Player | null>(null);
  const [confirmRemovePlayer, setConfirmRemovePlayer] = useState<Player | null>(null);
  const [confirmQuitPlayer, setConfirmQuitPlayer] = useState<Player | null>(null);

  // ---- Queries ----

  const {
    data: team,
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery({
    queryKey: ['team', id],
    queryFn: () => teamsApi.getById(id!),
    enabled: !!id,
  });

  const {
    data: players = [],
    isLoading: playersLoading,
  } = useQuery({
    queryKey: ['players', 'team', id],
    queryFn: () => playersApi.getByTeam(id!, team?.name),
    enabled: !!id && !!team,
  });

  // Fetch finances for balance column (admin only)
  const { data: teamFinances = [] } = useQuery({
    queryKey: ['playerFinances', 'team', id],
    queryFn: () => playerFinancesApi.getAll(),
    enabled: isAdmin && !!id,
  });

  // Map playerId -> balanceDue (positive = owes money, accounts for scholarships)
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const fin of teamFinances) {
      const existing = map.get(fin.playerId) || 0;
      map.set(fin.playerId, existing + (fin.balanceDue ?? (fin.totalOwed - fin.totalPaid)));
    }
    return map;
  }, [teamFinances]);

  // Compute team-level financial stats (admin only)
  const teamStats = useMemo(() => {
    // Filter finances to this team's players
    const playerIds = new Set(players.map(p => p.id));
    const teamFin = teamFinances.filter(f => playerIds.has(f.playerId));
    const totalOwed = teamFin.reduce((s, f) => s + f.totalOwed, 0);
    const totalPaid = teamFin.reduce((s, f) => s + f.totalPaid, 0);
    const totalScholarships = teamFin.reduce((s, f) => s + (f.scholarshipAmount || 0), 0);
    const outstanding = totalOwed - totalPaid - totalScholarships;
    const playersOwing = new Set(teamFin.filter(f => (f.balanceDue ?? (f.totalOwed - f.totalPaid)) > 0).map(f => f.playerId)).size;
    const collectionRate = totalOwed > 0 ? ((totalPaid + totalScholarships) / totalOwed) * 100 : 0;
    return { totalOwed, totalPaid, outstanding, playersOwing, collectionRate, totalScholarships };
  }, [teamFinances, players]);

  // Build a status map for payment status column
  const statusMap = useMemo(() => {
    const map = new Map<string, 'paid' | 'current' | 'overdue' | 'none'>();
    for (const fin of teamFinances) {
      const existing = map.get(fin.playerId);
      // Worst status wins: overdue > current > paid
      const status = fin.status || (fin.balance >= 0 ? 'paid' : 'current');
      if (!existing || existing === 'none' || existing === 'paid') {
        map.set(fin.playerId, status as 'paid' | 'current' | 'overdue');
      } else if (existing === 'current' && status === 'overdue') {
        map.set(fin.playerId, 'overdue');
      }
    }
    return map;
  }, [teamFinances]);

  // Fetch team stats (GC CSV imports) to show batting stats on roster
  const { data: allTeamStats = [] } = useQuery({
    queryKey: ['teamStats'],
    queryFn: () => teamStatsApi.getAll(),
    staleTime: 5 * 60_000,
  });

  // Match stats players to roster by name (case-insensitive)
  const playerStatsMap = useMemo(() => {
    const map = new Map<string, PlayerStats>();
    if (!team || players.length === 0) return map;

    // Find stat docs matching this team name (fuzzy: check if team name contains age group like "12U", "13U")
    const teamNameLower = team.name.toLowerCase();
    const matchingStats = allTeamStats.filter(s => {
      const sName = s.teamName.toLowerCase();
      // Match if stat teamName contains team name or vice versa, or age group matches
      return sName.includes(teamNameLower) || teamNameLower.includes(sName)
        || (team.ageGroup && sName.includes(team.ageGroup.toLowerCase()));
    });

    // Use the most recent matching stat doc
    if (matchingStats.length > 0) {
      const statDoc = matchingStats[0]; // already sorted by importedAt desc
      for (const sp of statDoc.players) {
        const key = `${sp.firstName.toLowerCase()} ${sp.lastName.toLowerCase()}`;
        map.set(key, sp);
      }
    }
    return map;
  }, [allTeamStats, team, players]);

  const { data: allPlayers = [] } = useQuery({
    queryKey: ['players', 'all'],
    queryFn: () => playersApi.getAll(),
    enabled: addPlayerDialogOpen,
  });

  // Players available to add (active, not already on a team)
  const availablePlayers = allPlayers.filter(
    (p) => p.active && !p.teamId
  );

  // ---- Mutations ----

  const assignPlayerMutation = useMutation({
    mutationFn: ({ playerId, teamId, teamName }: { playerId: string; teamId: string; teamName: string }) =>
      playersApi.assignToTeam(playerId, teamId, teamName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', 'team', id] });
      queryClient.invalidateQueries({ queryKey: ['players', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['team', id] });
      toast.success('Player added to team');
      setAddPlayerDialogOpen(false);
      setSelectedPlayerToAdd(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to add player to team');
    },
  });

  const removePlayerMutation = useMutation({
    mutationFn: (playerId: string) => playersApi.removeFromTeam(playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', 'team', id] });
      queryClient.invalidateQueries({ queryKey: ['players', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['team', id] });
      toast.success('Player removed from team');
      setConfirmRemovePlayer(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to remove player from team');
    },
  });

  const quitPlayerMutation = useMutation({
    mutationFn: async (player: Player) => {
      // 1. Mark player as quit (sets active=false, clears team)
      await playersApi.markAsQuit(player.id);

      // 2. Zero out the player's fees
      const finances = teamFinances.filter(f => f.playerId === player.id);
      for (const fin of finances) {
        await playerFinancesApi.update(fin.id, {
          registrationFee: 0,
          uniformCost: 0,
          tournamentFees: 0,
          facilityFees: 0,
          equipmentFees: 0,
          otherFees: 0,
        });
      }

      // 3. Redistribute team costs to remaining active players
      if (team) {
        await costCalculationApi.redistributeAfterQuit(team.id, team.season);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players', 'team', id] });
      queryClient.invalidateQueries({ queryKey: ['players', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['team', id] });
      queryClient.invalidateQueries({ queryKey: ['playerFinances'] });
      toast.success('Player marked as quit. Fees zeroed and team costs redistributed.');
      setConfirmQuitPlayer(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to process player quit');
    },
  });

  // ---- Handlers ----

  const handleAddPlayer = () => {
    if (!selectedPlayerToAdd || !team) return;
    assignPlayerMutation.mutate({
      playerId: selectedPlayerToAdd.id,
      teamId: team.id,
      teamName: team.name,
    });
  };

  const handleRemovePlayer = () => {
    if (!confirmRemovePlayer) return;
    removePlayerMutation.mutate(confirmRemovePlayer.id);
  };

  // ---- DataGrid Columns ----

  const columns: GridColDef[] = [
    {
      field: 'jerseyNumber',
      headerName: 'Jersey #',
      width: 90,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) =>
        params.value != null ? (
          <Chip label={`#${params.value}`} size="small" color="primary" variant="outlined" />
        ) : (
          <Typography variant="body2" color="text.disabled">--</Typography>
        ),
    },
    {
      field: 'firstName',
      headerName: 'First Name',
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'lastName',
      headerName: 'Last Name',
      flex: 1,
      minWidth: 120,
    },
    {
      field: 'positions',
      headerName: 'Positions',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => {
        const positions: string[] = params.value || [];
        if (positions.length === 0) {
          return <Typography variant="body2" color="text.disabled">--</Typography>;
        }
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {positions.map((pos) => (
              <Chip key={pos} label={pos} size="small" variant="outlined" />
            ))}
          </Box>
        );
      },
    },
    {
      field: 'bats',
      headerName: 'Bats',
      width: 70,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => params.value || '--',
    },
    {
      field: 'throws',
      headerName: 'Throws',
      width: 80,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => params.value || '--',
    },
    // --- Batting stats columns (from GC CSV import) ---
    ...(playerStatsMap.size > 0 ? [
      {
        field: 'statAvg',
        headerName: 'AVG',
        width: 70,
        align: 'center' as const,
        headerAlign: 'center' as const,
        valueGetter: (params: any) => {
          const key = `${(params.row.firstName || '').toLowerCase()} ${(params.row.lastName || '').toLowerCase()}`;
          return playerStatsMap.get(key)?.batting.avg || '--';
        },
      },
      {
        field: 'statH',
        headerName: 'H',
        width: 50,
        align: 'center' as const,
        headerAlign: 'center' as const,
        valueGetter: (params: any) => {
          const key = `${(params.row.firstName || '').toLowerCase()} ${(params.row.lastName || '').toLowerCase()}`;
          const s = playerStatsMap.get(key);
          return s ? s.batting.h : '--';
        },
      },
      {
        field: 'statRBI',
        headerName: 'RBI',
        width: 55,
        align: 'center' as const,
        headerAlign: 'center' as const,
        valueGetter: (params: any) => {
          const key = `${(params.row.firstName || '').toLowerCase()} ${(params.row.lastName || '').toLowerCase()}`;
          const s = playerStatsMap.get(key);
          return s ? s.batting.rbi : '--';
        },
      },
      {
        field: 'statR',
        headerName: 'R',
        width: 50,
        align: 'center' as const,
        headerAlign: 'center' as const,
        valueGetter: (params: any) => {
          const key = `${(params.row.firstName || '').toLowerCase()} ${(params.row.lastName || '').toLowerCase()}`;
          const s = playerStatsMap.get(key);
          return s ? s.batting.r : '--';
        },
      },
      {
        field: 'statSB',
        headerName: 'SB',
        width: 50,
        align: 'center' as const,
        headerAlign: 'center' as const,
        valueGetter: (params: any) => {
          const key = `${(params.row.firstName || '').toLowerCase()} ${(params.row.lastName || '').toLowerCase()}`;
          const s = playerStatsMap.get(key);
          return s ? s.batting.sb : '--';
        },
      },
      {
        field: 'statSO',
        headerName: 'SO',
        width: 50,
        align: 'center' as const,
        headerAlign: 'center' as const,
        valueGetter: (params: any) => {
          const key = `${(params.row.firstName || '').toLowerCase()} ${(params.row.lastName || '').toLowerCase()}`;
          const s = playerStatsMap.get(key);
          return s ? s.batting.so : '--';
        },
      },
      {
        field: 'statOBP',
        headerName: 'OBP',
        width: 70,
        align: 'center' as const,
        headerAlign: 'center' as const,
        valueGetter: (params: any) => {
          const key = `${(params.row.firstName || '').toLowerCase()} ${(params.row.lastName || '').toLowerCase()}`;
          return playerStatsMap.get(key)?.batting.obp || '--';
        },
      },
      {
        field: 'statSLG',
        headerName: 'SLG',
        width: 70,
        align: 'center' as const,
        headerAlign: 'center' as const,
        valueGetter: (params: any) => {
          const key = `${(params.row.firstName || '').toLowerCase()} ${(params.row.lastName || '').toLowerCase()}`;
          return playerStatsMap.get(key)?.batting.slg || '--';
        },
      },
    ] : []),
    {
      field: 'dateOfBirth',
      headerName: 'DOB',
      width: 110,
      renderCell: (params) => {
        if (!params.value) return '--';
        try {
          return format(new Date(params.value), 'MM/dd/yyyy');
        } catch {
          return '--';
        }
      },
    },
    {
      field: 'parentName',
      headerName: 'Primary Contact',
      flex: 1,
      minWidth: 130,
      renderCell: (params) => {
        const player = params.row as Player;
        const primary = player.contacts?.find(c => c.isPrimaryContact) || player.contacts?.[0];
        return primary?.name || player.parentName || '--';
      },
    },
    {
      field: 'parentEmail',
      headerName: 'Contact Email',
      flex: 1,
      minWidth: 180,
      renderCell: (params) => {
        const player = params.row as Player;
        const primary = player.contacts?.find(c => c.isPrimaryContact) || player.contacts?.[0];
        return primary?.email || player.parentEmail || '--';
      },
    },
    {
      field: 'parentPhone',
      headerName: 'Contact Phone',
      width: 130,
      renderCell: (params) => {
        const player = params.row as Player;
        const primary = player.contacts?.find(c => c.isPrimaryContact) || player.contacts?.[0];
        return primary?.phone || player.parentPhone || '--';
      },
    },
    ...(isAdmin ? [
      {
        field: 'paymentStatus',
        headerName: 'Status',
        width: 100,
        valueGetter: (params: any) => statusMap.get(params.row.id) || 'none',
        renderCell: (params: any) => {
          const status = params.value as string;
          if (status === 'none') return <Typography variant="body2" color="text.disabled">--</Typography>;
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
        field: 'balance',
        headerName: 'Balance',
        width: 110,
        valueGetter: (params: any) => balanceMap.get(params.row.id) ?? 0,
        renderCell: (params: any) => {
          const balance = params.value as number;
          if (balance === 0 && !balanceMap.has(params.row.id)) {
            return <Typography variant="body2" color="text.secondary">--</Typography>;
          }
          const isOwed = balance > 0;
          return (
            <Box
              onClick={() => navigate(`/players/${params.row.id}`)}
              sx={{
                px: 1,
                py: 0.5,
                borderRadius: 1,
                bgcolor: isOwed ? 'error.main' : 'success.main',
                color: 'white',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                '&:hover': { opacity: 0.85 },
              }}
            >
              {isOwed ? `$${balance.toFixed(2)} owed` : 'Paid'}
            </Box>
          );
        },
      },
    ] : []),
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View Player">
            <IconButton
              size="small"
              color="primary"
              onClick={() => navigate(`/players/${params.row.id}`)}
            >
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <>
              <Tooltip title="Mark as Quit (zeroes fees, redistributes)">
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => setConfirmQuitPlayer(params.row as Player)}
                >
                  <ExitToAppIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Remove from Team">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => setConfirmRemovePlayer(params.row as Player)}
                >
                  <PersonRemoveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      ),
    },
  ];

  // ---- Loading / Error States ----

  if (teamLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 8 }}>
        <CircularProgress size={48} />
      </Box>
    );
  }

  if (teamError) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="error" gutterBottom>
          Failed to load team data
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          Please check your connection and try again.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/teams')}
          sx={{ mt: 2 }}
        >
          Back to Teams
        </Button>
      </Box>
    );
  }

  if (!team) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Team not found
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/teams')}
          sx={{ mt: 2 }}
        >
          Back to Teams
        </Button>
      </Box>
    );
  }

  // ---- Render ----

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {/* ===== Top Bar: Back + Title + Edit ===== */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Tooltip title="Back to Teams">
            <IconButton onClick={() => navigate('/teams')}>
              <ArrowBackIcon />
            </IconButton>
          </Tooltip>
          <Box>
            <Typography variant="h4" fontWeight={700}>
              {team.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {team.ageGroup} &middot; {team.season}
            </Typography>
          </Box>
          <Chip
            label={team.active ? 'Active' : 'Inactive'}
            color={team.active ? 'success' : 'default'}
            size="small"
            icon={team.active ? <CheckCircleIcon /> : <CancelIcon />}
          />
        </Box>

        {isAdmin && (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditDialogOpen(true)}
          >
            Edit Team
          </Button>
        )}
      </Box>

      {/* ===== Team Info Summary Cards ===== */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
              <SportsBaseballIcon color="primary" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Age Group
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {team.ageGroup || '--'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
              <CalendarMonthIcon color="primary" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Season
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {team.season || '--'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
              <BadgeIcon color="primary" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Head Coach
                </Typography>
                <Typography variant="h6" fontWeight={600} noWrap>
                  {team.coachName || 'Not Assigned'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined">
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2, '&:last-child': { pb: 2 } }}>
              <GroupIcon color="primary" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Roster Size
                </Typography>
                <Typography variant="h6" fontWeight={600}>
                  {players.length} Player{players.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ===== Team Financial Summary (admin only) ===== */}
      {isAdmin && teamStats.totalOwed > 0 && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              <AttachMoneyIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Team Financials
            </Typography>
            <Button size="small" variant="outlined" onClick={() => navigate(`/finances/billing?team=${id}`)}>
              Go to Billing
            </Button>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <AttachMoneyIcon fontSize="small" color="primary" />
                    <Typography variant="caption" color="text.secondary">Total Owed</Typography>
                  </Box>
                  <Typography variant="h6" fontWeight={700}>${teamStats.totalOwed.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <PaymentIcon fontSize="small" color="success" />
                    <Typography variant="caption" color="text.secondary">Collected</Typography>
                  </Box>
                  <Typography variant="h6" fontWeight={700} color="success.main">${teamStats.totalPaid.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <TrendingUpIcon fontSize="small" color="error" />
                    <Typography variant="caption" color="text.secondary">Outstanding</Typography>
                  </Box>
                  <Typography variant="h6" fontWeight={700} color="error.main">${teamStats.outstanding.toFixed(2)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Card variant="outlined">
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <PeopleAltIcon fontSize="small" color="warning" />
                    <Typography variant="caption" color="text.secondary">Players Owing</Typography>
                  </Box>
                  <Typography variant="h6" fontWeight={700}>{teamStats.playersOwing}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {teamStats.collectionRate.toFixed(0)}% collected
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* ===== Additional Team Details ===== */}
      {(team.gcTeamId || team.status) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2}>
            {team.gcTeamId && (
              <Grid item xs={12} sm={6}>
                <Typography variant="caption" color="text.secondary">
                  GameChanger Team ID
                </Typography>
                <Typography variant="body1" fontWeight={500} sx={{ fontFamily: 'monospace' }}>
                  {team.gcTeamId}
                </Typography>
              </Grid>
            )}
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">
                Status
              </Typography>
              <Box sx={{ mt: 0.5 }}>
                <Chip
                  label={team.status === 'active' ? 'Active' : 'Archived'}
                  color={team.status === 'active' ? 'success' : 'default'}
                  size="small"
                />
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* ===== Player Roster Section ===== */}
      <Paper variant="outlined" sx={{ mb: 4 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            p: 2,
            pb: 1,
            flexWrap: 'wrap',
            gap: 1,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            <GroupIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            Player Roster ({players.length})
          </Typography>
          {isAdmin && (
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              size="small"
              onClick={() => setAddPlayerDialogOpen(true)}
            >
              Add Player
            </Button>
          )}
        </Box>
        <Divider />

        {playersLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : players.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <GroupIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
            <Typography color="text.secondary">
              No players assigned to this team yet.
            </Typography>
            {isAdmin && (
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                sx={{ mt: 2 }}
                onClick={() => setAddPlayerDialogOpen(true)}
              >
                Add Your First Player
              </Button>
            )}
          </Box>
        ) : (
          <Box sx={{ width: '100%' }}>
            <DataGrid
              rows={players}
              columns={columns}
              autoHeight
              disableRowSelectionOnClick
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
                sorting: { sortModel: [{ field: 'lastName', sort: 'asc' }] },
              }}
              sx={{
                border: 'none',
                '& .MuiDataGrid-columnHeaders': {
                  backgroundColor: 'action.hover',
                },
                '& .MuiDataGrid-row:hover': {
                  backgroundColor: 'action.hover',
                },
                '& .MuiDataGrid-cell': {
                  display: 'flex',
                  alignItems: 'center',
                },
              }}
              getRowId={(row) => row.id}
            />
          </Box>
        )}
      </Paper>

      {/* ===== GameChanger Widget Section ===== */}
      {team.gcTeamId && (
        <Paper variant="outlined" sx={{ mb: 4 }}>
          <Box sx={{ p: 2, pb: 1 }}>
            <Typography variant="h6" fontWeight={600}>
              <SportsBaseballIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              GameChanger Schedule
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Live schedule and scores from GameChanger
            </Typography>
          </Box>
          <Divider />
          <Box sx={{ p: 0 }}>
            <iframe
              src={`https://web.gc.com/teams/${team.gcTeamId}/schedule`}
              title="GameChanger Schedule"
              width="100%"
              height="600"
              style={{
                border: 'none',
                display: 'block',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
            />
          </Box>
        </Paper>
      )}

      {/* ===== GameChanger Synced Data ===== */}
      {team.gcTeamId && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
          <GCGamesPanel teamId={team.id} gcTeamId={team.gcTeamId} />
          <GCStatsPanel teamId={team.id} />
        </Box>
      )}

      {/* ===== Edit Team Dialog ===== */}
      <TeamFormDialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        team={team}
      />

      {/* ===== Add Player to Team Dialog ===== */}
      <Dialog
        open={addPlayerDialogOpen}
        onClose={() => {
          setAddPlayerDialogOpen(false);
          setSelectedPlayerToAdd(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Add Player to {team.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a player who is not currently assigned to a team.
          </Typography>
          <Autocomplete
            options={availablePlayers}
            getOptionLabel={(option) =>
              `${option.lastName}, ${option.firstName}${option.jerseyNumber != null ? ` (#${option.jerseyNumber})` : ''}`
            }
            value={selectedPlayerToAdd}
            onChange={(_event, newValue) => setSelectedPlayerToAdd(newValue)}
            renderOption={(props, option) => (
              <li {...props} key={option.id}>
                <Box>
                  <Typography variant="body1">
                    {option.lastName}, {option.firstName}
                    {option.jerseyNumber != null && (
                      <Chip label={`#${option.jerseyNumber}`} size="small" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  {option.positions.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      {option.positions.join(', ')}
                    </Typography>
                  )}
                </Box>
              </li>
            )}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Search Players"
                placeholder="Type a player name..."
                autoFocus
                sx={{ mt: 1 }}
              />
            )}
            noOptionsText="No available players found"
            isOptionEqualToValue={(option, value) => option.id === value.id}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setAddPlayerDialogOpen(false);
              setSelectedPlayerToAdd(null);
            }}
          >
            Cancel
          </Button>
          <Tooltip title={!selectedPlayerToAdd ? 'Select a player first' : ''}>
            <span>
              <Button
                variant="contained"
                disabled={!selectedPlayerToAdd || assignPlayerMutation.isPending}
                onClick={handleAddPlayer}
                startIcon={assignPlayerMutation.isPending ? <CircularProgress size={16} /> : <PersonAddIcon />}
              >
                {assignPlayerMutation.isPending ? 'Adding...' : 'Add to Team'}
              </Button>
            </span>
          </Tooltip>
        </DialogActions>
      </Dialog>

      {/* ===== Confirm Remove Player Dialog ===== */}
      <Dialog
        open={!!confirmRemovePlayer}
        onClose={() => setConfirmRemovePlayer(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Remove Player from Team</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove{' '}
            <strong>
              {confirmRemovePlayer?.firstName} {confirmRemovePlayer?.lastName}
            </strong>{' '}
            from <strong>{team.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The player will not be deleted. They will become unassigned and can be added to another team later.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmRemovePlayer(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={removePlayerMutation.isPending}
            onClick={handleRemovePlayer}
            startIcon={removePlayerMutation.isPending ? <CircularProgress size={16} /> : <PersonRemoveIcon />}
          >
            {removePlayerMutation.isPending ? 'Removing...' : 'Remove'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===== Confirm Quit Player Dialog ===== */}
      <Dialog
        open={!!confirmQuitPlayer}
        onClose={() => setConfirmQuitPlayer(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle color="warning.main">Mark Player as Quit</DialogTitle>
        <DialogContent>
          <Typography>
            Mark{' '}
            <strong>
              {confirmQuitPlayer?.firstName} {confirmQuitPlayer?.lastName}
            </strong>{' '}
            as quit from <strong>{team.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            This will:
          </Typography>
          <Typography component="ul" variant="body2" color="text.secondary" sx={{ mt: 0.5, pl: 2 }}>
            <li>Remove the player from the team roster</li>
            <li>Zero out all their fees</li>
            <li>Redistribute team costs to remaining players</li>
            <li>Keep their payment history intact</li>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmQuitPlayer(null)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={quitPlayerMutation.isPending}
            onClick={() => confirmQuitPlayer && quitPlayerMutation.mutate(confirmQuitPlayer)}
            startIcon={quitPlayerMutation.isPending ? <CircularProgress size={16} /> : <ExitToAppIcon />}
          >
            {quitPlayerMutation.isPending ? 'Processing...' : 'Mark as Quit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamDetailsPage;
