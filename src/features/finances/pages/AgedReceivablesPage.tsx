import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Card,
  CardContent,
  Grid,
  MenuItem,
  TextField,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import PrintIcon from '@mui/icons-material/Print';
import { playerFinancesApi, computeFeeTotal } from '@/lib/api/finances';
import { invoiceTokensApi } from '@/lib/api/invoiceTokens';
import { expensesApi } from '@/lib/api/accounting';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';

function getAgingBucket(dueDate: Date | undefined): string {
  if (!dueDate) return 'Current';
  const now = new Date();
  const diffMs = now.getTime() - dueDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Current';
  if (diffDays <= 30) return '1-30';
  if (diffDays <= 60) return '31-60';
  if (diffDays <= 90) return '61-90';
  return '90+';
}

const fmtCurrency = (val: number) =>
  val === 0 ? '--' : `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AgedReceivablesPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [tab, setTab] = useState<'receivables' | 'payables'>('receivables');

  const { data: allFinances = [], isLoading: loadingFinances, isError: financesError } = useQuery({
    queryKey: ['playerFinances'],
    queryFn: () => playerFinancesApi.getAll(),
  });

  const { data: allInvoices = [], isError: invoicesError } = useQuery({
    queryKey: ['invoiceTokens'],
    queryFn: () => invoiceTokensApi.getAll(),
  });

  const { data: teams = [], isError: teamsError } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const { data: unpaidExpenses = [], isLoading: loadingExpenses, isError: expensesError } = useQuery({
    queryKey: ['unpaidExpenses'],
    queryFn: () => expensesApi.getUnpaid(),
  });

  const isError = financesError || invoicesError || teamsError || expensesError;

  // Build per-player receivable aging
  const receivablesData = useMemo(() => {
    // Filter to players with outstanding balances
    let finances = allFinances.filter(f => {
      const totalOwed = computeFeeTotal(f);
      return totalOwed - f.totalPaid - (f.scholarshipAmount || 0) > 0;
    });

    if (selectedTeam !== 'all') {
      finances = finances.filter(f => f.teamId === selectedTeam);
    }

    // Build invoice map per player
    const playerInvoiceMap = new Map<string, Date | undefined>();
    for (const inv of allInvoices) {
      if (inv.used || inv.expiresAt < new Date()) continue;
      const existing = playerInvoiceMap.get(inv.playerId);
      if (!existing || (inv.dueDate && inv.dueDate < existing)) {
        playerInvoiceMap.set(inv.playerId, inv.dueDate);
      }
    }

    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, days90plus: 0 };

    const rows = finances.map(f => {
      const totalOwed = computeFeeTotal(f);
      const balanceDue = Math.max(0, totalOwed - f.totalPaid - (f.scholarshipAmount || 0));
      const oldestDueDate = playerInvoiceMap.get(f.playerId);
      const bucket = getAgingBucket(oldestDueDate);

      // Distribute balance into aging buckets
      if (bucket === 'Current') buckets.current += balanceDue;
      else if (bucket === '1-30') buckets.days30 += balanceDue;
      else if (bucket === '31-60') buckets.days60 += balanceDue;
      else if (bucket === '61-90') buckets.days90 += balanceDue;
      else buckets.days90plus += balanceDue;

      return {
        id: f.id,
        playerName: f.playerName,
        teamName: f.teamName,
        season: f.season,
        totalOwed,
        totalPaid: f.totalPaid,
        balanceDue,
        oldestDueDate,
        bucket,
      };
    });

    const total = Object.values(buckets).reduce((s, v) => s + v, 0);

    return { rows, buckets, total };
  }, [allFinances, allInvoices, selectedTeam]);

  // Build payables aging from unpaid expenses
  const payablesData = useMemo(() => {
    const buckets = { current: 0, days30: 0, days60: 0, days90: 0, days90plus: 0 };

    const rows = unpaidExpenses.map(e => {
      const bucket = getAgingBucket(e.date);
      if (bucket === 'Current') buckets.current += e.amount;
      else if (bucket === '1-30') buckets.days30 += e.amount;
      else if (bucket === '31-60') buckets.days60 += e.amount;
      else if (bucket === '61-90') buckets.days90 += e.amount;
      else buckets.days90plus += e.amount;

      return {
        id: e.id,
        vendor: e.vendor,
        description: e.description,
        category: e.category,
        date: e.date,
        amount: e.amount,
        bucket,
        season: e.season,
      };
    });

    const total = Object.values(buckets).reduce((s, v) => s + v, 0);
    return { rows, buckets, total };
  }, [unpaidExpenses]);

  const receivableColumns: GridColDef[] = [
    { field: 'playerName', headerName: 'Player', flex: 1, minWidth: 150 },
    { field: 'teamName', headerName: 'Team', width: 140 },
    { field: 'season', headerName: 'Season', width: 90 },
    {
      field: 'balanceDue',
      headerName: 'Balance Due',
      width: 120,
      type: 'number',
      renderCell: (params) => (
        <Typography color="error.main" fontWeight={600}>{fmtCurrency(params.value)}</Typography>
      ),
    },
    {
      field: 'oldestDueDate',
      headerName: 'Oldest Due',
      width: 110,
      renderCell: (params) =>
        params.value
          ? new Date(params.value).toLocaleDateString()
          : <Typography color="text.secondary">No invoice</Typography>,
    },
    {
      field: 'bucket',
      headerName: 'Aging',
      width: 100,
      renderCell: (params) => {
        const colors: Record<string, 'info' | 'warning' | 'error' | 'default'> = {
          'Current': 'info', '1-30': 'warning', '31-60': 'warning', '61-90': 'error', '90+': 'error',
        };
        return <Chip label={params.value} size="small" color={colors[params.value] || 'default'} />;
      },
    },
  ];

  const payableColumns: GridColDef[] = [
    { field: 'vendor', headerName: 'Vendor', flex: 1, minWidth: 150 },
    { field: 'description', headerName: 'Description', flex: 1, minWidth: 150 },
    { field: 'category', headerName: 'Category', width: 130 },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      type: 'number',
      renderCell: (params) => (
        <Typography color="error.main" fontWeight={600}>{fmtCurrency(params.value)}</Typography>
      ),
    },
    {
      field: 'date',
      headerName: 'Date',
      width: 110,
      renderCell: (params) => new Date(params.value).toLocaleDateString(),
    },
    {
      field: 'bucket',
      headerName: 'Aging',
      width: 100,
      renderCell: (params) => {
        const colors: Record<string, 'info' | 'warning' | 'error' | 'default'> = {
          'Current': 'info', '1-30': 'warning', '31-60': 'warning', '61-90': 'error', '90+': 'error',
        };
        return <Chip label={params.value} size="small" color={colors[params.value] || 'default'} />;
      },
    },
  ];

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>Aged Receivables & Payables</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  const activeData = tab === 'receivables' ? receivablesData : payablesData;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          {tab === 'receivables' ? 'Aged Receivables' : 'Aged Payables'}
        </Typography>
        <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()}>
          Print
        </Button>
      </Box>

      {/* Tab Toggle */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip
                label="Receivables (Players)"
                color={tab === 'receivables' ? 'primary' : 'default'}
                onClick={() => setTab('receivables')}
                variant={tab === 'receivables' ? 'filled' : 'outlined'}
              />
              <Chip
                label="Payables (Vendors)"
                color={tab === 'payables' ? 'primary' : 'default'}
                onClick={() => setTab('payables')}
                variant={tab === 'payables' ? 'filled' : 'outlined'}
              />
            </Box>
          </Grid>
          {tab === 'receivables' && (
            <Grid item xs>
              <TextField
                label="Filter by Team"
                select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                size="small"
                sx={{ minWidth: 200 }}
              >
                <MenuItem value="all">All Teams</MenuItem>
                {teams.map((team) => (
                  <MenuItem key={team.id} value={team.id}>{team.name}</MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
        </Grid>
      </Paper>

      {/* Aging Summary Table */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom>Aging Summary</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Current</TableCell>
                <TableCell>1-30 Days</TableCell>
                <TableCell>31-60 Days</TableCell>
                <TableCell>61-90 Days</TableCell>
                <TableCell>90+ Days</TableCell>
                <TableCell><strong>Total</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell>
                  <Chip label={fmtCurrency(activeData.buckets.current)} color="info" size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={fmtCurrency(activeData.buckets.days30)} color="warning" size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={fmtCurrency(activeData.buckets.days60)} color="warning" size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={fmtCurrency(activeData.buckets.days90)} color="error" size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={fmtCurrency(activeData.buckets.days90plus)} color="error" size="small" />
                </TableCell>
                <TableCell>
                  <Typography fontWeight={700} color="error.main">{fmtCurrency(activeData.total)}</Typography>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {tab === 'receivables' ? 'Players with Balance' : 'Unpaid Bills'}
              </Typography>
              <Typography variant="h4">{activeData.rows.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Total Outstanding</Typography>
              <Typography variant="h4" color="error.main">{fmtCurrency(activeData.total)}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">Overdue (30+ Days)</Typography>
              <Typography variant="h4" color="warning.main">
                {fmtCurrency(
                  activeData.buckets.days30 + activeData.buckets.days60 +
                  activeData.buckets.days90 + activeData.buckets.days90plus
                )}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Failed to load financial data. Please try again.
        </Alert>
      )}

      {activeData.rows.length === 0 && !isError && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {tab === 'receivables'
            ? 'No outstanding player balances!'
            : 'No unpaid bills!'}
        </Alert>
      )}

      {/* Data Grid */}
      <Paper sx={{ height: { xs: 350, md: 500 }, width: '100%' }}>
        <DataGrid
          rows={activeData.rows}
          columns={tab === 'receivables' ? receivableColumns : payableColumns}
          loading={tab === 'receivables' ? loadingFinances : loadingExpenses}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: { sortModel: [{ field: tab === 'receivables' ? 'balanceDue' : 'amount', sort: 'desc' }] },
          }}
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  );
};

export default AgedReceivablesPage;
