import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Divider,
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import GavelIcon from '@mui/icons-material/Gavel';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import type { Player, PlayerCompliance } from '@/types/models';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

type ComplianceKey = 'concussionProtocol' | 'waiver' | 'playerConduct' | 'parentConduct';

interface ComplianceItem {
  key: ComplianceKey;
  label: string;
  description: string;
}

const COMPLIANCE_ITEMS: ComplianceItem[] = [
  { key: 'concussionProtocol', label: 'Concussion Protocol', description: 'Understanding of concussion signs and return-to-play policy' },
  { key: 'waiver', label: 'Liability Waiver', description: 'General liability and assumption of risk waiver' },
  { key: 'playerConduct', label: 'Player Code of Conduct', description: 'Player behavior and sportsmanship agreement' },
  { key: 'parentConduct', label: 'Parent Code of Conduct', description: 'Parent/guardian behavior expectations' },
];

const COMPLIANCE_CONTENT: Record<ComplianceKey, { title: string; body: string }> = {
  concussionProtocol: {
    title: 'Concussion Awareness & Return-to-Play Protocol',
    body: `TC WAVES BALL CLUB - CONCUSSION PROTOCOL

As a parent/guardian of a Northern Michigan Waves athlete, I acknowledge that I have reviewed and understand the following:

WHAT IS A CONCUSSION?
A concussion is a brain injury caused by a bump, blow, or jolt to the head, or by a hit to the body that causes the head and brain to move rapidly back and forth. Even a "ding" or what seems to be a mild bump to the head can be serious.

SIGNS AND SYMPTOMS TO WATCH FOR:
- Headache or "pressure" in the head
- Nausea or vomiting
- Balance problems or dizziness
- Double or blurry vision
- Sensitivity to light or noise
- Feeling sluggish, hazy, foggy, or groggy
- Concentration or memory problems
- Confusion
- Feeling "not right" or "down"

WHAT TO DO IF A CONCUSSION IS SUSPECTED:
1. Remove the athlete from play immediately.
2. Do not try to judge the severity yourself. Only a healthcare provider can assess a concussion.
3. Inform the coaching staff and seek medical evaluation.
4. Do not allow the athlete to return to play on the same day as a suspected concussion.

RETURN-TO-PLAY PROTOCOL:
An athlete who has sustained a concussion must:
1. Be evaluated and cleared in writing by a licensed healthcare provider.
2. Follow a gradual return-to-play progression supervised by a healthcare provider.
3. Remain symptom-free at each stage before progressing.
4. Receive final written clearance before returning to full contact practice or competition.

MICHIGAN LAW (Public Act 342 of 2012):
Michigan law requires that youth athletes suspected of having a concussion be removed from play and may not return until cleared by a licensed health professional.

By acknowledging this document, I confirm that:
- I have read and understand the above information about concussions.
- I will report any suspected concussion to the coaching staff immediately.
- I understand that my child will not be allowed to return to play until medically cleared.
- I accept that failing to report symptoms may result in further injury to my child.`,
  },
  waiver: {
    title: 'Liability Waiver & Assumption of Risk',
    body: `TC WAVES BALL CLUB - LIABILITY WAIVER & ASSUMPTION OF RISK

PLEASE READ CAREFULLY. THIS IS A LEGAL DOCUMENT THAT AFFECTS YOUR RIGHTS.

In consideration of the participation of my child in Northern Michigan Waves activities, I acknowledge and agree to the following:

ASSUMPTION OF RISK:
I understand that participation in softball and related activities involves inherent risks, including but not limited to:
- Physical contact with other players, equipment, or facilities
- Injuries from thrown or batted balls
- Sprains, fractures, muscle strains, and other musculoskeletal injuries
- Heat-related illness
- Injuries related to field conditions, weather, and travel
- Other risks inherent to athletic competition and practice

I voluntarily assume all such risks and accept personal responsibility for any injury or illness that may result from participation.

RELEASE AND WAIVER:
To the fullest extent permitted by law, I release, waive, and discharge Northern Michigan Waves, Inc., its officers, directors, coaches, volunteers, and agents from any and all claims, demands, or causes of action arising out of or related to my child's participation in Northern Michigan Waves activities, including but not limited to claims for negligence.

MEDICAL AUTHORIZATION:
In the event of a medical emergency, I authorize Northern Michigan Waves coaches and staff to seek emergency medical treatment for my child if I or my designated emergency contact cannot be reached. I accept financial responsibility for any medical expenses incurred.

PHOTO/VIDEO CONSENT:
I grant Northern Michigan Waves permission to photograph and/or video record my child during practices, games, and events for use in team materials, social media, and promotional content. I understand I may opt out of this in writing at any time.

EQUIPMENT:
I understand that I am responsible for the proper care and return of any organization-owned equipment issued to my child. Failure to return equipment may result in a charge for replacement cost.

I have read this waiver, fully understand its terms, and sign it freely and voluntarily.`,
  },
  playerConduct: {
    title: 'Player Code of Conduct',
    body: `TC WAVES BALL CLUB - PLAYER CODE OF CONDUCT

As a player of the Northern Michigan Waves, I agree to the following standards of behavior:

SPORTSMANSHIP:
- I will treat teammates, opponents, coaches, umpires, and spectators with respect at all times.
- I will play fair and within the rules of the game.
- I will accept decisions of officials without argument or unsportsmanlike conduct.
- I will win with humility and lose with grace.

COMMITMENT:
- I will attend all scheduled practices, games, and team events, or provide advance notice if unable to attend.
- I will arrive on time and prepared for all team activities.
- I will give my best effort at all times.
- I understand that playing time is earned through effort, attitude, and attendance.

TEAMWORK:
- I will support and encourage my teammates.
- I will not engage in bullying, hazing, or exclusionary behavior.
- I will communicate openly with my coaches about concerns or issues.
- I will represent the Northern Michigan Waves positively in the community.

PERSONAL RESPONSIBILITY:
- I will take care of equipment and facilities.
- I will maintain academic standards as required by my school.
- I will not use or possess alcohol, tobacco, vaping products, or illegal substances.
- I will follow the guidance of my coaches regarding training, nutrition, and rest.

SOCIAL MEDIA:
- I will not post negative or disparaging comments about teammates, coaches, opponents, or officials on social media.
- I understand that inappropriate social media conduct may result in disciplinary action.

CONSEQUENCES:
I understand that violations of this Code of Conduct may result in:
- Verbal or written warning
- Reduced playing time
- Game or practice suspension
- Dismissal from the team (at the discretion of the coaching staff and club leadership)

By acknowledging this document, I confirm that I have read, understand, and agree to abide by this Player Code of Conduct for the duration of my participation with Northern Michigan Waves.`,
  },
  parentConduct: {
    title: 'Parent/Guardian Code of Conduct',
    body: `TC WAVES BALL CLUB - PARENT/GUARDIAN CODE OF CONDUCT

As a parent or guardian of a Northern Michigan Waves player, I agree to the following:

RESPECT:
- I will treat all coaches, players, parents, umpires, and event staff with respect and courtesy.
- I will not engage in verbal abuse, threats, or physical intimidation toward anyone at any time.
- I will respect the authority and decisions of coaches regarding lineups, playing time, positioning, and game strategy.
- I will respect the decisions of umpires, even when I disagree.

POSITIVE ENVIRONMENT:
- I will encourage my child and all players positively from the stands.
- I will not coach from the sidelines or stands during games and practices.
- I will not make negative comments about any player's performance, including my own child's.
- I will model good sportsmanship for all young athletes present.

COMMUNICATION:
- I will address concerns with coaches privately and respectfully, not during or immediately after games.
- I will follow the 24-hour rule: wait at least 24 hours after a game before addressing performance-related concerns with coaches.
- I will use appropriate channels (email, scheduled meetings) for communication with coaches and club leadership.
- I will attend parent meetings and stay informed through team communications.

COMMITMENT:
- I will ensure my child arrives on time and is picked up promptly.
- I will communicate schedule conflicts as early as possible.
- I will fulfill my financial obligations in a timely manner.
- I will volunteer and support fundraising efforts as able.

PROHIBITED BEHAVIOR:
- No alcohol or tobacco/vaping products at youth games or practices.
- No gambling related to youth sports activities.
- No confrontation with umpires, coaches, or other parents during events.
- No use of profanity or inappropriate language at team events.

CONSEQUENCES:
Violations of this Code of Conduct may result in:
- Verbal or written warning from the coaching staff or club leadership
- Removal from the venue for the remainder of the event
- Temporary ban from attending games/practices
- Permanent removal of the parent/guardian from team activities
- In severe cases, removal of the player from the team

The Northern Michigan Waves is committed to providing a safe, positive, and supportive environment for all participants. Your cooperation is essential to achieving this goal.

By acknowledging this document, I confirm that I have read, understand, and agree to abide by this Parent/Guardian Code of Conduct.`,
  },
};

/** Format a Firestore Timestamp or Date safely */
const safeDate = (v: unknown): Date | null => {
  try {
    if (!v) return null;
    if (typeof v === 'object' && v !== null && 'toDate' in v) {
      return (v as { toDate: () => Date }).toDate();
    }
    const d = v instanceof Date ? v : new Date(v as string | number);
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
};

interface PlayerComplianceCardProps {
  player: Player;
}

const PlayerComplianceCard = ({ player }: PlayerComplianceCardProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const canAcknowledge = isAdmin || (user?.linkedPlayerIds?.includes(player.id) ?? false);

  const [dialogKey, setDialogKey] = useState<ComplianceKey | null>(null);

  const compliance = player.compliance || {} as PlayerCompliance;

  const ackMutation = useMutation({
    mutationFn: (key: ComplianceKey) =>
      playersApi.acknowledgeCompliance(
        player.id,
        key,
        user!.uid,
        user!.displayName || user!.email,
      ),
    onSuccess: (_data, acknowledgedKey) => {
      queryClient.invalidateQueries({ queryKey: ['player', player.id] });
      toast.success('Acknowledgment recorded');
      // Auto-advance to next unsigned item
      const updatedCompliance = { ...compliance, [acknowledgedKey]: { acknowledgedAt: new Date() } };
      const nextUnsigned = COMPLIANCE_ITEMS.find(
        (item) => item.key !== acknowledgedKey && !updatedCompliance[item.key]
      );
      if (nextUnsigned) {
        setDialogKey(nextUnsigned.key);
      } else {
        setDialogKey(null);
        toast.success('All agreements complete!');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to record acknowledgment');
    },
  });

  const dialogItem = dialogKey ? COMPLIANCE_CONTENT[dialogKey] : null;

  return (
    <>
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <GavelIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Compliance & Agreements
            </Typography>
          </Box>
          <Divider sx={{ mb: 1.5 }} />

          {COMPLIANCE_ITEMS.map((item) => {
            const ack = compliance[item.key];
            const ackDate = ack ? safeDate(ack.acknowledgedAt) : null;
            const isAcknowledged = !!ackDate;
            return (
              <Box
                key={item.key}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 1,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 'none' },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  {isAcknowledged ? (
                    <CheckCircleIcon color="success" fontSize="small" />
                  ) : (
                    <CancelIcon color="disabled" fontSize="small" />
                  )}
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      {item.label}
                    </Typography>
                    {isAcknowledged && ackDate ? (
                      <Typography variant="caption" color="text.secondary">
                        Signed {format(ackDate, 'MMM d, yyyy')}
                        {ack?.acknowledgedByName && ` by ${ack.acknowledgedByName}`}
                      </Typography>
                    ) : (
                      <Typography variant="caption" color="error.main">
                        Not yet acknowledged
                      </Typography>
                    )}
                  </Box>
                </Box>
                {isAcknowledged ? (
                  <Chip label="Complete" size="small" color="success" variant="outlined" sx={{ height: 24 }} />
                ) : canAcknowledge ? (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setDialogKey(item.key)}
                  >
                    Review & Sign
                  </Button>
                ) : (
                  <Chip label="Pending" size="small" color="warning" variant="outlined" sx={{ height: 24 }} />
                )}
              </Box>
            );
          })}

          {/* Overall compliance status */}
          {(() => {
            const total = COMPLIANCE_ITEMS.length;
            const completed = COMPLIANCE_ITEMS.filter(i => !!compliance[i.key]).length;
            return (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Chip
                  label={completed === total ? 'All Agreements Complete' : `${completed} of ${total} Complete`}
                  color={completed === total ? 'success' : 'warning'}
                  sx={{ fontWeight: 600 }}
                />
              </Box>
            );
          })()}
        </CardContent>
      </Card>

      {/* Agreement Dialog */}
      <Dialog
        open={!!dialogKey}
        onClose={() => setDialogKey(null)}
        maxWidth="md"
        fullWidth
        fullScreen={window.innerWidth < 600}
      >
        <DialogTitle sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, py: { xs: 1.5, sm: 2 } }}>
          {dialogItem?.title || ''}
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 1.5, sm: 3 } }}>
          <Box
            sx={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              fontSize: { xs: '0.8rem', sm: '0.875rem' },
              lineHeight: 1.7,
              maxHeight: { xs: 'none', sm: '60vh' },
              overflow: 'auto',
              p: { xs: 1.5, sm: 2 },
              bgcolor: 'grey.50',
              borderRadius: 1,
            }}
          >
            {dialogItem?.body || ''}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: { xs: 1.5, sm: 3 }, py: { xs: 1.5, sm: 2 }, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 0 } }}>
          <Button onClick={() => setDialogKey(null)} fullWidth={window.innerWidth < 600}>Cancel</Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => dialogKey && ackMutation.mutate(dialogKey)}
            disabled={ackMutation.isPending}
            startIcon={ackMutation.isPending ? <CircularProgress size={16} /> : <GavelIcon />}
            fullWidth={window.innerWidth < 600}
          >
            {ackMutation.isPending ? 'Saving...' : 'I Have Read and Agree'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PlayerComplianceCard;
