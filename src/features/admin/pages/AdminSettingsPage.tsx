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
  Grid,
  Divider,
  Tabs,
  Tab,
  Chip,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import BusinessIcon from '@mui/icons-material/Business';
import NotificationsIcon from '@mui/icons-material/Notifications';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ShoppingBagIcon from '@mui/icons-material/ShoppingBag';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  appSettingsApi,
  IntegrationSettings,
  OrgSettings,
  NotificationSettings,
  SeasonSettings,
} from '@/lib/api/appSettings';
import { googleDriveApi } from '@/lib/api/googleDrive';
import { siteSettingsApi } from '@/lib/api/siteSettings';
import { useAuthStore } from '@/stores/authStore';
import type { SwagStoreSettings } from '@/types/models';
import toast from 'react-hot-toast';

interface TabPanelProps {
  children: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = ({ children, value, index }: TabPanelProps) => (
  <Box role="tabpanel" hidden={value !== index} sx={{ pt: 3 }}>
    {value === index && children}
  </Box>
);

// ============================================
// Organization Settings Tab
// ============================================
const OrgSettingsTab = () => {
  const queryClient = useQueryClient();
  const { data: org, isLoading } = useQuery({
    queryKey: ['appSettings', 'org'],
    queryFn: () => appSettingsApi.getOrg(),
  });

  const [form, setForm] = useState<OrgSettings | null>(null);

  useEffect(() => {
    if (org) setForm(org);
  }, [org]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<OrgSettings>) => appSettingsApi.updateOrg(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings', 'org'] });
      toast.success('Organization settings saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  if (isLoading || !form) return <CircularProgress />;

  const handleChange = (field: keyof OrgSettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: e.target.value });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Organization Information
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        These details appear across the site, on invoices, donor receipts, and compliance documents.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField label="Organization Name" value={form.orgName} onChange={handleChange('orgName')} fullWidth />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Tagline / Motto" value={form.tagline} onChange={handleChange('tagline')} fullWidth />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Email" value={form.email} onChange={handleChange('email')} fullWidth />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Phone" value={form.phone} onChange={handleChange('phone')} fullWidth />
        </Grid>
        <Grid item xs={12}>
          <TextField label="Street Address" value={form.address} onChange={handleChange('address')} fullWidth />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField label="City" value={form.city} onChange={handleChange('city')} fullWidth />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField label="State" value={form.state} onChange={handleChange('state')} fullWidth />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField label="ZIP Code" value={form.zip} onChange={handleChange('zip')} fullWidth />
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="EIN (Tax ID)"
            value={form.ein}
            onChange={handleChange('ein')}
            fullWidth
            placeholder="XX-XXXXXXX"
            helperText="Required for donor receipts and Form 990"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Website URL" value={form.websiteUrl} onChange={handleChange('websiteUrl')} fullWidth />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Logo URL" value={form.logoUrl} onChange={handleChange('logoUrl')} fullWidth />
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>Branding Colors</Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField label="Primary Color" value={form.primaryColor} onChange={handleChange('primaryColor')} sx={{ flex: 1 }} />
            <Box sx={{ width: 40, height: 40, borderRadius: 1, backgroundColor: form.primaryColor, border: '1px solid #ccc' }} />
          </Box>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField label="Secondary Color" value={form.secondaryColor} onChange={handleChange('secondaryColor')} sx={{ flex: 1 }} />
            <Box sx={{ width: 40, height: 40, borderRadius: 1, backgroundColor: form.secondaryColor, border: '1px solid #ccc' }} />
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save Organization Settings'}
        </Button>
      </Box>
    </Paper>
  );
};

// ============================================
// Notification Settings Tab
// ============================================
const NotificationSettingsTab = () => {
  const queryClient = useQueryClient();
  const { data: notif, isLoading } = useQuery({
    queryKey: ['appSettings', 'notifications'],
    queryFn: () => appSettingsApi.getNotifications(),
  });

  const [form, setForm] = useState<NotificationSettings | null>(null);

  useEffect(() => {
    if (notif) setForm(notif);
  }, [notif]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<NotificationSettings>) => appSettingsApi.updateNotifications(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings', 'notifications'] });
      toast.success('Notification settings saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  if (isLoading || !form) return <CircularProgress />;

  const handleToggle = (field: keyof NotificationSettings) => (_: unknown, checked: boolean) => {
    setForm({ ...form, [field]: checked });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Email & Notification Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Control when the system sends automated emails to parents, sponsors, and staff.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Sender Name"
            value={form.emailFromName}
            onChange={(e) => setForm({ ...form, emailFromName: e.target.value })}
            fullWidth
            helperText="Name that appears in 'From' field"
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Reply-To Email"
            value={form.emailReplyTo}
            onChange={(e) => setForm({ ...form, emailReplyTo: e.target.value })}
            fullWidth
          />
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={<Switch checked={form.sendPaymentReceipts} onChange={handleToggle('sendPaymentReceipts')} />}
            label="Send payment receipt emails when a payment is recorded"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={<Switch checked={form.sendInvoiceEmails} onChange={handleToggle('sendInvoiceEmails')} />}
            label="Send invoice emails when invoices are generated"
          />
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={<Switch checked={form.sendAnnouncementEmails} onChange={handleToggle('sendAnnouncementEmails')} />}
            label="Send email notifications for new announcements"
          />
        </Grid>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <FormControlLabel
              control={<Switch checked={form.sendReminderEmails} onChange={handleToggle('sendReminderEmails')} />}
              label="Send payment reminder emails"
            />
            {form.sendReminderEmails && (
              <TextField
                label="Days before due date"
                type="number"
                value={form.reminderDaysBefore}
                onChange={(e) => setForm({ ...form, reminderDaysBefore: parseInt(e.target.value) || 7 })}
                size="small"
                sx={{ width: 160 }}
              />
            )}
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save Notification Settings'}
        </Button>
      </Box>
    </Paper>
  );
};

// ============================================
// Season Settings Tab
// ============================================
const SeasonSettingsTab = () => {
  const queryClient = useQueryClient();
  const { data: season, isLoading } = useQuery({
    queryKey: ['appSettings', 'season'],
    queryFn: () => appSettingsApi.getSeason(),
  });

  const [form, setForm] = useState<SeasonSettings | null>(null);
  const [newSeason, setNewSeason] = useState('');

  useEffect(() => {
    if (season) setForm(season);
  }, [season]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<SeasonSettings>) => appSettingsApi.updateSeason(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings', 'season'] });
      toast.success('Season settings saved');
    },
    onError: () => toast.error('Failed to save'),
  });

  if (isLoading || !form) return <CircularProgress />;

  const handleAddSeason = () => {
    const trimmed = newSeason.trim();
    if (trimmed && !form.seasons.includes(trimmed)) {
      setForm({ ...form, seasons: [...form.seasons, trimmed] });
      setNewSeason('');
    }
  };

  const handleRemoveSeason = (s: string) => {
    if (s === form.currentSeason) {
      toast.error('Cannot remove the active season');
      return;
    }
    setForm({ ...form, seasons: form.seasons.filter((x) => x !== s) });
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Season Management
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Manage seasons and set the currently active season used across billing, rosters, and reports.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Current Season"
            value={form.currentSeason}
            onChange={(e) => setForm({ ...form, currentSeason: e.target.value })}
            fullWidth
            select
            SelectProps={{ native: true }}
          >
            {form.seasons.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>All Seasons</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            {form.seasons.map((s) => (
              <Chip
                key={s}
                label={s}
                color={s === form.currentSeason ? 'primary' : 'default'}
                onDelete={s !== form.currentSeason ? () => handleRemoveSeason(s) : undefined}
              />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="Add Season"
              value={newSeason}
              onChange={(e) => setNewSeason(e.target.value)}
              size="small"
              placeholder="e.g. Fall 2026"
              onKeyDown={(e) => e.key === 'Enter' && handleAddSeason()}
            />
            <Button variant="outlined" onClick={handleAddSeason} disabled={!newSeason.trim()}>
              Add
            </Button>
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save Season Settings'}
        </Button>
      </Box>
    </Paper>
  );
};

// ============================================
// Integration Settings Tab (Google Drive + Stripe status)
// ============================================
const IntegrationSettingsTab = () => {
  const queryClient = useQueryClient();
  const [folderId, setFolderId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; count: number } | null>(null);
  const [testing, setTesting] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['appSettings', 'integrations'],
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
      queryClient.invalidateQueries({ queryKey: ['appSettings', 'integrations'] });
      toast.success('Integration settings saved');
    },
    onError: () => toast.error('Failed to save settings'),
  });

  const handleSave = () => {
    saveMutation.mutate({ googleDrive: { enabled, folderId: folderId.trim() } });
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

  if (isLoading) return <CircularProgress />;

  const stripeConfigured = !!(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Stripe Status */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Stripe Payments
        </Typography>
        <Alert severity={stripeConfigured ? 'success' : 'warning'} sx={{ mb: 2 }}>
          {stripeConfigured
            ? 'Stripe is configured. Publishable key is set in environment variables.'
            : 'Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY in your .env file to enable online payments.'}
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Stripe keys and webhook secrets are configured via environment variables for security.
          Contact the system administrator to update Stripe configuration.
        </Typography>
      </Paper>

      {/* Google Drive */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Google Drive Integration
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Display photos from a shared Google Drive folder alongside media gallery content.
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <FormControlLabel
            control={<Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />}
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
            <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
            <Button variant="outlined" onClick={handleTestConnection} disabled={testing || !folderId.trim() || !enabled}>
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

// ============================================
// Swag Store Settings Tab
// ============================================
const SwagStoreSettingsTab = () => {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const { data: swag, isLoading } = useQuery({
    queryKey: ['siteSettings', 'swagStore'],
    queryFn: () => siteSettingsApi.getSwagStore(),
  });

  const [form, setForm] = useState<SwagStoreSettings | null>(null);

  useEffect(() => {
    if (swag) setForm(swag);
  }, [swag]);

  const saveMutation = useMutation({
    mutationFn: (data: Partial<SwagStoreSettings>) => siteSettingsApi.updateSwagStore(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['siteSettings', 'swagStore'] });
      toast.success('Swag store settings saved');
    },
    onError: () => toast.error('Failed to save swag store settings'),
  });

  if (isLoading || !form) return <CircularProgress />;

  const handleSave = () => {
    saveMutation.mutate({
      ...form,
      updatedBy: user?.uid || '',
    });
  };

  // Format Date for datetime-local input
  const formatDateTimeLocal = (date: Date | null): string => {
    if (!date) return '';
    const d = new Date(date);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Swag Store Link
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure the swag store banner that appears on the public homepage. Toggle it on when
        your store is open, and optionally set a close date to auto-hide it.
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={form.active}
                onChange={(_, checked) => setForm({ ...form, active: checked })}
              />
            }
            label="Swag store is currently active"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Store URL"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            fullWidth
            placeholder="https://your-store-url.com"
            helperText="Full URL to your external swag store"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Banner Label"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            fullWidth
            placeholder="Shop TC Waves Gear!"
            helperText="Text shown on the public homepage banner"
          />
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Store Closes At"
            type="datetime-local"
            value={formatDateTimeLocal(form.closesAt)}
            onChange={(e) =>
              setForm({
                ...form,
                closesAt: e.target.value ? new Date(e.target.value) : null,
              })
            }
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Leave blank for no expiration. The banner auto-hides after this date."
          />
          {form.closesAt && (
            <Button
              size="small"
              sx={{ mt: 0.5 }}
              onClick={() => setForm({ ...form, closesAt: null })}
            >
              Clear close date
            </Button>
          )}
        </Grid>
      </Grid>

      {form.active && !form.url && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          The swag store is active but no URL is set. The banner will not appear until a URL is provided.
        </Alert>
      )}

      {form.active && form.closesAt && new Date(form.closesAt) < new Date() && (
        <Alert severity="info" sx={{ mt: 2 }}>
          The close date is in the past. The banner is currently hidden from the public site even though it is active.
        </Alert>
      )}

      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" onClick={handleSave} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save Swag Store Settings'}
        </Button>
      </Box>
    </Paper>
  );
};

// ============================================
// Main Settings Page
// ============================================
const AdminSettingsPage = () => {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <SettingsIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h4">Admin Settings</Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
        <Tab icon={<BusinessIcon />} iconPosition="start" label="Organization" />
        <Tab icon={<NotificationsIcon />} iconPosition="start" label="Notifications" />
        <Tab icon={<CalendarMonthIcon />} iconPosition="start" label="Seasons" />
        <Tab icon={<IntegrationInstructionsIcon />} iconPosition="start" label="Integrations" />
        <Tab icon={<ShoppingBagIcon />} iconPosition="start" label="Swag Store" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        <OrgSettingsTab />
      </TabPanel>
      <TabPanel value={tab} index={1}>
        <NotificationSettingsTab />
      </TabPanel>
      <TabPanel value={tab} index={2}>
        <SeasonSettingsTab />
      </TabPanel>
      <TabPanel value={tab} index={3}>
        <IntegrationSettingsTab />
      </TabPanel>
      <TabPanel value={tab} index={4}>
        <SwagStoreSettingsTab />
      </TabPanel>
    </Box>
  );
};

export default AdminSettingsPage;
