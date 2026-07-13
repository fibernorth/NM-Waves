import { useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Chip,
  TextField,
  Rating,
  Slider,
  CircularProgress,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';
import type { EvalCategory, EvalParticipant, EvalStation } from '@/lib/api/evaluations';
import toast from 'react-hot-toast';

/**
 * SkillShark-style scoring surface, shared by the signed-in coach page and the
 * guest evaluator page: pick a station → tap a player → slide/tap scores for
 * that station's skills → save & next. Media attach is only offered in direct
 * (signed-in) mode; guest submissions go through the tokened Cloud Function.
 */

export interface ScoreSubmission {
  participantId: string;
  skillId: string;
  stationId?: string;
  score: number;
  comment?: string;
  mediaUrls?: string[];
}

interface Props {
  eventId: string;
  categories: EvalCategory[];
  stations: EvalStation[];
  participants: EvalParticipant[];
  /** Persist one skill score. Throw to signal failure. */
  onSubmit: (s: ScoreSubmission) => Promise<void>;
  /** Signed-in mode enables photo/video attachments. */
  allowMedia: boolean;
  /** participantId -> count of scores already recorded (for the done badges). */
  scoredCounts?: Record<string, number>;
}

const ScoringBoard = ({ eventId, categories, stations, participants, onSubmit, allowMedia, scoredCounts = {} }: Props) => {
  const [stationId, setStationId] = useState<string>(stations[0]?.id || '');
  const [activeP, setActiveP] = useState<EvalParticipant | null>(null);
  const [values, setValues] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [sessionScored, setSessionScored] = useState<Record<string, Set<string>>>({});
  const fileInput = useRef<HTMLInputElement>(null);

  const skillById = useMemo(() => {
    const m = new Map<string, { skill: EvalCategory['skills'][number]; category: EvalCategory }>();
    for (const c of categories) for (const s of c.skills) m.set(s.id, { skill: s, category: c });
    return m;
  }, [categories]);

  const station = stations.find((s) => s.id === stationId) || stations[0];
  const stationSkills = (station?.skillIds || []).map((id) => skillById.get(id)).filter(Boolean) as Array<{
    skill: EvalCategory['skills'][number];
    category: EvalCategory;
  }>;

  const checkedIn = participants.filter((p) => p.checkedIn);
  const roster = checkedIn.length > 0 ? checkedIn : participants;

  const openParticipant = (p: EvalParticipant) => {
    setActiveP(p);
    setValues({});
    setComment('');
    setMediaFiles([]);
  };

  const save = async (advance: boolean) => {
    if (!activeP || !station) return;
    const entries = Object.entries(values).filter(([, v]) => v > 0);
    if (entries.length === 0) {
      toast.error('Score at least one skill first');
      return;
    }
    setSaving(true);
    try {
      // Upload attachments once; attach to the first scored skill.
      const mediaUrls: string[] = [];
      if (allowMedia && mediaFiles.length > 0) {
        for (const f of mediaFiles) {
          const path = `media/evaluations/${eventId}/${activeP.id}-${Date.now()}-${f.name}`;
          const r = ref(storage, path);
          await uploadBytes(r, f);
          mediaUrls.push(await getDownloadURL(r));
        }
      }
      let first = true;
      for (const [skillId, score] of entries) {
        await onSubmit({
          participantId: activeP.id,
          skillId,
          stationId: station.id,
          score,
          comment: first ? comment.trim() || undefined : undefined,
          mediaUrls: first && mediaUrls.length ? mediaUrls : undefined,
        });
        first = false;
      }
      setSessionScored((prev) => {
        const next = { ...prev };
        if (!next[station.id]) next[station.id] = new Set();
        next[station.id] = new Set(next[station.id]).add(activeP.id);
        return next;
      });
      toast.success(`Saved ${entries.length} score${entries.length === 1 ? '' : 's'} for #${activeP.number || '—'} ${activeP.name}`);
      if (advance) {
        const idx = roster.findIndex((p) => p.id === activeP.id);
        const next = roster[(idx + 1) % roster.length];
        openParticipant(next);
      } else {
        setActiveP(null);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save scores');
    } finally {
      setSaving(false);
    }
  };

  if (!station) {
    return <Alert severity="info">No stations defined for this event yet.</Alert>;
  }

  return (
    <Box>
      {/* Station picker */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {stations.map((s) => (
          <Chip
            key={s.id}
            label={s.name}
            color={s.id === station.id ? 'primary' : 'default'}
            onClick={() => { setStationId(s.id); setActiveP(null); }}
          />
        ))}
      </Box>
      {station.location && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          📍 {station.location}{station.notes ? ` — ${station.notes}` : ''}
        </Typography>
      )}

      {!activeP ? (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Tap a player to score them at <b>{station.name}</b>.
            {checkedIn.length > 0 && ' Showing checked-in players.'}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1 }}>
            {roster.map((p) => {
              const done = sessionScored[station.id]?.has(p.id);
              return (
                <Paper
                  key={p.id}
                  variant="outlined"
                  onClick={() => openParticipant(p)}
                  sx={{
                    p: 1.25, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1,
                    borderColor: done ? 'success.main' : 'divider',
                    '&:hover': { borderColor: 'primary.main' },
                  }}
                >
                  <Chip size="small" label={p.number || '—'} color="primary" sx={{ fontWeight: 700, minWidth: 40 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>{p.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {p.division || ''}{p.group ? ` · ${p.group}` : ''}
                      {scoredCounts[p.id] ? ` · ${scoredCounts[p.id]} scores` : ''}
                    </Typography>
                  </Box>
                  {done && <CheckCircleIcon color="success" fontSize="small" sx={{ ml: 'auto' }} />}
                </Paper>
              );
            })}
          </Box>
          {roster.length === 0 && <Alert severity="info">No participants yet — add them on the Setup tab.</Alert>}
        </>
      ) : (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Chip label={activeP.number || '—'} color="primary" sx={{ fontWeight: 700 }} />
            <Typography variant="h6" sx={{ flexGrow: 1 }}>{activeP.name}</Typography>
            <Button size="small" onClick={() => setActiveP(null)}>Back to list</Button>
          </Box>

          {stationSkills.map(({ skill }) => (
            <Box key={skill.id} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" fontWeight={600}>
                  {skill.name}
                  {skill.weight > 1 && <Chip label={`×${skill.weight}`} size="small" sx={{ ml: 1, height: 18 }} />}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {values[skill.id] ? `${values[skill.id]}/${skill.scale}` : 'not scored'}
                </Typography>
              </Box>
              {skill.description && (
                <Typography variant="caption" color="text.secondary">{skill.description}</Typography>
              )}
              {skill.scale === 5 ? (
                <Rating
                  size="large"
                  value={values[skill.id] || 0}
                  onChange={(_, v) => setValues((prev) => ({ ...prev, [skill.id]: v || 0 }))}
                />
              ) : (
                <Slider
                  value={values[skill.id] || 0}
                  onChange={(_, v) => setValues((prev) => ({ ...prev, [skill.id]: v as number }))}
                  min={0} max={10} step={1} marks valueLabelDisplay="auto"
                />
              )}
            </Box>
          ))}

          <TextField
            label="Comment (optional)"
            fullWidth multiline minRows={2} sx={{ mt: 1 }}
            value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="Quick note — swing looks long, great first step, works hard…"
          />

          {allowMedia && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <input
                ref={fileInput} type="file" hidden multiple accept="image/*,video/*"
                onChange={(e) => setMediaFiles(Array.from(e.target.files || []))}
              />
              <Tooltip title="Attach photos or videos of this player (max 50MB each)">
                <IconButton onClick={() => fileInput.current?.click()}><AttachFileIcon /></IconButton>
              </Tooltip>
              {mediaFiles.map((f, i) => (
                <Chip key={i} label={f.name} size="small" onDelete={() => setMediaFiles((m) => m.filter((_, j) => j !== i))} />
              ))}
            </Box>
          )}

          <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
            <Button onClick={() => save(false)} disabled={saving}>Save</Button>
            <Button
              variant="contained"
              endIcon={saving ? <CircularProgress size={16} /> : <NavigateNextIcon />}
              onClick={() => save(true)}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save & Next Player'}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default ScoringBoard;
