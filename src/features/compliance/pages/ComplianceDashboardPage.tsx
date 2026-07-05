import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  TextField,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  IconButton,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { volunteerHoursApi, backgroundChecksApi, form990Api } from '@/lib/api/compliance';
import type { VolunteerHourLog, BackgroundCheck, Form990Data } from '@/types/models';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VerifiedIcon from '@mui/icons-material/Verified';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const currentYear = new Date().getFullYear().toString();

const BACKGROUND_CHECK_ROLES = ['Head Coach', 'Assistant Coach', 'Board Member', 'Volunteer', 'Other'];
const BACKGROUND_CHECK_STATUSES: BackgroundCheck['status'][] = ['pending', 'approved', 'denied', 'expired'];
const FORM_TYPES: Form990Data['formType'][] = ['990-N', '990-EZ', '990'];
const FORM_STATUSES: Form990Data['status'][] = ['draft', 'filed', 'accepted'];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function toDateInputValue(date: Date | string | undefined): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return format(d, 'yyyy-MM-dd');
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return '-';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '-';
  return format(d, 'MM/dd/yyyy');
}

// ---------- Default form states ----------

const defaultVolunteerForm = {
  volunteerName: '',
  date: '',
  hours: '',
  activity: '',
  eventTitle: '',
  season: currentYear,
  notes: '',
};

const defaultBackgroundCheckForm = {
  personName: '',
  personEmail: '',
  role: '',
  provider: '',
  submittedDate: '',
  completedDate: '',
  expirationDate: '',
  status: 'pending' as BackgroundCheck['status'],
  notes: '',
};

const defaultForm990Form = {
  taxYear: currentYear,
  formType: '990-N' as Form990Data['formType'],
  orgName: 'Northern Michigan Waves',
  orgEIN: '88-4060076',
  orgAddress: '',
  orgPhone: '',
  orgWebsite: '',
  yearFormed: '',
  stateOfIncorporation: '',
  grossReceipts: '',
  totalRevenue: '',
  totalExpenses: '',
  netAssets: '',
  totalAssets: '',
  totalLiabilities: '',
  missionStatement: '',
  programAccomplishments: '',
  numberOfVolunteers: '',
  numberOfEmployees: '',
  status: 'draft' as Form990Data['status'],
  filedDate: '',
  notes: '',
};

const ComplianceDashboardPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const admin = checkIsAdmin(user);

  // ---------- State ----------
  const [activeTab, setActiveTab] = useState(0);
  const [seasonFilter, setSeasonFilter] = useState(currentYear);

  // Volunteer hours dialog
  const [volunteerDialogOpen, setVolunteerDialogOpen] = useState(false);
  const [volunteerForm, setVolunteerForm] = useState(defaultVolunteerForm);
  const [editingVolunteerId, setEditingVolunteerId] = useState<string | null>(null);

  // Background check dialog
  const [bgCheckDialogOpen, setBgCheckDialogOpen] = useState(false);
  const [bgCheckForm, setBgCheckForm] = useState(defaultBackgroundCheckForm);
  const [editingBgCheckId, setEditingBgCheckId] = useState<string | null>(null);

  // Form 990 dialog
  const [form990DialogOpen, setForm990DialogOpen] = useState(false);
  const [form990Form, setForm990Form] = useState(defaultForm990Form);
  const [editingForm990Id, setEditingForm990Id] = useState<string | null>(null);

  // ---------- Queries ----------
  const { data: volunteerHours = [], isLoading: loadingVolunteerHours } = useQuery({
    queryKey: ['volunteerHours'],
    queryFn: () => volunteerHoursApi.getAll(),
  });

  const { data: backgroundChecks = [], isLoading: loadingBgChecks } = useQuery({
    queryKey: ['backgroundChecks'],
    queryFn: () => backgroundChecksApi.getAll(),
  });

  const { data: form990Records = [], isLoading: loadingForm990 } = useQuery({
    queryKey: ['form990'],
    queryFn: () => form990Api.getAll(),
  });

  // ---------- Filtered data ----------
  const filteredVolunteerHours = useMemo(
    () => volunteerHours.filter((v) => v.season === seasonFilter),
    [volunteerHours, seasonFilter],
  );

  const totalVolunteerHours = useMemo(
    () => filteredVolunteerHours.reduce((sum, v) => sum + v.hours, 0),
    [filteredVolunteerHours],
  );

  const approvedBgChecks = useMemo(
    () => backgroundChecks.filter((c) => c.status === 'approved').length,
    [backgroundChecks],
  );

  const currentForm990 = useMemo(
    () => form990Records.find((f) => f.taxYear === Number(seasonFilter)),
    [form990Records, seasonFilter],
  );

  const complianceScore = useMemo(() => {
    let total = 0;
    let completed = 0;

    // Volunteer hours: at least 1 logged
    total++;
    if (filteredVolunteerHours.length > 0) completed++;

    // Background checks: all approved
    total++;
    if (backgroundChecks.length > 0 && approvedBgChecks === backgroundChecks.length) completed++;

    // Form 990: filed
    total++;
    if (currentForm990?.status === 'filed') completed++;

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  }, [filteredVolunteerHours, backgroundChecks, approvedBgChecks, currentForm990]);

  const bgCheckStatusCounts = useMemo(() => {
    const counts = { pending: 0, approved: 0, denied: 0, expired: 0 };
    backgroundChecks.forEach((c) => {
      counts[c.status]++;
    });
    return counts;
  }, [backgroundChecks]);

  // ---------- Mutations ----------

  // Volunteer Hours
  const createVolunteerMutation = useMutation({
    mutationFn: (data: Omit<VolunteerHourLog, 'id' | 'createdAt'>) => volunteerHoursApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteerHours'] });
      toast.success('Volunteer hours logged');
      setVolunteerDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to log volunteer hours'),
  });

  const updateVolunteerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VolunteerHourLog> }) =>
      volunteerHoursApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteerHours'] });
      toast.success('Volunteer hours updated');
      setVolunteerDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update volunteer hours'),
  });

  const deleteVolunteerMutation = useMutation({
    mutationFn: (id: string) => volunteerHoursApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteerHours'] });
      toast.success('Volunteer hours deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete volunteer hours'),
  });

  const verifyVolunteerMutation = useMutation({
    mutationFn: (id: string) => volunteerHoursApi.verify(id, user?.uid ?? ''),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['volunteerHours'] });
      toast.success('Hours verified');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to verify hours'),
  });

  // Background Checks
  const createBgCheckMutation = useMutation({
    mutationFn: (data: Omit<BackgroundCheck, 'id' | 'createdAt' | 'updatedAt'>) =>
      backgroundChecksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backgroundChecks'] });
      toast.success('Background check added');
      setBgCheckDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add background check'),
  });

  const updateBgCheckMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BackgroundCheck> }) =>
      backgroundChecksApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backgroundChecks'] });
      toast.success('Background check updated');
      setBgCheckDialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update background check'),
  });

  const deleteBgCheckMutation = useMutation({
    mutationFn: (id: string) => backgroundChecksApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backgroundChecks'] });
      toast.success('Background check deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete background check'),
  });

  // Form 990
  const createForm990Mutation = useMutation({
    mutationFn: (data: Omit<Form990Data, 'id' | 'createdAt' | 'updatedAt'>) => form990Api.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form990'] });
      toast.success('Form 990 record added');
      setForm990DialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add Form 990 record'),
  });

  const updateForm990Mutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Form990Data> }) =>
      form990Api.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form990'] });
      toast.success('Form 990 record updated');
      setForm990DialogOpen(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update Form 990 record'),
  });

  const deleteForm990Mutation = useMutation({
    mutationFn: (id: string) => form990Api.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form990'] });
      toast.success('Form 990 record deleted');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete Form 990 record'),
  });

  // ---------- Handlers: Volunteer Hours ----------

  const handleOpenVolunteerDialog = (row?: VolunteerHourLog) => {
    if (row) {
      setEditingVolunteerId(row.id);
      setVolunteerForm({
        volunteerName: row.volunteerName,
        date: toDateInputValue(row.date),
        hours: String(row.hours),
        activity: row.activity,
        eventTitle: row.eventTitle ?? '',
        season: row.season,
        notes: row.notes ?? '',
      });
    } else {
      setEditingVolunteerId(null);
      setVolunteerForm({ ...defaultVolunteerForm, season: seasonFilter });
    }
    setVolunteerDialogOpen(true);
  };

  const handleSaveVolunteerHours = () => {
    if (!volunteerForm.volunteerName || !volunteerForm.date || !volunteerForm.hours || !volunteerForm.activity) {
      toast.error('Please fill in all required fields');
      return;
    }
    const payload = {
      volunteerName: volunteerForm.volunteerName,
      date: new Date(volunteerForm.date),
      hours: Number(volunteerForm.hours),
      activity: volunteerForm.activity,
      eventTitle: volunteerForm.eventTitle || undefined,
      season: volunteerForm.season,
      notes: volunteerForm.notes || undefined,
      createdBy: user?.uid ?? '',
    };

    if (editingVolunteerId) {
      updateVolunteerMutation.mutate({ id: editingVolunteerId, data: payload });
    } else {
      createVolunteerMutation.mutate(payload);
    }
  };

  const handleDeleteVolunteerHours = (id: string) => {
    if (window.confirm('Are you sure you want to delete this volunteer hour log?')) {
      deleteVolunteerMutation.mutate(id);
    }
  };

  // ---------- Handlers: Background Checks ----------

  const handleOpenBgCheckDialog = (row?: BackgroundCheck) => {
    if (row) {
      setEditingBgCheckId(row.id);
      setBgCheckForm({
        personName: row.personName,
        personEmail: row.personEmail ?? '',
        role: row.role,
        provider: row.provider ?? '',
        submittedDate: toDateInputValue(row.submittedDate),
        completedDate: toDateInputValue(row.completedDate),
        expirationDate: toDateInputValue(row.expirationDate),
        status: row.status,
        notes: row.notes ?? '',
      });
    } else {
      setEditingBgCheckId(null);
      setBgCheckForm({ ...defaultBackgroundCheckForm });
    }
    setBgCheckDialogOpen(true);
  };

  const handleSaveBgCheck = () => {
    if (!bgCheckForm.personName || !bgCheckForm.role || !bgCheckForm.submittedDate) {
      toast.error('Please fill in all required fields');
      return;
    }
    const payload = {
      personName: bgCheckForm.personName,
      personEmail: bgCheckForm.personEmail || undefined,
      role: bgCheckForm.role,
      provider: bgCheckForm.provider || undefined,
      submittedDate: new Date(bgCheckForm.submittedDate),
      completedDate: bgCheckForm.completedDate ? new Date(bgCheckForm.completedDate) : undefined,
      expirationDate: bgCheckForm.expirationDate ? new Date(bgCheckForm.expirationDate) : undefined,
      status: bgCheckForm.status,
      notes: bgCheckForm.notes || undefined,
      createdBy: user?.uid ?? '',
    };

    if (editingBgCheckId) {
      updateBgCheckMutation.mutate({ id: editingBgCheckId, data: payload });
    } else {
      createBgCheckMutation.mutate(payload);
    }
  };

  const handleDeleteBgCheck = (id: string) => {
    if (window.confirm('Are you sure you want to delete this background check?')) {
      deleteBgCheckMutation.mutate(id);
    }
  };

  // ---------- Handlers: Form 990 ----------

  const handleOpenForm990Dialog = (row?: Form990Data) => {
    if (row) {
      setEditingForm990Id(row.id);
      setForm990Form({
        taxYear: String(row.taxYear),
        formType: row.formType,
        orgName: row.orgName,
        orgEIN: row.orgEIN,
        orgAddress: row.orgAddress ?? '',
        orgPhone: row.orgPhone ?? '',
        orgWebsite: row.orgWebsite ?? '',
        yearFormed: row.yearFormed ? String(row.yearFormed) : '',
        stateOfIncorporation: row.stateOfIncorporation ?? '',
        grossReceipts: String(row.grossReceipts),
        totalRevenue: String(row.totalRevenue),
        totalExpenses: String(row.totalExpenses),
        netAssets: String(row.netAssets),
        totalAssets: String(row.totalAssets),
        totalLiabilities: String(row.totalLiabilities),
        missionStatement: row.missionStatement ?? '',
        programAccomplishments: row.programAccomplishments ?? '',
        numberOfVolunteers: row.numberOfVolunteers != null ? String(row.numberOfVolunteers) : '',
        numberOfEmployees: row.numberOfEmployees != null ? String(row.numberOfEmployees) : '',
        status: row.status,
        filedDate: toDateInputValue(row.filedDate),
        notes: row.notes ?? '',
      });
    } else {
      setEditingForm990Id(null);
      setForm990Form({ ...defaultForm990Form });
    }
    setForm990DialogOpen(true);
  };

  const handleSaveForm990 = () => {
    if (!form990Form.taxYear || !form990Form.orgName) {
      toast.error('Please fill in all required fields');
      return;
    }
    const payload = {
      taxYear: Number(form990Form.taxYear),
      formType: form990Form.formType,
      orgName: form990Form.orgName,
      orgEIN: form990Form.orgEIN,
      orgAddress: form990Form.orgAddress || '',
      orgPhone: form990Form.orgPhone || undefined,
      orgWebsite: form990Form.orgWebsite || undefined,
      yearFormed: form990Form.yearFormed ? Number(form990Form.yearFormed) : undefined,
      stateOfIncorporation: form990Form.stateOfIncorporation || undefined,
      grossReceipts: Number(form990Form.grossReceipts) || 0,
      totalRevenue: Number(form990Form.totalRevenue) || 0,
      totalExpenses: Number(form990Form.totalExpenses) || 0,
      netAssets: Number(form990Form.netAssets) || 0,
      totalAssets: Number(form990Form.totalAssets) || 0,
      totalLiabilities: Number(form990Form.totalLiabilities) || 0,
      missionStatement: form990Form.missionStatement || undefined,
      programAccomplishments: form990Form.programAccomplishments || undefined,
      numberOfVolunteers: form990Form.numberOfVolunteers ? Number(form990Form.numberOfVolunteers) : undefined,
      numberOfEmployees: form990Form.numberOfEmployees ? Number(form990Form.numberOfEmployees) : undefined,
      officers: [],
      status: form990Form.status,
      filedDate: form990Form.filedDate ? new Date(form990Form.filedDate) : undefined,
      notes: form990Form.notes || undefined,
      createdBy: user?.uid ?? '',
    };

    if (editingForm990Id) {
      updateForm990Mutation.mutate({ id: editingForm990Id, data: payload });
    } else {
      createForm990Mutation.mutate(payload);
    }
  };

  const handleDeleteForm990 = (id: string) => {
    if (window.confirm('Are you sure you want to delete this Form 990 record?')) {
      deleteForm990Mutation.mutate(id);
    }
  };

  // ---------- Column Definitions ----------

  const volunteerColumns: GridColDef[] = [
    { field: 'volunteerName', headerName: 'Volunteer Name', flex: 1, minWidth: 150 },
    {
      field: 'date',
      headerName: 'Date',
      width: 120,
      valueFormatter: (params) => formatDate(params.value),
    },
    { field: 'hours', headerName: 'Hours', width: 80, type: 'number' },
    { field: 'activity', headerName: 'Activity', width: 150 },
    {
      field: 'eventTitle',
      headerName: 'Event',
      width: 150,
      valueGetter: (params) => params.row.eventTitle || '-',
    },
    { field: 'season', headerName: 'Season', width: 100 },
    {
      field: 'verifiedBy',
      headerName: 'Verified',
      width: 150,
      renderCell: (params) =>
        params.value ? (
          <Chip label={`Verified: ${params.value}`} color="success" size="small" />
        ) : (
          <Chip label="Unverified" color="warning" size="small" />
        ),
    },
    ...(admin
      ? [
          {
            field: 'actions',
            headerName: 'Actions',
            width: 180,
            sortable: false,
            renderCell: (params: { row: VolunteerHourLog }) => (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {!params.row.verifiedBy && (
                  <Tooltip title="Verify">
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => verifyVolunteerMutation.mutate(params.row.id)}
                    >
                      <VerifiedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleOpenVolunteerDialog(params.row as VolunteerHourLog)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteVolunteerHours(params.row.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          } as GridColDef,
        ]
      : []),
  ];

  const bgCheckColumns: GridColDef[] = [
    { field: 'personName', headerName: 'Person Name', flex: 1, minWidth: 150 },
    { field: 'personEmail', headerName: 'Email', width: 180 },
    { field: 'role', headerName: 'Role', width: 140 },
    { field: 'provider', headerName: 'Provider', width: 130 },
    {
      field: 'submittedDate',
      headerName: 'Submitted',
      width: 120,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'completedDate',
      headerName: 'Completed',
      width: 120,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'expirationDate',
      headerName: 'Expires',
      width: 120,
      valueFormatter: (params) => formatDate(params.value),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const statusColorMap: Record<BackgroundCheck['status'], 'warning' | 'success' | 'error' | 'default'> = {
          pending: 'warning',
          approved: 'success',
          denied: 'error',
          expired: 'default',
        };
        return (
          <Chip
            label={params.value}
            color={statusColorMap[params.value as BackgroundCheck['status']]}
            size="small"
          />
        );
      },
    },
    ...(admin
      ? [
          {
            field: 'actions',
            headerName: 'Actions',
            width: 120,
            sortable: false,
            renderCell: (params: { row: BackgroundCheck }) => (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleOpenBgCheckDialog(params.row as BackgroundCheck)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteBgCheck(params.row.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          } as GridColDef,
        ]
      : []),
  ];

  const form990Columns: GridColDef[] = [
    { field: 'taxYear', headerName: 'Tax Year', width: 100 },
    {
      field: 'formType',
      headerName: 'Form Type',
      width: 110,
      renderCell: (params) => <Chip label={params.value} size="small" variant="outlined" />,
    },
    { field: 'orgName', headerName: 'Org Name', flex: 1, minWidth: 150 },
    {
      field: 'grossReceipts',
      headerName: 'Gross Receipts',
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value ?? 0),
    },
    {
      field: 'totalRevenue',
      headerName: 'Total Revenue',
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value ?? 0),
    },
    {
      field: 'totalExpenses',
      headerName: 'Total Expenses',
      width: 140,
      valueFormatter: (params) => formatCurrency(params.value ?? 0),
    },
    {
      field: 'netAssets',
      headerName: 'Net Assets',
      width: 130,
      valueFormatter: (params) => formatCurrency(params.value ?? 0),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => {
        const colorMap: Record<Form990Data['status'], 'warning' | 'info' | 'success'> = {
          draft: 'warning',
          filed: 'info',
          accepted: 'success',
        };
        const labelMap: Record<Form990Data['status'], string> = {
          draft: 'Draft',
          filed: 'Filed',
          accepted: 'Accepted',
        };
        return (
          <Chip
            label={labelMap[params.value as Form990Data['status']]}
            color={colorMap[params.value as Form990Data['status']]}
            size="small"
          />
        );
      },
    },
    ...(admin
      ? [
          {
            field: 'actions',
            headerName: 'Actions',
            width: 120,
            sortable: false,
            renderCell: (params: { row: Form990Data }) => (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => handleOpenForm990Dialog(params.row as Form990Data)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteForm990(params.row.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          } as GridColDef,
        ]
      : []),
  ];

  // ---------- Year options ----------
  const yearOptions = [];
  for (let y = Number(currentYear) + 1; y >= 2020; y--) {
    yearOptions.push(String(y));
  }

  // ---------- Render ----------
  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Compliance Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track volunteer hours, background checks, and Form 990 data for Northern Michigan Waves.
        </Typography>
      </Box>

      {/* Season Filter */}
      <Box sx={{ mb: 3 }}>
        <TextField
          select
          label="Season / Year"
          value={seasonFilter}
          onChange={(e) => setSeasonFilter(e.target.value)}
          size="small"
          sx={{ minWidth: 160 }}
        >
          {yearOptions.map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Volunteer Hours
              </Typography>
              <Typography variant="h4">{totalVolunteerHours}</Typography>
              <Typography variant="caption" color="text.secondary">
                Total for {seasonFilter}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Background Checks
              </Typography>
              <Typography variant="h4">
                {approvedBgChecks} / {backgroundChecks.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Approved
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Form 990 Status
              </Typography>
              <Typography variant="h4" sx={{ textTransform: 'capitalize' }}>
                {currentForm990
                  ? currentForm990.status.charAt(0).toUpperCase() + currentForm990.status.slice(1)
                  : 'N/A'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Tax Year {seasonFilter}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                Compliance Score
              </Typography>
              <Typography variant="h4">{complianceScore}%</Typography>
              <LinearProgress
                variant="determinate"
                value={complianceScore}
                sx={{ mt: 1 }}
                color={complianceScore === 100 ? 'success' : complianceScore >= 50 ? 'warning' : 'error'}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_e, val) => setActiveTab(val)} sx={{ mb: 2 }}>
        <Tab label="Volunteer Hours" />
        <Tab label="Background Checks" />
        <Tab label="Form 990" />
      </Tabs>

      {/* Tab: Volunteer Hours */}
      {activeTab === 0 && (
        <Box>
          {admin && (
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenVolunteerDialog()}
              >
                Log Hours
              </Button>
            </Box>
          )}
          <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
            <DataGrid
              rows={filteredVolunteerHours}
              columns={volunteerColumns}
              loading={loadingVolunteerHours}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              disableRowSelectionOnClick
            />
          </Paper>
        </Box>
      )}

      {/* Tab: Background Checks */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip label={`Pending: ${bgCheckStatusCounts.pending}`} color="warning" size="small" />
              <Chip label={`Approved: ${bgCheckStatusCounts.approved}`} color="success" size="small" />
              <Chip label={`Denied: ${bgCheckStatusCounts.denied}`} color="error" size="small" />
              <Chip label={`Expired: ${bgCheckStatusCounts.expired}`} size="small" />
            </Box>
            {admin && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenBgCheckDialog()}
              >
                Add Check
              </Button>
            )}
          </Box>
          <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
            <DataGrid
              rows={backgroundChecks}
              columns={bgCheckColumns}
              loading={loadingBgChecks}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
              }}
              disableRowSelectionOnClick
            />
          </Paper>
        </Box>
      )}

      {/* Tab: Form 990 */}
      {activeTab === 2 && (
        <Box>
          {admin && (
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleOpenForm990Dialog()}
              >
                Add Tax Year
              </Button>
            </Box>
          )}
          <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
            <DataGrid
              rows={form990Records}
              columns={form990Columns}
              loading={loadingForm990}
              pageSizeOptions={[10, 25, 50]}
              initialState={{
                pagination: { paginationModel: { pageSize: 10 } },
                sorting: { sortModel: [{ field: 'taxYear', sort: 'desc' }] },
              }}
              disableRowSelectionOnClick
            />
          </Paper>
        </Box>
      )}

      {/* ========== DIALOGS ========== */}

      {/* Volunteer Hours Dialog */}
      <Dialog open={volunteerDialogOpen} onClose={() => setVolunteerDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingVolunteerId ? 'Edit Volunteer Hours' : 'Log Volunteer Hours'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Volunteer Name"
              required
              value={volunteerForm.volunteerName}
              onChange={(e) => setVolunteerForm({ ...volunteerForm, volunteerName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Date"
              type="date"
              required
              value={volunteerForm.date}
              onChange={(e) => setVolunteerForm({ ...volunteerForm, date: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Hours"
              type="number"
              required
              value={volunteerForm.hours}
              onChange={(e) => setVolunteerForm({ ...volunteerForm, hours: e.target.value })}
              fullWidth
            />
            <TextField
              label="Activity"
              required
              value={volunteerForm.activity}
              onChange={(e) => setVolunteerForm({ ...volunteerForm, activity: e.target.value })}
              fullWidth
            />
            <TextField
              label="Event Title"
              value={volunteerForm.eventTitle}
              onChange={(e) => setVolunteerForm({ ...volunteerForm, eventTitle: e.target.value })}
              fullWidth
            />
            <TextField
              label="Season"
              required
              value={volunteerForm.season}
              onChange={(e) => setVolunteerForm({ ...volunteerForm, season: e.target.value })}
              fullWidth
            />
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={volunteerForm.notes}
              onChange={(e) => setVolunteerForm({ ...volunteerForm, notes: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVolunteerDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveVolunteerHours}
            disabled={createVolunteerMutation.isPending || updateVolunteerMutation.isPending}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Background Check Dialog */}
      <Dialog open={bgCheckDialogOpen} onClose={() => setBgCheckDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingBgCheckId ? 'Edit Background Check' : 'Add Background Check'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Person Name"
              required
              value={bgCheckForm.personName}
              onChange={(e) => setBgCheckForm({ ...bgCheckForm, personName: e.target.value })}
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={bgCheckForm.personEmail}
              onChange={(e) => setBgCheckForm({ ...bgCheckForm, personEmail: e.target.value })}
              fullWidth
            />
            <TextField
              label="Role"
              select
              required
              value={bgCheckForm.role}
              onChange={(e) => setBgCheckForm({ ...bgCheckForm, role: e.target.value })}
              fullWidth
            >
              {BACKGROUND_CHECK_ROLES.map((role) => (
                <MenuItem key={role} value={role}>
                  {role}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Provider"
              value={bgCheckForm.provider}
              onChange={(e) => setBgCheckForm({ ...bgCheckForm, provider: e.target.value })}
              fullWidth
            />
            <TextField
              label="Submitted Date"
              type="date"
              required
              value={bgCheckForm.submittedDate}
              onChange={(e) => setBgCheckForm({ ...bgCheckForm, submittedDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Completed Date"
              type="date"
              value={bgCheckForm.completedDate}
              onChange={(e) => setBgCheckForm({ ...bgCheckForm, completedDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Expiration Date"
              type="date"
              value={bgCheckForm.expirationDate}
              onChange={(e) => setBgCheckForm({ ...bgCheckForm, expirationDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Status"
              select
              value={bgCheckForm.status}
              onChange={(e) =>
                setBgCheckForm({ ...bgCheckForm, status: e.target.value as BackgroundCheck['status'] })
              }
              fullWidth
            >
              {BACKGROUND_CHECK_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={bgCheckForm.notes}
              onChange={(e) => setBgCheckForm({ ...bgCheckForm, notes: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBgCheckDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveBgCheck}
            disabled={createBgCheckMutation.isPending || updateBgCheckMutation.isPending}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Form 990 Dialog */}
      <Dialog open={form990DialogOpen} onClose={() => setForm990DialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingForm990Id ? 'Edit Form 990' : 'Add Form 990 Record'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Organization Info */}
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 1 }}>
              Organization Info
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Tax Year"
                  type="number"
                  required
                  value={form990Form.taxYear}
                  onChange={(e) => setForm990Form({ ...form990Form, taxYear: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Form Type"
                  select
                  value={form990Form.formType}
                  onChange={(e) =>
                    setForm990Form({ ...form990Form, formType: e.target.value as Form990Data['formType'] })
                  }
                  fullWidth
                >
                  {FORM_TYPES.map((ft) => (
                    <MenuItem key={ft} value={ft}>
                      {ft}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Org Name"
                  required
                  value={form990Form.orgName}
                  onChange={(e) => setForm990Form({ ...form990Form, orgName: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="EIN"
                  value={form990Form.orgEIN}
                  onChange={(e) => setForm990Form({ ...form990Form, orgEIN: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={8}>
                <TextField
                  label="Address"
                  value={form990Form.orgAddress}
                  onChange={(e) => setForm990Form({ ...form990Form, orgAddress: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Phone"
                  value={form990Form.orgPhone}
                  onChange={(e) => setForm990Form({ ...form990Form, orgPhone: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Website"
                  value={form990Form.orgWebsite}
                  onChange={(e) => setForm990Form({ ...form990Form, orgWebsite: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  label="Year Formed"
                  type="number"
                  value={form990Form.yearFormed}
                  onChange={(e) => setForm990Form({ ...form990Form, yearFormed: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <TextField
                  label="State"
                  value={form990Form.stateOfIncorporation}
                  onChange={(e) => setForm990Form({ ...form990Form, stateOfIncorporation: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>

            {/* Financial Summary */}
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
              Financial Summary
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Gross Receipts"
                  type="number"
                  value={form990Form.grossReceipts}
                  onChange={(e) => setForm990Form({ ...form990Form, grossReceipts: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Total Revenue"
                  type="number"
                  value={form990Form.totalRevenue}
                  onChange={(e) => setForm990Form({ ...form990Form, totalRevenue: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Total Expenses"
                  type="number"
                  value={form990Form.totalExpenses}
                  onChange={(e) => setForm990Form({ ...form990Form, totalExpenses: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Net Assets"
                  type="number"
                  value={form990Form.netAssets}
                  onChange={(e) => setForm990Form({ ...form990Form, netAssets: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Total Assets"
                  type="number"
                  value={form990Form.totalAssets}
                  onChange={(e) => setForm990Form({ ...form990Form, totalAssets: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Total Liabilities"
                  type="number"
                  value={form990Form.totalLiabilities}
                  onChange={(e) => setForm990Form({ ...form990Form, totalLiabilities: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>

            {/* Program Info */}
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
              Program Info
            </Typography>
            <TextField
              label="Mission Statement"
              multiline
              rows={3}
              value={form990Form.missionStatement}
              onChange={(e) => setForm990Form({ ...form990Form, missionStatement: e.target.value })}
              fullWidth
            />
            <TextField
              label="Program Accomplishments"
              multiline
              rows={3}
              value={form990Form.programAccomplishments}
              onChange={(e) => setForm990Form({ ...form990Form, programAccomplishments: e.target.value })}
              fullWidth
            />
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Number of Volunteers"
                  type="number"
                  value={form990Form.numberOfVolunteers}
                  onChange={(e) => setForm990Form({ ...form990Form, numberOfVolunteers: e.target.value })}
                  fullWidth
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Number of Employees"
                  type="number"
                  value={form990Form.numberOfEmployees}
                  onChange={(e) => setForm990Form({ ...form990Form, numberOfEmployees: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>

            {/* Filing */}
            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mt: 2 }}>
              Filing
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Status"
                  select
                  value={form990Form.status}
                  onChange={(e) =>
                    setForm990Form({ ...form990Form, status: e.target.value as Form990Data['status'] })
                  }
                  fullWidth
                >
                  {FORM_STATUSES.map((s) => (
                    <MenuItem key={s} value={s}>
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              {form990Form.status === 'filed' && (
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Filed Date"
                    type="date"
                    value={form990Form.filedDate}
                    onChange={(e) => setForm990Form({ ...form990Form, filedDate: e.target.value })}
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
              )}
            </Grid>
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={form990Form.notes}
              onChange={(e) => setForm990Form({ ...form990Form, notes: e.target.value })}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForm990DialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveForm990}
            disabled={createForm990Mutation.isPending || updateForm990Mutation.isPending}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ComplianceDashboardPage;
