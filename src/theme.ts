import { createTheme } from '@mui/material/styles';

// Many pages use light tint shades like `bgcolor: 'success.50'`. Those numeric
// keys don't exist on non-grey MUI palettes by default (they render nothing),
// so we augment the palette types and define the tints once here.
declare module '@mui/material/styles' {
  interface PaletteColor {
    50?: string;
    100?: string;
  }
  interface SimplePaletteColorOptions {
    50?: string;
    100?: string;
  }
}

export const theme = createTheme({
  palette: {
    primary: {
      main: '#001f5b',
      light: '#1a3a7a',
      dark: '#001240',
      50: '#e6ebf3',
      100: '#c2cde0',
    },
    secondary: {
      main: '#9bcbeb',
      light: '#c5e1f5',
      dark: '#6ba8d4',
      50: '#eef6fc',
      100: '#d6eaf8',
    },
    success: {
      main: '#2e7d32',
      light: '#4caf50',
      dark: '#1b5e20',
      contrastText: '#ffffff',
      50: '#e8f5e9',
      100: '#c8e6c9',
    },
    error: {
      main: '#d32f2f',
      light: '#ef5350',
      dark: '#b71c1c',
      contrastText: '#ffffff',
      50: '#ffebee',
      100: '#ffcdd2',
    },
    warning: {
      main: '#ed6c02',
      light: '#ff9800',
      dark: '#c55a00',
      contrastText: '#ffffff',
      50: '#fff3e0',
      100: '#ffe0b2',
    },
    // Brand-aligned "info" (a mid blue in the navy/light-blue family) so
    // color="info" no longer falls back to MUI's off-brand default cyan.
    info: {
      main: '#2f6fb0',
      light: '#5a92cc',
      dark: '#1d4f86',
      contrastText: '#ffffff',
      50: '#e7f0f9',
      100: '#c4dbf0',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 500,
      '@media (max-width:900px)': {
        fontSize: '2rem',
      },
      '@media (max-width:600px)': {
        fontSize: '1.75rem',
      },
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 500,
      '@media (max-width:900px)': {
        fontSize: '1.75rem',
      },
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
    h3: {
      fontSize: '1.75rem',
      fontWeight: 500,
      '@media (max-width:900px)': {
        fontSize: '1.5rem',
      },
      '@media (max-width:600px)': {
        fontSize: '1.25rem',
      },
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 500,
      '@media (max-width:900px)': {
        fontSize: '1.35rem',
      },
      '@media (max-width:600px)': {
        fontSize: '1.2rem',
      },
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 500,
      '@media (max-width:900px)': {
        fontSize: '1.15rem',
      },
      '@media (max-width:600px)': {
        fontSize: '1.05rem',
      },
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      '@media (max-width:600px)': {
        fontSize: '0.925rem',
      },
    },
    body1: {
      '@media (max-width:600px)': {
        fontSize: '0.875rem',
      },
    },
    body2: {
      '@media (max-width:600px)': {
        fontSize: '0.8125rem',
      },
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        },
      },
    },
  },
});
