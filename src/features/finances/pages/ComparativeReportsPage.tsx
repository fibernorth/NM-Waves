import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
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
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { reportsApi } from '@/lib/api/accounting';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { downloadCSV, fmtCurrencyCSV } from '@/lib/utils/exportReports';
import type { FinancialSummary } from '@/types/models';

const currentYear = new Date().getFullYear();
const seasonOptions: string[] = [];
for (let y = currentYear; y >= currentYear - 3; y--) {
  seasonOptions.push(y.toString());
  seasonOptions.push(`${y - 1}-${y}`);
}

const fmtCurrency = (val: number) =>
  val === 0
    ? '--'
    : `${val < 0 ? '(' : ''}$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${val < 0 ? ')' : ''}`;

/**
 * Derive the prior season string.
 * "2026" -> "2025", "2025-2026" -> "2024-2025"
 */
function getPriorSeason(season: string): string {
  if (season.includes('-')) {
    const [start, end] = season.split('-').map(Number);
    return `${start - 1}-${end - 1}`;
  }
  return String(Number(season) - 1);
}

/**
 * Compute dollar change and percentage change.
 * Positive = favorable for revenue / unfavorable for expenses; caller decides color.
 */
function computeChange(current: number, prior: number): { dollar: number; percent: number | null } {
  const dollar = current - prior;
  const percent = prior !== 0 ? ((current - prior) / Math.abs(prior)) * 100 : null;
  return { dollar, percent };
}

/** Row type for the comparison table */
interface ComparisonRow {
  label: string;
  current: number;
  prior: number;
  dollarChange: number;
  percentChange: number | null;
  /** true when an increase is considered "good" (revenue rows) */
  increaseIsFavorable: boolean;
  isBold?: boolean;
  isSectionHeader?: boolean;
}

function buildRows(
  currentReport: FinancialSummary | undefined,
  priorReport: FinancialSummary | undefined,
): ComparisonRow[] {
  const c = currentReport;
  const p = priorReport;

  const row = (
    label: string,
    getCurrent: (r: FinancialSummary) => number,
    increaseIsFavorable: boolean,
    isBold = false,
  ): ComparisonRow => {
    const cv = c ? getCurrent(c) : 0;
    const pv = p ? getCurrent(p) : 0;
    const { dollar, percent } = computeChange(cv, pv);
    return { label, current: cv, prior: pv, dollarChange: dollar, percentChange: percent, increaseIsFavorable, isBold };
  };

  const sectionHeader = (label: string): ComparisonRow => ({
    label,
    current: 0,
    prior: 0,
    dollarChange: 0,
    percentChange: null,
    increaseIsFavorable: true,
    isSectionHeader: true,
  });

  return [
    sectionHeader('REVENUE'),
    row('Player Payments', r => r.income.playerPayments, true),
    row('Sponsorships', r => r.income.sponsorships, true),
    row('Fundraisers', r => r.income.fundraisers, true),
    row('Donations', r => r.income.donations, true),
    row('Grants', r => r.income.grants, true),
    row('Merchandise', r => r.income.merchandise, true),
    row('Concessions', r => r.income.concessions, true),
    row('Other Income', r => r.income.other, true),
    row('Total Revenue', r => r.income.total, true, true),

    sectionHeader('EXPENSES'),
    row('Facilities', r => r.expenses.facilities, false),
    row('Equipment', r => r.expenses.equipment, false),
    row('Uniforms', r => r.expenses.uniforms, false),
    row('Tournaments', r => r.expenses.tournaments, false),
    row('Travel', r => r.expenses.travel, false),
    row('Insurance', r => r.expenses.insurance, false),
    row('League Fees', r => r.expenses.leagueFees, false),
    row('Coaching', r => r.expenses.coaching, false),
    row('Administrative', r => r.expenses.administrative, false),
    row('Processing Fees', r => r.expenses.processingFees, false),
    row('Marketing', r => r.expenses.marketing, false),
    row('Fundraising', r => r.expenses.fundraising, false),
    row('Maintenance', r => r.expenses.maintenance, false),
    row('Other Expenses', r => r.expenses.other, false),
    row('Total Expenses', r => r.expenses.total, false, true),

    sectionHeader(''),
    row('NET INCOME', r => r.netIncome, true, true),
  ];
}

const ComparativeReportsPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [selectedSeason, setSelectedSeason] = useState<string>(currentYear.toString());

  const priorSeason = useMemo(() => getPriorSeason(selectedSeason), [selectedSeason]);

  // Fetch current season report
  const { data: currentReport, isLoading: currentLoading, isError: currentError } = useQuery({
    queryKey: ['financialReport', selectedSeason],
    queryFn: () => reportsApi.generateSummary(selectedSeason),
    enabled: !!selectedSeason,
  });

  // Fetch prior season report
  const { data: priorReport, isLoading: priorLoading, isError: priorError } = useQuery({
    queryKey: ['financialReport', priorSeason],
    queryFn: () => reportsApi.generateSummary(priorSeason),
    enabled: !!priorSeason,
  });

  const isLoading = currentLoading || priorLoading;
  const isError = currentError || priorError;

  const rows = useMemo(
    () => buildRows(currentReport, priorReport),
    [currentReport, priorReport],
  );

  /**
   * Determine color for change cells.
   * Favorable changes are green, unfavorable changes are red.
   * For revenue: increase = favorable. For expenses: increase = unfavorable.
   */
  const changeColor = (row: ComparisonRow): string => {
    if (row.dollarChange === 0) return 'text.secondary';
    const isFavorable = row.increaseIsFavorable
      ? row.dollarChange > 0
      : row.dollarChange < 0;
    return isFavorable ? 'success.main' : 'error.main';
  };

  const handleExportCSV = useCallback(() => {
    if (!currentReport) return;
    const headers = [
      'Category',
      `${selectedSeason} (Current)`,
      `${priorSeason} (Prior)`,
      '$ Change',
      '% Change',
    ];
    const csvRows: (string | number)[][] = rows
      .filter(r => !r.isSectionHeader)
      .map(r => [
        r.label,
        fmtCurrencyCSV(r.current),
        fmtCurrencyCSV(r.prior),
        r.dollarChange < 0 ? `-${fmtCurrencyCSV(r.dollarChange)}` : fmtCurrencyCSV(r.dollarChange),
        r.percentChange !== null ? `${r.percentChange.toFixed(1)}%` : 'N/A',
      ]);
    downloadCSV(`comparative-report-${selectedSeason}-vs-${priorSeason}.csv`, headers, csvRows);
  }, [currentReport, rows, selectedSeason, priorSeason]);

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Comparative Financial Report</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  // Net income summaries for the cards
  const currentNetIncome = currentReport?.netIncome ?? 0;
  const priorNetIncome = priorReport?.netIncome ?? 0;
  const netIncomeChange = computeChange(currentNetIncome, priorNetIncome);

  const currentRevenue = currentReport?.income.total ?? 0;
  const priorRevenue = priorReport?.income.total ?? 0;
  const revenueChange = computeChange(currentRevenue, priorRevenue);

  const currentExpenses = currentReport?.expenses.total ?? 0;
  const priorExpenses = priorReport?.expenses.total ?? 0;
  const expensesChange = computeChange(currentExpenses, priorExpenses);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Comparative Financial Report</Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedSeason} vs {priorSeason}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Print
          </Button>
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExportCSV}
            disabled={!currentReport}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* Season Selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4}>
            <TextField
              label="Current Season"
              select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(e.target.value)}
              fullWidth
              size="small"
            >
              {seasonOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              label="Prior Season (auto)"
              value={priorSeason}
              disabled
              fullWidth
              size="small"
            />
          </Grid>
        </Grid>
      </Paper>

      {isLoading && (
        <Alert severity="info">Loading comparative report data...</Alert>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load report data. Please try again or select a different season.
        </Alert>
      )}

      {!isLoading && !isError && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingUpIcon color="success" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
                  </Box>
                  <Typography variant="h5" color="success.main">{fmtCurrency(currentRevenue)}</Typography>
                  <Typography
                    variant="caption"
                    color={revenueChange.dollar >= 0 ? 'success.main' : 'error.main'}
                  >
                    {revenueChange.dollar >= 0 ? '+' : ''}{fmtCurrency(revenueChange.dollar)}
                    {revenueChange.percent !== null && ` (${revenueChange.percent >= 0 ? '+' : ''}${revenueChange.percent.toFixed(1)}%)`}
                    {' '}vs prior
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <TrendingDownIcon color="error" sx={{ mr: 1 }} />
                    <Typography variant="body2" color="text.secondary">Total Expenses</Typography>
                  </Box>
                  <Typography variant="h5" color="error.main">{fmtCurrency(currentExpenses)}</Typography>
                  <Typography
                    variant="caption"
                    color={expensesChange.dollar <= 0 ? 'success.main' : 'error.main'}
                  >
                    {expensesChange.dollar >= 0 ? '+' : ''}{fmtCurrency(expensesChange.dollar)}
                    {expensesChange.percent !== null && ` (${expensesChange.percent >= 0 ? '+' : ''}${expensesChange.percent.toFixed(1)}%)`}
                    {' '}vs prior
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" gutterBottom>Net Income</Typography>
                  <Typography
                    variant="h5"
                    color={currentNetIncome >= 0 ? 'success.main' : 'error.main'}
                  >
                    {fmtCurrency(currentNetIncome)}
                  </Typography>
                  <Typography
                    variant="caption"
                    color={netIncomeChange.dollar >= 0 ? 'success.main' : 'error.main'}
                  >
                    {netIncomeChange.dollar >= 0 ? '+' : ''}{fmtCurrency(netIncomeChange.dollar)}
                    {netIncomeChange.percent !== null && ` (${netIncomeChange.percent >= 0 ? '+' : ''}${netIncomeChange.percent.toFixed(1)}%)`}
                    {' '}vs prior
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Comparison Table */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Period-over-Period Comparison
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Category</strong></TableCell>
                    <TableCell align="right"><strong>{selectedSeason}</strong></TableCell>
                    <TableCell align="right"><strong>{priorSeason}</strong></TableCell>
                    <TableCell align="right"><strong>$ Change</strong></TableCell>
                    <TableCell align="right"><strong>% Change</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, idx) => {
                    // Section headers
                    if (row.isSectionHeader) {
                      if (!row.label) {
                        return (
                          <TableRow key={idx}>
                            <TableCell colSpan={5}><Divider sx={{ my: 1 }} /></TableCell>
                          </TableRow>
                        );
                      }
                      return (
                        <TableRow key={idx}>
                          <TableCell colSpan={5}>
                            <Typography
                              variant="subtitle1"
                              sx={{
                                fontWeight: 'bold',
                                color: row.label === 'REVENUE' ? 'success.main' : 'error.main',
                              }}
                            >
                              {row.label}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    }

                    const isTotal = row.isBold;
                    const isNetIncome = row.label === 'NET INCOME';

                    return (
                      <TableRow
                        key={idx}
                        sx={{
                          ...(isNetIncome && {
                            bgcolor: currentNetIncome >= 0 ? 'success.main' : 'error.main',
                          }),
                          ...(isTotal && !isNetIncome && { bgcolor: 'action.hover' }),
                        }}
                      >
                        <TableCell sx={{ ...(!isTotal && { pl: 4 }) }}>
                          <Typography
                            fontWeight={isTotal ? 700 : 400}
                            sx={isNetIncome ? { color: 'white' } : undefined}
                            variant={isNetIncome ? 'h6' : 'body2'}
                          >
                            {row.label}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            fontWeight={isTotal ? 700 : 400}
                            variant="body2"
                            sx={isNetIncome ? { color: 'white' } : undefined}
                          >
                            {fmtCurrency(row.current)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            fontWeight={isTotal ? 700 : 400}
                            variant="body2"
                            sx={isNetIncome ? { color: 'white' } : undefined}
                          >
                            {fmtCurrency(row.prior)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            fontWeight={isTotal ? 700 : 400}
                            variant="body2"
                            sx={{ color: isNetIncome ? 'white' : changeColor(row) }}
                          >
                            {row.dollarChange === 0
                              ? '--'
                              : `${row.dollarChange > 0 ? '+' : ''}${fmtCurrency(row.dollarChange)}`}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            fontWeight={isTotal ? 700 : 400}
                            variant="body2"
                            sx={{ color: isNetIncome ? 'white' : changeColor(row) }}
                          >
                            {row.percentChange === null
                              ? 'N/A'
                              : row.percentChange === 0
                                ? '--'
                                : `${row.percentChange > 0 ? '+' : ''}${row.percentChange.toFixed(1)}%`}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default ComparativeReportsPage;
