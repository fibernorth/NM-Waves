import { useState } from 'react';
import { Button, CircularProgress } from '@mui/material';
import PaymentIcon from '@mui/icons-material/Payment';
import { redirectToCheckout } from '@/lib/api/stripe';
import toast from 'react-hot-toast';

interface StripeCheckoutButtonProps {
  financeId: string;
  playerId: string;
  amount: number;
  sponsorId?: string;
  isAnonymous?: boolean;
  invoiceToken?: string;
  payerEmail?: string;
  payerName?: string;
  label?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
}

const StripeCheckoutButton = ({
  financeId,
  playerId,
  amount,
  sponsorId,
  isAnonymous,
  invoiceToken,
  payerEmail,
  payerName,
  label = 'Pay with Card',
  disabled = false,
  fullWidth = false,
  variant = 'contained',
  size = 'large',
}: StripeCheckoutButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (amount < 0.5) {
      toast.error('Minimum payment amount is $0.50');
      return;
    }

    setLoading(true);
    try {
      await redirectToCheckout({
        financeId,
        playerId,
        amount,
        sponsorId,
        isAnonymous,
        invoiceToken,
        payerEmail,
        payerName,
      });
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      toast.error(error.message || 'Failed to start checkout. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={disabled || loading || amount < 0.5}
      fullWidth={fullWidth}
      startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <PaymentIcon />}
      sx={{
        backgroundColor: variant === 'contained' ? '#635bff' : undefined,
        '&:hover': variant === 'contained' ? { backgroundColor: '#4b45c6' } : undefined,
      }}
    >
      {loading ? 'Redirecting to Stripe...' : label}
    </Button>
  );
};

export default StripeCheckoutButton;
