import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  MenuItem,
  TextField,
  Grid,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { generalLedgerApi } from '@/lib/api/generalLedger';
import { chartOfAccountsApi } from '@/lib/api/chartOfAccounts';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import {
  collection,
  addDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { GeneralLedgerEntry, FundType, ChartOfAccount } from '@/types/models';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const currentYear = new Date().getFullYear();
const seasonOptions: string[] = [];
for (let y = currentYear; y >= currentYear - 5; y--) {
  seasonOptions.push(y.toString());
}

const FUND_TYPES: { value: FundType; label: string }[] = [
  { value: 'unrestricted', label: 'Unrestricted' },
  { value: 'temporarily_restricted', label: 'Temporarily Restricted' },
  { value: 'permanently_restricted', label: 'Permanently Restricted' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JournalLineItem {
  id: string;
  accountNumber: string;
  debit: string;
  credit: string;
}

interface JournalFormState {
  date: string;
  memo: string;
  season: string;
  fundType: FundType;
  lines: JournalLineItem[];
}

const createEmptyLine = (): JournalLineItem => ({
  id: crypto.randomUUID(),
  accountNumber: '',
  debit: '',
  credit: '',
});

const defaultForm: JournalFormState = {
  date: format(new Date(), 'yyyy-MM-dd'),
  memo: '',
  season: currentYear.toString(),
  fundType: 'unrestricted',
  lines: [createEmptyLine(), createEmptyLine()],
};

/** Strip undefined values from an object before writing to Firestore */
const cleanData = <T extends Record<string, unknown>>(obj: T): T => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const JournalEntryPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<JournalFormState>(defaultForm);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: glEntries = [], isLoading } = useQuery({
    queryKey: ['generalLedger'],
    queryFn: () => generalLedgerApi.getAll(),
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['chartOfAccounts'],
    queryFn: () => chartOfAccountsApi.getAll(),
  });

  // Build lookup map for account display
  const accountMap = useMemo(() => {
    const map = new Map<string, ChartOfAccount>();
    for (const a of accounts) map.set(a.accountNumber, a);
    return map;
  }, [accounts]);

  // Filter to only journal entries and group by sourceId (batch)
  const journalBatches = useMemo(() => {
    const journalEntries = glEntries.filter(e => e.sourceType === 'journal');

    // Group by sourceId
    const batchMap = new Map<string, GeneralLedgerEntry[]>();
    for (const entry of journalEntries) {
      const key = entry.sourceId || entry.id;
      const batch = batchMap.get(key) || [];
      batch.push(entry);
      batchMap.set(key, batch);
    }

    // Convert to display rows
    const rows: Array<{
      id: string;
      date: Date;
      memo: string;
      debitAccounts: string;
      creditAccounts: string;
      amount: number;
      createdBy: string;
      season: string;
      fundType?: FundType;
    }> = [];

    for (const [batchId, entries] of batchMap) {
      const first = entries[0];
      const debitEntries = entries.filter(e => e.debit > 0);
      const creditEntries = entries.filter(e => e.credit > 0);
      const totalDebit = debitEntries.reduce((s, e) => s + e.debit, 0);

      rows.push({
        id: batchId,
        date: first.date,
        memo: first.memo,
        debitAccounts: debitEntries.map(e => `${e.accountNumber} ${e.accountName}`).join(', '),
        creditAccounts: creditEntries.map(e => `${e.accountNumber} ${e.accountName}`).join(', '),
        amount: Math.round(totalDebit * 100) / 100,
        createdBy: first.createdBy,
        season: first.season,
        fundType: first.fundType,
      });
    }

    // Sort by date desc
    rows.sort((a, b) => b.date.getTime() - a.date.getTime());
    return rows;
  }, [glEntries]);

  // ---------------------------------------------------------------------------
  // Form helpers
  // ---------------------------------------------------------------------------

  const totalDebits = useMemo(() => {
    return form.lines.reduce((sum, line) => {
      const val = parseFloat(line.debit);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [form.lines]);

  const totalCredits = useMemo(() => {
    return form.lines.reduce((sum, line) => {
      const val = parseFloat(line.credit);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [form.lines]);

  const difference = Math.round((totalDebits - totalCredits) * 100) / 100;
  const isBalanced = Math.abs(difference) < 0.005 && totalDebits > 0;

  const updateLine = (lineId: string, field: keyof JournalLineItem, value: string) => {
    setForm(prev => ({
      ...prev,
      lines: prev.lines.map(line => {
        if (line.id !== lineId) return line;
        // If entering a debit, clear credit and vice versa
        if (field === 'debit' && value) {
          return { ...line, debit: value, credit: '' };
        }
        if (field === 'credit' && value) {
          return { ...line, credit: value, debit: '' };
        }
        return { ...line, [field]: value };
      }),
    }));
  };

  const addLine = () => {
    setForm(prev => ({
      ...prev,
      lines: [...prev.lines, createEmptyLine()],
    }));
  };

  const removeLine = (lineId: string) => {
    if (form.lines.length <= 2) {
      toast.error('Journal entries require at least 2 lines');
      return;
    }
    setForm(prev => ({
      ...prev,
      lines: prev.lines.filter(l => l.id !== lineId),
    }));
  };

  // ---------------------------------------------------------------------------
  // Dialog
  // ---------------------------------------------------------------------------

  const openDialog = () => {
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setForm(defaultForm);
  };

  // ---------------------------------------------------------------------------
  // Save mutation
  // ---------------------------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: async (formData: JournalFormState) => {
      const batchId = crypto.randomUUID();
      const entryDate = new Date(formData.date + 'T00:00:00');
      const colRef = collection(db, 'generalLedger');
      const now = Timestamp.now();

      const baseFields = {
        date: Timestamp.fromDate(entryDate),
        memo: formData.memo,
        sourceType: 'journal',
        sourceId: batchId,
        season: formData.season,
        fundType: formData.fundType,
        createdBy: user?.uid || '',
        createdAt: now,
      };

      const promises = formData.lines
        .filter(line => {
          const debit = parseFloat(line.debit) || 0;
          const credit = parseFloat(line.credit) || 0;
          return (debit > 0 || credit > 0) && line.accountNumber;
        })
        .map(line => {
          const acct = accountMap.get(line.accountNumber);
          const debit = Math.round((parseFloat(line.debit) || 0) * 100) / 100;
          const credit = Math.round((parseFloat(line.credit) || 0) * 100) / 100;

          return addDoc(colRef, cleanData({
            ...baseFields,
            accountId: acct?.id || '',
            accountNumber: line.accountNumber,
            accountName: acct?.name || line.accountNumber,
            debit,
            credit,
          }));
        });

      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['generalLedger'] });
      queryClient.invalidateQueries({ queryKey: ['financialReport'] });
      toast.success('Journal entry posted successfully');
      closeDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to post journal entry');
    },
  });

  const handleSave = () => {
    if (!form.date) {
      toast.error('Date is required');
      return;
    }
    if (!form.memo.trim()) {
      toast.error('Memo/description is required');
      return;
    }

    const validLines = form.lines.filter(line => {
      const debit = parseFloat(line.debit) || 0;
      const credit = parseFloat(line.credit) || 0;
      return (debit > 0 || credit > 0) && line.accountNumber;
    });

    if (validLines.length < 2) {
      toast.error('At least 2 valid line items are required');
      return;
    }

    if (!isBalanced) {
      toast.error('Total debits must equal total credits');
      return;
    }

    saveMutation.mutate(form);
  };

  // ---------------------------------------------------------------------------
  // DataGrid columns
  // ---------------------------------------------------------------------------

  const columns: GridColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      width: 110,
      valueFormatter: (params) => {
        try {
          return format(params.value, 'MM/dd/yyyy');
        } catch {
          return '--';
        }
      },
    },
    {
      field: 'memo',
      headerName: 'Memo',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'debitAccounts',
      headerName: 'Debit Account(s)',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'creditAccounts',
      headerName: 'Credit Account(s)',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 120,
      valueFormatter: (params) => `$${params.value.toFixed(2)}`,
    },
    {
      field: 'season',
      headerName: 'Season',
      width: 100,
    },
    {
      field: 'createdBy',
      headerName: 'Created By',
      width: 130,
    },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Journal Entries
        </Typography>
        <Paper sx={{ p: 3 }}>
          <Typography>You do not have permission to view this page.</Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Journal Entries</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openDialog}>
          New Journal Entry
        </Button>
      </Box>

      {/* Data Grid */}
      <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
        <DataGrid
          rows={journalBatches}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
            sorting: {
              sortModel: [{ field: 'date', sort: 'desc' }],
            },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {/* New Journal Entry Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={closeDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>New Journal Entry</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Header fields */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  label="Date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  required
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  label="Season"
                  value={form.season}
                  onChange={(e) => setForm({ ...form, season: e.target.value })}
                  fullWidth
                >
                  {seasonOptions.map(s => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  select
                  label="Fund Type"
                  value={form.fundType}
                  onChange={(e) => setForm({ ...form, fundType: e.target.value as FundType })}
                  fullWidth
                >
                  {FUND_TYPES.map(ft => (
                    <MenuItem key={ft.value} value={ft.value}>{ft.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <TextField
              label="Memo / Description"
              value={form.memo}
              onChange={(e) => setForm({ ...form, memo: e.target.value })}
              required
              fullWidth
              multiline
              rows={2}
            />

            <Divider />

            {/* Line items header */}
            <Typography variant="subtitle1" fontWeight="bold">
              Line Items
            </Typography>

            {/* Line items */}
            {form.lines.map((line, index) => (
              <Grid container spacing={1} key={line.id} alignItems="center">
                <Grid item xs={12} sm={1}>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                    {index + 1}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={5}>
                  <TextField
                    select
                    label="Account"
                    value={line.accountNumber}
                    onChange={(e) => updateLine(line.id, 'accountNumber', e.target.value)}
                    fullWidth
                    size="small"
                  >
                    <MenuItem value="">Select Account</MenuItem>
                    {accounts
                      .filter(a => a.active)
                      .map(a => (
                        <MenuItem key={a.accountNumber} value={a.accountNumber}>
                          {a.accountNumber} - {a.name}
                        </MenuItem>
                      ))}
                  </TextField>
                </Grid>
                <Grid item xs={5} sm={2.5}>
                  <TextField
                    label="Debit"
                    type="number"
                    value={line.debit}
                    onChange={(e) => updateLine(line.id, 'debit', e.target.value)}
                    fullWidth
                    size="small"
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={5} sm={2.5}>
                  <TextField
                    label="Credit"
                    type="number"
                    value={line.credit}
                    onChange={(e) => updateLine(line.id, 'credit', e.target.value)}
                    fullWidth
                    size="small"
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                </Grid>
                <Grid item xs={2} sm={1}>
                  <Tooltip title="Remove line">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => removeLine(line.id)}
                      disabled={form.lines.length <= 2}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Grid>
              </Grid>
            ))}

            <Button
              startIcon={<AddCircleOutlineIcon />}
              onClick={addLine}
              size="small"
              sx={{ alignSelf: 'flex-start' }}
            >
              Add Line
            </Button>

            <Divider />

            {/* Totals */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" color="text.secondary">Total Debits</Typography>
                  <Typography variant="h6">${totalDebits.toFixed(2)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 1.5, bgcolor: 'grey.50' }}>
                  <Typography variant="body2" color="text.secondary">Total Credits</Typography>
                  <Typography variant="h6">${totalCredits.toFixed(2)}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Paper sx={{ p: 1.5, bgcolor: isBalanced ? 'success.light' : 'error.light' }}>
                  <Typography variant="body2" color="white">Difference</Typography>
                  <Typography variant="h6" color="white">
                    ${Math.abs(difference).toFixed(2)}
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            {!isBalanced && totalDebits > 0 && (
              <Alert severity="warning">
                Debits and credits must be equal before saving. Current difference: ${Math.abs(difference).toFixed(2)}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!isBalanced || saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Posting...' : 'Post Entry'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default JournalEntryPage;
