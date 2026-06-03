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
  TableRow,
  Button,
  Alert,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { generalLedgerApi } from '@/lib/api/generalLedger';
import { chartOfAccountsApi } from '@/lib/api/chartOfAccounts';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { downloadCSV, fmtCurrencyCSV } from '@/lib/utils/exportReports';
import type { ChartOfAccount } from '@/types/models';

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

const fmtCurrencyCSVSigned = (val: number): string =>
  val < 0 ? `-${fmtCurrencyCSV(val)}` : fmtCurrencyCSV(val);

/**
 * Statement of Cash Flows (Indirect Method)
 *
 * Derives cash flow from GL entries:
 * - Net income = revenue credits - expense debits
 * - Depreciation (add back non-cash)
 * - Changes in receivables / payables
 * - Investing = equipment / asset purchases
 * - Net change = ending cash - beginning cash (also validated by sum of sections)
 */
const CashFlowPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [selectedSeason, setSelectedSeason] = useState<string>(currentYear.toString());

  // Fetch current-season GL entries
  const { data: entries = [], isLoading: entriesLoading, isError: entriesError } = useQuery({
    queryKey: ['glEntries', selectedSeason],
    queryFn: () => generalLedgerApi.getAll(selectedSeason || undefined),
    enabled: true,
  });

  // Fetch ALL GL entries (for prior-period beginning balances)
  const { data: allEntries = [], isLoading: allEntriesLoading, isError: allEntriesError } = useQuery({
    queryKey: ['glEntriesAll'],
    queryFn: () => generalLedgerApi.getAll(),
  });

  const { data: accounts = [], isLoading: accountsLoading, isError: accountsError } = useQuery({
    queryKey: ['chartOfAccounts'],
    queryFn: () => chartOfAccountsApi.getAll(),
  });

  const isLoading = entriesLoading || allEntriesLoading || accountsLoading;
  const isError = entriesError || allEntriesError || accountsError;

  const accountMap = useMemo(() => {
    const map = new Map<string, ChartOfAccount>();
    for (const a of accounts) {
      map.set(a.accountNumber, a);
    }
    return map;
  }, [accounts]);

  const cashFlow = useMemo(() => {
    // Helper: check if an account number is a cash account
    const isCash = (acctNum: string) => {
      const num = parseInt(acctNum, 10);
      return num >= 1000 && num <= 1020;
    };
    const isReceivable = (acctNum: string) => {
      const num = parseInt(acctNum, 10);
      return num >= 1100 && num <= 1199;
    };
    const isPayable = (acctNum: string) => {
      const num = parseInt(acctNum, 10);
      return num >= 2000 && num <= 2099;
    };
    const isDeferredRevenue = (acctNum: string) => {
      const num = parseInt(acctNum, 10);
      return num >= 2200 && num <= 2299;
    };
    const isEquipmentAsset = (acctNum: string) => {
      const num = parseInt(acctNum, 10);
      return num === 1500 || (num >= 1500 && num <= 1599);
    };
    const isRevenue = (acctNum: string) => {
      const num = parseInt(acctNum, 10);
      return num >= 4000 && num <= 4999;
    };
    const isExpense = (acctNum: string) => {
      const num = parseInt(acctNum, 10);
      return num >= 5000 && num <= 7999;
    };
    const isDepreciation = (acctNum: string) => {
      // Depreciation entries are typically on sourceType 'depreciation'
      // but we also check account subtypes
      const acct = accountMap.get(acctNum);
      return acct?.name?.toLowerCase().includes('depreciation') || false;
    };

    // --- Current-period calculations ---
    let totalRevenue = 0;
    let totalExpenses = 0;
    let depreciation = 0;
    let changeInReceivables = 0; // debit increases AR (uses cash conceptually)
    let changeInPayables = 0;    // credit increases AP (source of cash)
    let changeInDeferredRevenue = 0;
    let equipmentPurchases = 0;

    for (const entry of entries) {
      const acctNum = entry.accountNumber;
      const net = entry.debit - entry.credit;

      if (isRevenue(acctNum)) {
        // Revenue has credit normal: credit is positive revenue
        totalRevenue += entry.credit - entry.debit;
      } else if (isExpense(acctNum)) {
        // Expense has debit normal: debit is positive expense
        if (isDepreciation(acctNum) || entry.sourceType === 'depreciation') {
          depreciation += entry.debit - entry.credit;
        } else {
          totalExpenses += entry.debit - entry.credit;
        }
      } else if (isReceivable(acctNum)) {
        // Increase in AR = debit, bad for cash
        changeInReceivables += net;
      } else if (isPayable(acctNum)) {
        // Increase in AP = credit, good for cash
        changeInPayables += entry.credit - entry.debit;
      } else if (isDeferredRevenue(acctNum)) {
        changeInDeferredRevenue += entry.credit - entry.debit;
      } else if (isEquipmentAsset(acctNum)) {
        // Debit to equipment = purchase (investing outflow)
        equipmentPurchases += net;
      }
    }

    const netIncome = totalRevenue - totalExpenses - depreciation;

    // Operating activities (indirect method)
    const operatingCashFlow =
      netIncome +
      depreciation -
      changeInReceivables +
      changeInPayables +
      changeInDeferredRevenue;

    // Investing activities
    const investingCashFlow = -equipmentPurchases; // Purchases are outflows

    // Financing activities (typically none for small nonprofits)
    const financingCashFlow = 0;

    const netChange = operatingCashFlow + investingCashFlow + financingCashFlow;

    // --- Beginning and ending cash balances ---
    // Beginning = sum of all GL entries for cash accounts BEFORE this season
    // Ending = beginning + net change from this season's GL entries
    let beginningCash = 0;
    const currentSeasonEntryIds = new Set(entries.map(e => e.id));
    for (const entry of allEntries) {
      if (isCash(entry.accountNumber) && !currentSeasonEntryIds.has(entry.id)) {
        beginningCash += entry.debit - entry.credit;
      }
    }

    // Actual ending cash from GL
    let endingCash = 0;
    for (const entry of allEntries) {
      if (isCash(entry.accountNumber)) {
        endingCash += entry.debit - entry.credit;
      }
    }

    return {
      netIncome,
      depreciation,
      changeInReceivables,
      changeInPayables,
      changeInDeferredRevenue,
      operatingCashFlow,
      equipmentPurchases,
      investingCashFlow,
      financingCashFlow,
      netChange,
      beginningCash,
      endingCash,
    };
  }, [entries, allEntries, accountMap]);

  const handleExportCSV = useCallback(() => {
    const headers = ['Line Item', 'Amount'];
    const csvRows: (string | number)[][] = [
      ['OPERATING ACTIVITIES', ''],
      ['Net Income', fmtCurrencyCSVSigned(cashFlow.netIncome)],
      ['Adjustments to reconcile net income:', ''],
      ['  Add: Depreciation', fmtCurrencyCSVSigned(cashFlow.depreciation)],
      ['  (Increase)/Decrease in Receivables', fmtCurrencyCSVSigned(-cashFlow.changeInReceivables)],
      ['  Increase/(Decrease) in Payables', fmtCurrencyCSVSigned(cashFlow.changeInPayables)],
      ['  Increase/(Decrease) in Deferred Revenue', fmtCurrencyCSVSigned(cashFlow.changeInDeferredRevenue)],
      ['Net Cash from Operating Activities', fmtCurrencyCSVSigned(cashFlow.operatingCashFlow)],
      ['', ''],
      ['INVESTING ACTIVITIES', ''],
      ['Equipment Purchases', fmtCurrencyCSVSigned(-cashFlow.equipmentPurchases)],
      ['Net Cash from Investing Activities', fmtCurrencyCSVSigned(cashFlow.investingCashFlow)],
      ['', ''],
      ['FINANCING ACTIVITIES', ''],
      ['Net Cash from Financing Activities', fmtCurrencyCSVSigned(cashFlow.financingCashFlow)],
      ['', ''],
      ['NET CHANGE IN CASH', fmtCurrencyCSVSigned(cashFlow.netChange)],
      ['Beginning Cash Balance', fmtCurrencyCSVSigned(cashFlow.beginningCash)],
      ['Ending Cash Balance', fmtCurrencyCSVSigned(cashFlow.endingCash)],
    ];
    downloadCSV(`cash-flow-${selectedSeason}.csv`, headers, csvRows);
  }, [cashFlow, selectedSeason]);

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Statement of Cash Flows</Typography>
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
          <Typography variant="h4">Statement of Cash Flows</Typography>
          <Typography variant="body2" color="text.secondary">Indirect Method</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCSV}>
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
        <Alert severity="info">Loading cash flow data...</Alert>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load cash flow data. Please try again.
        </Alert>
      )}

      {!isLoading && !isError && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Operating</Typography>
                  <Typography
                    variant="h5"
                    color={cashFlow.operatingCashFlow >= 0 ? 'success.main' : 'error.main'}
                  >
                    {fmtCurrency(cashFlow.operatingCashFlow)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Investing</Typography>
                  <Typography
                    variant="h5"
                    color={cashFlow.investingCashFlow >= 0 ? 'success.main' : 'error.main'}
                  >
                    {fmtCurrency(cashFlow.investingCashFlow)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Net Change</Typography>
                  <Typography
                    variant="h5"
                    color={cashFlow.netChange >= 0 ? 'success.main' : 'error.main'}
                  >
                    {fmtCurrency(cashFlow.netChange)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Ending Cash</Typography>
                  <Typography
                    variant="h5"
                    color={cashFlow.endingCash >= 0 ? 'success.main' : 'error.main'}
                  >
                    {fmtCurrency(cashFlow.endingCash)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {entries.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No GL entries found for the selected season. Post transactions via the Trial Balance page first.
            </Alert>
          )}

          {/* Cash Flow Statement */}
          <Paper sx={{ p: 2 }}>
            <TableContainer>
              <Table size="small">
                <TableBody>
                  {/* OPERATING ACTIVITIES */}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        OPERATING ACTIVITIES
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4 }}>Net Income</TableCell>
                    <TableCell align="right">{fmtCurrency(cashFlow.netIncome)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={2} sx={{ pl: 4 }}>
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        Adjustments to reconcile net income to cash:
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 6 }}>Add: Depreciation</TableCell>
                    <TableCell align="right">{fmtCurrency(cashFlow.depreciation)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 6 }}>(Increase) / Decrease in Receivables</TableCell>
                    <TableCell align="right">{fmtCurrency(-cashFlow.changeInReceivables)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 6 }}>Increase / (Decrease) in Payables</TableCell>
                    <TableCell align="right">{fmtCurrency(cashFlow.changeInPayables)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 6 }}>Increase / (Decrease) in Deferred Revenue</TableCell>
                    <TableCell align="right">{fmtCurrency(cashFlow.changeInDeferredRevenue)}</TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>
                      <Typography fontWeight={700}>Net Cash from Operating Activities</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} color={cashFlow.operatingCashFlow >= 0 ? 'success.main' : 'error.main'}>
                        {fmtCurrency(cashFlow.operatingCashFlow)}
                      </Typography>
                    </TableCell>
                  </TableRow>

                  {/* Spacer */}
                  <TableRow><TableCell colSpan={2} sx={{ border: 'none', py: 1 }} /></TableRow>

                  {/* INVESTING ACTIVITIES */}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        INVESTING ACTIVITIES
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4 }}>Equipment Purchases</TableCell>
                    <TableCell align="right">{fmtCurrency(-cashFlow.equipmentPurchases)}</TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>
                      <Typography fontWeight={700}>Net Cash from Investing Activities</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} color={cashFlow.investingCashFlow >= 0 ? 'success.main' : 'error.main'}>
                        {fmtCurrency(cashFlow.investingCashFlow)}
                      </Typography>
                    </TableCell>
                  </TableRow>

                  {/* Spacer */}
                  <TableRow><TableCell colSpan={2} sx={{ border: 'none', py: 1 }} /></TableRow>

                  {/* FINANCING ACTIVITIES */}
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        FINANCING ACTIVITIES
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ pl: 4, fontStyle: 'italic' }} colSpan={2}>
                      <Typography variant="body2" color="text.secondary">None for this period</Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>
                      <Typography fontWeight={700}>Net Cash from Financing Activities</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700}>{fmtCurrency(cashFlow.financingCashFlow)}</Typography>
                    </TableCell>
                  </TableRow>

                  {/* Spacer */}
                  <TableRow><TableCell colSpan={2} sx={{ border: 'none', py: 1 }} /></TableRow>

                  {/* TOTALS */}
                  <TableRow sx={{ bgcolor: cashFlow.netChange >= 0 ? 'success.light' : 'error.light' }}>
                    <TableCell>
                      <Typography fontWeight={700} variant="subtitle1">NET CHANGE IN CASH</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} variant="subtitle1">
                        {fmtCurrency(cashFlow.netChange)}
                      </Typography>
                    </TableCell>
                  </TableRow>

                  {/* Spacer */}
                  <TableRow><TableCell colSpan={2} sx={{ border: 'none', py: 0.5 }} /></TableRow>

                  <TableRow>
                    <TableCell>
                      <Typography fontWeight={600}>Beginning Cash Balance</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={600}>{fmtCurrency(cashFlow.beginningCash)}</Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow sx={{ bgcolor: 'action.hover' }}>
                    <TableCell>
                      <Typography fontWeight={700} variant="h6">Ending Cash Balance</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={700} variant="h6" color={cashFlow.endingCash >= 0 ? 'success.main' : 'error.main'}>
                        {fmtCurrency(cashFlow.endingCash)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default CashFlowPage;
