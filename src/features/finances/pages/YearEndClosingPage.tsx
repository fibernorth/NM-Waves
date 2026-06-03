import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  MenuItem,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsApi } from '@/lib/api/accounting';
import { generalLedgerApi } from '@/lib/api/generalLedger';
import { fiscalYearCloseApi } from '@/lib/api/fiscalYearClose';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const currentYear = new Date().getFullYear();
const fiscalYearOptions: string[] = [];
for (let y = currentYear; y >= currentYear - 5; y--) {
  fiscalYearOptions.push(`${y - 1}-${y}`);
}

const PRE_CLOSE_CHECKLIST = [
  'All bank accounts reconciled',
  'All income recorded',
  'All expenses recorded',
  'Depreciation entries posted',
  'Trial balance reviewed',
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const YearEndClosingPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [selectedFiscalYear, setSelectedFiscalYear] = useState(
    `${currentYear - 1}-${currentYear}`
  );
  const [checklist, setChecklist] = useState<boolean[]>(
    PRE_CLOSE_CHECKLIST.map(() => false)
  );
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: closedYears = [], isLoading: loadingClosed } = useQuery({
    queryKey: ['closedFiscalYears'],
    queryFn: () => fiscalYearCloseApi.getClosedYears(),
  });

  // Check if selected year is already closed
  const selectedYearClose = useMemo(() => {
    return closedYears.find(c => c.fiscalYear === selectedFiscalYear) || null;
  }, [closedYears, selectedFiscalYear]);

  // Financial summary for the selected year — use the end year for season matching
  const seasonForQuery = useMemo(() => {
    if (selectedFiscalYear.includes('-')) {
      return selectedFiscalYear.split('-')[1];
    }
    return selectedFiscalYear;
  }, [selectedFiscalYear]);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['financialReport', seasonForQuery],
    queryFn: () => reportsApi.generateSummary(seasonForQuery),
  });

  // Get closing entries for already-closed years
  const { data: closingEntries = [] } = useQuery({
    queryKey: ['closingEntries', selectedYearClose?.id],
    queryFn: () => {
      if (!selectedYearClose) return Promise.resolve([]);
      return generalLedgerApi.getBySource('closing', selectedYearClose.id);
    },
    enabled: !!selectedYearClose,
  });

  // ---------------------------------------------------------------------------
  // Close mutation
  // ---------------------------------------------------------------------------

  const closeMutation = useMutation({
    mutationFn: async () => {
      return fiscalYearCloseApi.closeFiscalYear(
        selectedFiscalYear,
        user?.uid || '',
        closingNotes || undefined
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['closedFiscalYears'] });
      queryClient.invalidateQueries({ queryKey: ['generalLedger'] });
      queryClient.invalidateQueries({ queryKey: ['financialReport'] });
      queryClient.invalidateQueries({ queryKey: ['closingEntries'] });
      toast.success(`Fiscal year ${selectedFiscalYear} closed successfully`);
      setConfirmDialogOpen(false);
      setClosingNotes('');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to close fiscal year');
      setConfirmDialogOpen(false);
    },
  });

  const handleToggleChecklist = (index: number) => {
    setChecklist(prev => {
      const updated = [...prev];
      updated[index] = !updated[index];
      return updated;
    });
  };

  // ---------------------------------------------------------------------------
  // Closed years grid columns
  // ---------------------------------------------------------------------------

  const closedYearColumns: GridColDef[] = [
    {
      field: 'fiscalYear',
      headerName: 'Fiscal Year',
      width: 130,
    },
    {
      field: 'closedAt',
      headerName: 'Closed Date',
      width: 140,
      valueFormatter: (params) => {
        try {
          return format(params.value, 'MM/dd/yyyy');
        } catch {
          return '--';
        }
      },
    },
    {
      field: 'closedBy',
      headerName: 'Closed By',
      width: 140,
    },
    {
      field: 'totalRevenue',
      headerName: 'Total Revenue',
      width: 140,
      valueFormatter: (params) => `$${params.value.toFixed(2)}`,
    },
    {
      field: 'totalExpenses',
      headerName: 'Total Expenses',
      width: 140,
      valueFormatter: (params) => `$${params.value.toFixed(2)}`,
    },
    {
      field: 'netIncome',
      headerName: 'Net Income',
      width: 140,
      renderCell: (params) => {
        const val = params.value as number;
        const isNeg = val < 0;
        return (
          <Typography
            variant="body2"
            sx={{ fontWeight: 'bold', color: isNeg ? 'error.main' : 'success.main' }}
          >
            {isNeg ? `-$${Math.abs(val).toFixed(2)}` : `$${val.toFixed(2)}`}
          </Typography>
        );
      },
    },
    {
      field: 'notes',
      headerName: 'Notes',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => params.value || '--',
    },
  ];

  // Closing entries grid columns
  const closingEntryColumns: GridColDef[] = [
    {
      field: 'accountNumber',
      headerName: 'Account #',
      width: 110,
    },
    {
      field: 'accountName',
      headerName: 'Account Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'debit',
      headerName: 'Debit',
      width: 120,
      valueFormatter: (params) => params.value > 0 ? `$${params.value.toFixed(2)}` : '',
    },
    {
      field: 'credit',
      headerName: 'Credit',
      width: 120,
      valueFormatter: (params) => params.value > 0 ? `$${params.value.toFixed(2)}` : '',
    },
    {
      field: 'memo',
      headerName: 'Memo',
      flex: 1,
      minWidth: 200,
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Year-End Closing
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Year-End Closing
      </Typography>

      {/* Warning banner */}
      <Alert
        severity="warning"
        icon={<WarningAmberIcon />}
        sx={{ mb: 3 }}
      >
        <Typography variant="body1" fontWeight="bold">
          Year-end closing is a permanent operation.
        </Typography>
        <Typography variant="body2">
          Once closed, entries in the closed year cannot be modified. Revenue and expense accounts
          will be zeroed out and net income transferred to Retained Earnings.
        </Typography>
      </Alert>

      {/* Fiscal Year Selector */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              select
              label="Fiscal Year"
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(e.target.value)}
              fullWidth
              size="small"
            >
              {fiscalYearOptions.map(fy => (
                <MenuItem key={fy} value={fy}>
                  {fy}
                  {closedYears.some(c => c.fiscalYear === fy) && ' (Closed)'}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item>
            {selectedYearClose && (
              <Chip
                icon={<LockIcon />}
                label="Year Closed"
                color="success"
                variant="outlined"
              />
            )}
          </Grid>
        </Grid>
      </Paper>

      {/* Pre-closing Checklist */}
      {!selectedYearClose && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Pre-Closing Checklist
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Informational — ensure these items are complete before closing.
          </Typography>
          <List dense>
            {PRE_CLOSE_CHECKLIST.map((item, index) => (
              <ListItem
                key={index}
                onClick={() => handleToggleChecklist(index)}
                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {checklist[index] ? (
                    <CheckCircleIcon color="success" />
                  ) : (
                    <CheckBoxOutlineBlankIcon color="disabled" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={item}
                  sx={{
                    textDecoration: checklist[index] ? 'line-through' : 'none',
                    color: checklist[index] ? 'text.secondary' : 'text.primary',
                  }}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* Pre-Close Summary */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {selectedYearClose ? 'Close Summary' : 'Pre-Close Summary'} — {selectedFiscalYear}
        </Typography>

        {loadingSummary ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Revenue</Typography>
                  <Typography variant="h5" color="success.main">
                    ${selectedYearClose
                      ? selectedYearClose.totalRevenue.toFixed(2)
                      : (summary?.income.total || 0).toFixed(2)
                    }
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Total Expenses</Typography>
                  <Typography variant="h5" color="error.main">
                    ${selectedYearClose
                      ? selectedYearClose.totalExpenses.toFixed(2)
                      : (summary?.expenses.total || 0).toFixed(2)
                    }
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Card>
                <CardContent>
                  <Typography variant="body2" color="text.secondary">Net Income</Typography>
                  <Typography
                    variant="h5"
                    color={
                      (selectedYearClose ? selectedYearClose.netIncome : (summary?.netIncome || 0)) >= 0
                        ? 'success.main'
                        : 'error.main'
                    }
                  >
                    ${selectedYearClose
                      ? selectedYearClose.netIncome.toFixed(2)
                      : (summary?.netIncome || 0).toFixed(2)
                    }
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Close button */}
        {!selectedYearClose && (
          <Box sx={{ mt: 3 }}>
            <Button
              variant="contained"
              color="error"
              size="large"
              startIcon={<LockIcon />}
              onClick={() => setConfirmDialogOpen(true)}
              disabled={closeMutation.isPending || loadingSummary}
            >
              Close Fiscal Year {selectedFiscalYear}
            </Button>
          </Box>
        )}
      </Paper>

      {/* Closing entries for already-closed year */}
      {selectedYearClose && closingEntries.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            Closing Journal Entries
          </Typography>
          <Box sx={{ height: 300, width: '100%' }}>
            <DataGrid
              rows={closingEntries}
              columns={closingEntryColumns}
              pageSizeOptions={[10, 25]}
              initialState={{
                pagination: { paginationModel: { pageSize: 25 } },
              }}
              disableRowSelectionOnClick
              density="compact"
            />
          </Box>
        </Paper>
      )}

      <Divider sx={{ my: 3 }} />

      {/* Previously Closed Years */}
      <Typography variant="h5" gutterBottom>
        Previously Closed Years
      </Typography>
      <Paper sx={{ height: { xs: 250, md: 350 }, width: '100%' }}>
        <DataGrid
          rows={closedYears}
          columns={closedYearColumns}
          loading={loadingClosed}
          pageSizeOptions={[5, 10]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberIcon color="warning" />
          Confirm Year-End Closing
        </DialogTitle>
        <DialogContent>
          <DialogContentText gutterBottom>
            You are about to close fiscal year <strong>{selectedFiscalYear}</strong>. This will:
          </DialogContentText>
          <List dense>
            <ListItem>
              <ListItemText primary="Zero out all revenue accounts for the year" />
            </ListItem>
            <ListItem>
              <ListItemText primary="Zero out all expense accounts for the year" />
            </ListItem>
            <ListItem>
              <ListItemText
                primary={`Transfer net income of $${(summary?.netIncome || 0).toFixed(2)} to Retained Earnings`}
              />
            </ListItem>
          </List>
          <Alert severity="error" sx={{ mt: 1, mb: 2 }}>
            This action cannot be undone.
          </Alert>
          <TextField
            label="Notes (optional)"
            value={closingNotes}
            onChange={(e) => setClosingNotes(e.target.value)}
            fullWidth
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => closeMutation.mutate()}
            disabled={closeMutation.isPending}
            startIcon={closeMutation.isPending ? <CircularProgress size={16} /> : <LockIcon />}
          >
            {closeMutation.isPending ? 'Closing...' : 'Close Year'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default YearEndClosingPage;
