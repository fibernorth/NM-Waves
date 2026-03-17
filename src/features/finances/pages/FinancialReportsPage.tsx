import { useState, useMemo, useCallback } from 'react';
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
  Alert,
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
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import toast from 'react-hot-toast';

const currentYear = new Date().getFullYear();
const seasonOptions: string[] = [];
for (let y = currentYear; y >= currentYear - 3; y--) {
  seasonOptions.push(y.toString());
  seasonOptions.push(`${y - 1}-${y}`);
}

const FinancialReportsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [selectedSeason, setSelectedSeason] = useState<string>(currentYear.toString());
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>(undefined);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const { data: report, isError: reportError } = useQuery({
    queryKey: ['financialReport', selectedSeason, selectedTeam],
    queryFn: () => reportsApi.generateSummary(selectedSeason, selectedTeam),
    enabled: !!selectedSeason,
  });

  // Fetch ALL playerFinances – the season stored in Firestore uses
  // the team-style "2025-2026" format, not a plain year like "2026".
  // Filter client-side so we can match on either format.
  const { data: allPlayerFinances = [] } = useQuery({
    queryKey: ['playerFinances'],
    queryFn: () => playerFinancesApi.getAll(),
  });

  const playerFinances = useMemo(() => {
    if (!selectedSeason) return allPlayerFinances;
    return allPlayerFinances.filter(pf => {
      const s = pf.season || '';
      // Match plain year "2026" against "2025-2026" or exact "2026"
      return s === selectedSeason || s.endsWith(`-${selectedSeason}`) || s.startsWith(`${selectedSeason}-`);
    });
  }, [allPlayerFinances, selectedSeason]);

  const outstandingReceivables = useMemo(() => {
    const filtered = selectedTeam
      ? playerFinances.filter(pf => pf.teamId === selectedTeam)
      : playerFinances;
    return filtered.reduce(
      (sum, pf) => sum + Math.max(0, pf.balanceDue ?? (pf.totalOwed - pf.totalPaid)),
      0
    );
  }, [playerFinances, selectedTeam]);

  // ---------------------------------------------------------------------------
  // Print handler
  // ---------------------------------------------------------------------------

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // ---------------------------------------------------------------------------
  // CSV Export handler
  // ---------------------------------------------------------------------------

  const handleExportCSV = useCallback(() => {
    if (!report) {
      toast.error('No report data to export');
      return;
    }

    const teamName = selectedTeam
      ? teams.find(t => t.id === selectedTeam)?.name || 'Team'
      : 'Organization-wide';

    const rows: string[][] = [
      ['Financial Report'],
      [`Season: ${selectedSeason}`, `Scope: ${teamName}`],
      [],
      ['Category', 'Amount'],
      [],
      ['INCOME'],
      ['Player Payments', `$${report.income.playerPayments.toFixed(2)}`],
      ['Sponsorships', `$${report.income.sponsorships.toFixed(2)}`],
      ['Fundraisers', `$${report.income.fundraisers.toFixed(2)}`],
      ['Donations', `$${report.income.donations.toFixed(2)}`],
      ['Grants', `$${report.income.grants.toFixed(2)}`],
      ['Merchandise', `$${report.income.merchandise.toFixed(2)}`],
      ['Concessions', `$${report.income.concessions.toFixed(2)}`],
      ['Other Income', `$${report.income.other.toFixed(2)}`],
      ['Total Income', `$${report.income.total.toFixed(2)}`],
      [],
      ['EXPENSES'],
      ['Facilities', `$${report.expenses.facilities.toFixed(2)}`],
      ['Equipment', `$${report.expenses.equipment.toFixed(2)}`],
      ['Uniforms', `$${report.expenses.uniforms.toFixed(2)}`],
      ['Tournaments', `$${report.expenses.tournaments.toFixed(2)}`],
      ['Travel', `$${report.expenses.travel.toFixed(2)}`],
      ['Insurance', `$${report.expenses.insurance.toFixed(2)}`],
      ['League Fees', `$${report.expenses.leagueFees.toFixed(2)}`],
      ['Coaching', `$${report.expenses.coaching.toFixed(2)}`],
      ['Administrative', `$${report.expenses.administrative.toFixed(2)}`],
      ['Processing Fees', `$${report.expenses.processingFees.toFixed(2)}`],
      ['Marketing', `$${report.expenses.marketing.toFixed(2)}`],
      ['Fundraising', `$${report.expenses.fundraising.toFixed(2)}`],
      ['Maintenance', `$${report.expenses.maintenance.toFixed(2)}`],
      ['Other Expenses', `$${report.expenses.other.toFixed(2)}`],
      ['Total Expenses', `$${report.expenses.total.toFixed(2)}`],
      [],
      ['NET INCOME', `$${report.netIncome.toFixed(2)}`],
      [],
      ['Outstanding Payables', `$${report.outstandingPayables.toFixed(2)}`],
      ['Outstanding Receivables', `$${outstandingReceivables.toFixed(2)}`],
    ];

    const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `financial-report-${selectedSeason.replace(/\s+/g, '-')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('CSV exported successfully');
  }, [report, selectedSeason, selectedTeam, teams, outstandingReceivables]);

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
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
            Print
          </Button>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCSV}>
            Export CSV
          </Button>
        </Box>
      </Box>

      {reportError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load financial report data. Please try again or select a different season.
        </Alert>
      )}

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
              {seasonOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
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
                <TableCell align="right">${(report?.income.playerPayments ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Sponsorships</TableCell>
                <TableCell align="right">${(report?.income.sponsorships ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Fundraisers</TableCell>
                <TableCell align="right">${(report?.income.fundraisers ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Donations</TableCell>
                <TableCell align="right">${(report?.income.donations ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Grants</TableCell>
                <TableCell align="right">${(report?.income.grants ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Merchandise</TableCell>
                <TableCell align="right">${(report?.income.merchandise ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Concessions</TableCell>
                <TableCell align="right">${(report?.income.concessions ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Other</TableCell>
                <TableCell align="right">${(report?.income.other ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: 'success.light' }}>
                <TableCell><strong>Total Income</strong></TableCell>
                <TableCell align="right">
                  <strong>${(report?.income.total ?? 0).toFixed(2)}</strong>
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
                <TableCell align="right">${(report?.expenses.facilities ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Equipment</TableCell>
                <TableCell align="right">${(report?.expenses.equipment ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Uniforms</TableCell>
                <TableCell align="right">${(report?.expenses.uniforms ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Tournaments</TableCell>
                <TableCell align="right">${(report?.expenses.tournaments ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Travel</TableCell>
                <TableCell align="right">${(report?.expenses.travel ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Insurance</TableCell>
                <TableCell align="right">${(report?.expenses.insurance ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>League Fees</TableCell>
                <TableCell align="right">${(report?.expenses.leagueFees ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Coaching</TableCell>
                <TableCell align="right">${(report?.expenses.coaching ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Administrative</TableCell>
                <TableCell align="right">${(report?.expenses.administrative ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Processing Fees</TableCell>
                <TableCell align="right">${(report?.expenses.processingFees ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Marketing</TableCell>
                <TableCell align="right">${(report?.expenses.marketing ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Fundraising</TableCell>
                <TableCell align="right">${(report?.expenses.fundraising ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Maintenance</TableCell>
                <TableCell align="right">${(report?.expenses.maintenance ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={{ pl: 4 }}>Other</TableCell>
                <TableCell align="right">${(report?.expenses.other ?? 0).toFixed(2)}</TableCell>
              </TableRow>
              <TableRow sx={{ bgcolor: 'error.light' }}>
                <TableCell><strong>Total Expenses</strong></TableCell>
                <TableCell align="right">
                  <strong>${(report?.expenses.total ?? 0).toFixed(2)}</strong>
                </TableCell>
              </TableRow>

              {/* Divider */}
              <TableRow>
                <TableCell colSpan={2}><Divider sx={{ my: 2 }} /></TableCell>
              </TableRow>

              {/* Net Income */}
              <TableRow sx={{ bgcolor: (report?.netIncome ?? 0) >= 0 ? 'success.main' : 'error.main' }}>
                <TableCell>
                  <Typography variant="h6" sx={{ color: 'white' }}>
                    NET INCOME
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="h6" sx={{ color: 'white' }}>
                    ${(report?.netIncome ?? 0).toFixed(2)}
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
