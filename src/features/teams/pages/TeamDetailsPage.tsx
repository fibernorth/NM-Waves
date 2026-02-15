import { useState } from 'react';
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
import VisibilityIcon from '@mui/icons-material/Visibility';
import SportsBaseballIcon from '@mui/icons-material/SportsBaseball';
import GroupIcon from '@mui/icons-material/Group';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BadgeIcon from '@mui/icons-material/Badge';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { teamsApi } from '@/lib/api/teams';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import TeamFormDialog from '../components/TeamFormDialog';
import type { Player } from '@/types/models';

const TeamDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin' || user?.role === 'master-admin';

  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [addPlayerDialogOpen, setAddPlayerDialogOpen] = useState(false);
  const [selectedPlayerToAdd, setSelectedPlayerToAdd] = useState<Player | null>(null);
  const [confirmRemovePlayer, setConfirmRemovePlayer] = useState<Player | null>(null);

  // ---- Queries ----

  const {
    data: team,
    isLoading: teamLoading,
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
    queryFn: () => playersApi.getByTeam(id!),
    enabled: !!id,
  });

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
    onError: () => {
      toast.error('Failed to add player to team');
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
    onError: () => {
      toast.error('Failed to remove player from team');
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
      headerName: 'Parent Name',
      flex: 1,
      minWidth: 130,
      renderCell: (params) => params.value || '--',
    },
    {
      field: 'parentEmail',
      headerName: 'Parent Email',
      flex: 1,
      minWidth: 180,
      renderCell: (params) => params.value || '--',
    },
    {
      field: 'parentPhone',
      headerName: 'Parent Phone',
      width: 130,
      renderCell: (params) => params.value || '--',
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 130,
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
            <Tooltip title="Remove from Team">
              <IconButton
                size="small"
                color="error"
                onClick={() => setConfirmRemovePlayer(params.row as Player)}
              >
                <PersonRemoveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
          <Button
            variant="contained"
            disabled={!selectedPlayerToAdd || assignPlayerMutation.isPending}
            onClick={handleAddPlayer}
            startIcon={assignPlayerMutation.isPending ? <CircularProgress size={16} /> : <PersonAddIcon />}
          >
            {assignPlayerMutation.isPending ? 'Adding...' : 'Add to Team'}
          </Button>
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
    </Box>
  );
};

export default TeamDetailsPage;
