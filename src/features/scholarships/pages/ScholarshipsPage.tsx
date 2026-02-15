import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Card,
  CardContent,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { scholarshipsApi } from '@/lib/api/scholarships';
import type { Scholarship } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import ScholarshipFormDialog from '../components/ScholarshipFormDialog';

const ScholarshipsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedScholarship, setSelectedScholarship] = useState<Scholarship | null>(null);

  const { data: scholarships = [], isLoading } = useQuery({
    queryKey: ['scholarships'],
    queryFn: () => scholarshipsApi.getAll(),
  });

  const summary = useMemo(() => {
    const totalAwarded = scholarships.reduce((sum, s) => sum + s.amount, 0);
    const uniqueRecipients = new Set(scholarships.map(s => s.playerId)).size;
    const averageAmount = scholarships.length > 0 ? totalAwarded / scholarships.length : 0;
    return { totalAwarded, uniqueRecipients, averageAmount };
  }, [scholarships]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scholarshipsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scholarships'] });
      toast.success('Scholarship deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete scholarship');
    },
  });

  const handleEdit = (scholarship: Scholarship) => {
    setSelectedScholarship(scholarship);
    setOpenDialog(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this scholarship?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAdd = () => {
    setSelectedScholarship(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedScholarship(null);
  };

  const columns: GridColDef[] = [
    {
      field: 'playerName',
      headerName: 'Player',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'amount',
      headerName: 'Amount',
      width: 130,
      type: 'number',
      valueFormatter: (params: any) => {
        return `$${params.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
    },
    {
      field: 'reason',
      headerName: 'Reason',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'approvedBy',
      headerName: 'Approved By',
      width: 160,
    },
    {
      field: 'approvedAt',
      headerName: 'Date',
      width: 120,
      valueFormatter: (params: any) => {
        try {
          return format(params.value, 'MM/dd/yyyy');
        } catch {
          return '-';
        }
      },
    },
    ...(isAdmin
      ? [
          {
            field: 'actions' as const,
            headerName: 'Actions',
            width: 180,
            sortable: false,
            renderCell: (params: any) => (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={() => handleEdit(params.row)}
                >
                  Edit
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => handleDelete(params.row.id)}
                >
                  Delete
                </Button>
              </Box>
            ),
          },
        ]
      : []),
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Scholarships</Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Award Scholarship
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">
              Total Awarded
            </Typography>
            <Typography variant="h5">
              ${summary.totalAwarded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">
              Number of Recipients
            </Typography>
            <Typography variant="h5">{summary.uniqueRecipients}</Typography>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary">
              Average Amount
            </Typography>
            <Typography variant="h5">
              ${summary.averageAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={scholarships}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      {isAdmin && (
        <ScholarshipFormDialog
          open={openDialog}
          onClose={handleCloseDialog}
          scholarship={selectedScholarship}
        />
      )}
    </Box>
  );
};

export default ScholarshipsPage;
