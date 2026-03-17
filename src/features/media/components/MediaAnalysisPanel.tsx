import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  List,
  ListItem,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import CheckIcon from '@mui/icons-material/Check';
import PersonIcon from '@mui/icons-material/Person';
import GroupsIcon from '@mui/icons-material/Groups';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LabelIcon from '@mui/icons-material/Label';
import { mediaApi } from '@/lib/api/media';
import { MediaItem } from '@/types/models';
import toast from 'react-hot-toast';

interface MediaAnalysisPanelProps {
  mediaItems: MediaItem[];
  teams: Array<{ id: string; name: string }>;
}

const MediaAnalysisPanel = ({ mediaItems, teams }: MediaAnalysisPanelProps) => {
  const queryClient = useQueryClient();
  const [showSuggestions, setShowSuggestions] = useState(false);

  const analyzedItems = mediaItems.filter((m) => m.analysisStatus === 'analyzed');
  const unanalyzedItems = mediaItems.filter(
    (m) => !m.analysisStatus && m.mediaType !== 'video'
  );
  const pendingItems = mediaItems.filter((m) => m.analysisStatus === 'pending');
  const failedItems = mediaItems.filter((m) => m.analysisStatus === 'failed');

  // Items with suggestions that haven't been applied yet
  const itemsWithSuggestions = analyzedItems.filter(
    (m) =>
      (m.suggestedPlayerIds && m.suggestedPlayerIds.length > 0) ||
      m.suggestedTeamId ||
      m.photoDate
  );

  const batchAnalyzeMutation = useMutation({
    mutationFn: () => mediaApi.triggerBatchAnalysis(50),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success(
        `Analyzed ${result.processed} photos${result.failed > 0 ? ` (${result.failed} failed)` : ''}`
      );
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Batch analysis failed');
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async ({
      item,
      updates,
    }: {
      item: MediaItem;
      updates: Parameters<typeof mediaApi.acceptSuggestions>[1];
    }) => {
      await mediaApi.acceptSuggestions(item.id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] });
      toast.success('Suggestions applied');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to apply suggestions');
    },
  });

  const teamNameMap = new Map(teams.map((t) => [t.id, t.name]));

  return (
    <>
      {/* Inline summary bar */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <AutoFixHighIcon color="primary" />
        <Typography variant="subtitle2" sx={{ mr: 1 }}>
          Photo Analysis
        </Typography>

        <Chip
          label={`${analyzedItems.length} analyzed`}
          size="small"
          color="success"
          variant="outlined"
        />
        {unanalyzedItems.length > 0 && (
          <Chip
            label={`${unanalyzedItems.length} unanalyzed`}
            size="small"
            color="warning"
            variant="outlined"
          />
        )}
        {pendingItems.length > 0 && (
          <Chip label={`${pendingItems.length} processing`} size="small" color="info" variant="outlined" />
        )}
        {failedItems.length > 0 && (
          <Chip label={`${failedItems.length} failed`} size="small" color="error" variant="outlined" />
        )}

        <Box sx={{ flex: 1 }} />

        {itemsWithSuggestions.length > 0 && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<PersonIcon />}
            onClick={() => setShowSuggestions(true)}
          >
            Review {itemsWithSuggestions.length} Suggestions
          </Button>
        )}

        <Button
          variant="contained"
          size="small"
          startIcon={<AutoFixHighIcon />}
          onClick={() => batchAnalyzeMutation.mutate()}
          disabled={batchAnalyzeMutation.isPending || unanalyzedItems.length === 0}
        >
          {batchAnalyzeMutation.isPending
            ? 'Analyzing...'
            : `Analyze Photos (${unanalyzedItems.length})`}
        </Button>
      </Paper>

      {batchAnalyzeMutation.isPending && (
        <LinearProgress sx={{ mb: 2 }} />
      )}

      {/* Suggestions review dialog */}
      <Dialog
        open={showSuggestions}
        onClose={() => setShowSuggestions(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AutoFixHighIcon />
            Review Analysis Suggestions
          </Box>
        </DialogTitle>
        <DialogContent>
          {itemsWithSuggestions.length === 0 ? (
            <Alert severity="info">No pending suggestions to review.</Alert>
          ) : (
            <List>
              {itemsWithSuggestions.map((item) => (
                <SuggestionItem
                  key={item.id}
                  item={item}
                  teamNameMap={teamNameMap}
                  onAcceptAll={() => {
                    const updates: Parameters<typeof mediaApi.acceptSuggestions>[1] = {};
                    if (item.suggestedTeamId) {
                      updates.teamId = item.suggestedTeamId;
                      updates.teamName = teamNameMap.get(item.suggestedTeamId) || '';
                    }
                    if (item.suggestedPlayerIds && item.suggestedPlayerNames) {
                      updates.playerIds = item.suggestedPlayerIds;
                      updates.playerNames = item.suggestedPlayerNames;
                    }
                    acceptMutation.mutate({ item, updates });
                  }}
                  isPending={acceptMutation.isPending}
                />
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSuggestions(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// ---- Individual suggestion item ----

interface SuggestionItemProps {
  item: MediaItem;
  teamNameMap: Map<string, string>;
  onAcceptAll: () => void;
  isPending: boolean;
}

const SuggestionItem = ({
  item,
  teamNameMap,
  onAcceptAll,
  isPending,
}: SuggestionItemProps) => {
  return (
    <ListItem
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        mb: 1,
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{ display: 'flex', width: '100%', gap: 2, alignItems: 'center' }}>
        {/* Thumbnail */}
        <Box
          component="img"
          src={item.thumbnailUrl || item.fileUrl}
          alt={item.fileName || ''}
          sx={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 1 }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {item.fileName || item.id}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {item.suggestedTeamId && (
              <Chip
                icon={<GroupsIcon />}
                label={`Team: ${teamNameMap.get(item.suggestedTeamId) || item.suggestedTeamId}`}
                size="small"
                color="primary"
                variant="outlined"
              />
            )}
            {item.suggestedPlayerNames && item.suggestedPlayerNames.length > 0 && (
              <Chip
                icon={<PersonIcon />}
                label={`Players: ${item.suggestedPlayerNames.join(', ')}`}
                size="small"
                color="secondary"
                variant="outlined"
              />
            )}
            {item.detectedJerseyNumbers && item.detectedJerseyNumbers.length > 0 && (
              <Chip
                label={`Jersey #${item.detectedJerseyNumbers.join(', #')}`}
                size="small"
                variant="outlined"
              />
            )}
            {item.photoDate && (
              <Chip
                icon={<CalendarTodayIcon />}
                label={new Date(item.photoDate).toLocaleDateString()}
                size="small"
                variant="outlined"
              />
            )}
            {item.detectedLabels && item.detectedLabels.length > 0 && (
              <Chip
                icon={<LabelIcon />}
                label={item.detectedLabels.slice(0, 3).join(', ')}
                size="small"
                variant="outlined"
              />
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Accept all suggestions">
            <IconButton
              color="success"
              onClick={onAcceptAll}
              disabled={isPending}
              size="small"
            >
              <CheckIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </ListItem>
  );
};

export default MediaAnalysisPanel;
