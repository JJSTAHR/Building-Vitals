/**
 * ChartLoadingState Component (Quick Win #4 Mock Implementation)
 *
 * Displays loading states for charts.
 * This is a mock implementation for integration testing purposes.
 *
 * @module components/charts/ChartLoadingState
 */

import React from 'react';

export interface ChartLoadingStateProps {
  loading: boolean;
  hasData: boolean;
  height?: number | string;
  message?: string;
}

export const ChartLoadingState: React.FC<ChartLoadingStateProps> = ({
  loading,
  hasData,
  height = 400,
  message = 'Loading chart data...'
}) => {
  if (!loading || hasData) return null;

  const containerStyle: React.CSSProperties = {
    height: typeof height === 'number' ? `${height}px` : height,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '24px',
    backgroundColor: '#f5f5f5',
    border: '1px solid #e0e0e0',
    borderRadius: '4px'
  };

  return (
    <div style={containerStyle} role="status" aria-live="polite">
      <div style={{
        width: '40px',
        height: '40px',
        border: '4px solid #e0e0e0',
        borderTop: '4px solid #2196f3',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div style={{
        fontSize: '14px',
        color: '#666',
        textAlign: 'center'
      }}>
        {message}
      </div>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
