import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Alert,
  Autocomplete,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { equipmentApi } from '@/lib/api/equipment';
import { playersApi } from '@/lib/api/players';
import { teamsApi } from '@/lib/api/teams';
import { Equipment, Player } from '@/types/models';
import toast from 'react-hot-toast';

interface AssignEquipmentDialogProps {
  open: boolean;
  onClose: () => void;
  equipment: Equipment | null;
}

const AssignEquipmentDialog = ({ open, onClose, equipment }: AssignEquipmentDialogProps) => {
  const queryClient = useQueryClient();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [numberConflict, setNumberConflict] = useState<string | null>(null);

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => playersApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!equipment || !selectedPlayer) return;

      // Validate number if equipment has a number
      if (equipment.number) {
        const team = teams.find((t) => t.id === selectedPlayer.teamId);
        if (team) {
          const conflict = await equipmentApi.validateNumber(
            equipment.number,
            team.ageGroup,
            equipment.season,
            equipment.id
          );
          if (conflict) {
            setNumberConflict(
              `Number ${equipment.number} is already assigned to ${conflict.conflictPlayer}`
            );
            return;
          }
        }
      }

      await equipmentApi.assign(
        equipment.id,
        selectedPlayer.id,
        `${selectedPlayer.firstName} ${selectedPlayer.lastName}`,
        selectedPlayer.teamId
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipment assigned successfully');
      handleClose();
    },
    onError: () => toast.error('Failed to assign equipment'),
  });

  const unassignMutation = useMutation({
    mutationFn: () => equipmentApi.unassign(equipment!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment'] });
      toast.success('Equipment unassigned');
      handleClose();
    },
    onError: () => toast.error('Failed to unassign equipment'),
  });

  const handleClose = () => {
    setSelectedPlayer(null);
    setNumberConflict(null);
    onClose();
  };

  if (!equipment) return null;

  const isAssigned = equipment.status === 'assigned' && equipment.assignedTo;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isAssigned ? 'Reassign / Unassign Equipment' : 'Assign Equipment'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {equipment.type.replace('_', ' ')} #{equipment.number || 'N/A'} - Size: {equipment.size}
          </Typography>

          {isAssigned && (
            <Alert severity="info">
              Currently assigned to: <strong>{equipment.assignedToName}</strong>
            </Alert>
          )}

          {numberConflict && (
            <Alert severity="warning">{numberConflict}</Alert>
          )}

          <Autocomplete
            options={players.filter((p) => p.active)}
            getOptionLabel={(option) => {
              const team = teams.find((t) => t.id === option.teamId);
              return `${option.firstName} ${option.lastName}${team ? ` (${team.name})` : ''}`;
            }}
            value={selectedPlayer}
            onChange={(_, newValue) => {
              setSelectedPlayer(newValue);
              setNumberConflict(null);
            }}
            renderInput={(params) => (
              <TextField {...params} label="Select Player" />
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        {isAssigned && (
          <Button
            color="warning"
            onClick={() => unassignMutation.mutate()}
            disabled={unassignMutation.isPending}
          >
            Unassign
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => assignMutation.mutate()}
          disabled={!selectedPlayer || assignMutation.isPending}
        >
          {assignMutation.isPending ? 'Assigning...' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignEquipmentDialog;
