import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  MenuItem,
  IconButton,
  Typography,
  Divider,
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { playersApi } from '@/lib/api/players';
import { teamsApi } from '@/lib/api/teams';
import { userProvisioningApi } from '@/lib/api/userProvisioning';
import { auth } from '@/lib/firebase/config';
import { Player } from '@/types/models';
import toast from 'react-hot-toast';

/** Send provisioning invite emails via the sendParentInvites cloud function */
const sendProvisioningInvites = async (emails: string[]) => {
  if (emails.length === 0) return;
  const token = await auth.currentUser?.getIdToken();
  if (!token) return;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const url = `https://us-central1-${projectId}.cloudfunctions.net/sendParentInvites`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ emails }),
  });
};

const playerSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  dateOfBirth: z.string().optional(),
  teamId: z.string().optional(),
  jerseyNumber: z.string().optional(),
  positions: z.string().optional(),
  bats: z.string().optional(),
  throws: z.string().optional(),
  contacts: z.array(z.object({
    name: z.string().optional().default(''),
    relationship: z.string().optional().default(''),
    email: z.string().optional().default('').refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Invalid email'),
    phone: z.string().optional().default(''),
    isPrimaryContact: z.boolean(),
    isFinancialParty: z.boolean(),
  })),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  medicalNotes: z.string().optional(),
  notes: z.string().optional(),
  playingUpFrom: z.string().optional(),
  active: z.boolean(),
});

type PlayerFormData = z.infer<typeof playerSchema>;

interface PlayerFormDialogProps {
  open: boolean;
  onClose: () => void;
  player: Player | null;
  defaultTeamId?: string;
}

const RELATIONSHIP_OPTIONS = [
  'Mother',
  'Father',
  'Stepmother',
  'Stepfather',
  'Guardian',
  'Other',
];

const MAX_CONTACTS = 6;

const defaultContact = {
  name: '',
  relationship: '',
  email: '',
  phone: '',
  isPrimaryContact: true,
  isFinancialParty: true,
};

const PlayerFormDialog = ({ open, onClose, player, defaultTeamId }: PlayerFormDialogProps) => {
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<PlayerFormData>({
    resolver: zodResolver(playerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      teamId: '',
      jerseyNumber: '',
      positions: '',
      bats: '',
      throws: '',
      contacts: [{ ...defaultContact }],
      emergencyContact: '',
      emergencyPhone: '',
      medicalNotes: '',
      notes: '',
      playingUpFrom: '',
      active: true,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'contacts',
  });

  // Track account status for each contact email
  const [emailStatuses, setEmailStatuses] = useState<Record<string, 'active' | 'pending' | null>>({});

  // Check contact email statuses when editing an existing player
  useEffect(() => {
    if (!player?.contacts?.length) {
      setEmailStatuses({});
      return;
    }
    const emails = player.contacts.map((c) => c.email).filter(Boolean);
    if (emails.length === 0) return;

    userProvisioningApi.checkEmailStatuses(emails).then(setEmailStatuses).catch(console.error);
  }, [player]);

  useEffect(() => {
    if (player) {
      // Build contacts from player.contacts if available, otherwise fall back to parentName/Email/Phone
      let contacts: PlayerFormData['contacts'];
      if (player.contacts && player.contacts.length > 0) {
        contacts = player.contacts.map((c) => ({
          name: c.name || '',
          relationship: c.relationship || '',
          email: c.email || '',
          phone: c.phone || '',
          isPrimaryContact: c.isPrimaryContact || false,
          isFinancialParty: c.isFinancialParty || false,
        }));
      } else {
        contacts = [
          {
            name: player.parentName || '',
            relationship: '',
            email: player.parentEmail || '',
            phone: player.parentPhone || '',
            isPrimaryContact: true,
            isFinancialParty: true,
          },
        ];
      }

      reset({
        firstName: player.firstName,
        lastName: player.lastName,
        dateOfBirth: player.dateOfBirth ? player.dateOfBirth.toISOString().split('T')[0] : '',
        teamId: player.teamId || '',
        jerseyNumber: player.jerseyNumber != null ? String(player.jerseyNumber) : '',
        positions: Array.isArray(player.positions) ? player.positions.join(', ') : '',
        bats: player.bats || '',
        throws: player.throws || '',
        contacts,
        emergencyContact: player.emergencyContact,
        emergencyPhone: player.emergencyPhone,
        medicalNotes: player.medicalNotes || '',
        notes: player.notes || '',
        playingUpFrom: player.playingUpFrom || '',
        active: player.active,
      });
    } else {
      reset({
        firstName: '',
        lastName: '',
        dateOfBirth: '',
        teamId: defaultTeamId || '',
        jerseyNumber: '',
        positions: '',
        bats: '',
        throws: '',
        contacts: [{ ...defaultContact }],
        emergencyContact: '',
        emergencyPhone: '',
        medicalNotes: '',
        notes: '',
        playingUpFrom: '',
        active: true,
      });
    }
  }, [player, reset, defaultTeamId]);

  const buildPlayerPayload = (data: PlayerFormData) => {
    const primaryContact = data.contacts.find((c) => c.isPrimaryContact) || data.contacts[0];
    const team = teams.find((t) => t.id === data.teamId);
    return {
      firstName: data.firstName,
      lastName: data.lastName,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      teamId: data.teamId || undefined,
      teamName: team?.name,
      jerseyNumber: data.jerseyNumber ? parseInt(data.jerseyNumber) : undefined,
      positions: data.positions ? data.positions.split(',').map((p) => p.trim()).filter(Boolean) : [],
      bats: (data.bats as 'L' | 'R' | 'S') || undefined,
      throws: (data.throws as 'L' | 'R') || undefined,
      contacts: data.contacts,
      parentName: primaryContact?.name || '',
      parentEmail: primaryContact?.email || '',
      parentPhone: primaryContact?.phone || '',
      emergencyContact: data.emergencyContact || '',
      emergencyPhone: data.emergencyPhone || '',
      medicalNotes: data.medicalNotes || undefined,
      notes: data.notes || undefined,
      playingUpFrom: data.playingUpFrom || undefined,
      active: data.active,
    };
  };

  const createMutation = useMutation({
    mutationFn: async (data: PlayerFormData) => {
      const payload = buildPlayerPayload(data);
      const playerId = await playersApi.create(payload as any);

      // Auto-provision parent accounts for contacts and send invite emails
      const createdPlayer = await playersApi.getById(playerId);
      if (createdPlayer) {
        await userProvisioningApi.provisionAllContacts(createdPlayer).catch(console.error);
        const emails = data.contacts.map(c => c.email).filter(Boolean);
        await sendProvisioningInvites(emails).catch(console.error);
      }
      return playerId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
      toast.success('Player created and invite sent');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create player');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PlayerFormData) => {
      const payload = buildPlayerPayload(data);
      const contactEmails = data.contacts.map(c => c.email).filter(Boolean);

      // Check which emails already have accounts before provisioning
      const existingStatuses = contactEmails.length > 0
        ? await userProvisioningApi.checkEmailStatuses(contactEmails).catch(() => ({} as Record<string, string | null>))
        : {};
      const newEmails = contactEmails.filter(e => !existingStatuses[e]);

      await playersApi.update(player!.id, payload);

      // Auto-provision parent accounts for any new contacts
      const updatedPlayer = await playersApi.getById(player!.id);
      if (updatedPlayer) {
        await userProvisioningApi.provisionAllContacts(updatedPlayer).catch(console.error);
        // Send invites only for newly provisioned contacts
        if (newEmails.length > 0) {
          await sendProvisioningInvites(newEmails).catch(console.error);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
      toast.success('Player updated successfully');
      onClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update player');
    },
  });

  const onSubmit = (data: PlayerFormData) => {
    // Validate at least one primary contact
    const hasPrimary = data.contacts.some((c) => c.isPrimaryContact);
    if (!hasPrimary) {
      toast.error('At least one contact must be marked as Primary');
      return;
    }

    if (player) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{player ? 'Edit Player' : 'Add New Player'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="First Name"
                {...register('firstName')}
                error={!!errors.firstName}
                helperText={errors.firstName?.message}
                fullWidth
              />
              <TextField
                label="Last Name"
                {...register('lastName')}
                error={!!errors.lastName}
                helperText={errors.lastName?.message}
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Date of Birth"
                type="date"
                {...register('dateOfBirth')}
                error={!!errors.dateOfBirth}
                helperText={errors.dateOfBirth?.message}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="Team"
                select
                {...register('teamId')}
                error={!!errors.teamId}
                helperText={errors.teamId?.message}
                fullWidth
              >
                <MenuItem value="">
                  <em>No Team</em>
                </MenuItem>
                {teams.filter((t) => t.active).map((team) => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Jersey Number"
                type="number"
                {...register('jerseyNumber')}
                fullWidth
              />
              <TextField
                label="Positions"
                placeholder="e.g., P, SS, CF"
                {...register('positions')}
                helperText="Comma-separated"
                fullWidth
              />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <TextField
                label="Bats"
                select
                {...register('bats')}
                fullWidth
              >
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
                <MenuItem value="L">Left</MenuItem>
                <MenuItem value="R">Right</MenuItem>
                <MenuItem value="S">Switch</MenuItem>
              </TextField>
              <TextField
                label="Throws"
                select
                {...register('throws')}
                fullWidth
              >
                <MenuItem value="">
                  <em>Not specified</em>
                </MenuItem>
                <MenuItem value="L">Left</MenuItem>
                <MenuItem value="R">Right</MenuItem>
              </TextField>
              <TextField
                label="Playing Up From"
                placeholder="e.g., 12U"
                {...register('playingUpFrom')}
                fullWidth
              />
            </Box>

            <TextField
              label="Notes"
              {...register('notes')}
              multiline
              rows={2}
              fullWidth
            />

            {/* Parent/Guardian Contacts Section */}
            <Divider />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Parent/Guardian Contacts
              </Typography>
              {fields.length < MAX_CONTACTS && (
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() =>
                    append({
                      name: '',
                      relationship: '',
                      email: '',
                      phone: '',
                      isPrimaryContact: true,
                      isFinancialParty: true,
                    })
                  }
                >
                  Add Contact
                </Button>
              )}
            </Box>
            {errors.contacts?.message && (
              <Typography variant="body2" color="error">
                {errors.contacts.message}
              </Typography>
            )}

            {fields.map((field, index) => (
              <Box
                key={field.id}
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 2,
                  position: 'relative',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Contact {index + 1}
                  </Typography>
                  {fields.length > 1 && (
                    <IconButton size="small" color="error" onClick={() => remove(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                  <TextField
                    label="Name"
                    {...register(`contacts.${index}.name`)}
                    error={!!errors.contacts?.[index]?.name}
                    helperText={errors.contacts?.[index]?.name?.message}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="Relationship"
                    select
                    {...register(`contacts.${index}.relationship`)}
                    error={!!errors.contacts?.[index]?.relationship}
                    helperText={errors.contacts?.[index]?.relationship?.message}
                    fullWidth
                    size="small"
                  >
                    {RELATIONSHIP_OPTIONS.map((rel) => (
                      <MenuItem key={rel} value={rel}>
                        {rel}
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 1 }}>
                  <Box>
                    <TextField
                      label="Email"
                      type="email"
                      {...register(`contacts.${index}.email`)}
                      error={!!errors.contacts?.[index]?.email}
                      helperText={errors.contacts?.[index]?.email?.message}
                      fullWidth
                      size="small"
                    />
                    {player?.contacts?.[index]?.email && emailStatuses[player.contacts[index].email] === 'active' && (
                      <Chip
                        label="Account exists"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                      />
                    )}
                    {player?.contacts?.[index]?.email && emailStatuses[player.contacts[index].email] === 'pending' && (
                      <Chip
                        label="Invite pending"
                        size="small"
                        color="warning"
                        variant="outlined"
                        sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }}
                      />
                    )}
                  </Box>
                  <TextField
                    label="Phone"
                    {...register(`contacts.${index}.phone`)}
                    error={!!errors.contacts?.[index]?.phone}
                    helperText={errors.contacts?.[index]?.phone?.message}
                    fullWidth
                    size="small"
                  />
                </Box>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControlLabel
                    control={
                      <Controller
                        name={`contacts.${index}.isPrimaryContact`}
                        control={control}
                        render={({ field: checkField }) => (
                          <Checkbox
                            {...checkField}
                            checked={checkField.value}
                            size="small"
                          />
                        )}
                      />
                    }
                    label="Primary Contact"
                  />
                  <FormControlLabel
                    control={
                      <Controller
                        name={`contacts.${index}.isFinancialParty`}
                        control={control}
                        render={({ field: checkField }) => (
                          <Checkbox
                            {...checkField}
                            checked={checkField.value}
                            size="small"
                          />
                        )}
                      />
                    }
                    label="Financial Party"
                  />
                </Box>
              </Box>
            ))}

            <Divider />

            {/* Emergency Contact */}
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Emergency Contact
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Emergency Contact"
                {...register('emergencyContact')}
                error={!!errors.emergencyContact}
                helperText={errors.emergencyContact?.message}
                fullWidth
              />
              <TextField
                label="Emergency Phone"
                {...register('emergencyPhone')}
                error={!!errors.emergencyPhone}
                helperText={errors.emergencyPhone?.message}
                fullWidth
              />
            </Box>

            <TextField
              label="Medical Notes"
              {...register('medicalNotes')}
              error={!!errors.medicalNotes}
              helperText={errors.medicalNotes?.message}
              multiline
              rows={3}
              fullWidth
            />

            <FormControlLabel
              control={
                <Controller
                  name="active"
                  control={control}
                  render={({ field }) => (
                    <Checkbox {...field} checked={field.value} />
                  )}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            {player ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default PlayerFormDialog;
