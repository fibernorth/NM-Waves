import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from '@mui/material';

export interface ConfirmOptions {
  title?: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Styles the confirm button as a destructive (red) action. */
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

/**
 * Promise-based confirmation dialog, styled with MUI to replace the app's
 * native `window.confirm()` calls (which broke the look on the most
 * consequential actions). Usage:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete team?', message: '…', destructive: true })) { … }
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = (): ConfirmFn => useContext(ConfirmContext);

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ opts, resolve })),
    []
  );

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onClose={() => close(false)} maxWidth="xs" fullWidth>
        {state?.opts.title && <DialogTitle>{state.opts.title}</DialogTitle>}
        <DialogContent>
          <DialogContentText component="div">{state?.opts.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => close(false)}>{state?.opts.cancelText || 'Cancel'}</Button>
          <Button
            onClick={() => close(true)}
            variant="contained"
            color={state?.opts.destructive ? 'error' : 'primary'}
            autoFocus
          >
            {state?.opts.confirmText || 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </ConfirmContext.Provider>
  );
};
