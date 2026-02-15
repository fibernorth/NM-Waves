import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Chip,
  LinearProgress,
  Grid,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import PaymentIcon from '@mui/icons-material/Payment';
import { fundraisersApi } from '@/lib/api/fundraisers';
import { teamsApi } from '@/lib/api/teams';
import { Fundraiser } from '@/types/models';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import FundraiserFormDialog from '../components/FundraiserFormDialog';
import DonationDialog from '../components/DonationDialog';

const FundraisersPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [openFormDialog, setOpenFormDialog] = useState(false);
  const [selectedFundraiser, setSelectedFundraiser] = useState<Fundraiser | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [donationDialogOpen, setDonationDialogOpen] = useState(false);
  const [donationFundraiser, setDonationFundraiser] = useState<Fundraiser | null>(null);

  const { data: fundraisers = [], isLoading } = useQuery({
    queryKey: ['fundraisers'],
    queryFn: () => fundraisersApi.getAll(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fundraisersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fundraisers'] });
      toast.success('Fundraiser deleted successfully');
    },
    onError: () => {
      toast.error('Failed to delete fundraiser');
    },
  });

  const getTeamName = (teamId: string) => {
    if (teamId === 'all') return 'All Teams';
    const team = teams.find((t) => t.id === teamId);
    return team?.name || teamId;
  };

  const handleAdd = () => {
    setSelectedFundraiser(null);
    setOpenFormDialog(true);
  };

  const handleEdit = (fundraiser: Fundraiser) => {
    setSelectedFundraiser(fundraiser);
    setOpenFormDialog(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this fundraiser?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseFormDialog = () => {
    setOpenFormDialog(false);
    setSelectedFundraiser(null);
  };

  const handleToggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleOpenDonation = (fundraiser: Fundraiser) => {
    setDonationFundraiser(fundraiser);
    setDonationDialogOpen(true);
  };

  const handleCloseDonation = () => {
    setDonationDialogOpen(false);
    setDonationFundraiser(null);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Fundraisers</Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
            Add Fundraiser
          </Button>
        )}
      </Box>

      {fundraisers.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No fundraisers yet. {isAdmin ? 'Click "Add Fundraiser" to get started.' : ''}
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {fundraisers.map((fundraiser) => {
            const progress = fundraiser.goal > 0
              ? Math.min((fundraiser.currentAmount / fundraiser.goal) * 100, 100)
              : 0;
            const isExpanded = expandedId === fundraiser.id;

            return (
              <Grid item xs={12} md={6} lg={4} key={fundraiser.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'box-shadow 0.2s',
                    '&:hover': { boxShadow: 4 },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
                        {fundraiser.name}
                      </Typography>
                      <Chip
                        label={fundraiser.status === 'active' ? 'Active' : 'Completed'}
                        color={fundraiser.status === 'active' ? 'success' : 'default'}
                        size="small"
                      />
                    </Box>

                    {fundraiser.description && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {fundraiser.description}
                      </Typography>
                    )}

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Team: {getTeamName(fundraiser.teamId)}
                    </Typography>

                    <Box sx={{ mt: 2, mb: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="body2" fontWeight="bold">
                          ${fundraiser.currentAmount.toFixed(2)} raised
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          ${fundraiser.goal.toFixed(2)} goal
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={progress}
                        sx={{
                          height: 10,
                          borderRadius: 5,
                          bgcolor: 'grey.200',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 5,
                            bgcolor: progress >= 100 ? 'success.main' : 'primary.main',
                          },
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                        {progress.toFixed(0)}% of goal
                      </Typography>
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {fundraiser.donations.length} donation{fundraiser.donations.length !== 1 ? 's' : ''}
                    </Typography>

                    {(fundraiser.startDate || fundraiser.endDate) && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                        {fundraiser.startDate && format(fundraiser.startDate, 'MMM d, yyyy')}
                        {fundraiser.startDate && fundraiser.endDate && ' - '}
                        {fundraiser.endDate && format(fundraiser.endDate, 'MMM d, yyyy')}
                      </Typography>
                    )}
                  </CardContent>

                  <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 1 }}>
                    <Button
                      size="small"
                      onClick={() => handleToggleExpand(fundraiser.id)}
                      endIcon={isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    >
                      {isExpanded ? 'Hide' : 'Show'} Donations
                    </Button>
                    <Box>
                      {isAdmin && (
                        <>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleOpenDonation(fundraiser)}
                            title="Add Donation"
                          >
                            <PaymentIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleEdit(fundraiser)}
                            title="Edit"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(fundraiser.id)}
                            title="Delete"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </CardActions>

                  <Collapse in={isExpanded}>
                    <Box sx={{ px: 2, pb: 2 }}>
                      {fundraiser.donations.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                          No donations yet.
                        </Typography>
                      ) : (
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Donor</TableCell>
                                <TableCell align="right">Amount</TableCell>
                                <TableCell>Method</TableCell>
                                <TableCell>Date</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {fundraiser.donations.map((donation, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>{donation.payerName}</TableCell>
                                  <TableCell align="right">${donation.amount.toFixed(2)}</TableCell>
                                  <TableCell sx={{ textTransform: 'capitalize' }}>{donation.method}</TableCell>
                                  <TableCell>{format(donation.date, 'MM/dd/yyyy')}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                      {isAdmin && (
                        <Box sx={{ mt: 1, textAlign: 'center' }}>
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpenDonation(fundraiser)}
                          >
                            Add Donation
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {isAdmin && (
        <>
          <FundraiserFormDialog
            open={openFormDialog}
            onClose={handleCloseFormDialog}
            fundraiser={selectedFundraiser}
          />
          <DonationDialog
            open={donationDialogOpen}
            onClose={handleCloseDonation}
            fundraiser={donationFundraiser}
          />
        </>
      )}
    </Box>
  );
};

export default FundraisersPage;
