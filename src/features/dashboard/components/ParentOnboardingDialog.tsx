import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  MenuItem,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { playersApi } from '@/lib/api/players';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/authStore';
import type { PlayerContact } from '@/types/models';
import toast from 'react-hot-toast';

interface PlayerFormState {
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  emergencyContact: string;
  emergencyPhone: string;
  medicalNotes: string;
  contacts: PlayerContact[];
}

interface ParentOnboardingDialogProps {
  open: boolean;
  onClose: () => void;
  linkedPlayerIds: string[];
}

const RELATIONSHIPS = ['Mother', 'Father', 'Stepmother', 'Stepfather', 'Guardian', 'Other'];

const ParentOnboardingDialog = ({ open, onClose, linkedPlayerIds }: ParentOnboardingDialogProps) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [playerForms, setPlayerForms] = useState<Record<string, PlayerFormState>>({});
  const [expanded, setExpanded] = useState<string | false>(false);

  // Fetch each linked player directly so we always get fresh data
  const { data: linkedPlayers = [], isLoading } = useQuery({
    queryKey: ['linkedPlayers', ...linkedPlayerIds],
    queryFn: async () => {
      const results = await Promise.all(
        linkedPlayerIds.map(id => playersApi.getById(id))
      );
      return results.filter(Boolean) as NonNullable<Awaited<ReturnType<typeof playersApi.getById>>>[];
    },
    enabled: open && linkedPlayerIds.length > 0,
    staleTime: 0, // always refetch when dialog opens
  });

  // Re-initialize form state from player data every time the dialog opens or player data changes
  useEffect(() => {
    if (!open || linkedPlayers.length === 0) return;

    const forms: Record<string, PlayerFormState> = {};
    linkedPlayers.forEach(player => {
      forms[player.id] = {
        parentName: player.parentName || user?.displayName || '',
        parentEmail: player.parentEmail || user?.email || '',
        parentPhone: player.parentPhone || '',
        emergencyContact: player.emergencyContact || '',
        emergencyPhone: player.emergencyPhone || '',
        medicalNotes: player.medicalNotes || '',
        contacts: player.contacts?.length > 0
          ? player.contacts.map(c => ({ ...c }))
          : [{
              name: user?.displayName || '',
              relationship: 'Mother',
              email: user?.email || '',
              phone: '',
              isPrimaryContact: true,
              isFinancialParty: true,
            }],
      };
    });
    setPlayerForms(forms);
    if (linkedPlayers.length > 0) {
      setExpanded(linkedPlayers[0].id);
    }
  }, [open, linkedPlayers]);

  const updateField = (playerId: string, field: keyof PlayerFormState, value: string) => {
    setPlayerForms(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], [field]: value },
    }));
  };

  const updateContact = (playerId: string, index: number, field: keyof PlayerContact, value: string | boolean) => {
    setPlayerForms(prev => {
      const form = { ...prev[playerId] };
      const contacts = [...form.contacts];
      contacts[index] = { ...contacts[index], [field]: value };
      return { ...prev, [playerId]: { ...form, contacts } };
    });
  };

  const addContact = (playerId: string) => {
    setPlayerForms(prev => {
      const form = { ...prev[playerId] };
      return {
        ...prev,
        [playerId]: {
          ...form,
          contacts: [...form.contacts, { name: '', relationship: 'Guardian', email: '', phone: '', isPrimaryContact: false, isFinancialParty: false }],
        },
      };
    });
  };

  const removeContact = (playerId: string, index: number) => {
    setPlayerForms(prev => {
      const form = { ...prev[playerId] };
      const contacts = form.contacts.filter((_, i) => i !== index);
      return { ...prev, [playerId]: { ...form, contacts } };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update each player
      for (const [playerId, form] of Object.entries(playerForms)) {
        await playersApi.update(playerId, {
          parentName: form.parentName,
          parentEmail: form.parentEmail,
          parentPhone: form.parentPhone,
          emergencyContact: form.emergencyContact,
          emergencyPhone: form.emergencyPhone,
          medicalNotes: form.medicalNotes,
          contacts: form.contacts,
        });
      }

      // Mark onboarding as complete on user doc
      if (user?.uid) {
        await updateDoc(doc(db, 'users', user.uid), {
          onboardingComplete: true,
          updatedAt: Timestamp.now(),
        });
      }

      queryClient.invalidateQueries({ queryKey: ['players'] });
      toast.success('Player information updated successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Welcome to TC Waves!
        <Typography variant="body2" color="text.secondary">
          Please review and update the information for your child{linkedPlayers.length > 1 ? 'ren' : ''}. This helps us keep accurate records.
        </Typography>
      </DialogTitle>
      <DialogContent>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : linkedPlayers.length === 0 ? (
          <Alert severity="info">
            No players are currently linked to your account. Contact an administrator if this seems incorrect.
          </Alert>
        ) : (
          linkedPlayers.map(player => {
            const form = playerForms[player.id];
            if (!form) return null;

            return (
              <Accordion
                key={player.id}
                expanded={expanded === player.id}
                onChange={(_, isExpanded) => setExpanded(isExpanded ? player.id : false)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ChildCareIcon color="primary" />
                    <Typography fontWeight={600}>
                      {player.firstName} {player.lastName}
                    </Typography>
                    {player.teamName && (
                      <Typography variant="body2" color="text.secondary">
                        — {player.teamName}
                      </Typography>
                    )}
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Parent / Guardian Contacts
                  </Typography>

                  {form.contacts.map((contact, i) => (
                    <Box key={i} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                      <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                        <TextField
                          label="Name"
                          value={contact.name}
                          onChange={e => updateContact(player.id, i, 'name', e.target.value)}
                          fullWidth
                          size="small"
                        />
                        <TextField
                          label="Relationship"
                          select
                          value={contact.relationship}
                          onChange={e => updateContact(player.id, i, 'relationship', e.target.value)}
                          fullWidth
                          size="small"
                        >
                          {RELATIONSHIPS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                        </TextField>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                        <TextField
                          label="Email"
                          type="email"
                          value={contact.email}
                          onChange={e => updateContact(player.id, i, 'email', e.target.value)}
                          fullWidth
                          size="small"
                        />
                        <TextField
                          label="Phone"
                          value={contact.phone}
                          onChange={e => updateContact(player.id, i, 'phone', e.target.value)}
                          fullWidth
                          size="small"
                        />
                      </Box>
                      {form.contacts.length > 1 && (
                        <Button size="small" color="error" onClick={() => removeContact(player.id, i)}>
                          Remove Contact
                        </Button>
                      )}
                    </Box>
                  ))}

                  <Button size="small" onClick={() => addContact(player.id)} sx={{ mb: 2 }}>
                    + Add Another Contact
                  </Button>

                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Emergency Contact
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <TextField
                      label="Emergency Contact Name"
                      value={form.emergencyContact}
                      onChange={e => updateField(player.id, 'emergencyContact', e.target.value)}
                      fullWidth
                      size="small"
                    />
                    <TextField
                      label="Emergency Phone"
                      value={form.emergencyPhone}
                      onChange={e => updateField(player.id, 'emergencyPhone', e.target.value)}
                      fullWidth
                      size="small"
                    />
                  </Box>

                  <TextField
                    label="Medical Notes / Allergies"
                    value={form.medicalNotes}
                    onChange={e => updateField(player.id, 'medicalNotes', e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                    size="small"
                    placeholder="Any medical conditions, allergies, or special needs we should know about"
                  />
                </AccordionDetails>
              </Accordion>
            );
          })
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Skip for Now</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving || linkedPlayers.length === 0}
        >
          {saving ? 'Saving...' : 'Save & Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ParentOnboardingDialog;
