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
  Button,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { expensesApi, matchesSeason } from '@/lib/api/accounting';
import { chartOfAccountsApi, EXPENSE_CATEGORY_TO_ACCOUNT } from '@/lib/api/chartOfAccounts';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { downloadCSV, fmtCurrencyCSV } from '@/lib/utils/exportReports';
import type { ChartOfAccount, ExpenseCategory } from '@/types/models';

const currentYear = new Date().getFullYear();
const seasonOptions: string[] = [];
for (let y = currentYear; y >= currentYear - 3; y--) {
  seasonOptions.push(y.toString());
  seasonOptions.push(`${y - 1}-${y}`);
}

const fmtCurrency = (val: number) =>
  val === 0 ? '--' : `$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Human-readable labels for expense categories */
const CATEGORY_LABELS: Record<string, string> = {
  facilities: 'Facilities',
  equipment: 'Equipment',
  uniforms: 'Uniforms',
  tournaments: 'Tournaments',
  travel: 'Travel',
  insurance: 'Insurance',
  league_fees: 'League Fees',
  coaching: 'Coaching',
  administrative: 'Administrative',
  processing_fees: 'Processing Fees',
  marketing: 'Marketing',
  fundraising: 'Fundraising',
  maintenance: 'Maintenance',
  other: 'Other',
};

type FunctionalColumn = 'program' | 'admin' | 'fundraising';

/**
 * Determine functional classification from the chart of accounts subtype.
 * Falls back to account number range if subtype lookup fails.
 */
function getFunctionalClass(
  category: ExpenseCategory,
  accountMap: Map<string, ChartOfAccount>,
): FunctionalColumn {
  const acctNum = EXPENSE_CATEGORY_TO_ACCOUNT[category];
  if (acctNum) {
    const acct = accountMap.get(acctNum);
    if (acct) {
      switch (acct.subtype) {
        case 'program_expense':
          return 'program';
        case 'admin_expense':
          return 'admin';
        case 'fundraising_expense':
          return 'fundraising';
        case 'other_expense':
          return 'program'; // Default: other into program
      }
    }
    // Fallback by account number range
    const num = parseInt(acctNum, 10);
    if (num >= 5000 && num <= 5899) return 'program';
    if (num >= 6000 && num <= 6199) return 'admin';
    if (num >= 7000 && num <= 7999) return 'fundraising';
  }
  return 'program';
}

interface FunctionalRow {
  category: string;
  label: string;
  program: number;
  admin: number;
  fundraising: number;
  total: number;
}

const FunctionalExpensesPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [selectedSeason, setSelectedSeason] = useState<string>(currentYear.toString());

  const { data: expenses = [], isLoading: expensesLoading, isError: expensesError } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => expensesApi.getAll(),
  });

  const { data: accounts = [], isLoading: accountsLoading, isError: accountsError } = useQuery({
    queryKey: ['chartOfAccounts'],
    queryFn: () => chartOfAccountsApi.getAll(),
  });

  const isLoading = expensesLoading || accountsLoading;
  const isError = expensesError || accountsError;

  const accountMap = useMemo(() => {
    const map = new Map<string, ChartOfAccount>();
    for (const a of accounts) {
      map.set(a.accountNumber, a);
    }
    return map;
  }, [accounts]);

  const filteredExpenses = useMemo(() => {
    if (!selectedSeason) return expenses;
    return expenses.filter(e => matchesSeason(e.season, selectedSeason));
  }, [expenses, selectedSeason]);

  const rows = useMemo((): FunctionalRow[] => {
    // Aggregate by category
    const catTotals = new Map<string, number>();
    for (const exp of filteredExpenses) {
      const cat = exp.category || 'other';
      catTotals.set(cat, (catTotals.get(cat) || 0) + exp.amount);
    }

    const result: FunctionalRow[] = [];
    for (const [cat, total] of catTotals) {
      if (total === 0) continue;
      const col = getFunctionalClass(cat as ExpenseCategory, accountMap);
      result.push({
        category: cat,
        label: CATEGORY_LABELS[cat] || cat,
        program: col === 'program' ? total : 0,
        admin: col === 'admin' ? total : 0,
        fundraising: col === 'fundraising' ? total : 0,
        total,
      });
    }

    // Sort by label
    result.sort((a, b) => a.label.localeCompare(b.label));
    return result;
  }, [filteredExpenses, accountMap]);

  const totals = useMemo(() => {
    const t = { program: 0, admin: 0, fundraising: 0, total: 0 };
    for (const r of rows) {
      t.program += r.program;
      t.admin += r.admin;
      t.fundraising += r.fundraising;
      t.total += r.total;
    }
    return t;
  }, [rows]);

  const percentages = useMemo(() => {
    if (totals.total === 0) return { program: 0, admin: 0, fundraising: 0 };
    return {
      program: (totals.program / totals.total) * 100,
      admin: (totals.admin / totals.total) * 100,
      fundraising: (totals.fundraising / totals.total) * 100,
    };
  }, [totals]);

  const handleExportCSV = useCallback(() => {
    if (rows.length === 0) return;
    const headers = ['Expense Category', 'Program Services', 'Management & General', 'Fundraising', 'Total'];
    const csvRows: (string | number)[][] = rows.map(r => [
      r.label,
      fmtCurrencyCSV(r.program),
      fmtCurrencyCSV(r.admin),
      fmtCurrencyCSV(r.fundraising),
      fmtCurrencyCSV(r.total),
    ]);
    // Add totals row
    csvRows.push([
      'TOTAL',
      fmtCurrencyCSV(totals.program),
      fmtCurrencyCSV(totals.admin),
      fmtCurrencyCSV(totals.fundraising),
      fmtCurrencyCSV(totals.total),
    ]);
    // Add percentage row
    csvRows.push([
      '% of Total',
      `${percentages.program.toFixed(1)}%`,
      `${percentages.admin.toFixed(1)}%`,
      `${percentages.fundraising.toFixed(1)}%`,
      '100%',
    ]);
    downloadCSV(`functional-expenses-${selectedSeason}.csv`, headers, csvRows);
  }, [rows, totals, percentages, selectedSeason]);

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Statement of Functional Expenses</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Statement of Functional Expenses</Typography>
          <Typography variant="body2" color="text.secondary">IRS Form 990 Part IX</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCSV} disabled={rows.length === 0}>
            Download CSV
          </Button>
        </Box>
      </Box>

      {/* Season Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          label="Season"
          select
          value={selectedSeason}
          onChange={(e) => setSelectedSeason(e.target.value)}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All Seasons</MenuItem>
          {seasonOptions.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      </Paper>

      {isLoading && (
        <Alert severity="info">Loading functional expense data...</Alert>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load expense data. Please try again.
        </Alert>
      )}

      {!isLoading && !isError && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Program Services</Typography>
                  <Typography variant="h5" color="primary.main">{fmtCurrency(totals.program)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {percentages.program.toFixed(1)}% of total
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Management & General</Typography>
                  <Typography variant="h5" color="warning.main">{fmtCurrency(totals.admin)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {percentages.admin.toFixed(1)}% of total
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Fundraising</Typography>
                  <Typography variant="h5" color="info.main">{fmtCurrency(totals.fundraising)}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {percentages.fundraising.toFixed(1)}% of total
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Expenses</Typography>
                  <Typography variant="h5" color="error.main">{fmtCurrency(totals.total)}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {rows.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No expense data found for the selected season. Record expenses first.
            </Alert>
          )}

          {rows.length > 0 && (
            <Paper sx={{ p: 2 }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Expense Category</strong></TableCell>
                      <TableCell align="right"><strong>Program Services</strong></TableCell>
                      <TableCell align="right"><strong>Management & General</strong></TableCell>
                      <TableCell align="right"><strong>Fundraising</strong></TableCell>
                      <TableCell align="right"><strong>Total</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.category}>
                        <TableCell>{row.label}</TableCell>
                        <TableCell align="right">{fmtCurrency(row.program)}</TableCell>
                        <TableCell align="right">{fmtCurrency(row.admin)}</TableCell>
                        <TableCell align="right">{fmtCurrency(row.fundraising)}</TableCell>
                        <TableCell align="right">{fmtCurrency(row.total)}</TableCell>
                      </TableRow>
                    ))}

                    {/* Total Row */}
                    <TableRow sx={{ bgcolor: 'action.hover' }}>
                      <TableCell>
                        <Typography fontWeight={700}>TOTAL EXPENSES</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color="primary.main">{fmtCurrency(totals.program)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color="warning.main">{fmtCurrency(totals.admin)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color="info.main">{fmtCurrency(totals.fundraising)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight={700} color="error.main">{fmtCurrency(totals.total)}</Typography>
                      </TableCell>
                    </TableRow>

                    {/* Percentage Row */}
                    <TableRow>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600} color="text.secondary">% of Total</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">{percentages.program.toFixed(1)}%</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">{percentages.admin.toFixed(1)}%</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">{percentages.fundraising.toFixed(1)}%</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary">100%</Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </>
      )}
    </Box>
  );
};

export default FunctionalExpensesPage;
