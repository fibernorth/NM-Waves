import { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  MenuItem,
  LinearProgress,
  Alert,
  Chip,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import FolderZipIcon from '@mui/icons-material/FolderZip';
import { useQuery } from '@tanstack/react-query';
import JSZip from 'jszip';
import { mediaApi } from '@/lib/api/media';
import { teamsApi } from '@/lib/api/teams';
import { useAuthStore } from '@/stores/authStore';
import { isResizableImage } from '@/lib/utils/imageResize';
import toast from 'react-hot-toast';

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

const isImageEntry = (name: string): boolean => {
  const lower = name.toLowerCase();
  // Skip macOS resource forks and hidden files
  if (lower.includes('__macosx') || lower.split('/').some((p) => p.startsWith('.'))) {
    return false;
  }
  return IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const ZipUploadPage = () => {
  const { user } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [zipFile, setZipFile] = useState<File | null>(null);
  const [teamId, setTeamId] = useState<string>('all');
  const [tagsInput, setTagsInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ extracted: 0, uploaded: 0, failed: 0, skipped: 0, total: 0 });
  const [currentFile, setCurrentFile] = useState('');
  const [done, setDone] = useState(false);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamsApi.getAll(),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setZipFile(file);
      setDone(false);
      setProgress({ extracted: 0, uploaded: 0, failed: 0, skipped: 0, total: 0 });
    }
  };

  const handleExtractAndUpload = async () => {
    if (!zipFile) {
      toast.error('Please select a zip file');
      return;
    }

    setIsProcessing(true);
    setDone(false);
    setProgress({ extracted: 0, uploaded: 0, failed: 0, skipped: 0, total: 0 });

    try {
      const zip = await JSZip.loadAsync(zipFile);
      const entries = Object.entries(zip.files).filter(
        ([name, entry]) => !entry.dir && isImageEntry(name)
      );

      const total = entries.length;
      setProgress((p) => ({ ...p, total, extracted: total }));

      if (total === 0) {
        toast.error('No image files found in zip');
        setIsProcessing(false);
        return;
      }

      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const team = teams.find((t) => t.id === teamId);
      let uploaded = 0;
      let failed = 0;
      let skipped = 0;

      for (const [name, entry] of entries) {
        const fileName = name.split('/').pop() || name;
        setCurrentFile(fileName);

        try {
          const blob = await entry.async('blob');
          // Determine MIME type from extension
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          const mimeMap: Record<string, string> = {
            jpg: 'image/jpeg',
            jpeg: 'image/jpeg',
            png: 'image/png',
            gif: 'image/gif',
            webp: 'image/webp',
          };
          const mimeType = mimeMap[ext] || 'image/jpeg';
          const file = new File([blob], fileName, { type: mimeType });

          if (!isResizableImage(file)) {
            skipped++;
            setProgress((p) => ({ ...p, skipped }));
            continue;
          }

          const result = await mediaApi.uploadMedia(file);

          await mediaApi.create({
            fileUrl: result.url,
            thumbnailUrl: result.thumbnailUrl,
            fileName: result.fileName,
            teamId,
            teamName: team?.name || (teamId === 'all' ? 'All Teams' : ''),
            uploadedBy: user?.uid || '',
            uploadedByName: user?.displayName || '',
            tags,
            mediaType: result.mediaType,
          });

          uploaded++;
          setProgress((p) => ({ ...p, uploaded }));
        } catch (err) {
          console.error(`Failed to upload ${fileName}:`, err);
          failed++;
          setProgress((p) => ({ ...p, failed }));
        }
      }

      setDone(true);
      toast.success(`Upload complete: ${uploaded} succeeded, ${failed} failed, ${skipped} skipped`);
    } catch (err) {
      console.error('Zip extraction failed:', err);
      toast.error('Failed to extract zip file');
    } finally {
      setIsProcessing(false);
      setCurrentFile('');
    }
  };

  const overallProgress =
    progress.total > 0
      ? Math.round(((progress.uploaded + progress.failed + progress.skipped) / progress.total) * 100)
      : 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <FolderZipIcon sx={{ fontSize: 40, mr: 2, color: 'primary.main' }} />
        <Typography variant="h4">Bulk Image Upload</Typography>
      </Box>

      <Paper sx={{ p: 3, maxWidth: 600 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* File Input */}
          <Box>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            <Button
              variant="outlined"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              fullWidth
              disabled={isProcessing}
              sx={{ py: 1.5 }}
            >
              {zipFile ? zipFile.name : 'Select .zip File'}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Upload a zip file containing images (JPG, PNG, GIF, WebP)
            </Typography>
          </Box>

          {/* Team Selector */}
          <TextField
            select
            label="Team"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            fullWidth
            disabled={isProcessing}
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

          {/* Tags */}
          <TextField
            label="Tags (applied to all images)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            fullWidth
            disabled={isProcessing}
            helperText="Comma separated, e.g.: tournament, game day"
          />

          {/* Upload Button */}
          <Button
            variant="contained"
            onClick={handleExtractAndUpload}
            disabled={!zipFile || isProcessing}
            size="large"
          >
            {isProcessing ? 'Processing...' : 'Extract & Upload'}
          </Button>

          {/* Progress */}
          {isProcessing && (
            <Box>
              <LinearProgress variant="determinate" value={overallProgress} sx={{ mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                {currentFile && `Uploading: ${currentFile}`}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                <Chip label={`Extracted: ${progress.extracted}`} size="small" />
                <Chip label={`Uploaded: ${progress.uploaded}`} size="small" color="success" />
                {progress.failed > 0 && (
                  <Chip label={`Failed: ${progress.failed}`} size="small" color="error" />
                )}
                {progress.skipped > 0 && (
                  <Chip label={`Skipped: ${progress.skipped}`} size="small" color="default" />
                )}
              </Box>
            </Box>
          )}

          {/* Done Summary */}
          {done && (
            <Alert severity="success">
              Upload complete! {progress.uploaded} images uploaded
              {progress.failed > 0 ? `, ${progress.failed} failed` : ''}
              {progress.skipped > 0 ? `, ${progress.skipped} skipped` : ''}.
            </Alert>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default ZipUploadPage;
