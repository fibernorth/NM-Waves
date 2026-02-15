import { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  Button,
  Grid,
  MenuItem,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

const AGE_GROUPS = ['8U', '10U', '12U', '14U', '16U', '18U'];

const POSITIONS = [
  'Pitcher',
  'Catcher',
  'First Base',
  'Second Base',
  'Shortstop',
  'Third Base',
  'Left Field',
  'Center Field',
  'Right Field',
  'Utility',
];

const tryoutSchema = z.object({
  playerFirstName: z.string().min(1, 'Player first name is required').max(50),
  playerLastName: z.string().min(1, 'Player last name is required').max(50),
  dateOfBirth: z.string().min(1, 'Date of birth is required'),
  ageGroup: z.string().min(1, 'Age group is required'),
  parentName: z.string().min(1, 'Parent/guardian name is required').max(100),
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  phone: z.string().min(1, 'Phone number is required').max(20),
  positionsInterested: z.string().min(1, 'Please select at least one position'),
  priorExperience: z.string().max(1000).optional(),
});

type TryoutFormData = z.infer<typeof tryoutSchema>;

const TryoutRegistrationPage = () => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<TryoutFormData>({
    resolver: zodResolver(tryoutSchema),
    defaultValues: {
      playerFirstName: '',
      playerLastName: '',
      dateOfBirth: '',
      ageGroup: '',
      parentName: '',
      email: '',
      phone: '',
      positionsInterested: '',
      priorExperience: '',
    },
  });

  const onSubmit = async (data: TryoutFormData) => {
    setSubmitError(null);
    setSubmitting(true);

    try {
      await addDoc(collection(db, 'tryout-applicants'), {
        playerFirstName: data.playerFirstName.trim(),
        playerLastName: data.playerLastName.trim(),
        dateOfBirth: data.dateOfBirth,
        ageGroup: data.ageGroup,
        parentName: data.parentName.trim(),
        email: data.email.trim(),
        phone: data.phone.trim(),
        positionsInterested: data.positionsInterested,
        priorExperience: data.priorExperience?.trim() || '',
        submittedAt: Timestamp.now(),
        status: 'new',
      });
      setSubmitted(true);
      reset();
    } catch (err) {
      console.error('Error submitting tryout registration:', err);
      setSubmitError('There was an error submitting your registration. Please try again later.');
    } finally {
      setSubmitting(false);
    }
  };

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
            Tryout Registration
          </Typography>
          <Typography variant="h6" sx={{ mt: 1, opacity: 0.9, fontWeight: 300 }}>
            Register your player for TC Waves tryouts
          </Typography>
        </Container>
      </Box>

      <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
        <Paper sx={{ p: { xs: 3, md: 4 } }}>
          {submitted ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Alert severity="success" sx={{ mb: 3 }}>
                Registration submitted successfully!
              </Alert>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Thank You for Registering!
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                We have received your tryout registration. A member of our coaching staff will
                contact you with tryout details, including date, time, and location.
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Please make sure your player brings appropriate gear to tryouts,
                including a glove, bat, cleats, and athletic clothing.
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setSubmitted(false)}
                sx={{ mt: 2 }}
              >
                Register Another Player
              </Button>
            </Box>
          ) : (
            <>
              <Typography variant="h5" fontWeight={600} gutterBottom>
                Player Information
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                All fields marked with * are required.
              </Typography>
              <Divider sx={{ mb: 3 }} />

              {submitError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {submitError}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
                <Grid container spacing={2.5}>
                  {/* Player Info */}
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="playerFirstName"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Player First Name"
                          error={!!errors.playerFirstName}
                          helperText={errors.playerFirstName?.message}
                          required
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="playerLastName"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Player Last Name"
                          error={!!errors.playerLastName}
                          helperText={errors.playerLastName?.message}
                          required
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="dateOfBirth"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Date of Birth"
                          type="date"
                          InputLabelProps={{ shrink: true }}
                          error={!!errors.dateOfBirth}
                          helperText={errors.dateOfBirth?.message}
                          required
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="ageGroup"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          select
                          label="Age Group Interest"
                          error={!!errors.ageGroup}
                          helperText={errors.ageGroup?.message}
                          required
                        >
                          {AGE_GROUPS.map((group) => (
                            <MenuItem key={group} value={group}>
                              {group}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>

                  {/* Divider */}
                  <Grid item xs={12}>
                    <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                      Parent / Guardian Information
                    </Typography>
                    <Divider sx={{ mt: 1 }} />
                  </Grid>

                  <Grid item xs={12}>
                    <Controller
                      name="parentName"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Parent/Guardian Full Name"
                          error={!!errors.parentName}
                          helperText={errors.parentName?.message}
                          required
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="email"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Email Address"
                          type="email"
                          error={!!errors.email}
                          helperText={errors.email?.message}
                          required
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Controller
                      name="phone"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Phone Number"
                          error={!!errors.phone}
                          helperText={errors.phone?.message}
                          required
                        />
                      )}
                    />
                  </Grid>

                  {/* Playing Experience */}
                  <Grid item xs={12}>
                    <Typography variant="h6" fontWeight={600} sx={{ mt: 1 }}>
                      Playing Experience
                    </Typography>
                    <Divider sx={{ mt: 1 }} />
                  </Grid>

                  <Grid item xs={12}>
                    <Controller
                      name="positionsInterested"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          select
                          label="Primary Position Interest"
                          error={!!errors.positionsInterested}
                          helperText={errors.positionsInterested?.message}
                          required
                        >
                          {POSITIONS.map((position) => (
                            <MenuItem key={position} value={position}>
                              {position}
                            </MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Controller
                      name="priorExperience"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth
                          label="Prior Experience"
                          multiline
                          rows={4}
                          placeholder="Please describe any prior playing experience, including teams played for, years played, and any notable achievements."
                          error={!!errors.priorExperience}
                          helperText={errors.priorExperience?.message}
                        />
                      )}
                    />
                  </Grid>

                  {/* Submit */}
                  <Grid item xs={12}>
                    <Button
                      type="submit"
                      variant="contained"
                      size="large"
                      disabled={submitting}
                      sx={{ minWidth: 200, mt: 1 }}
                    >
                      {submitting ? (
                        <CircularProgress size={24} color="inherit" />
                      ) : (
                        'Submit Registration'
                      )}
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </>
          )}
        </Paper>
      </Container>
    </Box>
  );
};

export default TryoutRegistrationPage;
