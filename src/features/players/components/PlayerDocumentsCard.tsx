import { useState, useRef } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Divider,
  Button,
  Box,
  IconButton,
  Tooltip,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DescriptionIcon from '@mui/icons-material/Description';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import VerifiedIcon from '@mui/icons-material/Verified';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { playersApi } from '@/lib/api/players';
import { useAuthStore } from '@/stores/authStore';
import { isAdmin as checkIsAdmin, hasRole } from '@/lib/auth/roles';
import type { Player, PlayerDocumentType } from '@/types/models';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const DOC_TYPE_LABELS: Record<PlayerDocumentType, string> = {
  birth_certificate: 'Birth Certificate',
  medical_form: 'Medical Form',
  waiver: 'Waiver',
  report_card: 'Report Card',
  other: 'Other',
};

const DOC_TYPE_COLORS: Record<PlayerDocumentType, 'error' | 'info' | 'warning' | 'success' | 'default'> = {
  birth_certificate: 'error',
  medical_form: 'info',
  waiver: 'warning',
  report_card: 'success',
  other: 'default',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface PlayerDocumentsCardProps {
  player: Player;
}

const PlayerDocumentsCard = ({ player }: PlayerDocumentsCardProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = checkIsAdmin(user);
  const isCoachOnly = hasRole(user, 'coach');
  const canUpload = isAdmin || isCoachOnly || hasRole(user, 'parent');
  const canDelete = isAdmin;

  const [uploadOpen, setUploadOpen] = useState(false);
  const [docType, setDocType] = useState<PlayerDocumentType>('birth_certificate');
  const [label, setLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const documents = player.documents || [];

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !user) throw new Error('Missing file or user');
      return playersApi.uploadDocument(
        player.id,
        selectedFile,
        docType,
        label || DOC_TYPE_LABELS[docType],
        user.uid,
        user.displayName || user.email,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player', player.id] });
      toast.success('Document uploaded successfully');
      handleCloseUpload();
    },
    onError: () => {
      toast.error('Failed to upload document');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (docToDelete: typeof documents[0]) =>
      playersApi.deleteDocument(player.id, docToDelete),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player', player.id] });
      toast.success('Document deleted');
    },
    onError: () => {
      toast.error('Failed to delete document');
    },
  });

  const handleCloseUpload = () => {
    setUploadOpen(false);
    setDocType('birth_certificate');
    setLabel('');
    setSelectedFile(null);
  };

  const hasBirthCert = documents.some(d => d.type === 'birth_certificate');

  return (
    <>
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Player Documents
            </Typography>
            {canUpload && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => setUploadOpen(true)}
              >
                Upload
              </Button>
            )}
          </Box>
          <Divider sx={{ mb: 1 }} />

          {/* Birth certificate status */}
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
            <VerifiedIcon
              fontSize="small"
              color={hasBirthCert ? 'success' : 'disabled'}
            />
            <Typography variant="body2" color={hasBirthCert ? 'success.main' : 'text.secondary'}>
              Birth Certificate: {hasBirthCert ? 'On File' : 'Not Uploaded'}
            </Typography>
          </Box>

          {documents.length === 0 ? (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <DescriptionIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No documents uploaded yet.
              </Typography>
              {canUpload && (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Upload birth certificates, medical forms, and waivers.
                </Typography>
              )}
            </Box>
          ) : (
            <List dense disablePadding>
              {documents.map((doc) => (
                <ListItem key={doc.id} sx={{ px: 0 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <DescriptionIcon fontSize="small" color="action" />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={500}>
                          {doc.label}
                        </Typography>
                        <Chip
                          label={DOC_TYPE_LABELS[doc.type]}
                          size="small"
                          color={DOC_TYPE_COLORS[doc.type]}
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(doc.fileSize)} &middot;{' '}
                        {format(new Date(doc.uploadedAt), 'MM/dd/yyyy')}
                        {doc.uploadedByName && ` by ${doc.uploadedByName}`}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={() => window.open(doc.fileUrl, '_blank')}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canDelete && (
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => {
                            if (window.confirm(`Delete "${doc.label}"?`)) {
                              deleteMutation.mutate(doc);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadOpen} onClose={handleCloseUpload} maxWidth="sm" fullWidth>
        <DialogTitle>Upload Document for {player.firstName} {player.lastName}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              select
              label="Document Type"
              value={docType}
              onChange={(e) => setDocType(e.target.value as PlayerDocumentType)}
              fullWidth
            >
              <MenuItem value="birth_certificate">Birth Certificate</MenuItem>
              <MenuItem value="medical_form">Medical Form</MenuItem>
              <MenuItem value="waiver">Waiver</MenuItem>
              <MenuItem value="report_card">Report Card</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </TextField>

            <TextField
              label="Label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={DOC_TYPE_LABELS[docType]}
              fullWidth
            />

            <Box>
              <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error('File must be under 10MB');
                      return;
                    }
                    setSelectedFile(file);
                  }
                }}
              />
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
                sx={{ py: 2 }}
              >
                {selectedFile ? selectedFile.name : 'Choose File (PDF, Image, or Word)'}
              </Button>
              {selectedFile && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  {formatFileSize(selectedFile.size)}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseUpload}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => uploadMutation.mutate()}
            disabled={!selectedFile || uploadMutation.isPending}
            startIcon={uploadMutation.isPending ? <CircularProgress size={16} /> : <UploadFileIcon />}
          >
            {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PlayerDocumentsCard;
