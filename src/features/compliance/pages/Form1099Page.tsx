import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  TextField,
  MenuItem,
  Chip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { vendorsApi, expensesApi } from '@/lib/api/accounting';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { downloadCSV } from '@/lib/utils/exportReports';
import DownloadIcon from '@mui/icons-material/Download';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import toast from 'react-hot-toast';
import type { Vendor, Expense } from '@/types/models';

const THRESHOLD = 600;

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

/** Mask tax ID for display: show last 4 digits only */
function maskTaxId(taxId?: string): string {
  if (!taxId) return 'Not on file';
  if (taxId.length <= 4) return taxId;
  return '***-**-' + taxId.slice(-4);
}

const currentYear = new Date().getFullYear();
const yearOptions: number[] = [];
for (let y = currentYear; y >= currentYear - 5; y--) {
  yearOptions.push(y);
}

interface VendorRow {
  id: string;
  vendorName: string;
  taxId: string;
  taxIdDisplay: string;
  category: string;
  totalPaid: number;
  meetsThreshold: boolean;
}

const Form1099Page = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  // Default to prior year for 1099 reporting
  const [taxYear, setTaxYear] = useState<number>(currentYear - 1);

  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => vendorsApi.getAll(),
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => expensesApi.getAll(),
  });

  const isLoading = vendorsLoading || expensesLoading;

  // Filter to 1099-eligible vendors and compute payment totals
  const vendorRows: VendorRow[] = useMemo(() => {
    const eligible = vendors.filter((v: Vendor) => v.is1099Eligible);

    // Filter expenses for the selected tax year and sum per vendor name
    const yearStart = new Date(taxYear, 0, 1);
    const yearEnd = new Date(taxYear, 11, 31, 23, 59, 59, 999);

    const yearExpenses = expenses.filter((e: Expense) => {
      const d = e.date;
      return d >= yearStart && d <= yearEnd && e.isPaid;
    });

    // Build vendor-name-to-total map
    const vendorTotals = new Map<string, number>();
    for (const exp of yearExpenses) {
      const vname = (exp.vendor || '').trim().toLowerCase();
      if (!vname) continue;
      vendorTotals.set(vname, (vendorTotals.get(vname) || 0) + exp.amount);
    }

    return eligible.map((v: Vendor) => {
      const key = v.name.trim().toLowerCase();
      const totalPaid = vendorTotals.get(key) || 0;
      return {
        id: v.id,
        vendorName: v.name,
        taxId: v.taxId || '',
        taxIdDisplay: maskTaxId(v.taxId),
        category: v.category,
        totalPaid,
        meetsThreshold: totalPaid >= THRESHOLD,
      };
    });
  }, [vendors, expenses, taxYear]);

  // Summary stats
  const stats = useMemo(() => {
    const total1099Vendors = vendorRows.length;
    const requiring1099 = vendorRows.filter(r => r.meetsThreshold).length;
    const totalPayments = vendorRows.reduce((sum, r) => sum + r.totalPaid, 0);
    return { total1099Vendors, requiring1099, totalPayments };
  }, [vendorRows]);

  const handleExportCSV = () => {
    const rows = vendorRows
      .filter(r => r.meetsThreshold)
      .map(r => [
        r.vendorName,
        r.taxId || 'N/A',
        r.category,
        r.totalPaid.toFixed(2),
        r.meetsThreshold ? 'Yes' : 'No',
      ]);

    if (rows.length === 0) {
      toast.error('No vendors meet the $600 threshold for export');
      return;
    }

    downloadCSV(
      `1099-report-${taxYear}.csv`,
      ['Vendor Name', 'Tax ID', 'Category', 'Total Paid', 'Requires 1099'],
      rows,
    );
  };

  const columns: GridColDef[] = [
    {
      field: 'vendorName',
      headerName: 'Vendor Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'taxIdDisplay',
      headerName: 'Tax ID',
      width: 150,
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 140,
      renderCell: (params) => (
        <Chip label={params.value} size="small" variant="outlined" />
      ),
    },
    {
      field: 'totalPaid',
      headerName: 'Total Paid',
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value),
    },
    {
      field: 'threshold',
      headerName: `Threshold ($${THRESHOLD})`,
      width: 150,
      renderCell: (params) => {
        const row = params.row as VendorRow;
        return (
          <Chip
            icon={row.meetsThreshold ? <CheckCircleIcon /> : <WarningIcon />}
            label={row.meetsThreshold ? `>= $${THRESHOLD}` : `< $${THRESHOLD}`}
            size="small"
            color={row.meetsThreshold ? 'success' : 'default'}
            variant="outlined"
          />
        );
      },
    },
    {
      field: 'status',
      headerName: '1099 Required',
      width: 130,
      renderCell: (params) => {
        const row = params.row as VendorRow;
        return (
          <Chip
            label={row.meetsThreshold ? 'Yes' : 'No'}
            size="small"
            color={row.meetsThreshold ? 'error' : 'default'}
          />
        );
      },
    },
  ];

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>1099 Reporting</Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">1099 Reporting</Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            select
            label="Tax Year"
            value={taxYear}
            onChange={(e) => setTaxYear(Number(e.target.value))}
            size="small"
            sx={{ minWidth: 120 }}
          >
            {yearOptions.map(y => (
              <MenuItem key={y} value={y}>{y}</MenuItem>
            ))}
          </TextField>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleExportCSV}
            disabled={vendorRows.filter(r => r.meetsThreshold).length === 0}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total 1099 Vendors
              </Typography>
              <Typography variant="h5">{stats.total1099Vendors}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {'Requiring 1099 (>= $' + THRESHOLD + ')'}
              </Typography>
              <Typography variant="h5" color="error.main">
                {stats.requiring1099}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Total Payments to 1099 Vendors
              </Typography>
              <Typography variant="h5">
                {formatCurrency(stats.totalPayments)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Vendor Grid */}
      <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
        <DataGrid
          rows={vendorRows}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: {
              sortModel: [{ field: 'totalPaid', sort: 'desc' }],
            },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* Filing reminder */}
      {stats.requiring1099 > 0 && (
        <Paper sx={{ p: 2, mt: 2, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
          <Typography variant="body2">
            <strong>Reminder:</strong> 1099-NEC forms must be filed with the IRS and provided
            to vendors by January 31 of the following year. You have{' '}
            <strong>{stats.requiring1099}</strong> vendor(s) requiring a 1099 for tax year{' '}
            <strong>{taxYear}</strong>.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default Form1099Page;
