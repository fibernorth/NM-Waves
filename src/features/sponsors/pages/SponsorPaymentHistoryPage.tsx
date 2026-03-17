import { useMemo } from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { getSponsorByUserId } from '@/lib/api/sponsorPortal';
import { format } from 'date-fns';

const SponsorPaymentHistoryPage = () => {
  const { user } = useAuthStore();

  const { data: sponsor, isLoading } = useQuery({
    queryKey: ['sponsor', 'self', user?.uid],
    queryFn: () => getSponsorByUserId(user!.uid),
    enabled: !!user?.uid,
  });

  const rows = useMemo(() => {
    if (!sponsor?.sponsoredPlayers) return [];
    return sponsor.sponsoredPlayers.map((sp, index) => ({
      id: sp.paymentId || `sp_${index}`,
      playerName: sp.playerName,
      amount: sp.amount,
      date: new Date(sp.date),
    }));
  }, [sponsor]);

  const columns: GridColDef[] = [
    {
      field: 'date',
      headerName: 'Date',
      width: 160,
      valueFormatter: (params) =>
        params.value ? format(params.value, 'MMM d, yyyy') : '--',
    },
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
      renderCell: (params) => (
        <Chip
          label={`$${params.value.toFixed(2)}`}
          color="success"
          variant="outlined"
          size="small"
        />
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Payment History
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        A record of all your sponsored player payments.
      </Typography>

      <Paper sx={{ height: { xs: 350, md: 500 }, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            sorting: { sortModel: [{ field: 'date', sort: 'desc' }] },
          }}
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  );
};

export default SponsorPaymentHistoryPage;
