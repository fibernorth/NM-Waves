import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Container } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { sponsorsApi } from '@/lib/api/sponsors';
import type { Sponsor } from '@/types/models';

interface SponsorBannerProps {
  mode: 'carousel' | 'footer';
}

const SponsorBanner = ({ mode }: SponsorBannerProps) => {
  const { data: sponsors = [] } = useQuery({
    queryKey: ['sponsors', 'public'],
    queryFn: () => sponsorsApi.getPublic(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  // Build display list - gold sponsors appear more frequently
  const displaySponsors = sponsors.length > 0 ? (() => {
    const list: Sponsor[] = [];
    sponsors.forEach(s => {
      list.push(s);
      if (s.level === 'gold') list.push(s); // Gold appears 2x
    });
    return list;
  })() : [];

  // Auto-rotate for carousel mode
  const rotate = useCallback(() => {
    if (displaySponsors.length === 0) return;
    setCurrentIndex(prev => (prev + 1) % displaySponsors.length);
  }, [displaySponsors.length]);

  useEffect(() => {
    if (mode !== 'carousel' || displaySponsors.length === 0) return;
    const interval = setInterval(rotate, 4000);
    return () => clearInterval(interval);
  }, [mode, rotate, displaySponsors.length]);

  if (sponsors.length === 0) return null;

  if (mode === 'footer') {
    return (
      <Box sx={{ py: 2, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
        <Typography
          variant="caption"
          sx={{ display: 'block', textAlign: 'center', mb: 1.5, opacity: 0.7, color: 'inherit' }}
        >
          Proudly Supported By
        </Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 3,
          }}
        >
          {sponsors.map((sponsor) => (
            <Box
              key={sponsor.id}
              component="a"
              href={sponsor.websiteUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                opacity: 0.8,
                transition: 'opacity 0.2s',
                '&:hover': { opacity: 1 },
              }}
            >
              {sponsor.logoUrl ? (
                <Box
                  component="img"
                  src={sponsor.logoUrl}
                  alt={sponsor.businessName}
                  sx={{
                    height: sponsor.level === 'gold' ? 36 : 28,
                    width: 'auto',
                    maxWidth: 120,
                    objectFit: 'contain',
                    filter: 'brightness(0) invert(1)',
                  }}
                />
              ) : (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'inherit',
                    fontWeight: sponsor.level === 'gold' ? 700 : 400,
                    fontSize: sponsor.level === 'gold' ? '0.85rem' : '0.75rem',
                  }}
                >
                  {sponsor.businessName}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  // Carousel mode
  const visibleCount = Math.min(5, sponsors.length);
  const getVisibleSponsors = () => {
    const visible: Sponsor[] = [];
    for (let i = 0; i < visibleCount; i++) {
      const idx = (currentIndex + i) % displaySponsors.length;
      // Avoid duplicates in view
      const sponsor = displaySponsors[idx];
      if (!visible.find(v => v.id === sponsor.id)) {
        visible.push(sponsor);
      } else if (displaySponsors.length > visibleCount) {
        // Find next non-duplicate
        for (let j = 1; j < displaySponsors.length; j++) {
          const altIdx = (idx + j) % displaySponsors.length;
          const alt = displaySponsors[altIdx];
          if (!visible.find(v => v.id === alt.id)) {
            visible.push(alt);
            break;
          }
        }
      }
    }
    return visible;
  };

  return (
    <Box sx={{ py: 4, backgroundColor: 'grey.50' }}>
      <Container maxWidth="lg">
        <Typography
          variant="overline"
          sx={{ display: 'block', textAlign: 'center', mb: 2, color: 'text.secondary', letterSpacing: 2 }}
        >
          Our Sponsors
        </Typography>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: { xs: 3, md: 5 },
            flexWrap: 'wrap',
            minHeight: 60,
          }}
        >
          {getVisibleSponsors().map((sponsor) => (
            <Box
              key={sponsor.id}
              component="a"
              href={sponsor.websiteUrl || '#'}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                transition: 'transform 0.2s, opacity 0.2s',
                opacity: 0.75,
                '&:hover': { opacity: 1, transform: 'scale(1.05)' },
              }}
            >
              {sponsor.logoUrl ? (
                <Box
                  component="img"
                  src={sponsor.logoUrl}
                  alt={sponsor.businessName}
                  sx={{
                    height: sponsor.level === 'gold' ? 56 : 40,
                    width: 'auto',
                    maxWidth: sponsor.level === 'gold' ? 180 : 140,
                    objectFit: 'contain',
                  }}
                />
              ) : (
                <Box
                  sx={{
                    px: 2,
                    py: 1,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    backgroundColor: 'white',
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.primary',
                      fontWeight: sponsor.level === 'gold' ? 700 : 500,
                      fontSize: sponsor.level === 'gold' ? '1rem' : '0.875rem',
                    }}
                  >
                    {sponsor.businessName}
                  </Typography>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default SponsorBanner;
