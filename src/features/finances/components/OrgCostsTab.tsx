import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Alert,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { costItemsApi } from '@/lib/api/costItems';
import { CostItem } from '@/types/models';
import toast from 'react-hot-toast';
import CostItemFormDialog from './CostItemFormDialog';

interface OrgCostsTabProps {
  season: string;
}

const OrgCostsTab = ({ season }: OrgCostsTabProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<CostItem | null>(null);

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ['costItems', 'organization', season],
    queryFn: async () => {
      const items = await costItemsApi.getBySeason(season);
      return items.filter((i) => i.tier === 'organization');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => costItemsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['costItems'] });
      toast.success('Cost item deleted');
    },
  });

  const totalOrgCost = allItems.reduce((sum, i) => sum + i.amount, 0);

  const columns: GridColDef[] = [
    { field: 'label', headerName: 'Cost Item', flex: 1, minWidth: 200 },
    {
      field: 'category',
      headerName: 'Category',
      width: 150,
      renderCell: (params) => (
        <Chip
          label={params.value === 'waves_fee' ? 'Waves Fee' : params.value === 'insurance' ? 'Insurance' : 'Administrative'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: 'amount',
      headerName: 'Total Amount',
      width: 130,
      valueFormatter: (params) => `$${(params.value || 0).toFixed(2)}`,
    },
    {
      field: 'financeField',
      headerName: 'Finance Field',
      width: 150,
    },
    {
      field: 'active',
      headerName: 'Active',
      width: 80,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'success' : 'default'}
          size="small"
        />
      ),
    },
    {
      field: 'notes',
      headerName: 'Notes',
      width: 150,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit">
            <IconButton
              size="small"
              onClick={() => {
                setSelected(params.row);
                setDialogOpen(true);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton
              size="small"
              color="error"
              onClick={() => {
                if (window.confirm('Delete this cost item?')) {
                  deleteMutation.mutate(params.row.id);
                }
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box>
          <Typography variant="h6">Organization Costs</Typography>
          <Typography variant="body2" color="text.secondary">
            These costs are split evenly across all active players in all teams.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setSelected(null);
            setDialogOpen(true);
          }}
        >
          Add Org Cost
        </Button>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Total org costs: <strong>${totalOrgCost.toFixed(2)}</strong> — This total will be divided
        equally among all players across all teams.
      </Alert>

      <Paper sx={{ height: 400, width: '100%' }}>
        <DataGrid
          rows={allItems}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
          }}
          disableRowSelectionOnClick
        />
      </Paper>

      <CostItemFormDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setSelected(null);
        }}
        tier="organization"
        costItem={selected}
        defaultSeason={season}
      />
    </Box>
  );
};

export default OrgCostsTab;
