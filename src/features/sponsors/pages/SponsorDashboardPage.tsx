import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
} from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import PeopleIcon from '@mui/icons-material/People';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HistoryIcon from '@mui/icons-material/History';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getSponsorByUserId } from '@/lib/api/sponsorPortal';
import { format } from 'date-fns';

const SponsorDashboardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: sponsor, isLoading } = useQuery({
    queryKey: ['sponsor', 'self', user?.uid],
    queryFn: () => getSponsorByUserId(user!.uid),
    enabled: !!user?.uid,
  });

  const stats = useMemo(() => {
    if (!sponsor) return { totalSponsored: 0, playersSponsored: 0, lastPayment: null };

    const players = sponsor.sponsoredPlayers || [];
    const uniquePlayers = new Set(players.map((p) => p.playerId)).size;
    const lastPayment = players.length > 0
      ? players.reduce((latest, p) => (p.date > latest.date ? p : latest))
      : null;

    return {
      totalSponsored: sponsor.totalSponsored || players.reduce((sum, p) => sum + p.amount, 0),
      playersSponsored: uniquePlayers,
      lastPayment,
    };
  }, [sponsor]);

  if (isLoading) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Welcome{sponsor ? `, ${sponsor.businessName}` : ''}!
      </Typography>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <AttachMoneyIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">Total Sponsored</Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                ${stats.totalSponsored.toFixed(2)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <PeopleIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">Players Sponsored</Typography>
              </Box>
              <Typography variant="h4">{stats.playersSponsored}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <HistoryIcon color="info" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">Last Payment</Typography>
              </Box>
              <Typography variant="h6">
                {stats.lastPayment
                  ? `$${stats.lastPayment.amount.toFixed(2)} on ${format(stats.lastPayment.date, 'MMM d, yyyy')}`
                  : 'No payments yet'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6}>
          <Button
            variant="contained"
            size="large"
            fullWidth
            startIcon={<PaymentIcon />}
            onClick={() => navigate('/sponsor/pay')}
            sx={{ py: 2 }}
          >
            Sponsor a Player
          </Button>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Button
            variant="outlined"
            size="large"
            fullWidth
            startIcon={<HistoryIcon />}
            onClick={() => navigate('/sponsor/history')}
            sx={{ py: 2 }}
          >
            View Payment History
          </Button>
        </Grid>
      </Grid>

      {/* Recent Activity */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Recent Sponsored Players
        </Typography>
        {(sponsor?.sponsoredPlayers || []).length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            You haven't sponsored any players yet. Click "Sponsor a Player" to get started!
          </Typography>
        ) : (
          <List>
            {(sponsor?.sponsoredPlayers || [])
              .slice()
              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
              .slice(0, 5)
              .map((sp, index) => (
                <Box key={index}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={sp.playerName}
                      secondary={format(new Date(sp.date), 'MMMM d, yyyy')}
                    />
                    <Chip
                      label={`$${sp.amount.toFixed(2)}`}
                      color="success"
                      variant="outlined"
                    />
                  </ListItem>
                </Box>
              ))}
          </List>
        )}
      </Paper>
    </Box>
  );
};

export default SponsorDashboardPage;
