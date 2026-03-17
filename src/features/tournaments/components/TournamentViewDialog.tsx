import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  Divider,
  Link,
} from '@mui/material';
import { format } from 'date-fns';
import { Tournament } from '@/types/models';
import { useQuery } from '@tanstack/react-query';
import { teamsApi } from '@/lib/api/teams';
import TournamentWorkflowStepper from './TournamentWorkflowStepper';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

const statusLabelMap: Record<string, string> = {
  upcoming: 'Upcoming',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const statusColorMap: Record<string, 'info' | 'warning' | 'success'> = {
  upcoming: 'info',
  in_progress: 'warning',
  completed: 'success',
};

interface TournamentViewDialogProps {
  open: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  showFinancials?: boolean;
}

const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Box sx={{ display: 'flex', gap: 1, py: 0.5 }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140, fontWeight: 500 }}>
      {label}:
    </Typography>
    <Typography variant="body2">{value || '—'}</Typography>
  </Box>
);

const TournamentViewDialog = ({ open, onClose, tournament, showFinancials = false }: TournamentViewDialogProps) => {
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  if (!tournament) return null;

  const teamNames = (tournament.teamIds || [])
    .map(id => teams.find(t => t.id === id)?.name || id)
    .join(', ');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{tournament.name}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
          {/* Workflow stepper - read only */}
          <TournamentWorkflowStepper
            currentStatus={tournament.workflowStatus || 'wanting'}
            readOnly
          />

          <Divider />

          {/* Basic Info */}
          <InfoRow label="Location" value={tournament.location} />
          <InfoRow
            label="Dates"
            value={`${format(tournament.startDate, 'MMM d, yyyy')} — ${format(tournament.endDate, 'MMM d, yyyy')}`}
          />
          <InfoRow label="Teams" value={teamNames || 'None assigned'} />
          <InfoRow
            label="Status"
            value={
              tournament.status ? (
                <Chip
                  label={statusLabelMap[tournament.status] || tournament.status}
                  color={statusColorMap[tournament.status] || 'default'}
                  size="small"
                />
              ) : '—'
            }
          />

          {/* Contact Info */}
          {(tournament.contactName || tournament.contactPhone || tournament.contactEmail) && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">Contact Information</Typography>
              {tournament.contactName && <InfoRow label="Contact" value={tournament.contactName} />}
              {tournament.contactPhone && <InfoRow label="Phone" value={tournament.contactPhone} />}
              {tournament.contactEmail && <InfoRow label="Email" value={tournament.contactEmail} />}
            </>
          )}

          {/* Financials - only for coaches/admins */}
          {showFinancials && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">Financials</Typography>
              <InfoRow label="Total Cost" value={`$${(tournament.cost || 0).toFixed(2)}`} />
              {tournament.depositAmount ? (
                <InfoRow label="Deposit" value={`$${tournament.depositAmount.toFixed(2)}`} />
              ) : null}
              {tournament.balanceDueDate && (
                <InfoRow label="Balance Due" value={format(tournament.balanceDueDate, 'MMM d, yyyy')} />
              )}
              <InfoRow
                label="Insurance Sent"
                value={
                  tournament.insuranceSent
                    ? <CheckCircleIcon color="success" sx={{ fontSize: 18 }} />
                    : <CancelIcon color="disabled" sx={{ fontSize: 18 }} />
                }
              />
            </>
          )}

          {/* Links */}
          {(tournament.websiteUrl || tournament.scheduleUrl || tournament.registrationUrl) && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">Links</Typography>
              {tournament.websiteUrl && (
                <InfoRow label="Website" value={<Link href={tournament.websiteUrl} target="_blank" rel="noopener">{tournament.websiteUrl}</Link>} />
              )}
              {tournament.scheduleUrl && (
                <InfoRow label="Schedule" value={<Link href={tournament.scheduleUrl} target="_blank" rel="noopener">{tournament.scheduleUrl}</Link>} />
              )}
              {tournament.registrationUrl && (
                <InfoRow label="Registration" value={<Link href={tournament.registrationUrl} target="_blank" rel="noopener">{tournament.registrationUrl}</Link>} />
              )}
            </>
          )}

          {/* Accommodations */}
          {tournament.accommodationsInfo && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">Accommodations</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {tournament.accommodationsInfo}
              </Typography>
            </>
          )}

          {/* Notes */}
          {tournament.notes && (
            <>
              <Divider />
              <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {tournament.notes}
              </Typography>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};

export default TournamentViewDialog;
