import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appSettingsApi, IntegrationSettings } from '@/lib/api/appSettings';
import { googleDriveApi } from '@/lib/api/googleDrive';
import toast from 'react-hot-toast';

const AdminSettingsPage = () => {
  const queryClient = useQueryClient();
  const [folderId, setFolderId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; count: number } | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => appSettingsApi.getIntegrations(),
  });

  useEffect(() => {
    if (settings?.googleDrive) {
      setFolderId(settings.googleDrive.folderId || '');
      setEnabled(settings.googleDrive.enabled || false);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: IntegrationSettings) => appSettingsApi.updateIntegrations(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      toast.success('Settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      googleDrive: {
        enabled,
        folderId: folderId.trim(),
      },
    });
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const photos = await googleDriveApi.listPhotos();
      setTestResult({ success: true, count: photos.length });
    } catch {
      setTestResult({ success: false, count: 0 });
    } finally {
      setTesting(false);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <SettingsIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h4">Admin Settings</Typography>
      </Box>

      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <Typography variant="h6" gutterBottom>
          Google Drive Integration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Display photos from a shared Google Drive folder alongside media gallery content.
          Requires Google Drive API to be enabled in GCP and a service account configured.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={
              <Switch
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
            }
            label="Enable Google Drive Integration"
          />

          <TextField
            label="Google Drive Folder ID"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            fullWidth
            helperText="The folder ID from the Google Drive share URL"
            placeholder="e.g., 1ABC...xyz"
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={testing || !folderId.trim() || !enabled}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </Button>
          </Box>

          {testResult && (
            <Alert severity={testResult.success ? 'success' : 'error'}>
              {testResult.success
                ? `Connection successful! Found ${testResult.count} photos.`
                : 'Connection failed. Check your folder ID and service account configuration.'}
            </Alert>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default AdminSettingsPage;
