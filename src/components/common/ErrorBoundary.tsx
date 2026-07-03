import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Box, Button, Container, Typography } from '@mui/material';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level error boundary. Without this, a render error in any of the 60+
 * pages unmounts the entire React tree and leaves the user on a permanent
 * white screen. This catches the error and offers a recovery path instead.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Unhandled render error:', error, info.componentStack);
  }

  handleReload = () => {
    // Clear the error state and force a fresh render of the app.
    this.setState({ hasError: false });
    window.location.assign('/');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <Container maxWidth="sm">
        <Box
          sx={{
            minHeight: '60vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 2,
          }}
        >
          <Typography variant="h5" component="h1">
            Something went wrong
          </Typography>
          <Typography variant="body1" color="text.secondary">
            The page hit an unexpected error. Reloading usually fixes it. If the
            problem keeps happening, please contact the club administrator.
          </Typography>
          <Button variant="contained" onClick={this.handleReload}>
            Reload
          </Button>
        </Box>
      </Container>
    );
  }
}

export default ErrorBoundary;
