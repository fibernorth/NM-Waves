import {
  Box,
  Stepper,
  Step,
  StepLabel,
  StepButton,
  Typography,
  Chip,
} from '@mui/material';
import type { TournamentWorkflowStatus } from '@/types/models';

const WORKFLOW_STEPS: { status: TournamentWorkflowStatus; label: string }[] = [
  { status: 'wanting', label: 'Wanting' },
  { status: 'entered', label: 'Entered' },
  { status: 'deposit_paid', label: 'Deposit Paid' },
  { status: 'paid_in_full', label: 'Paid in Full' },
  { status: 'schedule_received', label: 'Schedule Received' },
  { status: 'playing', label: 'Playing' },
  { status: 'completed', label: 'Completed' },
];

const statusColorMap: Record<TournamentWorkflowStatus, 'default' | 'info' | 'warning' | 'success' | 'primary' | 'secondary'> = {
  wanting: 'default',
  entered: 'info',
  deposit_paid: 'primary',
  paid_in_full: 'success',
  schedule_received: 'info',
  playing: 'warning',
  completed: 'success',
};

interface TournamentWorkflowStepperProps {
  currentStatus: TournamentWorkflowStatus;
  onStatusChange?: (newStatus: TournamentWorkflowStatus) => void;
  readOnly?: boolean;
}

const TournamentWorkflowStepper = ({
  currentStatus,
  onStatusChange,
  readOnly = false,
}: TournamentWorkflowStepperProps) => {
  const activeStep = WORKFLOW_STEPS.findIndex((s) => s.status === currentStatus);

  const handleStepClick = (index: number) => {
    if (readOnly || !onStatusChange) return;
    onStatusChange(WORKFLOW_STEPS[index].status);
  };

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Workflow Status:
        </Typography>
        <Chip
          label={WORKFLOW_STEPS[activeStep]?.label || currentStatus}
          color={statusColorMap[currentStatus] || 'default'}
          size="small"
        />
      </Box>
      <Stepper activeStep={activeStep} alternativeLabel nonLinear={!readOnly}>
        {WORKFLOW_STEPS.map((step, index) => (
          <Step key={step.status} completed={index < activeStep}>
            {readOnly ? (
              <StepLabel>{step.label}</StepLabel>
            ) : (
              <StepButton onClick={() => handleStepClick(index)}>
                {step.label}
              </StepButton>
            )}
          </Step>
        ))}
      </Stepper>
    </Box>
  );
};

export default TournamentWorkflowStepper;
export { WORKFLOW_STEPS, statusColorMap };
