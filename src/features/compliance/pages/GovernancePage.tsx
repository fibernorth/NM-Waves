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
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '@/components/common/ConfirmProvider';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import VisibilityIcon from '@mui/icons-material/Visibility';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import { boardMeetingsApi, governanceDocsApi } from '@/lib/api/governance';
import type { BoardMeeting, GovernanceDocument, GovernanceDocType } from '@/types/models';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatDateSafe = (date: Date | undefined | null, fmt = 'MM/dd/yyyy') => {
  if (!date) return '-';
  try {
    return format(date, fmt);
  } catch {
    return '-';
  }
};

const toTitleCase = (str: string) =>
  str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const GOV_DOC_TYPE_OPTIONS: { value: GovernanceDocType; label: string }[] = [
  { value: 'bylaws', label: 'Bylaws' },
  { value: 'articles_of_incorporation', label: 'Articles of Incorporation' },
  { value: 'conflict_of_interest', label: 'Conflict of Interest' },
  { value: 'whistleblower', label: 'Whistleblower' },
  { value: 'document_retention', label: 'Document Retention' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'gift_acceptance', label: 'Gift Acceptance' },
  { value: 'financial_controls', label: 'Financial Controls' },
  { value: 'other', label: 'Other' },
];

// ---------------------------------------------------------------------------
// Tab Panel
// ---------------------------------------------------------------------------

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => (
  <div role="tabpanel" hidden={value !== index}>
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

// ---------------------------------------------------------------------------
// Default form states
// ---------------------------------------------------------------------------

interface MeetingFormState {
  title: string;
  date: string;
  location: string;
  attendees: string;
  absentees: string;
  agendaItems: string;
  minutesText: string;
  resolutions: string;
  nextMeetingDate: string;
}

const defaultMeetingForm: MeetingFormState = {
  title: '',
  date: '',
  location: '',
  attendees: '',
  absentees: '',
  agendaItems: '',
  minutesText: '',
  resolutions: '',
  nextMeetingDate: '',
};

interface DocFormState {
  type: GovernanceDocType;
  title: string;
  description: string;
  version: string;
  effectiveDate: string;
  reviewDate: string;
  fileUrl: string;
  fileName: string;
  status: 'draft' | 'active' | 'archived';
}

const defaultDocForm: DocFormState = {
  type: 'bylaws',
  title: '',
  description: '',
  version: '1.0',
  effectiveDate: '',
  reviewDate: '',
  fileUrl: '',
  fileName: '',
  status: 'draft',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GovernancePage = () => {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  // Tab state
  const [tabIndex, setTabIndex] = useState(0);

  // Meeting dialog state
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<BoardMeeting | null>(null);
  const [meetingForm, setMeetingForm] = useState<MeetingFormState>(defaultMeetingForm);

  // Document dialog state
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<GovernanceDocument | null>(null);
  const [docForm, setDocForm] = useState<DocFormState>(defaultDocForm);

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  const { data: meetings = [], isLoading: meetingsLoading, isError: meetingsError } = useQuery({
    queryKey: ['boardMeetings'],
    queryFn: () => boardMeetingsApi.getAll(),
  });

  const { data: documents = [], isLoading: docsLoading, isError: docsError } = useQuery({
    queryKey: ['governanceDocs'],
    queryFn: () => governanceDocsApi.getAll(),
  });

  // ---------------------------------------------------------------------------
  // Summary cards
  // ---------------------------------------------------------------------------

  const summary = useMemo(() => {
    const totalMeetings = meetings.length;
    const approvedMinutes = meetings.filter((m) => m.status === 'approved').length;
    const activeDocs = documents.filter((d) => d.status === 'active').length;
    const pendingReview = meetings.filter((m) => m.status === 'draft').length +
      documents.filter((d) => d.status === 'draft').length;
    return { totalMeetings, approvedMinutes, activeDocs, pendingReview };
  }, [meetings, documents]);

  // ---------------------------------------------------------------------------
  // Mutations - Meetings
  // ---------------------------------------------------------------------------

  const createMeetingMutation = useMutation({
    mutationFn: (data: Omit<BoardMeeting, 'id' | 'createdAt' | 'updatedAt'>) =>
      boardMeetingsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boardMeetings'] });
      toast.success('Meeting created successfully');
      closeMeetingDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create meeting');
    },
  });

  const updateMeetingMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BoardMeeting> }) =>
      boardMeetingsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boardMeetings'] });
      toast.success('Meeting updated successfully');
      closeMeetingDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update meeting');
    },
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: (id: string) => boardMeetingsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boardMeetings'] });
      toast.success('Meeting deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete meeting');
    },
  });

  const approveMeetingMutation = useMutation({
    mutationFn: ({ id, approvedBy }: { id: string; approvedBy: string }) =>
      boardMeetingsApi.approve(id, approvedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boardMeetings'] });
      toast.success('Meeting minutes approved');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to approve meeting');
    },
  });

  // ---------------------------------------------------------------------------
  // Mutations - Documents
  // ---------------------------------------------------------------------------

  const createDocMutation = useMutation({
    mutationFn: (data: Omit<GovernanceDocument, 'id' | 'createdAt' | 'updatedAt'>) =>
      governanceDocsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governanceDocs'] });
      toast.success('Document created successfully');
      closeDocDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to create document');
    },
  });

  const updateDocMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<GovernanceDocument> }) =>
      governanceDocsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governanceDocs'] });
      toast.success('Document updated successfully');
      closeDocDialog();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update document');
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: (id: string) => governanceDocsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['governanceDocs'] });
      toast.success('Document deleted successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete document');
    },
  });

  // ---------------------------------------------------------------------------
  // Meeting dialog helpers
  // ---------------------------------------------------------------------------

  const openAddMeeting = () => {
    setEditingMeeting(null);
    setMeetingForm(defaultMeetingForm);
    setMeetingDialogOpen(true);
  };

  const openEditMeeting = (meeting: BoardMeeting) => {
    setEditingMeeting(meeting);
    setMeetingForm({
      title: meeting.title,
      date: meeting.date ? format(meeting.date, 'yyyy-MM-dd') : '',
      location: meeting.location || '',
      attendees: meeting.attendees.join(', '),
      absentees: (meeting.absentees || []).join(', '),
      agendaItems: meeting.agendaItems.join('\n'),
      minutesText: meeting.minutesText,
      resolutions: (meeting.resolutions || []).join('\n'),
      nextMeetingDate: meeting.nextMeetingDate
        ? format(meeting.nextMeetingDate, 'yyyy-MM-dd')
        : '',
    });
    setMeetingDialogOpen(true);
  };

  const closeMeetingDialog = () => {
    setMeetingDialogOpen(false);
    setEditingMeeting(null);
    setMeetingForm(defaultMeetingForm);
  };

  const handleSaveMeeting = () => {
    if (!meetingForm.title || !meetingForm.date) {
      toast.error('Title and date are required');
      return;
    }

    const splitCsv = (val: string) =>
      val
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

    const splitLines = (val: string) =>
      val
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);

    const payload: any = {
      title: meetingForm.title,
      date: new Date(meetingForm.date + 'T00:00:00'),
      location: meetingForm.location || '',
      attendees: splitCsv(meetingForm.attendees),
      absentees: splitCsv(meetingForm.absentees),
      agendaItems: splitLines(meetingForm.agendaItems),
      minutesText: meetingForm.minutesText,
      resolutions: splitLines(meetingForm.resolutions),
      status: 'draft' as const,
      createdBy: user?.uid || '',
    };
    if (meetingForm.nextMeetingDate) {
      payload.nextMeetingDate = new Date(meetingForm.nextMeetingDate + 'T00:00:00');
    }

    if (editingMeeting) {
      updateMeetingMutation.mutate({ id: editingMeeting.id, data: payload });
    } else {
      createMeetingMutation.mutate(payload);
    }
  };

  const handleDeleteMeeting = async (id: string) => {
    if (await confirm({ message: 'Are you sure you want to delete this meeting?', confirmText: 'Delete', destructive: true })) {
      deleteMeetingMutation.mutate(id);
    }
  };

  const handleApproveMeeting = (id: string) => {
    const approvedBy = user?.displayName || user?.email || '';
    approveMeetingMutation.mutate({ id, approvedBy });
  };

  // ---------------------------------------------------------------------------
  // Document dialog helpers
  // ---------------------------------------------------------------------------

  const openAddDoc = () => {
    setEditingDoc(null);
    setDocForm(defaultDocForm);
    setDocDialogOpen(true);
  };

  const openEditDoc = (doc: GovernanceDocument) => {
    setEditingDoc(doc);
    setDocForm({
      type: doc.type,
      title: doc.title,
      description: doc.description || '',
      version: doc.version,
      effectiveDate: doc.effectiveDate ? format(doc.effectiveDate, 'yyyy-MM-dd') : '',
      reviewDate: doc.reviewDate ? format(doc.reviewDate, 'yyyy-MM-dd') : '',
      fileUrl: doc.fileUrl || '',
      fileName: doc.fileName || '',
      status: doc.status,
    });
    setDocDialogOpen(true);
  };

  const closeDocDialog = () => {
    setDocDialogOpen(false);
    setEditingDoc(null);
    setDocForm(defaultDocForm);
  };

  const handleSaveDoc = () => {
    if (!docForm.title || !docForm.effectiveDate) {
      toast.error('Title and effective date are required');
      return;
    }

    const payload: any = {
      type: docForm.type,
      title: docForm.title,
      description: docForm.description || '',
      version: docForm.version,
      effectiveDate: new Date(docForm.effectiveDate + 'T00:00:00'),
      fileUrl: docForm.fileUrl,
      fileName: docForm.fileName,
      status: docForm.status,
      createdBy: user?.uid || '',
    };
    if (docForm.reviewDate) {
      payload.reviewDate = new Date(docForm.reviewDate + 'T00:00:00');
    }

    if (editingDoc) {
      updateDocMutation.mutate({ id: editingDoc.id, data: payload });
    } else {
      createDocMutation.mutate(payload);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    if (await confirm({ message: 'Are you sure you want to delete this document?', confirmText: 'Delete', destructive: true })) {
      deleteDocMutation.mutate(id);
    }
  };

  // ---------------------------------------------------------------------------
  // DataGrid columns - Meetings
  // ---------------------------------------------------------------------------

  const meetingColumns: GridColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      width: 120,
      valueFormatter: (params: any) => formatDateSafe(params.value),
    },
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 160,
      renderCell: (params: any) => params.value || '-',
    },
    {
      field: 'attendees',
      headerName: 'Attendees',
      width: 120,
      renderCell: (params: any) => {
        const count = (params.value as string[])?.length || 0;
        return `${count} present`;
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: any) => (
        <Chip
          label={params.value === 'approved' ? 'Approved' : 'Draft'}
          size="small"
          color={params.value === 'approved' ? 'success' : 'warning'}
        />
      ),
    },
    ...(isAdmin
      ? [
          {
            field: 'actions' as const,
            headerName: 'Actions',
            width: 180,
            sortable: false,
            renderCell: (params: any) => (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="View / Edit">
                  <IconButton
                    size="small"
                    onClick={() => openEditMeeting(params.row as BoardMeeting)}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {params.row.status === 'draft' && (
                  <Tooltip title="Approve">
                    <IconButton
                      size="small"
                      color="success"
                      onClick={() => handleApproveMeeting(params.row.id)}
                    >
                      <CheckCircleIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteMeeting(params.row.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          },
        ]
      : []),
  ];

  // ---------------------------------------------------------------------------
  // DataGrid columns - Documents
  // ---------------------------------------------------------------------------

  const docColumns: GridColDef[] = [
    {
      field: 'type',
      headerName: 'Type',
      width: 180,
      renderCell: (params: any) => (
        <Chip label={toTitleCase(params.value)} size="small" variant="outlined" />
      ),
    },
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'version',
      headerName: 'Version',
      width: 90,
    },
    {
      field: 'effectiveDate',
      headerName: 'Effective Date',
      width: 130,
      valueFormatter: (params: any) => formatDateSafe(params.value),
    },
    {
      field: 'reviewDate',
      headerName: 'Review Date',
      width: 130,
      valueFormatter: (params: any) => formatDateSafe(params.value),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      renderCell: (params: any) => {
        const colorMap: Record<string, 'warning' | 'success' | 'default'> = {
          draft: 'warning',
          active: 'success',
          archived: 'default',
        };
        return (
          <Chip
            label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
            size="small"
            color={colorMap[params.value] || 'default'}
          />
        );
      },
    },
    ...(isAdmin
      ? [
          {
            field: 'actions' as const,
            headerName: 'Actions',
            width: 150,
            sortable: false,
            renderCell: (params: any) => (
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    onClick={() => openEditDoc(params.row as GovernanceDocument)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {params.row.fileUrl && (
                  <Tooltip title="View File">
                    <IconButton
                      size="small"
                      color="primary"
                      component="a"
                      href={params.row.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteDoc(params.row.id)}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            ),
          },
        ]
      : []),
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Governance & Board</Typography>
        <Typography variant="body2" color="text.secondary">
          Manage board meetings, minutes, and governance documents for Northern Michigan Waves.
        </Typography>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Total Meetings
              </Typography>
              <Typography variant="h5">{summary.totalMeetings}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Approved Minutes
              </Typography>
              <Typography variant="h5">{summary.approvedMinutes}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Active Documents
              </Typography>
              <Typography variant="h5">{summary.activeDocs}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                Pending Review
              </Typography>
              <Typography variant="h5">{summary.pendingReview}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {(meetingsError || docsError) && (
        <Alert severity="error" sx={{ mb: 2 }}>Failed to load governance data. Please refresh the page.</Alert>
      )}

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
          <Tab label="Board Meetings" />
          <Tab label="Documents" />
        </Tabs>
      </Box>

      {/* Board Meetings Tab */}
      <TabPanel value={tabIndex} index={0}>
        {isAdmin && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAddMeeting}>
              Add Meeting
            </Button>
          </Box>
        )}
        <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
          <DataGrid
            rows={meetings}
            columns={meetingColumns}
            loading={meetingsLoading}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            disableRowSelectionOnClick
          />
        </Paper>
      </TabPanel>

      {/* Documents Tab */}
      <TabPanel value={tabIndex} index={1}>
        {isAdmin && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDoc}>
              Add Document
            </Button>
          </Box>
        )}
        <Paper sx={{ height: { xs: 400, md: 600 }, width: '100%' }}>
          <DataGrid
            rows={documents}
            columns={docColumns}
            loading={docsLoading}
            pageSizeOptions={[10, 25, 50]}
            initialState={{
              pagination: { paginationModel: { pageSize: 10 } },
            }}
            disableRowSelectionOnClick
          />
        </Paper>
      </TabPanel>

      {/* ------------------------------------------------------------------ */}
      {/* Meeting Form Dialog                                                 */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={meetingDialogOpen}
        onClose={closeMeetingDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingMeeting ? 'Edit Meeting' : 'Add Meeting'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              value={meetingForm.title}
              onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Date"
              type="date"
              value={meetingForm.date}
              onChange={(e) => setMeetingForm({ ...meetingForm, date: e.target.value })}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Location"
              value={meetingForm.location}
              onChange={(e) => setMeetingForm({ ...meetingForm, location: e.target.value })}
              fullWidth
            />
            <TextField
              label="Attendees (comma-separated)"
              value={meetingForm.attendees}
              onChange={(e) => setMeetingForm({ ...meetingForm, attendees: e.target.value })}
              fullWidth
              helperText="Enter names separated by commas"
            />
            <TextField
              label="Absentees (comma-separated)"
              value={meetingForm.absentees}
              onChange={(e) => setMeetingForm({ ...meetingForm, absentees: e.target.value })}
              fullWidth
              helperText="Enter names separated by commas"
            />
            <TextField
              label="Agenda Items (one per line)"
              value={meetingForm.agendaItems}
              onChange={(e) =>
                setMeetingForm({ ...meetingForm, agendaItems: e.target.value })
              }
              multiline
              rows={4}
              fullWidth
            />
            <TextField
              label="Minutes Text"
              value={meetingForm.minutesText}
              onChange={(e) =>
                setMeetingForm({ ...meetingForm, minutesText: e.target.value })
              }
              multiline
              rows={6}
              fullWidth
            />
            <TextField
              label="Resolutions (one per line)"
              value={meetingForm.resolutions}
              onChange={(e) =>
                setMeetingForm({ ...meetingForm, resolutions: e.target.value })
              }
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Next Meeting Date"
              type="date"
              value={meetingForm.nextMeetingDate}
              onChange={(e) =>
                setMeetingForm({ ...meetingForm, nextMeetingDate: e.target.value })
              }
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeMeetingDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveMeeting}
            disabled={createMeetingMutation.isPending || updateMeetingMutation.isPending}
          >
            {editingMeeting ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* Document Form Dialog                                                */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={docDialogOpen}
        onClose={closeDocDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {editingDoc ? 'Edit Document' : 'Add Document'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Document Type"
              value={docForm.type}
              onChange={(e) =>
                setDocForm({ ...docForm, type: e.target.value as GovernanceDocType })
              }
              fullWidth
            >
              {GOV_DOC_TYPE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Title"
              value={docForm.title}
              onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={docForm.description}
              onChange={(e) => setDocForm({ ...docForm, description: e.target.value })}
              multiline
              rows={3}
              fullWidth
            />
            <TextField
              label="Version"
              value={docForm.version}
              onChange={(e) => setDocForm({ ...docForm, version: e.target.value })}
              fullWidth
            />
            <TextField
              label="Effective Date"
              type="date"
              value={docForm.effectiveDate}
              onChange={(e) => setDocForm({ ...docForm, effectiveDate: e.target.value })}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Review Date"
              type="date"
              value={docForm.reviewDate}
              onChange={(e) => setDocForm({ ...docForm, reviewDate: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="File URL"
              value={docForm.fileUrl}
              onChange={(e) => setDocForm({ ...docForm, fileUrl: e.target.value })}
              fullWidth
              helperText="Link to the document file"
            />
            <TextField
              label="File Name"
              value={docForm.fileName}
              onChange={(e) => setDocForm({ ...docForm, fileName: e.target.value })}
              fullWidth
            />
            <TextField
              select
              label="Status"
              value={docForm.status}
              onChange={(e) =>
                setDocForm({
                  ...docForm,
                  status: e.target.value as 'draft' | 'active' | 'archived',
                })
              }
              fullWidth
            >
              <MenuItem value="draft">Draft</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="archived">Archived</MenuItem>
            </TextField>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDocDialog}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveDoc}
            disabled={createDocMutation.isPending || updateDocMutation.isPending}
          >
            {editingDoc ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GovernancePage;
