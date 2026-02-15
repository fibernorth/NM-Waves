import { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Box,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import type { Sponsor } from '@/types/models';

const LEVEL_ORDER: Record<string, number> = {
  gold: 1,
  silver: 2,
  bronze: 3,
  custom: 4,
};

const LEVEL_COLORS: Record<string, string> = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  custom: '#1976d2',
};

const LEVEL_LABELS: Record<string, string> = {
  gold: 'Gold Sponsor',
  silver: 'Silver Sponsor',
  bronze: 'Bronze Sponsor',
  custom: 'Sponsor',
};

const PublicSponsorsPage = () => {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSponsors = async () => {
      try {
        const q = query(
          collection(db, 'sponsors'),
          where('displayOnPublicSite', '==', true),
          orderBy('businessName')
        );
        const snapshot = await getDocs(q);
        const sponsorsData = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            businessName: data.businessName,
            logoUrl: data.logoUrl || '',
            websiteUrl: data.websiteUrl || '',
            contactName: data.contactName || '',
            contactEmail: data.contactEmail || '',
            contactPhone: data.contactPhone || '',
            level: data.level,
            amount: data.amount || 0,
            displayOnPublicSite: data.displayOnPublicSite ?? false,
            season: data.season,
            createdAt: data.createdAt?.toDate() || new Date(),
          } as Sponsor;
        });
        setSponsors(sponsorsData);
      } catch (err) {
        console.error('Error fetching sponsors:', err);
        setError('Unable to load sponsors at this time. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchSponsors();
  }, []);

  // Group sponsors by level
  const groupedSponsors: Record<string, Sponsor[]> = {};
  sponsors.forEach((sponsor) => {
    const level = sponsor.level || 'custom';
    if (!groupedSponsors[level]) {
      groupedSponsors[level] = [];
    }
    groupedSponsors[level].push(sponsor);
  });

  // Sort levels by defined order
  const sortedLevels = Object.keys(groupedSponsors).sort(
    (a, b) => (LEVEL_ORDER[a] || 99) - (LEVEL_ORDER[b] || 99)
  );

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
            Our Sponsors
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Thank you to the businesses that support TC Waves
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
        ) : sponsors.length === 0 ? (
          <Alert severity="info">
            Sponsor information coming soon! Interested in sponsoring TC Waves? Visit our
            Contact page to get in touch.
          </Alert>
        ) : (
          sortedLevels.map((level, levelIndex) => (
            <Box key={level} sx={{ mb: 6 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Box
                  sx={{
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    backgroundColor: LEVEL_COLORS[level] || '#999',
                  }}
                />
                <Typography variant="h4" fontWeight={600}>
                  {LEVEL_LABELS[level] || level.charAt(0).toUpperCase() + level.slice(1) + ' Sponsors'}
                </Typography>
              </Box>

              <Grid container spacing={3}>
                {groupedSponsors[level].map((sponsor) => (
                  <Grid item xs={12} sm={6} md={level === 'gold' ? 6 : 4} key={sponsor.id}>
                    <Card
                      sx={{
                        height: '100%',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
                        },
                        border: level === 'gold' ? `2px solid ${LEVEL_COLORS.gold}` : undefined,
                      }}
                    >
                      {sponsor.websiteUrl ? (
                        <CardActionArea
                          component="a"
                          href={sponsor.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                        >
                          <SponsorCardContent sponsor={sponsor} level={level} />
                        </CardActionArea>
                      ) : (
                        <SponsorCardContent sponsor={sponsor} level={level} />
                      )}
                    </Card>
                  </Grid>
                ))}
              </Grid>

              {levelIndex < sortedLevels.length - 1 && <Divider sx={{ mt: 4 }} />}
            </Box>
          ))
        )}

        {/* Become a Sponsor CTA */}
        {!loading && !error && (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              px: 3,
              backgroundColor: 'grey.50',
              borderRadius: 2,
              mt: 4,
            }}
          >
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Interested in Sponsoring TC Waves?
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Contact us to learn about sponsorship opportunities and how your business can
              support youth athletics in Traverse City.
            </Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
};

// Extracted card content component
const SponsorCardContent = ({ sponsor, level }: { sponsor: Sponsor; level: string }) => (
  <>
    {sponsor.logoUrl && (
      <CardMedia
        component="img"
        image={sponsor.logoUrl}
        alt={`${sponsor.businessName} logo`}
        sx={{
          height: level === 'gold' ? 160 : 120,
          objectFit: 'contain',
          p: 2,
          backgroundColor: '#fafafa',
        }}
      />
    )}
    <CardContent sx={{ flexGrow: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="h6" fontWeight={600}>
          {sponsor.businessName}
        </Typography>
        {sponsor.websiteUrl && (
          <OpenInNewIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
        )}
      </Box>
      <Chip
        label={LEVEL_LABELS[level] || level}
        size="small"
        sx={{
          backgroundColor: LEVEL_COLORS[level] || '#999',
          color: level === 'silver' ? '#333' : 'white',
          fontWeight: 600,
        }}
      />
    </CardContent>
  </>
);

export default PublicSponsorsPage;
