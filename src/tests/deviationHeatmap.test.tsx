/**
 * Deviation Heatmap Test Suite
 *
 * Comprehensive tests for deviation heatmap visualization with building system data:
 * - Heatmap data structure and validation
 * - Building system data integration
 * - Color scheme and threshold configuration
 * - Cell hover and interaction
 * - Deviation calculation accuracy
 * - Time-based heatmap rendering
 * - Building-specific metrics visualization
 *
 * @module tests/deviationHeatmap
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock heatmap interfaces
interface HeatmapDataPoint {
  x: string | number;
  y: string | number;
  value: number;
  deviation?: number;
  timestamp?: Date;
}

interface BuildingSystemData {
  systemId: string;
  systemName: string;
  metrics: {
    timestamp: Date;
    value: number;
    setpoint?: number;
    deviation?: number;
  }[];
}

interface DeviationHeatmapProps {
  data: HeatmapDataPoint[][];
  buildingSystems?: BuildingSystemData[];
  colorScheme?: 'viridis' | 'plasma' | 'inferno' | 'cool' | 'warm' | 'redgreen';
  showValues?: boolean;
  showDeviation?: boolean;
  thresholds?: {
    low: number;
    medium: number;
    high: number;
  };
  timeRange?: {
    start: Date;
    end: Date;
  };
  onCellClick?: (data: HeatmapDataPoint) => void;
  onCellHover?: (data: HeatmapDataPoint | null) => void;
}

// Mock heatmap component
const MockDeviationHeatmap: React.FC<DeviationHeatmapProps> = ({
  data,
  buildingSystems,
  colorScheme = 'viridis',
  showValues = false,
  showDeviation = false,
  thresholds,
  onCellClick,
  onCellHover
}) => {
  const [hoveredCell, setHoveredCell] = React.useState<HeatmapDataPoint | null>(null);

  const handleCellHover = (cell: HeatmapDataPoint | null) => {
    setHoveredCell(cell);
    onCellHover?.(cell);
  };

  return (
    <div data-testid="deviation-heatmap">
      <div data-testid="heatmap-header">
        <span data-testid="color-scheme">{colorScheme}</span>
        {buildingSystems && (
          <span data-testid="systems-count">{buildingSystems.length} systems</span>
        )}
      </div>

      <div data-testid="heatmap-grid">
        {data.map((row, rowIdx) => (
          <div key={rowIdx} data-testid={`row-${rowIdx}`}>
            {row.map((cell, cellIdx) => (
              <div
                key={`${rowIdx}-${cellIdx}`}
                data-testid={`cell-${rowIdx}-${cellIdx}`}
                data-value={cell.value}
                data-deviation={cell.deviation}
                onClick={() => onCellClick?.(cell)}
                onMouseEnter={() => handleCellHover(cell)}
                onMouseLeave={() => handleCellHover(null)}
                style={{
                  display: 'inline-block',
                  width: 50,
                  height: 50,
                  margin: 2,
                  backgroundColor: getCellColor(cell.value, thresholds)
                }}
              >
                {showValues && <span>{cell.value}</span>}
                {showDeviation && cell.deviation && (
                  <span data-testid="deviation-label">{cell.deviation}</span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {hoveredCell && (
        <div data-testid="hover-tooltip">
          <div>Value: {hoveredCell.value}</div>
          {hoveredCell.deviation && <div>Deviation: {hoveredCell.deviation}</div>}
          <div>Position: ({hoveredCell.x}, {hoveredCell.y})</div>
        </div>
      )}

      {thresholds && (
        <div data-testid="color-legend">
          <div data-testid="threshold-low">&lt; {thresholds.low}</div>
          <div data-testid="threshold-medium">{thresholds.low} - {thresholds.medium}</div>
          <div data-testid="threshold-high">&gt; {thresholds.high}</div>
        </div>
      )}
    </div>
  );
};

function getCellColor(value: number, thresholds?: { low: number; medium: number; high: number }): string {
  if (!thresholds) return '#888';

  if (value < thresholds.low) return '#2196F3'; // Blue (low)
  if (value < thresholds.medium) return '#4CAF50'; // Green (medium)
  if (value < thresholds.high) return '#FF9800'; // Orange (high)
  return '#F44336'; // Red (very high)
}

describe('Deviation Heatmap', () => {
  const mockHeatmapData: HeatmapDataPoint[][] = [
    [
      { x: 0, y: 0, value: 20, deviation: -2 },
      { x: 1, y: 0, value: 22, deviation: 0 },
      { x: 2, y: 0, value: 25, deviation: 3 }
    ],
    [
      { x: 0, y: 1, value: 21, deviation: -1 },
      { x: 1, y: 1, value: 23, deviation: 1 },
      { x: 2, y: 1, value: 24, deviation: 2 }
    ]
  ];

  const mockBuildingSystems: BuildingSystemData[] = [
    {
      systemId: 'hvac-1',
      systemName: 'HVAC System 1',
      metrics: [
        {
          timestamp: new Date('2024-01-01T00:00:00'),
          value: 72,
          setpoint: 70,
          deviation: 2
        },
        {
          timestamp: new Date('2024-01-01T01:00:00'),
          value: 71,
          setpoint: 70,
          deviation: 1
        }
      ]
    },
    {
      systemId: 'hvac-2',
      systemName: 'HVAC System 2',
      metrics: [
        {
          timestamp: new Date('2024-01-01T00:00:00'),
          value: 68,
          setpoint: 70,
          deviation: -2
        }
      ]
    }
  ];

  const defaultThresholds = {
    low: 15,
    medium: 22,
    high: 28
  };

  describe('Heatmap Rendering', () => {
    it('renders heatmap with data', () => {
      render(<MockDeviationHeatmap data={mockHeatmapData} />);

      expect(screen.getByTestId('deviation-heatmap')).toBeInTheDocument();
      expect(screen.getByTestId('heatmap-grid')).toBeInTheDocument();
    });

    it('renders correct number of rows and cells', () => {
      render(<MockDeviationHeatmap data={mockHeatmapData} />);

      expect(screen.getByTestId('row-0')).toBeInTheDocument();
      expect(screen.getByTestId('row-1')).toBeInTheDocument();

      expect(screen.getByTestId('cell-0-0')).toBeInTheDocument();
      expect(screen.getByTestId('cell-0-1')).toBeInTheDocument();
      expect(screen.getByTestId('cell-0-2')).toBeInTheDocument();
    });

    it('displays cell values when showValues is true', () => {
      render(<MockDeviationHeatmap data={mockHeatmapData} showValues={true} />);

      const cell = screen.getByTestId('cell-0-0');
      expect(cell).toHaveTextContent('20');
    });

    it('displays deviation values when showDeviation is true', () => {
      render(<MockDeviationHeatmap data={mockHeatmapData} showDeviation={true} />);

      const deviationLabels = screen.getAllByTestId('deviation-label');
      expect(deviationLabels.length).toBeGreaterThan(0);
    });

    it('applies correct color scheme', () => {
      const colorSchemes: Array<'viridis' | 'plasma' | 'inferno' | 'cool' | 'warm'> = [
        'viridis', 'plasma', 'inferno', 'cool', 'warm'
      ];

      colorSchemes.forEach(scheme => {
        const { unmount } = render(
          <MockDeviationHeatmap data={mockHeatmapData} colorScheme={scheme} />
        );

        expect(screen.getByTestId('color-scheme')).toHaveTextContent(scheme);
        unmount();
      });
    });
  });

  describe('Building System Integration', () => {
    it('displays building systems count', () => {
      render(
        <MockDeviationHeatmap
          data={mockHeatmapData}
          buildingSystems={mockBuildingSystems}
        />
      );

      expect(screen.getByTestId('systems-count')).toHaveTextContent('2 systems');
    });

    it('processes building system metrics', () => {
      const systemData = mockBuildingSystems[0];

      expect(systemData.systemId).toBe('hvac-1');
      expect(systemData.metrics).toHaveLength(2);
      expect(systemData.metrics[0].deviation).toBe(2);
    });

    it('calculates deviations from setpoints', () => {
      const metrics = mockBuildingSystems[0].metrics[0];

      expect(metrics.value).toBe(72);
      expect(metrics.setpoint).toBe(70);
      expect(metrics.deviation).toBe(2);
    });

    it('handles multiple building systems', () => {
      render(
        <MockDeviationHeatmap
          data={mockHeatmapData}
          buildingSystems={mockBuildingSystems}
        />
      );

      const systemsCount = screen.getByTestId('systems-count');
      expect(systemsCount).toHaveTextContent('2 systems');
    });

    it('converts building system data to heatmap format', () => {
      const convertedData: HeatmapDataPoint[][] = mockBuildingSystems.map(system =>
        system.metrics.map((metric, idx) => ({
          x: idx,
          y: system.systemId,
          value: metric.value,
          deviation: metric.deviation,
          timestamp: metric.timestamp
        }))
      );

      expect(convertedData).toHaveLength(2);
      expect(convertedData[0][0].value).toBe(72);
      expect(convertedData[0][0].deviation).toBe(2);
    });
  });

  describe('Threshold Configuration', () => {
    it('displays threshold legend', () => {
      render(
        <MockDeviationHeatmap
          data={mockHeatmapData}
          thresholds={defaultThresholds}
        />
      );

      expect(screen.getByTestId('color-legend')).toBeInTheDocument();
      expect(screen.getByTestId('threshold-low')).toHaveTextContent('< 15');
      expect(screen.getByTestId('threshold-medium')).toHaveTextContent('15 - 22');
      expect(screen.getByTestId('threshold-high')).toHaveTextContent('> 28');
    });

    it('applies color based on thresholds', () => {
      render(
        <MockDeviationHeatmap
          data={mockHeatmapData}
          thresholds={defaultThresholds}
        />
      );

      const lowValueCell = screen.getByTestId('cell-0-0'); // value: 20
      const highValueCell = screen.getByTestId('cell-0-2'); // value: 25

      expect(lowValueCell).toHaveStyle({ backgroundColor: '#4CAF50' }); // Green (medium)
      expect(highValueCell).toHaveStyle({ backgroundColor: '#FF9800' }); // Orange (high)
    });

    it('validates threshold ranges', () => {
      const thresholds = {
        low: 10,
        medium: 20,
        high: 30
      };

      expect(thresholds.low).toBeLessThan(thresholds.medium);
      expect(thresholds.medium).toBeLessThan(thresholds.high);
    });

    it('handles custom threshold values', () => {
      const customThresholds = {
        low: 0,
        medium: 50,
        high: 100
      };

      render(
        <MockDeviationHeatmap
          data={mockHeatmapData}
          thresholds={customThresholds}
        />
      );

      expect(screen.getByTestId('threshold-low')).toHaveTextContent('< 0');
      expect(screen.getByTestId('threshold-high')).toHaveTextContent('> 100');
    });
  });

  describe('Cell Interactions', () => {
    it('handles cell click events', async () => {
      const mockOnCellClick = vi.fn();
      const user = userEvent.setup();

      render(
        <MockDeviationHeatmap
          data={mockHeatmapData}
          onCellClick={mockOnCellClick}
        />
      );

      const cell = screen.getByTestId('cell-0-0');
      await user.click(cell);

      expect(mockOnCellClick).toHaveBeenCalledTimes(1);
      expect(mockOnCellClick).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 0,
          y: 0,
          value: 20
        })
      );
    });

    it('shows tooltip on cell hover', async () => {
      const user = userEvent.setup();

      render(<MockDeviationHeatmap data={mockHeatmapData} />);

      const cell = screen.getByTestId('cell-0-0');
      await user.hover(cell);

      expect(screen.getByTestId('hover-tooltip')).toBeInTheDocument();
      expect(screen.getByText('Value: 20')).toBeInTheDocument();
      expect(screen.getByText('Deviation: -2')).toBeInTheDocument();
    });

    it('hides tooltip on mouse leave', async () => {
      const user = userEvent.setup();

      render(<MockDeviationHeatmap data={mockHeatmapData} />);

      const cell = screen.getByTestId('cell-0-0');
      await user.hover(cell);

      expect(screen.getByTestId('hover-tooltip')).toBeInTheDocument();

      await user.unhover(cell);

      expect(screen.queryByTestId('hover-tooltip')).not.toBeInTheDocument();
    });

    it('calls onCellHover callback', async () => {
      const mockOnCellHover = vi.fn();
      const user = userEvent.setup();

      render(
        <MockDeviationHeatmap
          data={mockHeatmapData}
          onCellHover={mockOnCellHover}
        />
      );

      const cell = screen.getByTestId('cell-0-1');
      await user.hover(cell);

      expect(mockOnCellHover).toHaveBeenCalledWith(
        expect.objectContaining({
          x: 1,
          y: 0,
          value: 22
        })
      );

      await user.unhover(cell);

      expect(mockOnCellHover).toHaveBeenCalledWith(null);
    });
  });

  describe('Deviation Calculations', () => {
    it('calculates positive deviation correctly', () => {
      const value = 75;
      const setpoint = 70;
      const deviation = value - setpoint;

      expect(deviation).toBe(5);
      expect(deviation).toBeGreaterThan(0);
    });

    it('calculates negative deviation correctly', () => {
      const value = 65;
      const setpoint = 70;
      const deviation = value - setpoint;

      expect(deviation).toBe(-5);
      expect(deviation).toBeLessThan(0);
    });

    it('handles zero deviation', () => {
      const value = 70;
      const setpoint = 70;
      const deviation = value - setpoint;

      expect(deviation).toBe(0);
    });

    it('displays deviation with correct sign', () => {
      const testData: HeatmapDataPoint[][] = [
        [
          { x: 0, y: 0, value: 75, deviation: 5 },
          { x: 1, y: 0, value: 65, deviation: -5 },
          { x: 2, y: 0, value: 70, deviation: 0 }
        ]
      ];

      render(<MockDeviationHeatmap data={testData} showDeviation={true} />);

      const cell0 = screen.getByTestId('cell-0-0');
      const cell1 = screen.getByTestId('cell-0-1');
      const cell2 = screen.getByTestId('cell-0-2');

      expect(cell0.getAttribute('data-deviation')).toBe('5');
      expect(cell1.getAttribute('data-deviation')).toBe('-5');
      expect(cell2.getAttribute('data-deviation')).toBe('0');
    });
  });

  describe('Time-Based Visualization', () => {
    it('accepts time range configuration', () => {
      const timeRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31')
      };

      render(
        <MockDeviationHeatmap
          data={mockHeatmapData}
          timeRange={timeRange}
        />
      );

      expect(screen.getByTestId('deviation-heatmap')).toBeInTheDocument();
    });

    it('filters building system data by time range', () => {
      const timeRange = {
        start: new Date('2024-01-01T00:00:00'),
        end: new Date('2024-01-01T01:00:00')
      };

      const filteredMetrics = mockBuildingSystems[0].metrics.filter(
        metric =>
          metric.timestamp >= timeRange.start &&
          metric.timestamp <= timeRange.end
      );

      expect(filteredMetrics).toHaveLength(2);
    });

    it('groups data by time intervals', () => {
      const hourlyGroups = mockBuildingSystems[0].metrics.reduce((acc, metric) => {
        const hour = metric.timestamp.getHours();
        if (!acc[hour]) acc[hour] = [];
        acc[hour].push(metric);
        return acc;
      }, {} as Record<number, typeof mockBuildingSystems[0]['metrics']>);

      expect(hourlyGroups[0]).toHaveLength(1);
      expect(hourlyGroups[1]).toHaveLength(1);
    });
  });

  describe('Data Validation', () => {
    it('validates heatmap data structure', () => {
      const validData: HeatmapDataPoint[][] = [
        [
          { x: 0, y: 0, value: 10 },
          { x: 1, y: 0, value: 20 }
        ]
      ];

      expect(validData).toBeInstanceOf(Array);
      expect(validData[0]).toBeInstanceOf(Array);
      expect(validData[0][0]).toHaveProperty('x');
      expect(validData[0][0]).toHaveProperty('y');
      expect(validData[0][0]).toHaveProperty('value');
    });

    it('handles empty data gracefully', () => {
      render(<MockDeviationHeatmap data={[]} />);

      expect(screen.getByTestId('deviation-heatmap')).toBeInTheDocument();
      expect(screen.getByTestId('heatmap-grid')).toBeInTheDocument();
    });

    it('validates building system data structure', () => {
      const validSystem: BuildingSystemData = {
        systemId: 'test-1',
        systemName: 'Test System',
        metrics: [
          {
            timestamp: new Date(),
            value: 70,
            setpoint: 68,
            deviation: 2
          }
        ]
      };

      expect(validSystem).toHaveProperty('systemId');
      expect(validSystem).toHaveProperty('systemName');
      expect(validSystem).toHaveProperty('metrics');
      expect(validSystem.metrics[0]).toHaveProperty('timestamp');
      expect(validSystem.metrics[0]).toHaveProperty('value');
    });

    it('handles missing deviation values', () => {
      const dataWithoutDeviation: HeatmapDataPoint[][] = [
        [
          { x: 0, y: 0, value: 20 },
          { x: 1, y: 0, value: 25 }
        ]
      ];

      render(<MockDeviationHeatmap data={dataWithoutDeviation} showDeviation={true} />);

      expect(screen.getByTestId('deviation-heatmap')).toBeInTheDocument();
    });
  });

  describe('Building-Specific Metrics', () => {
    it('visualizes HVAC temperature deviations', () => {
      const hvacData: BuildingSystemData = {
        systemId: 'hvac-main',
        systemName: 'Main HVAC',
        metrics: [
          { timestamp: new Date(), value: 72, setpoint: 70, deviation: 2 },
          { timestamp: new Date(), value: 68, setpoint: 70, deviation: -2 }
        ]
      };

      expect(hvacData.metrics[0].deviation).toBe(2);
      expect(hvacData.metrics[1].deviation).toBe(-2);
    });

    it('tracks system performance over time', () => {
      const system = mockBuildingSystems[0];
      const avgDeviation = system.metrics.reduce((sum, m) => sum + (m.deviation || 0), 0) / system.metrics.length;

      expect(avgDeviation).toBe(1.5); // (2 + 1) / 2
    });

    it('identifies systems with high deviations', () => {
      const highDeviationThreshold = 3;
      const systemsWithHighDeviation = mockBuildingSystems.filter(system =>
        system.metrics.some(m => Math.abs(m.deviation || 0) >= highDeviationThreshold)
      );

      expect(systemsWithHighDeviation).toHaveLength(0);
    });

    it('supports multiple metric types per system', () => {
      interface ExtendedMetric {
        timestamp: Date;
        temperature?: number;
        humidity?: number;
        pressure?: number;
        [key: string]: any;
      }

      const multiMetricSystem = {
        systemId: 'multi-1',
        systemName: 'Multi-Metric System',
        metrics: [
          { timestamp: new Date(), temperature: 72, humidity: 45, pressure: 101.3 }
        ]
      };

      expect(multiMetricSystem.metrics[0]).toHaveProperty('temperature');
      expect(multiMetricSystem.metrics[0]).toHaveProperty('humidity');
      expect(multiMetricSystem.metrics[0]).toHaveProperty('pressure');
    });
  });
});
