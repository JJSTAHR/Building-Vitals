/**
 * BoxPlotAggregationConfigurator Component
 *
 * Provides configuration interface for box plot aggregation settings including:
 * - Aggregation period selection (hourly, daily, weekly, monthly)
 * - Outlier display toggle
 * - Whisker calculation method (IQR, percentile, standard deviation)
 * - Visual preview and explanations
 *
 * @module components/charts/configurators/BoxPlotAggregationConfigurator
 */

import React, { useMemo } from 'react';
import {
  FormControl,
  FormControlLabel,
  FormLabel,
  Select,
  MenuItem,
  Checkbox,
  Radio,
  RadioGroup,
  TextField,
  Box,
  Paper,
  Typography,
  Alert,
  Divider,
  Stack,
  Chip,
  SelectChangeEvent
} from '@mui/material';
import { Info as InfoIcon } from '@mui/icons-material';

/**
 * Box plot configuration interface
 */
export interface BoxPlotConfig {
  /** Aggregation period for grouping data points */
  aggregationPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly';
  /** Whether to display outlier points beyond whiskers */
  showOutliers: boolean;
  /** Method for calculating whisker positions */
  whiskerMethod: 'iqr' | 'percentile' | 'stddev';
  /** Range parameter for whisker calculation (e.g., 1.5 for IQR, 95 for percentile) */
  whiskerRange: number;
}

/**
 * Props for configurator steps
 */
export interface ConfigStepProps {
  /** Current configuration state */
  config: Partial<BoxPlotConfig>;
  /** Callback when configuration changes */
  onChange: (config: Partial<BoxPlotConfig>) => void;
  /** Optional time range for context */
  timeRange?: {
    start: Date;
    end: Date;
  };
}

/**
 * Default whisker ranges for each method
 */
const DEFAULT_WHISKER_RANGES = {
  iqr: 1.5,
  percentile: 95,
  stddev: 2
};

/**
 * Box plot aggregation configurator component
 */
export const BoxPlotAggregationConfigurator: React.FC<ConfigStepProps> = ({
  config,
  onChange,
  timeRange
}) => {
  // Initialize with defaults if not provided
  const currentConfig: BoxPlotConfig = useMemo(() => ({
    aggregationPeriod: config.aggregationPeriod || 'daily',
    showOutliers: config.showOutliers ?? true,
    whiskerMethod: config.whiskerMethod || 'iqr',
    whiskerRange: config.whiskerRange || DEFAULT_WHISKER_RANGES[config.whiskerMethod || 'iqr']
  }), [config]);

  /**
   * Handle aggregation period change
   */
  const handlePeriodChange = (event: SelectChangeEvent<string>) => {
    const period = event.target.value as BoxPlotConfig['aggregationPeriod'];
    onChange({
      ...currentConfig,
      aggregationPeriod: period
    });
  };

  /**
   * Handle outliers toggle
   */
  const handleOutliersChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...currentConfig,
      showOutliers: event.target.checked
    });
  };

  /**
   * Handle whisker method change
   */
  const handleWhiskerMethodChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const method = event.target.value as BoxPlotConfig['whiskerMethod'];
    onChange({
      ...currentConfig,
      whiskerMethod: method,
      whiskerRange: DEFAULT_WHISKER_RANGES[method]
    });
  };

  /**
   * Handle whisker range change
   */
  const handleWhiskerRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    if (!isNaN(value) && value > 0) {
      onChange({
        ...currentConfig,
        whiskerRange: value
      });
    }
  };

  /**
   * Calculate estimated data points per box
   */
  const estimatedDataPoints = useMemo(() => {
    if (!timeRange) return null;

    const msPerHour = 60 * 60 * 1000;
    const msPerDay = 24 * msPerHour;
    const totalMs = timeRange.end.getTime() - timeRange.start.getTime();

    const estimates = {
      hourly: Math.ceil(totalMs / msPerHour),
      daily: Math.ceil(totalMs / msPerDay),
      weekly: Math.ceil(totalMs / (7 * msPerDay)),
      monthly: Math.ceil(totalMs / (30 * msPerDay))
    };

    return estimates[currentConfig.aggregationPeriod];
  }, [timeRange, currentConfig.aggregationPeriod]);

  /**
   * Get whisker method explanation
   */
  const getWhiskerMethodExplanation = (method: BoxPlotConfig['whiskerMethod']) => {
    const explanations = {
      iqr: {
        title: 'Interquartile Range (IQR)',
        description: 'Whiskers extend to 1.5 × IQR from Q1 and Q3. Most commonly used method, robust to extreme values.',
        formula: 'Lower: Q1 - 1.5 × IQR | Upper: Q3 + 1.5 × IQR',
        useCase: 'Best for general-purpose analysis and identifying statistical outliers'
      },
      percentile: {
        title: 'Percentile Range',
        description: 'Whiskers extend to specified percentile values (e.g., 5th and 95th percentiles).',
        formula: 'Lower: Pₙ | Upper: P₁₀₀₋ₙ (where n is percentile)',
        useCase: 'Best when you want to show a specific percentage of data distribution'
      },
      stddev: {
        title: 'Standard Deviation',
        description: 'Whiskers extend to a multiple of standard deviations from the mean.',
        formula: 'Lower: μ - nσ | Upper: μ + nσ (where n is multiplier)',
        useCase: 'Best for normally distributed data and comparing variability'
      }
    };

    return explanations[method];
  };

  const currentExplanation = getWhiskerMethodExplanation(currentConfig.whiskerMethod);

  /**
   * Generate sample data for preview
   */
  const samplePreviewData = useMemo(() => {
    // Generate sample quartile values for visualization
    const baseValues = {
      min: 20,
      q1: 35,
      median: 50,
      q3: 65,
      max: 80,
      outliers: currentConfig.showOutliers ? [5, 10, 90, 95] : []
    };

    // Adjust based on whisker method
    switch (currentConfig.whiskerMethod) {
      case 'percentile':
        return {
          ...baseValues,
          min: 25,
          max: 75,
          label: `${100 - currentConfig.whiskerRange}th - ${currentConfig.whiskerRange}th percentile`
        };
      case 'stddev':
        return {
          ...baseValues,
          min: 50 - (currentConfig.whiskerRange * 15),
          max: 50 + (currentConfig.whiskerRange * 15),
          label: `Mean ± ${currentConfig.whiskerRange}σ`
        };
      default: // iqr
        return {
          ...baseValues,
          label: `Q1 - ${currentConfig.whiskerRange} × IQR to Q3 + ${currentConfig.whiskerRange} × IQR`
        };
    }
  }, [currentConfig.whiskerMethod, currentConfig.whiskerRange, currentConfig.showOutliers]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Aggregation Period Section */}
      <Paper sx={{ p: 3 }}>
        <FormControl fullWidth>
          <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
            Aggregation Period
          </FormLabel>
          <Select
            value={currentConfig.aggregationPeriod}
            onChange={handlePeriodChange}
            displayEmpty
            fullWidth
          >
            <MenuItem value="hourly">
              <Box>
                <Typography variant="body1">Hourly</Typography>
                <Typography variant="caption" color="text.secondary">
                  Group data points by hour
                </Typography>
              </Box>
            </MenuItem>
            <MenuItem value="daily">
              <Box>
                <Typography variant="body1">Daily</Typography>
                <Typography variant="caption" color="text.secondary">
                  Group data points by day (recommended)
                </Typography>
              </Box>
            </MenuItem>
            <MenuItem value="weekly">
              <Box>
                <Typography variant="body1">Weekly</Typography>
                <Typography variant="caption" color="text.secondary">
                  Group data points by week
                </Typography>
              </Box>
            </MenuItem>
            <MenuItem value="monthly">
              <Box>
                <Typography variant="body1">Monthly</Typography>
                <Typography variant="caption" color="text.secondary">
                  Group data points by month
                </Typography>
              </Box>
            </MenuItem>
          </Select>

          {estimatedDataPoints && (
            <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
              Each box will represent approximately <strong>{estimatedDataPoints}</strong> data points
              based on your selected time range.
            </Alert>
          )}
        </FormControl>
      </Paper>

      {/* Statistical Method Section */}
      <Paper sx={{ p: 3 }}>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
            Whisker Calculation Method
          </FormLabel>

          <RadioGroup
            value={currentConfig.whiskerMethod}
            onChange={handleWhiskerMethodChange}
          >
            <FormControlLabel
              value="iqr"
              control={<Radio />}
              label={
                <Box sx={{ ml: 1 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body1">Interquartile Range (IQR)</Typography>
                    <Chip label="Recommended" size="small" color="primary" />
                  </Stack>
                  <Typography variant="caption" color="text.secondary">
                    Standard statistical method, robust to outliers
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              value="percentile"
              control={<Radio />}
              label={
                <Box sx={{ ml: 1 }}>
                  <Typography variant="body1">Percentile Range</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Show specific percentage of data distribution
                  </Typography>
                </Box>
              }
            />

            <FormControlLabel
              value="stddev"
              control={<Radio />}
              label={
                <Box sx={{ ml: 1 }}>
                  <Typography variant="body1">Standard Deviation</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Best for normally distributed data
                  </Typography>
                </Box>
              }
            />
          </RadioGroup>

          {/* Whisker Range Input */}
          <Box sx={{ mt: 2, ml: 4 }}>
            <TextField
              label={
                currentConfig.whiskerMethod === 'iqr' ? 'IQR Multiplier' :
                currentConfig.whiskerMethod === 'percentile' ? 'Percentile Value' :
                'Standard Deviation Multiplier'
              }
              type="number"
              value={currentConfig.whiskerRange}
              onChange={handleWhiskerRangeChange}
              size="small"
              sx={{ width: 200 }}
              inputProps={{
                min: currentConfig.whiskerMethod === 'percentile' ? 0 : 0.1,
                max: currentConfig.whiskerMethod === 'percentile' ? 100 : 10,
                step: currentConfig.whiskerMethod === 'percentile' ? 1 : 0.1
              }}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Method Explanation */}
          <Alert severity="info" icon={<InfoIcon />}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
              {currentExplanation.title}
            </Typography>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {currentExplanation.description}
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', display: 'block', mb: 1 }}>
              {currentExplanation.formula}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              <strong>Use case:</strong> {currentExplanation.useCase}
            </Typography>
          </Alert>
        </FormControl>
      </Paper>

      {/* Outliers Section */}
      <Paper sx={{ p: 3 }}>
        <FormControl component="fieldset" fullWidth>
          <FormLabel component="legend" sx={{ mb: 2, fontWeight: 600 }}>
            Outlier Display
          </FormLabel>

          <FormControlLabel
            control={
              <Checkbox
                checked={currentConfig.showOutliers}
                onChange={handleOutliersChange}
              />
            }
            label={
              <Box sx={{ ml: 1 }}>
                <Typography variant="body1">Show outlier points</Typography>
                <Typography variant="caption" color="text.secondary">
                  Display individual data points beyond whisker range
                </Typography>
              </Box>
            }
          />

          <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
            Outliers are data points that fall outside the whisker range.
            Showing them helps identify anomalies and extreme values in your metrics.
          </Alert>
        </FormControl>
      </Paper>

      {/* Preview Section */}
      <Paper sx={{ p: 3, bgcolor: 'grey.50' }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          Preview
        </Typography>

        <Box sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
          position: 'relative',
          border: '2px dashed',
          borderColor: 'divider',
          borderRadius: 1,
          p: 3
        }}>
          {/* Visual box plot representation */}
          <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            width: '100%',
            maxWidth: 400
          }}>
            {/* Outliers above */}
            {currentConfig.showOutliers && samplePreviewData.outliers
              .filter(v => v > samplePreviewData.max)
              .map((value, idx) => (
                <Box
                  key={`outlier-high-${idx}`}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    mb: 1,
                    position: 'relative'
                  }}
                />
              ))
            }

            {/* Upper whisker */}
            <Box sx={{
              width: 2,
              height: 30,
              bgcolor: 'text.secondary',
              mb: 0.5
            }} />

            {/* Box (Q1 to Q3) */}
            <Box sx={{
              width: 120,
              height: 80,
              border: 2,
              borderColor: 'primary.main',
              bgcolor: 'primary.light',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-around',
              position: 'relative'
            }}>
              {/* Q3 label */}
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  right: -50,
                  top: -5,
                  color: 'text.secondary'
                }}
              >
                Q3
              </Typography>

              {/* Median line */}
              <Box sx={{
                width: '100%',
                height: 3,
                bgcolor: 'primary.dark',
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)'
              }} />

              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  right: -60,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'text.secondary'
                }}
              >
                Median
              </Typography>

              {/* Q1 label */}
              <Typography
                variant="caption"
                sx={{
                  position: 'absolute',
                  right: -50,
                  bottom: -5,
                  color: 'text.secondary'
                }}
              >
                Q1
              </Typography>
            </Box>

            {/* Lower whisker */}
            <Box sx={{
              width: 2,
              height: 30,
              bgcolor: 'text.secondary',
              mt: 0.5
            }} />

            {/* Outliers below */}
            {currentConfig.showOutliers && samplePreviewData.outliers
              .filter(v => v < samplePreviewData.min)
              .map((value, idx) => (
                <Box
                  key={`outlier-low-${idx}`}
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'error.main',
                    mt: 1
                  }}
                />
              ))
            }

            {/* Whisker range label */}
            <Typography
              variant="caption"
              sx={{
                mt: 2,
                color: 'text.secondary',
                textAlign: 'center',
                maxWidth: 300
              }}
            >
              {samplePreviewData.label}
            </Typography>
          </Box>
        </Box>

        {/* Preview Legend */}
        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: 'primary.light', border: 2, borderColor: 'primary.main' }} />
            <Typography variant="caption">Interquartile Range (Q1-Q3)</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 3, bgcolor: 'primary.dark' }} />
            <Typography variant="caption">Median</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 2, height: 16, bgcolor: 'text.secondary' }} />
            <Typography variant="caption">Whiskers</Typography>
          </Stack>
          {currentConfig.showOutliers && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />
              <Typography variant="caption">Outliers</Typography>
            </Stack>
          )}
        </Box>
      </Paper>

      {/* Summary */}
      <Alert severity="success">
        <Typography variant="body2">
          <strong>Configuration Summary:</strong> Data will be aggregated by{' '}
          <strong>{currentConfig.aggregationPeriod}</strong> periods using{' '}
          <strong>{currentExplanation.title}</strong> method
          {currentConfig.showOutliers ? ', with outliers displayed' : ', outliers hidden'}.
        </Typography>
      </Alert>
    </Box>
  );
};

export default BoxPlotAggregationConfigurator;
