import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  CircularProgress,
  Alert,
  Dialog,
  IconButton,
  Chip,
  Stack,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import {
  collection,
  query,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { MediaItem } from '@/types/models';

const PublicGalleryPage = () => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [filterTeam, setFilterTeam] = useState<string | null>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const q = query(
          collection(db, 'media'),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            fileUrl: data.fileUrl,
            thumbnailUrl: data.thumbnailUrl || undefined,
            fileName: data.fileName || undefined,
            teamId: data.teamId,
            teamName: data.teamName || undefined,
            uploadedBy: data.uploadedBy,
            uploadedByName: data.uploadedByName || undefined,
            tags: data.tags || [],
            caption: data.caption || undefined,
            mediaType: data.mediaType || 'image',
            createdAt: data.createdAt?.toDate() || new Date(),
          } as MediaItem;
        });
        setMedia(items);
      } catch (err) {
        console.error('Error fetching media:', err);
        setError('Unable to load gallery at this time. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, []);

  const teamNames = Array.from(new Set(media.map((m) => m.teamName).filter(Boolean))) as string[];

  const filteredMedia = filterTeam
    ? media.filter((m) => m.teamName === filterTeam)
    : media;

  const imageMedia = filteredMedia.filter((m) => m.mediaType === 'image');

  const handleOpen = (index: number) => setSelectedIndex(index);
  const handleClose = () => setSelectedIndex(null);
  const handlePrev = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };
  const handleNext = () => {
    if (selectedIndex !== null && selectedIndex < imageMedia.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  const cols = isMobile ? 1 : isTablet ? 2 : 3;

  return (
    <Box>
      {/* Page Header */}
      <Box
        sx={{
          backgroundColor: 'primary.main',
          color: 'white',
          py: { xs: 4, md: 6 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h3"
            component="h1"
            fontWeight={700}
            sx={{ fontSize: { xs: '1.75rem', md: '2.5rem' } }}
          >
            Photo Gallery
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Highlights from our teams and events
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 6 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : imageMedia.length === 0 ? (
          <Alert severity="info">
            No photos have been uploaded yet. Check back soon!
          </Alert>
        ) : (
          <>
            {/* Team filter chips */}
            {teamNames.length > 1 && (
              <Stack direction="row" spacing={1} sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}>
                <Chip
                  label="All Teams"
                  color={filterTeam === null ? 'primary' : 'default'}
                  onClick={() => setFilterTeam(null)}
                  variant={filterTeam === null ? 'filled' : 'outlined'}
                />
                {teamNames.map((name) => (
                  <Chip
                    key={name}
                    label={name}
                    color={filterTeam === name ? 'primary' : 'default'}
                    onClick={() => setFilterTeam(name)}
                    variant={filterTeam === name ? 'filled' : 'outlined'}
                  />
                ))}
              </Stack>
            )}

            <ImageList cols={cols} gap={12}>
              {imageMedia.map((item, index) => (
                <ImageListItem
                  key={item.id}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 1,
                    overflow: 'hidden',
                    '&:hover': { opacity: 0.9 },
                  }}
                  onClick={() => handleOpen(index)}
                >
                  <img
                    src={item.fileUrl}
                    alt={item.caption || item.fileName || 'Gallery photo'}
                    loading="lazy"
                    style={{ height: 260, objectFit: 'cover' }}
                  />
                  {(item.caption || item.teamName) && (
                    <ImageListItemBar
                      title={item.caption}
                      subtitle={item.teamName}
                    />
                  )}
                </ImageListItem>
              ))}
            </ImageList>
          </>
        )}
      </Container>

      {/* Lightbox Dialog */}
      <Dialog
        open={selectedIndex !== null}
        onClose={handleClose}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'black',
            position: 'relative',
            m: { xs: 1, md: 2 },
          },
        }}
      >
        {selectedIndex !== null && imageMedia[selectedIndex] && (
          <Box sx={{ position: 'relative' }}>
            <IconButton
              onClick={handleClose}
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                color: 'white',
                bgcolor: 'rgba(0,0,0,0.5)',
                zIndex: 1,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
              }}
            >
              <CloseIcon />
            </IconButton>

            {selectedIndex > 0 && (
              <IconButton
                onClick={handlePrev}
                sx={{
                  position: 'absolute',
                  left: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  zIndex: 1,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <ArrowBackIosNewIcon />
              </IconButton>
            )}

            {selectedIndex < imageMedia.length - 1 && (
              <IconButton
                onClick={handleNext}
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.5)',
                  zIndex: 1,
                  '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' },
                }}
              >
                <ArrowForwardIosIcon />
              </IconButton>
            )}

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: { xs: 300, md: 500 },
                p: 2,
              }}
            >
              <img
                src={imageMedia[selectedIndex].fileUrl}
                alt={imageMedia[selectedIndex].caption || 'Gallery photo'}
                style={{
                  maxWidth: '100%',
                  maxHeight: '80vh',
                  objectFit: 'contain',
                }}
              />
            </Box>

            {imageMedia[selectedIndex].caption && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body1" color="white">
                  {imageMedia[selectedIndex].caption}
                </Typography>
                {imageMedia[selectedIndex].teamName && (
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                    {imageMedia[selectedIndex].teamName}
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}
      </Dialog>
    </Box>
  );
};

export default PublicGalleryPage;
