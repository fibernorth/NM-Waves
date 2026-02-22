import { useState } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  Alert,
} from '@mui/material';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin } from '@/lib/auth/roles';
import OrgCostsTab from '../components/OrgCostsTab';
import TeamCostsTab from '../components/TeamCostsTab';
import PlayerCostsTab from '../components/PlayerCostsTab';
import CostSummaryTab from '../components/CostSummaryTab';

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

const CostManagementPage = () => {
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const [tabIndex, setTabIndex] = useState(0);
  const [season, setSeason] = useState(new Date().getFullYear().toString());

  if (!isAdmin) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Cost Management
        </Typography>
        <Alert severity="warning">
          You do not have permission to manage costs.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Cost Management</Typography>
        <TextField
          label="Season"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          size="small"
          sx={{ width: 120 }}
        />
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Manage costs at three tiers: Organization (shared by all players), Team (shared by team members), and Player (individual).
        Use the Summary tab to see per-player rollups and sync to billing.
      </Alert>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
          <Tab label="Organization" />
          <Tab label="Team" />
          <Tab label="Player" />
          <Tab label="Summary" />
        </Tabs>
      </Box>

      <TabPanel value={tabIndex} index={0}>
        <OrgCostsTab season={season} />
      </TabPanel>
      <TabPanel value={tabIndex} index={1}>
        <TeamCostsTab season={season} />
      </TabPanel>
      <TabPanel value={tabIndex} index={2}>
        <PlayerCostsTab season={season} />
      </TabPanel>
      <TabPanel value={tabIndex} index={3}>
        <CostSummaryTab season={season} />
      </TabPanel>
    </Box>
  );
};

export default CostManagementPage;
