/**
 * BoxPlot Configurator Integration Example
 *
 * Demonstrates complete integration of BoxPlotAggregationConfigurator
 * within a multi-step chart configuration wizard.
 *
 * This example shows:
 * - Step-by-step wizard flow
 * - State management across steps
 * - Real-time chart preview
 * - Configuration persistence
 * - Error handling and validation
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Step,
  StepLabel,
  Stepper,
  Typography,
  Paper,
  Alert,
  Grid,
  Card,
  CardContent,
  Divider,
  CircularProgress
} from '@mui/material';
import {
  BoxPlotAggregationConfigurator,
  BoxPlotConfig
} from '../src/components/charts/configurators';

/**
 * Mock chart component for demonstration
 */
const BoxPlotChart: React.FC<{ config: BoxPlotConfig; data: any[] }> = ({ config, data }) => (
  <Box
    sx={{
      height: 400,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      border: '2px dashed',
      borderColor: 'divider',
      borderRadius: 1,
      bgcolor: 'grey.50'
    }}
  >
    <Typography variant="h6" color="text.secondary">
      Box Plot Preview
      <br />
      <Typography variant="caption">
        {config.aggregationPeriod} | {config.whiskerMethod} |
        {config.showOutliers ? 'with outliers' : 'no outliers'}
      </Typography>
    </Typography>
  </Box>
);

/**
 * Step 1: Metric Selection
 */
const MetricSelectionStep: React.FC<{
  selectedMetrics: string[];
  onChange: (metrics: string[]) => void;
}> = ({ selectedMetrics, onChange }) => {
  const availableMetrics = [
    { id: 'lcp', name: 'Largest Contentful Paint (LCP)', category: 'Core Web Vital' },
    { id: 'fid', name: 'First Input Delay (FID)', category: 'Core Web Vital' },
    { id: 'cls', name: 'Cumulative Layout Shift (CLS)', category: 'Core Web Vital' },
    { id: 'fcp', name: 'First Contentful Paint (FCP)', category: 'Performance' },
    { id: 'ttfb', name: 'Time to First Byte (TTFB)', category: 'Performance' }
  ];

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Select Metrics to Analyze
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Choose which metrics you want to visualize in the box plot
      </Typography>

      <Grid container spacing={2}>
        {availableMetrics.map((metric) => (
          <Grid item xs={12} sm={6} key={metric.id}>
            <Card
              sx={{
                cursor: 'pointer',
                border: 2,
                borderColor: selectedMetrics.includes(metric.id) ? 'primary.main' : 'transparent',
                bgcolor: selectedMetrics.includes(metric.id) ? 'primary.light' : 'background.paper'
              }}
              onClick={() => {
                const newMetrics = selectedMetrics.includes(metric.id)
                  ? selectedMetrics.filter(m => m !== metric.id)
                  : [...selectedMetrics, metric.id];
                onChange(newMetrics);
              }}
            >
              <CardContent>
                <Typography variant="subtitle1" fontWeight="bold">
                  {metric.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {metric.category}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {selectedMetrics.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Select at least one metric to continue
        </Alert>
      )}
    </Box>
  );
};

/**
 * Step 2: Box Plot Configuration (using our configurator)
 */
const ConfigurationStep: React.FC<{
  config: Partial<BoxPlotConfig>;
  onChange: (config: Partial<BoxPlotConfig>) => void;
  timeRange: { start: Date; end: Date };
}> = ({ config, onChange, timeRange }) => {
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Configure Box Plot Settings
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Customize the statistical analysis and visualization settings
      </Typography>

      <BoxPlotAggregationConfigurator
        config={config}
        onChange={onChange}
        timeRange={timeRange}
      />
    </Box>
  );
};

/**
 * Step 3: Preview and Save
 */
const PreviewStep: React.FC<{
  config: BoxPlotConfig;
  metrics: string[];
  onSave: () => void;
  loading: boolean;
}> = ({ config, metrics, onSave, loading }) => {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    // Simulate data fetching
    const fetchData = async () => {
      // In real app, fetch based on config and metrics
      await new Promise(resolve => setTimeout(resolve, 1000));
      setChartData([{ mock: 'data' }]);
    };

    fetchData();
  }, [config, metrics]);

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Preview Your Chart
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Review the configuration and preview the chart before saving
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <BoxPlotChart config={config as BoxPlotConfig} data={chartData} />
          )}
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              Configuration Summary
            </Typography>
            <Divider sx={{ my: 1 }} />

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Metrics
              </Typography>
              <Typography variant="body2">
                {metrics.join(', ')}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Aggregation Period
              </Typography>
              <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                {config.aggregationPeriod}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Whisker Method
              </Typography>
              <Typography variant="body2" sx={{ textTransform: 'uppercase' }}>
                {config.whiskerMethod} ({config.whiskerRange})
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Outliers
              </Typography>
              <Typography variant="body2">
                {config.showOutliers ? 'Visible' : 'Hidden'}
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={onSave}
              disabled={loading}
            >
              Save Configuration
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

/**
 * Main Wizard Component
 */
export const BoxPlotConfigurationWizard: React.FC = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
  const [boxPlotConfig, setBoxPlotConfig] = useState<Partial<BoxPlotConfig>>({
    aggregationPeriod: 'daily',
    showOutliers: true,
    whiskerMethod: 'iqr',
    whiskerRange: 1.5
  });
  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const timeRange = {
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31')
  };

  const steps = [
    'Select Metrics',
    'Configure Box Plot',
    'Preview & Save'
  ];

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setSelectedMetrics([]);
    setBoxPlotConfig({
      aggregationPeriod: 'daily',
      showOutliers: true,
      whiskerMethod: 'iqr',
      whiskerRange: 1.5
    });
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Save configuration
    console.log('Saving configuration:', {
      metrics: selectedMetrics,
      config: boxPlotConfig
    });

    // In real app, persist to backend:
    // await api.saveChartConfiguration({ metrics: selectedMetrics, config: boxPlotConfig });

    setLoading(false);
    setSaveSuccess(true);
    handleNext();
  };

  const isStepValid = (step: number): boolean => {
    switch (step) {
      case 0:
        return selectedMetrics.length > 0;
      case 1:
        return !!(
          boxPlotConfig.aggregationPeriod &&
          boxPlotConfig.whiskerMethod &&
          boxPlotConfig.whiskerRange
        );
      case 2:
        return true;
      default:
        return false;
    }
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <MetricSelectionStep
            selectedMetrics={selectedMetrics}
            onChange={setSelectedMetrics}
          />
        );
      case 1:
        return (
          <ConfigurationStep
            config={boxPlotConfig}
            onChange={setBoxPlotConfig}
            timeRange={timeRange}
          />
        );
      case 2:
        return (
          <PreviewStep
            config={boxPlotConfig as BoxPlotConfig}
            metrics={selectedMetrics}
            onSave={handleSave}
            loading={loading}
          />
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, margin: '0 auto', p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Create Box Plot Chart
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Follow the steps below to configure your box plot visualization
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {steps.map((label, index) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {activeStep === steps.length ? (
        // Completion screen
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          {saveSuccess ? (
            <>
              <Typography variant="h5" gutterBottom color="success.main">
                ✓ Configuration Saved Successfully!
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                Your box plot chart has been created and saved.
              </Typography>
              <Button onClick={handleReset} variant="outlined">
                Create Another Chart
              </Button>
            </>
          ) : (
            <>
              <Typography variant="h5" gutterBottom>
                All Steps Completed
              </Typography>
              <Button onClick={handleReset}>Reset</Button>
            </>
          )}
        </Paper>
      ) : (
        <>
          <Paper sx={{ p: 3, mb: 3 }}>
            {getStepContent(activeStep)}
          </Paper>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Back
            </Button>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={handleReset}>
                Reset
              </Button>

              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  onClick={handleSave}
                  disabled={loading || !isStepValid(activeStep)}
                >
                  {loading ? 'Saving...' : 'Save Configuration'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  disabled={!isStepValid(activeStep)}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </>
      )}

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <Paper sx={{ p: 2, mt: 3, bgcolor: 'grey.100' }}>
          <Typography variant="caption" fontWeight="bold">
            Debug Information
          </Typography>
          <pre style={{ fontSize: 10, overflow: 'auto' }}>
            {JSON.stringify({ selectedMetrics, boxPlotConfig, activeStep }, null, 2)}
          </pre>
        </Paper>
      )}
    </Box>
  );
};

export default BoxPlotConfigurationWizard;
