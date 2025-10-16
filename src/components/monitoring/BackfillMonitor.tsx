import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  LinearProgress,
  Chip,
  Button,
  IconButton,
  Alert,
  AlertTitle,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Tooltip,
  Collapse,
  Divider,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Error as ErrorIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Storage as StorageIcon,
  CloudQueue as CloudIcon,
  Dashboard as DashboardIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { backfillService } from '../../services/backfillService';
import type { BackfillConfig, BackfillStatusType } from '../../types/backfill';

const STATUS_COLORS: Record<BackfillStatusType, 'success' | 'error' | 'warning' | 'info' | 'default'> = {
  running: 'info',
  paused: 'warning',
  failed: 'error',
  completed: 'success',
  idle: 'default',
};

const STATUS_LABELS: Record<BackfillStatusType, string> = {
  running: 'Running',
  paused: 'Paused',
  failed: 'Failed',
  completed: 'Completed',
  idle: 'Idle',
};

export const BackfillMonitor: React.FC = () => {
  const queryClient = useQueryClient();
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [showCompletedDates, setShowCompletedDates] = useState(false);
  const [config, setConfig] = useState<BackfillConfig>({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    batchSize: 100,
    delayMs: 1000,
  });

  // Query for backfill status with auto-refresh every 5 seconds
  const { data: status, isLoading, error } = useQuery({
    queryKey: ['backfillStatus'],
    queryFn: () => backfillService.getStatus(),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  // Mutations
  const startMutation = useMutation({
    mutationFn: (config: BackfillConfig) => backfillService.start(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backfillStatus'] });
      setStartDialogOpen(false);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => backfillService.pause(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backfillStatus'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: () => backfillService.resume(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backfillStatus'] }),
  });

  const stopMutation = useMutation({
    mutationFn: () => backfillService.stop(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backfillStatus'] }),
  });

  const retryMutation = useMutation({
    mutationFn: () => backfillService.retryFailed(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backfillStatus'] }),
  });

  const resetMutation = useMutation({
    mutationFn: () => backfillService.reset(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backfillStatus'] }),
  });

  const handleStartBackfill = () => {
    startMutation.mutate(config);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['backfillStatus'] });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent>
          <Typography>Loading backfill status...</Typography>
          <LinearProgress />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">
            <AlertTitle>Error Loading Backfill Status</AlertTitle>
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (!status) {
    return null;
  }

  const statusType = backfillService.getStatusType(status);
  const progress = status.totalDays > 0 ? (status.processedDays / status.totalDays) * 100 : 0;
  const eta = status.isRunning && status.startedAt
    ? backfillService.calculateETA(status)
    : null;

  const elapsedTime = status.startedAt
    ? Date.now() - new Date(status.startedAt).getTime()
    : 0;

  // Database links
  const CLOUDFLARE_ACCOUNT_ID = '7dcac9cefd9619a741980cd17367ab6f';
  const D1_DATABASE_ID = '1afc0a07-85cd-4d5f-a046-b580ffffb8dc';
  const R2_BUCKET_NAME = 'ace-timeseries';

  const cloudflareD1Link = `https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/d1/databases/${D1_DATABASE_ID}/console`;
  const cloudflareR2Link = `https://dash.cloudflare.com/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}`;
  const appDashboardLink = '/dashboard'; // Main dashboard where data is visualized

  return (
    <>
      <Card>
        <CardHeader
          title="Backfill Monitor"
          subheader={`Last updated: ${new Date(status.lastUpdated).toLocaleString()}`}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Refresh">
                <IconButton onClick={handleRefresh} size="small">
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
              {!status.isRunning && !status.isPaused && (
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<PlayIcon />}
                  onClick={() => setStartDialogOpen(true)}
                  size="small"
                >
                  Start Backfill
                </Button>
              )}
            </Box>
          }
        />
        <CardContent>
          <Grid container spacing={3}>
            {/* Status Badge */}
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                <Chip
                  label={STATUS_LABELS[statusType]}
                  color={STATUS_COLORS[statusType]}
                  size="medium"
                />
                {status.isRunning && (
                  <Typography variant="body2" color="text.secondary">
                    Processing: {status.currentDate || 'N/A'}
                  </Typography>
                )}
              </Box>
            </Grid>

            {/* Database Links Section */}
            <Grid item xs={12}>
              <Box sx={{
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 1,
                border: 1,
                borderColor: 'divider',
                mb: 2
              }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                  📊 View Data & Database Links
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    startIcon={<DashboardIcon />}
                    endIcon={<OpenInNewIcon fontSize="small" />}
                    href={appDashboardLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                  >
                    View Data in Dashboard
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<StorageIcon />}
                    endIcon={<OpenInNewIcon fontSize="small" />}
                    href={cloudflareD1Link}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                  >
                    D1 Database Console
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<CloudIcon />}
                    endIcon={<OpenInNewIcon fontSize="small" />}
                    href={cloudflareR2Link}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                  >
                    R2 Storage Bucket
                  </Button>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  💡 Tip: Recent data (last 20 days) is in D1, older data is in R2 storage
                </Typography>
              </Box>
            </Grid>

            {/* Progress Bar */}
            {status.totalDays > 0 && (
              <Grid item xs={12}>
                <Box sx={{ mb: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Progress
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {status.processedDays} / {status.totalDays} days ({progress.toFixed(1)}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              </Grid>
            )}

            {/* Date Range */}
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Date Range
                </Typography>
                <Typography variant="body1">
                  {status.startDate} → {status.endDate}
                </Typography>
              </Box>
            </Grid>

            {/* Records Fetched */}
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Records Fetched
                </Typography>
                <Typography variant="body1">
                  {status.recordsFetched.toLocaleString()}
                </Typography>
              </Box>
            </Grid>

            {/* ETA */}
            {eta && (
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ScheduleIcon fontSize="small" color="action" />
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Estimated Completion
                    </Typography>
                    <Typography variant="body2">
                      {new Date(eta).toLocaleString()}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}

            {/* Elapsed Time */}
            {status.startedAt && (
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Elapsed Time
                  </Typography>
                  <Typography variant="body1">
                    {backfillService.formatDuration(elapsedTime)}
                  </Typography>
                </Box>
              </Grid>
            )}

            {/* Control Buttons */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {status.isRunning && (
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<PauseIcon />}
                    onClick={() => pauseMutation.mutate()}
                    disabled={pauseMutation.isPending}
                  >
                    Pause
                  </Button>
                )}
                {status.isPaused && (
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<PlayIcon />}
                    onClick={() => resumeMutation.mutate()}
                    disabled={resumeMutation.isPending}
                  >
                    Resume
                  </Button>
                )}
                {(status.isRunning || status.isPaused) && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<StopIcon />}
                    onClick={() => stopMutation.mutate()}
                    disabled={stopMutation.isPending}
                  >
                    Stop
                  </Button>
                )}
                {status.errors.length > 0 && (
                  <Button
                    variant="outlined"
                    color="warning"
                    startIcon={<RefreshIcon />}
                    onClick={() => retryMutation.mutate()}
                    disabled={retryMutation.isPending}
                  >
                    Retry Failed ({status.errors.length})
                  </Button>
                )}
                {!status.isRunning && !status.isPaused && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => resetMutation.mutate()}
                    disabled={resetMutation.isPending}
                  >
                    Reset
                  </Button>
                )}
              </Box>
            </Grid>

            {/* Errors Section */}
            {status.errors.length > 0 && (
              <Grid item xs={12}>
                <Box>
                  <Button
                    onClick={() => setShowErrors(!showErrors)}
                    endIcon={showErrors ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    startIcon={<ErrorIcon />}
                    color="error"
                    size="small"
                  >
                    Errors ({status.errors.length})
                  </Button>
                  <Collapse in={showErrors}>
                    <List dense>
                      {status.errors.map((err, idx) => (
                        <ListItem key={idx}>
                          <ListItemText
                            primary={`${err.date} - ${err.error}`}
                            secondary={`${new Date(err.timestamp).toLocaleString()} (Retry count: ${err.retryCount})`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Collapse>
                </Box>
              </Grid>
            )}

            {/* Completed Dates Section */}
            {status.completedDates.length > 0 && (
              <Grid item xs={12}>
                <Box>
                  <Button
                    onClick={() => setShowCompletedDates(!showCompletedDates)}
                    endIcon={showCompletedDates ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    startIcon={<CheckCircleIcon />}
                    color="success"
                    size="small"
                  >
                    Completed Dates ({status.completedDates.length})
                  </Button>
                  <Collapse in={showCompletedDates}>
                    <Box sx={{ maxHeight: 200, overflow: 'auto', mt: 1 }}>
                      <List dense>
                        {status.completedDates.map((date, idx) => (
                          <ListItem key={idx}>
                            <ListItemText primary={date} />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  </Collapse>
                </Box>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Start Backfill Dialog */}
      <Dialog open={startDialogOpen} onClose={() => setStartDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Start Backfill</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              label="Start Date"
              type="date"
              value={config.startDate}
              onChange={(e) => setConfig({ ...config, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="End Date"
              type="date"
              value={config.endDate}
              onChange={(e) => setConfig({ ...config, endDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Batch Size"
              type="number"
              value={config.batchSize}
              onChange={(e) => setConfig({ ...config, batchSize: parseInt(e.target.value) })}
              fullWidth
            />
            <TextField
              label="Delay (ms)"
              type="number"
              value={config.delayMs}
              onChange={(e) => setConfig({ ...config, delayMs: parseInt(e.target.value) })}
              fullWidth
            />
            <Alert severity="info">
              This will fetch historical data for the specified date range. The process may take several minutes to hours depending on the range.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStartDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleStartBackfill}
            variant="contained"
            disabled={startMutation.isPending}
          >
            {startMutation.isPending ? 'Starting...' : 'Start'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default BackfillMonitor;
