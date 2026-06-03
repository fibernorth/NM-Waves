import { useState, useCallback } from 'react';
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
  Alert,
  Button,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import PrintIcon from '@mui/icons-material/Print';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { generalLedgerApi } from '@/lib/api/generalLedger';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { downloadCSV, fmtCurrencyCSV } from '@/lib/utils/exportReports';

const currentYear = new Date().getFullYear().toString();

const fmtCurrency = (val: number) =>
  val === 0 ? '--' : `$${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const SectionTable = ({
  title,
  items,
  total,
  totalLabel,
  color,
}: {
  title: string;
  items: Array<{ accountNumber: string; name: string; balance: number }>;
  total: number;
  totalLabel: string;
  color: string;
}) => (
  <Paper sx={{ p: 2, mb: 2 }}>
    <Typography variant="h6" sx={{ mb: 1, color }}>{title}</Typography>
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Account #</TableCell>
            <TableCell>Account Name</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3}>
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  No entries
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow key={item.accountNumber}>
                <TableCell>{item.accountNumber}</TableCell>
                <TableCell>{item.name}</TableCell>
                <TableCell align="right">{fmtCurrency(item.balance)}</TableCell>
              </TableRow>
            ))
          )}
          <TableRow>
            <TableCell colSpan={2}>
              <Typography fontWeight={700}>{totalLabel}</Typography>
            </TableCell>
            <TableCell align="right">
              <Typography fontWeight={700} color={color}>
                {fmtCurrency(total)}
              </Typography>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>
);

const BalanceSheetPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [season, setSeason] = useState(currentYear);

  const { data: balanceSheet, isLoading, isError } = useQuery({
    queryKey: ['balanceSheet', season],
    queryFn: () => generalLedgerApi.computeBalanceSheet(season || undefined),
  });

  const handleExportCSV = useCallback(() => {
    if (!balanceSheet) return;
    const headers = ['Section', 'Account #', 'Account Name', 'Amount'];
    const rows: (string | number)[][] = [];
    for (const item of balanceSheet.assets) {
      rows.push(['Assets', item.accountNumber, item.name, fmtCurrencyCSV(item.balance)]);
    }
    rows.push(['', '', 'Total Assets', fmtCurrencyCSV(balanceSheet.totalAssets)]);
    rows.push(['', '', '', '']);
    for (const item of balanceSheet.liabilities) {
      rows.push(['Liabilities', item.accountNumber, item.name, fmtCurrencyCSV(item.balance)]);
    }
    rows.push(['', '', 'Total Liabilities', fmtCurrencyCSV(balanceSheet.totalLiabilities)]);
    rows.push(['', '', '', '']);
    for (const item of balanceSheet.netAssets) {
      rows.push(['Net Assets', item.accountNumber, item.name, fmtCurrencyCSV(item.balance)]);
    }
    rows.push(['', '', 'Total Net Assets', fmtCurrencyCSV(balanceSheet.totalNetAssets)]);
    rows.push(['', '', '', '']);
    rows.push(['', '', 'Total Liabilities + Net Assets', fmtCurrencyCSV(balanceSheet.totalLiabilities + balanceSheet.totalNetAssets)]);
    downloadCSV(`balance-sheet-${season || 'all'}.csv`, headers, rows);
  }, [balanceSheet, season]);

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Balance Sheet</Typography>
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
          <Typography variant="h4">Statement of Financial Position</Typography>
          <Typography variant="body2" color="text.secondary">Balance Sheet</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExportCSV} disabled={!balanceSheet}>
            Download CSV
          </Button>
        </Box>
      </Box>

      {/* Season Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <TextField
          label="As of Season"
          select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          size="small"
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="">All Time</MenuItem>
          {[currentYear, `${Number(currentYear) - 1}-${currentYear}`, String(Number(currentYear) - 1), `${Number(currentYear) - 2}-${Number(currentYear) - 1}`, String(Number(currentYear) - 2)].map(y => (
            <MenuItem key={y} value={y}>{y}</MenuItem>
          ))}
        </TextField>
      </Paper>

      {isLoading && (
        <Alert severity="info">Loading balance sheet data...</Alert>
      )}

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load balance sheet data. Please try again.
        </Alert>
      )}

      {balanceSheet && !isLoading && (
        <>
          {/* Summary Cards */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Assets</Typography>
                  <Typography variant="h5" color="primary.main">
                    {fmtCurrency(balanceSheet.totalAssets)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Liabilities</Typography>
                  <Typography variant="h5" color="error.main">
                    {fmtCurrency(balanceSheet.totalLiabilities)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Net Assets</Typography>
                  <Typography
                    variant="h5"
                    color={balanceSheet.totalNetAssets >= 0 ? 'success.main' : 'error.main'}
                  >
                    {fmtCurrency(balanceSheet.totalNetAssets)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={3}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {balanceSheet.isBalanced ? (
                      <CheckCircleIcon color="success" fontSize="small" />
                    ) : (
                      <ErrorIcon color="error" fontSize="small" />
                    )}
                    <Typography variant="body2" color="text.secondary">Status</Typography>
                  </Box>
                  <Typography
                    variant="h5"
                    color={balanceSheet.isBalanced ? 'success.main' : 'error.main'}
                  >
                    {balanceSheet.isBalanced ? 'Balanced' : 'Unbalanced'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {!balanceSheet.isBalanced && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              Assets ({fmtCurrency(balanceSheet.totalAssets)}) do not equal Liabilities + Net Assets
              ({fmtCurrency(balanceSheet.totalLiabilities + balanceSheet.totalNetAssets)}).
              Review GL entries for discrepancies.
            </Alert>
          )}

          {balanceSheet.assets.length === 0 && balanceSheet.liabilities.length === 0 && balanceSheet.netAssets.length === 0 && (
            <Alert severity="info" sx={{ mb: 2 }}>
              No balance sheet data. Post transactions to the General Ledger via the Trial Balance page first.
            </Alert>
          )}

          {/* Assets */}
          <SectionTable
            title="Assets"
            items={balanceSheet.assets}
            total={balanceSheet.totalAssets}
            totalLabel="Total Assets"
            color="primary.main"
          />

          {/* Liabilities */}
          <SectionTable
            title="Liabilities"
            items={balanceSheet.liabilities}
            total={balanceSheet.totalLiabilities}
            totalLabel="Total Liabilities"
            color="error.main"
          />

          {/* Net Assets */}
          <SectionTable
            title="Net Assets"
            items={balanceSheet.netAssets}
            total={balanceSheet.totalNetAssets}
            totalLabel="Total Net Assets"
            color="success.main"
          />

          {/* Bottom Line */}
          <Paper sx={{ p: 2, mb: 2 }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Typography fontWeight={700}>Total Liabilities + Net Assets</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight={700} variant="h6">
                      {fmtCurrency(balanceSheet.totalLiabilities + balanceSheet.totalNetAssets)}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Paper>

          {/* Revenue/Expense Note */}
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Income Statement Summary (included in Net Assets)</Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
                <Typography variant="h6" color="success.main">{fmtCurrency(balanceSheet.totalRevenue)}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Total Expenses</Typography>
                <Typography variant="h6" color="error.main">{fmtCurrency(balanceSheet.totalExpenses)}</Typography>
              </Grid>
              <Grid item xs={4}>
                <Typography variant="body2" color="text.secondary">Surplus / (Deficit)</Typography>
                <Typography
                  variant="h6"
                  color={balanceSheet.totalRevenue - balanceSheet.totalExpenses >= 0 ? 'success.main' : 'error.main'}
                >
                  {fmtCurrency(balanceSheet.totalRevenue - balanceSheet.totalExpenses)}
                </Typography>
              </Grid>
            </Grid>
          </Paper>
        </>
      )}
    </Box>
  );
};

export default BalanceSheetPage;
