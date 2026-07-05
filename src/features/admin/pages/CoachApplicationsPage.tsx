import { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef, GridToolbar } from '@mui/x-data-grid';
import SportsIcon from '@mui/icons-material/Sports';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coachApplicationsApi, type CoachApplication, type CoachApplicationStatus } from '@/lib/api/coachApplications';
import toast from 'react-hot-toast';

const STATUS_COLORS: Record<CoachApplicationStatus, 'info' | 'warning' | 'success' | 'error'> = {
  new: 'info',
  reviewing: 'warning',
  approved: 'success',
  declined: 'error',
};

const CoachApplicationsPage = () => {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<CoachApplication | null>(null);

  const { data: apps = [], isLoading, isError } = useQuery({
    queryKey: ['coachApplications'],
    queryFn: () => coachApplicationsApi.getAll(),
  });

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: CoachApplicationStatus }) =>
      coachApplicationsApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachApplications'] });
      toast.success('Status updated');
      setSelected(null);
    },
    onError: (err: any) => toast.error(err?.message || 'Failed to update'),
  });

  const columns: GridColDef<CoachApplication>[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 140 },
    { field: 'location', headerName: 'Location', flex: 0.8, minWidth: 120 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 160 },
    { field: 'phone', headerName: 'Phone', width: 130 },
    { field: 'ageGroupsInterested', headerName: 'Age Groups', width: 120 },
    {
      field: 'backgroundCheckConsent',
      headerName: 'BG Consent',
      width: 110,
      renderCell: (p) => (p.value ? <Chip size="small" color="success" label="Yes" /> : <Chip size="small" label="No" />),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (p) => <Chip size="small" label={p.value} color={STATUS_COLORS[p.value as CoachApplicationStatus]} />,
    },
    { field: 'submittedAt', headerName: 'Submitted', width: 120, type: 'date', valueGetter: (params) => params.row.submittedAt },
    {
      field: 'actions',
      headerName: '',
      width: 90,
      sortable: false,
      filterable: false,
      renderCell: (p) => <Button size="small" onClick={() => setSelected(p.row)}>View</Button>,
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <SportsIcon color="primary" />
        <Typography variant="h4">Coach Applications</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Applications from the public &ldquo;Coach With Us&rdquo; form. Sort or filter any column.
      </Typography>

      {isError ? (
        <Alert severity="error">Failed to load applications.</Alert>
      ) : (
        <Paper sx={{ height: 620, width: '100%' }}>
          <DataGrid
            rows={apps}
            columns={columns}
            loading={isLoading}
            slots={{ toolbar: GridToolbar }}
            slotProps={{ toolbar: { showQuickFilter: true } }}
            initialState={{
              sorting: { sortModel: [{ field: 'submittedAt', sort: 'desc' }] },
              pagination: { paginationModel: { pageSize: 25 } },
            }}
            pageSizeOptions={[25, 50, 100]}
            disableRowSelectionOnClick
          />
        </Paper>
      )}

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        {selected && (
          <>
            <DialogTitle>
              {selected.name}
              <Chip size="small" sx={{ ml: 1 }} label={selected.status} color={STATUS_COLORS[selected.status]} />
            </DialogTitle>
            <DialogContent dividers>
              <Grid container spacing={1.5}>
                <Field label="Email" value={selected.email} />
                <Field label="Phone" value={selected.phone} />
                <Field label="Location" value={selected.location || '—'} />
                <Field label="Age groups" value={selected.ageGroupsInterested || '—'} />
                <Field label="Background check consent" value={selected.backgroundCheckConsent ? 'Yes' : 'No'} />
                <Field label="Certifications" value={selected.certifications || '—'} full />
                <Field label="Coaching experience" value={selected.coachingExperience || '—'} full />
                <Field label="Playing experience" value={selected.playingExperience || '—'} full />
                <Field label="Availability" value={selected.availability || '—'} full />
                <Field label="Why interested" value={selected.whyInterested || '—'} full />
              </Grid>
            </DialogContent>
            <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
              <Button size="small" onClick={() => setStatus.mutate({ id: selected.id, status: 'reviewing' })} disabled={setStatus.isPending}>Reviewing</Button>
              <Button size="small" color="success" variant="contained" onClick={() => setStatus.mutate({ id: selected.id, status: 'approved' })} disabled={setStatus.isPending}>Approve</Button>
              <Button size="small" color="error" onClick={() => setStatus.mutate({ id: selected.id, status: 'declined' })} disabled={setStatus.isPending}>Decline</Button>
              <Box sx={{ flexGrow: 1 }} />
              <Button onClick={() => setSelected(null)}>Close</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

const Field = ({ label, value, full }: { label: string; value: string; full?: boolean }) => (
  <Grid item xs={full ? 12 : 6}>
    <Typography variant="caption" color="text.secondary">{label}</Typography>
    <Typography variant="body2">{value}</Typography>
  </Grid>
);

export default CoachApplicationsPage;
