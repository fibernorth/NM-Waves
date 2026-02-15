import { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import DescriptionIcon from '@mui/icons-material/Description';
import { documentsApi } from '@/lib/api/documents';
import { teamsApi } from '@/lib/api/teams';
import { AppDocument } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import DocumentFormDialog from '../components/DocumentFormDialog';

const formatFileSize = (bytes?: number): string => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const visibilityColorMap: Record<string, 'success' | 'info' | 'warning' | 'secondary' | 'default'> = {
  public: 'success',
  parent: 'info',
  coach: 'secondary',
  team: 'info',
  admin: 'warning',
};

const DocumentsPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<AppDocument | null>(null);
  const [filterTeam, setFilterTeam] = useState<string>('all');
  const [filterVisibility, setFilterVisibility] = useState<string>('all');

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ['documents', user?.roles],
    queryFn: () => {
      if (isAdmin) return documentsApi.getAll();
      return documentsApi.getForRoles(user?.roles || ['visitor']);
    },
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (doc: AppDocument) => documentsApi.delete(doc.id, doc.fileURL),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete document');
    },
  });

  const filteredDocuments = useMemo(() => {
    let result = documents;
    if (filterTeam !== 'all') {
      result = result.filter((d) => d.teamId === filterTeam);
    }
    if (filterVisibility !== 'all') {
      result = result.filter((d) => d.visibility === filterVisibility);
    }
    return result;
  }, [documents, filterTeam, filterVisibility]);

  const teamNameMap = useMemo(() => {
    const map: Record<string, string> = { all: 'All Teams' };
    teams.forEach((t) => {
      map[t.id] = t.name;
    });
    return map;
  }, [teams]);

  const handleAdd = () => {
    setSelectedDocument(null);
    setOpenDialog(true);
  };

  const handleEdit = (doc: AppDocument) => {
    setSelectedDocument(doc);
    setOpenDialog(true);
  };

  const handleDelete = (doc: AppDocument) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      deleteMutation.mutate(doc);
    }
  };

  const handleDownload = (fileURL: string) => {
    window.open(fileURL, '_blank');
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setSelectedDocument(null);
  };

  const columns: GridColDef[] = [
    {
      field: 'title',
      headerName: 'Title',
      flex: 1,
      minWidth: 180,
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 150,
      renderCell: (params) => (
        <Tooltip title={params.value || ''} arrow>
          <Typography variant="body2" noWrap>
            {params.value || '-'}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: 'teamId',
      headerName: 'Team',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={teamNameMap[params.value] || (params.value === 'all' ? 'All Teams' : params.value)}
          size="small"
          color="primary"
          variant="outlined"
        />
      ),
    },
    {
      field: 'visibility',
      headerName: 'Visibility',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value.charAt(0).toUpperCase() + params.value.slice(1)}
          size="small"
          color={visibilityColorMap[params.value] || 'default'}
        />
      ),
    },
    {
      field: 'fileSize',
      headerName: 'Size',
      width: 100,
      renderCell: (params) => (
        <Typography variant="body2">{formatFileSize(params.value)}</Typography>
      ),
    },
    {
      field: 'uploadedByName',
      headerName: 'Uploaded By',
      width: 140,
      renderCell: (params) => (
        <Typography variant="body2">{params.value || '-'}</Typography>
      ),
    },
    {
      field: 'createdAt',
      headerName: 'Date',
      width: 120,
      renderCell: (params) => {
        if (!params.value) return '-';
        return format(params.value, 'MM/dd/yyyy');
      },
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: isAdmin ? 160 : 80,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Download">
            <IconButton
              size="small"
              color="primary"
              onClick={() => handleDownload(params.row.fileURL)}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <>
              <Tooltip title="Edit">
                <IconButton
                  size="small"
                  onClick={() => handleEdit(params.row)}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(params.row)}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <DescriptionIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
          <Typography variant="h4">Documents</Typography>
        </Box>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Upload Document
          </Button>
        )}
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <TextField
            select
            label="Filter by Team"
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All Teams</MenuItem>
            {teams.map((team) => (
              <MenuItem key={team.id} value={team.id}>
                {team.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Filter by Visibility"
            value={filterVisibility}
            onChange={(e) => setFilterVisibility(e.target.value)}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="public">Public</MenuItem>
            <MenuItem value="parent">Parent</MenuItem>
            <MenuItem value="coach">Coach</MenuItem>
            <MenuItem value="team">Team</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
          </TextField>
        </Box>
      </Paper>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredDocuments}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      <DocumentFormDialog
        open={openDialog}
        onClose={handleCloseDialog}
        document={selectedDocument}
        teams={teams}
      />
    </Box>
  );
};

export default DocumentsPage;
