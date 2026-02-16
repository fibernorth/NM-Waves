import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  FormControlLabel,
  Checkbox,
  Alert,
  Divider,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getSponsorByUserId, getPlayerFinanceSummary } from '@/lib/api/sponsorPortal';
import PlayerSearchAutocomplete from '@/components/common/PlayerSearchAutocomplete';
import StripeCheckoutButton from '@/components/common/StripeCheckoutButton';

const SponsorPayPlayerPage = () => {
  const { user } = useAuthStore();

  const [selectedPlayer, setSelectedPlayer] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    fullName: string;
    teamName?: string;
  } | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const { data: sponsor } = useQuery({
    queryKey: ['sponsor', 'self', user?.uid],
    queryFn: () => getSponsorByUserId(user!.uid),
    enabled: !!user?.uid,
  });

  const { data: financeSummary, isLoading: loadingFinance } = useQuery({
    queryKey: ['playerFinanceSummary', selectedPlayer?.id],
    queryFn: () => getPlayerFinanceSummary(selectedPlayer!.id),
    enabled: !!selectedPlayer?.id,
  });

  const parsedAmount = parseFloat(amount) || 0;
  const canPay = selectedPlayer && parsedAmount >= 0.5 && financeSummary?.financeId;

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Sponsor a Player
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Search for a player by name, choose an amount, and complete payment via card.
      </Typography>

      <Grid container spacing={3}>
        {/* Player Search */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              1. Find a Player
            </Typography>
            <PlayerSearchAutocomplete
              onSelect={(player) => {
                setSelectedPlayer(player);
                setAmount('');
              }}
              value={selectedPlayer}
              label="Search by player name"
              placeholder="Start typing a name..."
            />

            {selectedPlayer && financeSummary && (
              <Card variant="outlined" sx={{ mt: 2 }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {financeSummary.playerName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {financeSummary.teamName} &bull; {financeSummary.season}
                  </Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Typography variant="body2">
                    Balance Due:{' '}
                    <Typography component="span" fontWeight={700} color={financeSummary.balanceDue > 0 ? 'error.main' : 'success.main'}>
                      ${financeSummary.balanceDue.toFixed(2)}
                    </Typography>
                  </Typography>
                </CardContent>
              </Card>
            )}

            {selectedPlayer && !financeSummary && !loadingFinance && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No financial record found for this player.
              </Alert>
            )}
          </Paper>

          {selectedPlayer && financeSummary && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                2. Payment Amount
              </Typography>
              <TextField
                label="Amount to Sponsor"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                fullWidth
                InputProps={{ startAdornment: '$' }}
                inputProps={{ step: '0.01', min: '0.50' }}
                helperText={
                  financeSummary.balanceDue > 0
                    ? `Player's balance due: $${financeSummary.balanceDue.toFixed(2)}`
                    : 'Player is currently paid in full'
                }
                sx={{ mb: 2 }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                  />
                }
                label="Keep my identity private from the player and their family"
              />
              {isAnonymous && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  Your payment will be recorded as "Anonymous Sponsor". Only club administrators
                  will be able to see your identity.
                </Alert>
              )}
            </Paper>
          )}

          {canPay && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                3. Complete Payment
              </Typography>
              <Alert severity="info" sx={{ mb: 2 }}>
                Note: A small processing fee (2.9% + $0.30) applies to card payments and will be
                reflected in the club's accounting.
              </Alert>
              <StripeCheckoutButton
                financeId={financeSummary!.financeId}
                playerId={selectedPlayer!.id}
                amount={parsedAmount}
                sponsorId={sponsor?.id}
                isAnonymous={isAnonymous}
                label={`Pay $${parsedAmount.toFixed(2)} via Card`}
                fullWidth
              />
            </Paper>
          )}
        </Grid>

        {/* Sidebar Info */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              How It Works
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              1. Search for the player you'd like to sponsor
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              2. Enter the amount you'd like to contribute
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              3. Optionally choose to remain anonymous
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              4. Complete payment securely via Stripe
            </Typography>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary">
              Your payment will be applied directly to the player's account balance.
              A receipt will be sent to your email address.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SponsorPayPlayerPage;
