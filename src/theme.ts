import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#001f5b',
      light: '#1a3a7a',
      dark: '#001240',
    },
    secondary: {
      main: '#9bcbeb',
      light: '#c5e1f5',
      dark: '#6ba8d4',
    },
    success: {
      main: '#2e7d32',
    },
    error: {
      main: '#d32f2f',
    },
    warning: {
      main: '#ed6c02',
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
