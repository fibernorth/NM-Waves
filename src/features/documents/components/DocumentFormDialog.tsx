import { useEffect, useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Box,
  LinearProgress,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '@/lib/api/documents';
import { AppDocument, Team } from '@/types/models';
import { useAuthStore } from '@/stores/authStore';
import toast from 'react-hot-toast';

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

const documentSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  teamId: z.string().min(1, 'Team is required'),
  visibility: z.enum(['public', 'parent', 'coach', 'team', 'admin']),
  category: z.string().optional(),
});

type DocumentFormData = z.infer<typeof documentSchema>;

interface DocumentFormDialogProps {
  open: boolean;
  onClose: () => void;
  document: AppDocument | null;
  teams: Team[];
}

const DocumentFormDialog = ({ open, onClose, document, teams }: DocumentFormDialogProps) => {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);

  const isEditMode = !!document;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<DocumentFormData>({
    resolver: zodResolver(documentSchema),
    defaultValues: {
      title: '',
      description: '',
      teamId: 'all',
      visibility: 'public',
      category: '',
    },
  });

  useEffect(() => {
    if (document) {
      reset({
        title: document.title,
        description: document.description || '',
        teamId: document.teamId,
        visibility: document.visibility,
        category: document.category || '',
      });
    } else {
      reset({
        title: '',
        description: '',
        teamId: 'all',
        visibility: 'public',
        category: '',
      });
    }
    setSelectedFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  }, [document, reset, open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Auto-populate title from filename if title is empty
      const currentTitle = (document?.title || '').trim();
      if (!currentTitle && !isEditMode) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setValue('title', nameWithoutExt);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      if (!selectedFile) {
        throw new Error('Please select a file to upload');
      }

      setIsUploading(true);
      setUploadProgress(0);

      // Upload file first
      const { url, fileName, fileSize } = await documentsApi.uploadFile(
        selectedFile,
        (progress) => setUploadProgress(progress)
      );

      // Create document record
      await documentsApi.create({
        title: data.title,
        description: data.description || undefined,
        fileURL: url,
        fileName,
        fileSize,
        teamId: data.teamId,
        visibility: data.visibility,
        uploadedBy: user?.uid || '',
        uploadedByName: user?.displayName || '',
        category: data.category || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document uploaded successfully');
      setIsUploading(false);
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to upload document');
      setIsUploading(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: DocumentFormData) => {
      setIsUploading(true);
      setUploadProgress(0);

      let fileData: { fileURL?: string; fileName?: string; fileSize?: number } = {};

      // If a new file was selected, upload it
      if (selectedFile) {
        const { url, fileName, fileSize } = await documentsApi.uploadFile(
          selectedFile,
          (progress) => setUploadProgress(progress)
        );
        fileData = { fileURL: url, fileName, fileSize };
      }

      await documentsApi.update(document!.id, {
        title: data.title,
        description: data.description || undefined,
        teamId: data.teamId,
        visibility: data.visibility,
        category: data.category || undefined,
        ...fileData,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast.success('Document updated successfully');
      setIsUploading(false);
      onClose();
    },
    onError: () => {
      toast.error('Failed to update document');
      setIsUploading(false);
    },
  });

  const onSubmit = (data: DocumentFormData) => {
    if (!isEditMode && !selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isBusy = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onClose={isBusy ? undefined : onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>{isEditMode ? 'Edit Document' : 'Upload Document'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* File Upload */}
            <Box>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="document-file-input"
              />
              <Button
                variant="outlined"
                startIcon={<CloudUploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                fullWidth
                disabled={isBusy}
                sx={{ py: 1.5 }}
              >
                {selectedFile
                  ? selectedFile.name
                  : isEditMode
                    ? 'Replace File (optional)'
                    : 'Select File *'}
              </Button>
              {isEditMode && document?.fileName && !selectedFile && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Current file: {document.fileName}
                </Typography>
              )}
              {!isEditMode && !selectedFile && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Accepted: PDF, Word, Excel, PowerPoint, Text, CSV
                </Typography>
              )}
            </Box>

            {/* Upload Progress */}
            {isUploading && uploadProgress > 0 && (
              <Box>
                <LinearProgress variant="determinate" value={uploadProgress} sx={{ mb: 0.5 }} />
                <Typography variant="caption" color="text.secondary">
                  {uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Upload complete'}
                </Typography>
              </Box>
            )}

            <TextField
              label="Title"
              {...register('title')}
              error={!!errors.title}
              helperText={errors.title?.message}
              fullWidth
              required
            />

            <TextField
              label="Description"
              {...register('description')}
              error={!!errors.description}
              helperText={errors.description?.message}
              multiline
              rows={3}
              fullWidth
            />

            <TextField
              label="Team"
              select
              {...register('teamId')}
              error={!!errors.teamId}
              helperText={errors.teamId?.message}
              fullWidth
              required
              defaultValue={document?.teamId || 'all'}
            >
              <MenuItem value="all">All Teams</MenuItem>
              {teams
                .filter((t) => t.active)
                .map((team) => (
                  <MenuItem key={team.id} value={team.id}>
                    {team.name}
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              label="Visibility"
              select
              {...register('visibility')}
              error={!!errors.visibility}
              helperText={errors.visibility?.message}
              fullWidth
              required
              defaultValue={document?.visibility || 'public'}
            >
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="parent">Parent</MenuItem>
              <MenuItem value="coach">Coach</MenuItem>
              <MenuItem value="team">Team Only</MenuItem>
              <MenuItem value="admin">Admin Only</MenuItem>
            </TextField>

            <TextField
              label="Category"
              {...register('category')}
              error={!!errors.category}
              helperText={errors.category?.message || 'e.g., Forms, Waivers, Schedules'}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={isBusy}>
            {isBusy ? 'Uploading...' : isEditMode ? 'Update' : 'Upload'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default DocumentFormDialog;
