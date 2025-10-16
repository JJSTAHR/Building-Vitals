/**
 * useChartError Hook (Quick Win #2 Mock Implementation)
 *
 * Provides centralized error handling for chart components with retry capability.
 * This is a mock implementation for integration testing purposes.
 *
 * @module hooks/charts/useChartError
 */

import { useState, useCallback } from 'react';

export interface ChartError {
  message: string;
  type: 'validation' | 'network' | 'render' | 'unknown';
  timestamp: number;
  chartId?: string;
}

export interface UseChartErrorReturn {
  error: ChartError | null;
  setError: (error: ChartError | null) => void;
  clearError: () => void;
  retry: () => void;
  retryCount: number;
}

export interface UseChartErrorOptions {
  maxRetries?: number;
  onRetry?: () => void;
  logErrors?: boolean;
}

/**
 * Custom hook for managing chart error states
 */
export function useChartError(options: UseChartErrorOptions = {}): UseChartErrorReturn {
  const {
    maxRetries = 3,
    onRetry,
    logErrors = true
  } = options;

  const [error, setErrorState] = useState<ChartError | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const setError = useCallback((newError: ChartError | null) => {
    if (logErrors && newError) {
      console.error('[ChartError]', newError.message, newError);
    }
    setErrorState(newError);
  }, [logErrors]);

  const clearError = useCallback(() => {
    setErrorState(null);
    setRetryCount(0);
  }, []);

  const retry = useCallback(() => {
    if (retryCount < maxRetries) {
      setRetryCount(prev => prev + 1);
      setErrorState(null);
      onRetry?.();
    }
  }, [retryCount, maxRetries, onRetry]);

  return {
    error,
    setError,
    clearError,
    retry,
    retryCount
  };
}

/**
 * Helper functions to create typed errors
 */
export const createChartError = {
  validation: (message: string, chartId?: string): ChartError => ({
    message,
    type: 'validation',
    timestamp: Date.now(),
    chartId
  }),

  network: (message: string, chartId?: string): ChartError => ({
    message,
    type: 'network',
    timestamp: Date.now(),
    chartId
  }),

  render: (message: string, chartId?: string): ChartError => ({
    message,
    type: 'render',
    timestamp: Date.now(),
    chartId
  }),

  unknown: (message: string, chartId?: string): ChartError => ({
    message,
    type: 'unknown',
    timestamp: Date.now(),
    chartId
  })
};
