/**
 * ChartErrorDisplay Component (Quick Win #2 Mock Implementation)
 *
 * Displays chart errors with retry capability.
 * This is a mock implementation for integration testing purposes.
 *
 * @module components/charts/ChartErrorDisplay
 */

import React from 'react';
import type { ChartError } from '../../hooks/charts/useChartError';

export interface ChartErrorDisplayProps {
  error: ChartError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  height?: number | string;
}

export const ChartErrorDisplay: React.FC<ChartErrorDisplayProps> = ({
  error,
  onRetry,
  onDismiss,
  height = 400
}) => {
  if (!error) return null;

  const containerStyle: React.CSSProperties = {
    height: typeof height === 'number' ? `${height}px` : height,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '24px',
    backgroundColor: '#fff3f3',
    border: '1px solid #f44336',
    borderRadius: '4px'
  };

  const errorType = error.type || 'unknown';
  const errorIcon = {
    validation: '⚠️',
    network: '🌐',
    render: '🖼️',
    unknown: '❌'
  }[errorType];

  return (
    <div style={containerStyle} role="alert" aria-live="assertive">
      <div style={{ fontSize: '48px' }}>{errorIcon}</div>
      <div style={{
        fontSize: '16px',
        fontWeight: 'bold',
        color: '#d32f2f',
        textAlign: 'center'
      }}>
        {error.type.toUpperCase()} ERROR
      </div>
      <div style={{
        fontSize: '14px',
        color: '#666',
        textAlign: 'center',
        maxWidth: '400px'
      }}>
        {error.message}
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '8px 16px',
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              padding: '8px 16px',
              backgroundColor: '#9e9e9e',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
};
