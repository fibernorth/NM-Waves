import { Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Optional leading icon (rendered before the title). */
  icon?: ReactNode;
  /** Right-aligned actions (buttons, etc.). */
  actions?: ReactNode;
}

/**
 * Standard page header — one title style (h4), consistent spacing, optional
 * icon/subtitle and right-aligned actions. Replaces the several hand-rolled
 * title-row patterns across the app so every page reads the same.
 */
const PageHeader = ({ title, subtitle, icon, actions }: PageHeaderProps) => (
  <Box sx={{ mb: 3 }}>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
        {icon}
        <Typography variant="h4" sx={{ minWidth: 0 }}>
          {title}
        </Typography>
      </Box>
      {actions && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{actions}</Box>}
    </Box>
    {subtitle && (
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
        {subtitle}
      </Typography>
    )}
  </Box>
);

export default PageHeader;
