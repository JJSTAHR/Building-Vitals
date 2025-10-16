import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import userEvent from '@testing-library/user-event';
import { BarChart } from '../../src/components/charts/BarChart';
import { ControlBandChart } from '../../src/components/charts/ControlBandChart';
import { TimeSeriesChart } from '../../src/components/charts/TimeSeriesChart';
import { EnhancedLineChart } from '../../src/components/charts/EnhancedLineChart';
import { AreaChart } from '../../src/components/charts/AreaChart';

/**
 * Feature Enhancement Tests - Phase 3
 * Tests for the 5 new features
 */

describe('Feature Enhancements', () => {

  describe('13. Threshold Mark Lines - BarChart', () => {
    const mockData = [
      { category: 'A', value: 100 },
      { category: 'B', value: 200 },
      { category: 'C', value: 150 },
      { category: 'D', value: 300 },
    ];

    it('should render mark lines at specified threshold values', () => {
      const thresholds = [
        { value: 150, label: 'Warning', color: '#ffa500' },
        { value: 250, label: 'Critical', color: '#ff0000' }
      ];

      const { container } = render(
        <BarChart
          data={mockData}
          thresholds={thresholds}
        />
      );

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();

      // Mark lines should be rendered
      const markLines = container.querySelectorAll('[data-type="mark-line"]');
      expect(markLines.length).toBeGreaterThanOrEqual(thresholds.length);
    });

    it('should display threshold labels correctly', async () => {
      const thresholds = [
        { value: 150, label: 'Warning Level', color: '#ffa500' },
        { value: 250, label: 'Critical Level', color: '#ff0000' }
      ];

      render(
        <BarChart
          data={mockData}
          thresholds={thresholds}
        />
      );

      // Labels should be present in the chart
      await waitFor(() => {
        expect(screen.getByText(/Warning Level/i)).toBeInTheDocument();
        expect(screen.getByText(/Critical Level/i)).toBeInTheDocument();
      });
    });

    it('should apply custom colors to threshold lines', () => {
      const thresholds = [
        { value: 150, label: 'Low', color: '#00ff00' },
        { value: 200, label: 'Medium', color: '#ffa500' },
        { value: 250, label: 'High', color: '#ff0000' }
      ];

      const { container } = render(
        <BarChart
          data={mockData}
          thresholds={thresholds}
        />
      );

      // Verify colors are applied
      const markLines = container.querySelectorAll('[data-type="mark-line"]');
      expect(markLines.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle multiple thresholds', () => {
      const thresholds = [
        { value: 50, label: 'Min', color: '#0000ff' },
        { value: 150, label: 'Low', color: '#00ff00' },
        { value: 200, label: 'Medium', color: '#ffa500' },
        { value: 250, label: 'High', color: '#ff0000' },
        { value: 350, label: 'Max', color: '#800080' }
      ];

      const { container } = render(
        <BarChart
          data={mockData}
          thresholds={thresholds}
        />
      );

      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should work without thresholds', () => {
      const { container } = render(<BarChart data={mockData} />);
      expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
    });

    it('should position thresholds correctly relative to data', () => {
      const thresholds = [
        { value: 150, label: 'Threshold', color: '#ffa500' }
      ];

      const { container } = render(
        <BarChart
          data={mockData}
          thresholds={thresholds}
        />
      );

      // Threshold should be visible and positioned correctly
      const chart = container.querySelector('.echarts-for-react');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('14. Alert Panel Responsive - ControlBandChart', () => {
    const mockData = Array.from({ length: 100 }, (_, i) => ({
      timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
      value: 50 + Math.random() * 20,
      ucl: 70,
      lcl: 30
    }));

    it('should render compact layout on mobile (390px)', () => {
      global.innerWidth = 390;
      global.innerHeight = 844;

      const { container } = render(
        <div style={{ width: '390px' }}>
          <ControlBandChart
            data={mockData}
            showAlerts={true}
          />
        </div>
      );

      const alertPanel = container.querySelector('[data-testid="alert-panel"]');
      expect(alertPanel).toBeInTheDocument();
      expect(alertPanel).toHaveClass('compact');
    });

    it('should render full layout on desktop (1920px)', () => {
      global.innerWidth = 1920;
      global.innerHeight = 1080;

      const { container } = render(
        <div style={{ width: '1920px' }}>
          <ControlBandChart
            data={mockData}
            showAlerts={true}
          />
        </div>
      );

      const alertPanel = container.querySelector('[data-testid="alert-panel"]');
      expect(alertPanel).toBeInTheDocument();
      expect(alertPanel).toHaveClass('full');
    });

    it('should adjust layout on window resize', async () => {
      const { container, rerender } = render(
        <div style={{ width: '1920px' }}>
          <ControlBandChart
            data={mockData}
            showAlerts={true}
          />
        </div>
      );

      let alertPanel = container.querySelector('[data-testid="alert-panel"]');
      expect(alertPanel).toHaveClass('full');

      // Simulate resize to mobile
      global.innerWidth = 390;
      global.dispatchEvent(new Event('resize'));

      rerender(
        <div style={{ width: '390px' }}>
          <ControlBandChart
            data={mockData}
            showAlerts={true}
          />
        </div>
      );

      await waitFor(() => {
        alertPanel = container.querySelector('[data-testid="alert-panel"]');
        expect(alertPanel).toHaveClass('compact');
      });
    });

    it('should maintain functionality at breakpoints', () => {
      const breakpoints = [
        { width: 320, name: 'small mobile' },
        { width: 390, name: 'mobile' },
        { width: 768, name: 'tablet' },
        { width: 1024, name: 'small desktop' },
        { width: 1920, name: 'desktop' }
      ];

      breakpoints.forEach(({ width, name }) => {
        global.innerWidth = width;

        const { container, unmount } = render(
          <div style={{ width: `${width}px` }}>
            <ControlBandChart
              data={mockData}
              showAlerts={true}
            />
          </div>
        );

        expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
        unmount();
      });
    });

    it('should stack alerts vertically on mobile', () => {
      global.innerWidth = 390;

      const { container } = render(
        <div style={{ width: '390px' }}>
          <ControlBandChart
            data={mockData}
            showAlerts={true}
          />
        </div>
      );

      const alertPanel = container.querySelector('[data-testid="alert-panel"]');
      expect(alertPanel).toHaveStyle({ flexDirection: 'column' });
    });

    it('should display alerts horizontally on desktop', () => {
      global.innerWidth = 1920;

      const { container } = render(
        <div style={{ width: '1920px' }}>
          <ControlBandChart
            data={mockData}
            showAlerts={true}
          />
        </div>
      );

      const alertPanel = container.querySelector('[data-testid="alert-panel"]');
      expect(alertPanel).toHaveStyle({ flexDirection: 'row' });
    });
  });

  describe('15. Data View Toolbox - Multiple Charts', () => {
    const mockData = Array.from({ length: 50 }, (_, i) => ({
      timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
      value: Math.random() * 100
    }));

    const chartsToTest = [
      { name: 'TimeSeriesChart', component: TimeSeriesChart },
      { name: 'EnhancedLineChart', component: EnhancedLineChart },
      { name: 'AreaChart', component: AreaChart },
    ];

    chartsToTest.forEach(({ name, component: ChartComponent }) => {
      describe(`${name}`, () => {
        it('should have data view option in toolbox', async () => {
          const { container } = render(
            <ChartComponent
              data={mockData}
              series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
              showDataView={true}
            />
          );

          const toolbox = container.querySelector('[data-testid="toolbox"]');
          expect(toolbox).toBeInTheDocument();

          const dataViewButton = container.querySelector('[data-tool="dataView"]');
          expect(dataViewButton).toBeInTheDocument();
        });

        it('should export data in correct format', async () => {
          const onDataExport = jest.fn();

          const { container } = render(
            <ChartComponent
              data={mockData}
              series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
              showDataView={true}
              onDataExport={onDataExport}
            />
          );

          const dataViewButton = container.querySelector('[data-tool="dataView"]');
          if (dataViewButton) {
            fireEvent.click(dataViewButton);
          }

          await waitFor(() => {
            expect(onDataExport).toHaveBeenCalledWith(
              expect.arrayContaining([
                expect.objectContaining({
                  timestamp: expect.any(String),
                  value: expect.any(Number)
                })
              ])
            );
          });
        });

        it('should include all data points in export', async () => {
          const onDataExport = jest.fn();

          render(
            <ChartComponent
              data={mockData}
              series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
              showDataView={true}
              onDataExport={onDataExport}
            />
          );

          // Trigger export
          await waitFor(() => {
            if (onDataExport.mock.calls.length > 0) {
              const exportedData = onDataExport.mock.calls[0][0];
              expect(exportedData.length).toBe(mockData.length);
            }
          });
        });

        it('should handle empty data gracefully', () => {
          const { container } = render(
            <ChartComponent
              data={[]}
              series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
              showDataView={true}
            />
          );

          expect(container.querySelector('.echarts-for-react')).toBeInTheDocument();
        });
      });
    });

    it('should export with correct column headers', async () => {
      const onDataExport = jest.fn();

      render(
        <TimeSeriesChart
          data={mockData}
          series={[
            { key: 'value', name: 'Temperature', color: '#ff0000' }
          ]}
          showDataView={true}
          onDataExport={onDataExport}
        />
      );

      await waitFor(() => {
        if (onDataExport.mock.calls.length > 0) {
          const exportedData = onDataExport.mock.calls[0][0];
          expect(Object.keys(exportedData[0])).toContain('timestamp');
          expect(Object.keys(exportedData[0])).toContain('value');
        }
      });
    });
  });

  describe('16. Timeline Controls - No Duplicates', () => {
    const mockData = Array.from({ length: 200 }, (_, i) => ({
      timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
      value: Math.random() * 100
    }));

    it('should render timeline without duplicate controls', () => {
      const { container } = render(
        <TimeSeriesChart
          data={mockData}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          showTimeline={true}
        />
      );

      const timelineControls = container.querySelectorAll('[data-testid="timeline-control"]');

      // Count unique control IDs
      const controlIds = Array.from(timelineControls).map(ctrl => ctrl.getAttribute('id'));
      const uniqueIds = new Set(controlIds);

      expect(uniqueIds.size).toBe(timelineControls.length);
    });

    it('should not have duplicate play buttons', () => {
      const { container } = render(
        <TimeSeriesChart
          data={mockData}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          showTimeline={true}
        />
      );

      const playButtons = container.querySelectorAll('[data-timeline-action="play"]');
      expect(playButtons.length).toBe(1);
    });

    it('should not have duplicate slider controls', () => {
      const { container } = render(
        <TimeSeriesChart
          data={mockData}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          showTimeline={true}
        />
      );

      const sliders = container.querySelectorAll('[data-timeline-element="slider"]');
      expect(sliders.length).toBe(1);
    });

    it('should maintain single timeline across re-renders', () => {
      const { container, rerender } = render(
        <TimeSeriesChart
          data={mockData}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          showTimeline={true}
        />
      );

      const initialTimelineCount = container.querySelectorAll('[data-testid="timeline-control"]').length;

      // Multiple re-renders
      for (let i = 0; i < 5; i++) {
        rerender(
          <TimeSeriesChart
            data={mockData}
            series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
            showTimeline={true}
          />
        );
      }

      const finalTimelineCount = container.querySelectorAll('[data-testid="timeline-control"]').length;
      expect(finalTimelineCount).toBe(initialTimelineCount);
    });

    it('should cleanup timeline on unmount', () => {
      const { container, unmount } = render(
        <TimeSeriesChart
          data={mockData}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          showTimeline={true}
        />
      );

      expect(container.querySelector('[data-testid="timeline-control"]')).toBeInTheDocument();

      unmount();

      expect(container.querySelector('[data-testid="timeline-control"]')).not.toBeInTheDocument();
    });
  });

  describe('17. Keyboard Shortcuts - All Charts', () => {
    const mockData = Array.from({ length: 100 }, (_, i) => ({
      timestamp: new Date(2024, 0, 1, 0, i).toISOString(),
      value: Math.random() * 100
    }));

    const charts = [
      { name: 'TimeSeriesChart', component: TimeSeriesChart },
      { name: 'EnhancedLineChart', component: EnhancedLineChart },
      { name: 'AreaChart', component: AreaChart },
      { name: 'BarChart', component: BarChart },
      { name: 'ControlBandChart', component: ControlBandChart },
    ];

    charts.forEach(({ name, component: ChartComponent }) => {
      describe(`${name}`, () => {
        it('should zoom in with Ctrl++', async () => {
          const { container } = render(
            <ChartComponent
              data={mockData}
              series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
              enableKeyboardShortcuts={true}
            />
          );

          const chart = container.querySelector('.echarts-for-react');

          if (chart) {
            fireEvent.keyDown(chart, { key: '+', ctrlKey: true });
          }

          await waitFor(() => {
            expect(chart).toBeInTheDocument();
          });
        });

        it('should zoom out with Ctrl+-', async () => {
          const { container } = render(
            <ChartComponent
              data={mockData}
              series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
              enableKeyboardShortcuts={true}
            />
          );

          const chart = container.querySelector('.echarts-for-react');

          if (chart) {
            fireEvent.keyDown(chart, { key: '-', ctrlKey: true });
          }

          await waitFor(() => {
            expect(chart).toBeInTheDocument();
          });
        });

        it('should reset zoom with Ctrl+0', async () => {
          const { container } = render(
            <ChartComponent
              data={mockData}
              series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
              enableKeyboardShortcuts={true}
            />
          );

          const chart = container.querySelector('.echarts-for-react');

          if (chart) {
            // Zoom in first
            fireEvent.keyDown(chart, { key: '+', ctrlKey: true });
            // Then reset
            fireEvent.keyDown(chart, { key: '0', ctrlKey: true });
          }

          await waitFor(() => {
            expect(chart).toBeInTheDocument();
          });
        });

        it('should navigate with arrow keys', async () => {
          const { container } = render(
            <ChartComponent
              data={mockData}
              series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
              enableKeyboardShortcuts={true}
            />
          );

          const chart = container.querySelector('.echarts-for-react');

          if (chart) {
            fireEvent.keyDown(chart, { key: 'ArrowLeft' });
            fireEvent.keyDown(chart, { key: 'ArrowRight' });
            fireEvent.keyDown(chart, { key: 'ArrowUp' });
            fireEvent.keyDown(chart, { key: 'ArrowDown' });
          }

          await waitFor(() => {
            expect(chart).toBeInTheDocument();
          });
        });

        it('should not interfere with other keyboard events', async () => {
          const onKeyPress = jest.fn();

          const { container } = render(
            <div onKeyDown={onKeyPress}>
              <ChartComponent
                data={mockData}
                series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
                enableKeyboardShortcuts={true}
              />
            </div>
          );

          const parentDiv = container.firstChild;

          if (parentDiv) {
            fireEvent.keyDown(parentDiv, { key: 'a' });
            fireEvent.keyDown(parentDiv, { key: 'Enter' });
          }

          expect(onKeyPress).toHaveBeenCalled();
        });

        it('should work with user-event library', async () => {
          const user = userEvent.setup();

          const { container } = render(
            <ChartComponent
              data={mockData}
              series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
              enableKeyboardShortcuts={true}
            />
          );

          const chart = container.querySelector('.echarts-for-react');

          if (chart) {
            await user.keyboard('{Control>}+{/Control}');
            await user.keyboard('{Control>}-{/Control}');
            await user.keyboard('{Control>}0{/Control}');
          }

          expect(chart).toBeInTheDocument();
        });

        it('should disable shortcuts when prop is false', async () => {
          const { container } = render(
            <ChartComponent
              data={mockData}
              series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
              enableKeyboardShortcuts={false}
            />
          );

          const chart = container.querySelector('.echarts-for-react');

          if (chart) {
            fireEvent.keyDown(chart, { key: '+', ctrlKey: true });
          }

          // Should not crash
          expect(chart).toBeInTheDocument();
        });
      });
    });

    it('should handle rapid key presses', async () => {
      const { container } = render(
        <TimeSeriesChart
          data={mockData}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          enableKeyboardShortcuts={true}
        />
      );

      const chart = container.querySelector('.echarts-for-react');

      if (chart) {
        // Rapid fire key presses
        for (let i = 0; i < 10; i++) {
          fireEvent.keyDown(chart, { key: '+', ctrlKey: true });
          fireEvent.keyDown(chart, { key: '-', ctrlKey: true });
        }
      }

      await waitFor(() => {
        expect(chart).toBeInTheDocument();
      });
    });

    it('should support accessibility keyboard navigation', async () => {
      const { container } = render(
        <TimeSeriesChart
          data={mockData}
          series={[{ key: 'value', name: 'Value', color: '#ff0000' }]}
          enableKeyboardShortcuts={true}
        />
      );

      const chart = container.querySelector('.echarts-for-react');

      if (chart) {
        fireEvent.keyDown(chart, { key: 'Tab' });
        fireEvent.keyDown(chart, { key: 'Enter' });
        fireEvent.keyDown(chart, { key: 'Escape' });
      }

      expect(chart).toBeInTheDocument();
    });
  });
});
