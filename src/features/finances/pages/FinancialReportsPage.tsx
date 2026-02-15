import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  MenuItem,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Button,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api/accounting';
import { playerFinancesApi } from '@/lib/api/finances';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';

const FinancialReportsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [selectedSeason, setSelectedSeason] = useState<string>('2024 Summer');
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>(undefined);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const { data: report } = useQuery({
    queryKey: ['financialReport', selectedSeason, selectedTeam],
    queryFn: () => reportsApi.generateSummary(selectedSeason, selectedTeam),
    enabled: !!selectedSeason,
  });

  const { data: playerFinances = [] } = useQuery({
    queryKey: ['playerFinances', selectedSeason],
    queryFn: () => playerFinancesApi.getBySeason(selectedSeason),
    enabled: !!selectedSeason,
  });

  const outstandingReceivables = useMemo(() => {
    return playerFinances
      .filter(pf => pf.balance < 0)
      .reduce((sum, pf) => sum + Math.abs(pf.balance), 0);
  }, [playerFinances]);

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Financial Reports
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view financial reports.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Financial Reports</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PrintIcon />}>
            Print
          </Button>
          <Button variant="outlined" startIcon={<DownloadIcon />}>
            Export PDF
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Season"
              select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              fullWidth
            >
              <MenuItem value="2024 Spring">2024 Spring</MenuItem>
              <MenuItem value="2024 Summer">2024 Summer</MenuItem>
              <MenuItem value="2024 Fall">2024 Fall</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Team"
              select
              value={selectedTeam || 'all'}
              onChange={(e) => setSelectedTeam(e.target.value === 'all' ? undefined : e.target.value)}
              fullWidth
            >
              <MenuItem value="all">All Teams (Organization-wide)</MenuItem>
              {teams.map((team) => (
                <MenuItem key={team.id} value={team.id}>
                  {team.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
        </Grid>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingUpIcon color="success" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Total Income
                </Typography>
              </Box>
              <Typography variant="h4" color="success.main">
                ${report?.income.total.toFixed(2) || '0.00'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <TrendingDownIcon color="error" sx={{ mr: 1 }} />
                <Typography variant="body2" color="text.secondary">
                  Total Expenses
                </Typography>
              </Box>
              <Typography variant="h4" color="error.main">
                ${report?.expenses.total.toFixed(2) || '0.00'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Net Income
              </Typography>
              <Typography
                variant="h4"
                sx={{
                  color: (report?.netIncome || 0) >= 0 ? 'success.main' : 'error.main',
                }}
              >
                ${report?.netIncome.toFixed(2) || '0.00'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {(report?.netIncome || 0) >= 0 ? 'Surplus' : 'Deficit'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Cash Flow Summary */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Cash Flow Summary
        </Typography>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          Cash-basis: counts income when received, expenses when paid
        </Typography>
        <TableContainer sx={{ mt: 2 }}>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Cash In (Total Income Received)</TableCell>
                <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>
                  ${report?.income.total.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Cash Out (Total Expenses Paid)</TableCell>
                <TableCell align="right" sx={{ color: 'error.main', fontWeight: 600 }}>
                  ${report?.expenses.total.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 700 }}>Net Cash Flow</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: (report?.netIncome || 0) >= 0 ? 'success.main' : 'error.main' }}>
                  ${report?.netIncome.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Outstanding Receivables (Player Balances)</TableCell>
                <TableCell align="right" sx={{ color: 'info.main', fontWeight: 600 }}>
                  ${outstandingReceivables.toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Outstanding Payables (Unpaid Expenses)</TableCell>
                <TableCell align="right" sx={{ color: 'warning.main', fontWeight: 600 }}>
                  ${report?.outstandingPayables.toFixed(2) || '0.00'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Income Statement (P&L) */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Income Statement (Profit & Loss)
        </Typography>
        <Typography variant="caption" color="text.secondary" gutterBottom>
          {selectedSeason} {selectedTeam ? `- ${teams.find(t => t.id === selectedTeam)?.name}` : '- Organization-wide'}
        </Typography>

        <TableContainer sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell><strong>Category</strong></TableCell>
                <TableCell align="right"><strong>Amount</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Income Section */}
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'success.main' }}>
                    INCOME
                  </Typography>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Player Payments</TableCell>
                <TableCell align="right">${report?.income.playerPayments.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Sponsorships</TableCell>
                <TableCell align="right">${report?.income.sponsorships.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Fundraisers</TableCell>
                <TableCell align="right">${report?.income.fundraisers.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Donations</TableCell>
                <TableCell align="right">${report?.income.donations.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Grants</TableCell>
                <TableCell align="right">${report?.income.grants.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Merchandise</TableCell>
                <TableCell align="right">${report?.income.merchandise.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Concessions</TableCell>
                <TableCell align="right">${report?.income.concessions.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Other</TableCell>
                <TableCell align="right">${report?.income.other.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: 'success.light' }}>
                <TableCell><strong>Total Income</strong></TableCell>
                <TableCell align="right">
                  <strong>${report?.income.total.toFixed(2)}</strong>
                </TableCell>
              </TableRow>

              {/* Divider */}
              <TableRow>
                <TableCell colSpan={2}><Divider sx={{ my: 1 }} /></TableCell>
              </TableRow>

              {/* Expenses Section */}
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'error.main' }}>
                    EXPENSES
                  </Typography>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Facilities</TableCell>
                <TableCell align="right">${report?.expenses.facilities.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Equipment</TableCell>
                <TableCell align="right">${report?.expenses.equipment.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Uniforms</TableCell>
                <TableCell align="right">${report?.expenses.uniforms.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Tournaments</TableCell>
                <TableCell align="right">${report?.expenses.tournaments.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Travel</TableCell>
                <TableCell align="right">${report?.expenses.travel.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Insurance</TableCell>
                <TableCell align="right">${report?.expenses.insurance.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>League Fees</TableCell>
                <TableCell align="right">${report?.expenses.leagueFees.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Coaching</TableCell>
                <TableCell align="right">${report?.expenses.coaching.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Administrative</TableCell>
                <TableCell align="right">${report?.expenses.administrative.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Marketing</TableCell>
                <TableCell align="right">${report?.expenses.marketing.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Fundraising</TableCell>
                <TableCell align="right">${report?.expenses.fundraising.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Maintenance</TableCell>
                <TableCell align="right">${report?.expenses.maintenance.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Other</TableCell>
                <TableCell align="right">${report?.expenses.other.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: 'error.light' }}>
                <TableCell><strong>Total Expenses</strong></TableCell>
                <TableCell align="right">
                  <strong>${report?.expenses.total.toFixed(2)}</strong>
                </TableCell>
              </TableRow>

              {/* Divider */}
              <TableRow>
                <TableCell colSpan={2}><Divider sx={{ my: 2 }} /></TableCell>
              </TableRow>

              {/* Net Income */}
              <TableRow sx={{ bgcolor: report && report.netIncome >= 0 ? 'success.main' : 'error.main' }}>
                <TableCell>
                  <Typography variant="h6" sx={{ color: 'white' }}>
                    NET INCOME
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="h6" sx={{ color: 'white' }}>
                    ${report?.netIncome.toFixed(2)}
                  </Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Outstanding Items */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="warning.main">
              Outstanding Payables
            </Typography>
            <Typography variant="h4">${report?.outstandingPayables.toFixed(2) || '0.00'}</Typography>
            <Typography variant="caption" color="text.secondary">
              Unpaid expenses
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="info.main">
              Outstanding Receivables
            </Typography>
            <Typography variant="h4">${outstandingReceivables.toFixed(2)}</Typography>
            <Typography variant="caption" color="text.secondary">
              Unpaid player balances
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default FinancialReportsPage;
