/**
 * Chart Time Formatter Usage Examples
 *
 * Demonstrates how to integrate the centralized time formatter
 * with ECharts components in the Building Vitals application.
 */

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  formatEChartsAxisLabel,
  formatEChartsTooltip,
  formatTimeRange,
  getOptimalGranularity,
  createEChartsFormatter,
  formatRelativeTime
} from '@/utils/chartTimeFormatter';

// ========================================
// Example 1: Temperature Chart with Auto-Granularity
// ========================================

interface TemperatureData {
  timestamp: number;
  temperature: number;
  humidity: number;
}

export const TemperatureChart: React.FC<{ data: TemperatureData[] }> = ({ data }) => {
  const option = useMemo(() => {
    const timestamps = data.map(d => d.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    return {
      title: {
        text: 'Temperature & Humidity',
        subtext: formatTimeRange(minTime, maxTime)
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const time = formatEChartsTooltip(params[0].value[0]);
          const lines = params.map((param: any) =>
            `${param.marker}${param.seriesName}: ${param.value[1]}${param.seriesName.includes('Temp') ? '°F' : '%'}`
          );
          return `${time}<br/>${lines.join('<br/>')}`;
        }
      },
      legend: {
        data: ['Temperature', 'Humidity']
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          formatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime]),
          rotate: 45,
          hideOverlap: true
        }
      },
      yAxis: [
        {
          type: 'value',
          name: 'Temperature (°F)',
          position: 'left'
        },
        {
          type: 'value',
          name: 'Humidity (%)',
          position: 'right'
        }
      ],
      series: [
        {
          name: 'Temperature',
          type: 'line',
          data: data.map(d => [d.timestamp, d.temperature]),
          smooth: true,
          yAxisIndex: 0
        },
        {
          name: 'Humidity',
          type: 'line',
          data: data.map(d => [d.timestamp, d.humidity]),
          smooth: true,
          yAxisIndex: 1
        }
      ],
      dataZoom: [
        {
          type: 'slider',
          xAxisIndex: 0,
          labelFormatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime])
        }
      ]
    };
  }, [data]);

  return <ReactECharts option={option} style={{ height: '400px' }} />;
};

// ========================================
// Example 2: Energy Consumption with Custom Granularity
// ========================================

interface EnergyData {
  timestamp: number;
  consumption: number;
}

export const EnergyChart: React.FC<{
  data: EnergyData[];
  granularity?: 'minute' | 'hour' | 'day'
}> = ({ data, granularity = 'hour' }) => {
  const option = useMemo(() => {
    const formatter = createEChartsFormatter({ granularity });

    return {
      title: {
        text: 'Energy Consumption',
        subtext: `Granularity: ${granularity}`
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const time = formatEChartsTooltip(params[0].value[0], false); // No seconds
          const value = params[0].value[1];
          return `${time}<br/>Consumption: ${value} kWh`;
        }
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          formatter,
          rotate: 45
        }
      },
      yAxis: {
        type: 'value',
        name: 'Consumption (kWh)'
      },
      series: [{
        name: 'Energy',
        type: 'bar',
        data: data.map(d => [d.timestamp, d.consumption]),
        itemStyle: {
          color: '#5470c6'
        }
      }]
    };
  }, [data, granularity]);

  return <ReactECharts option={option} style={{ height: '350px' }} />;
};

// ========================================
// Example 3: Real-Time Data with Last Updated Display
// ========================================

export const RealTimeMonitor: React.FC<{
  data: Array<{ timestamp: number; value: number }>;
  lastUpdate: number;
}> = ({ data, lastUpdate }) => {
  const [relativeTime, setRelativeTime] = React.useState('');

  // Update relative time every minute
  React.useEffect(() => {
    const updateTime = () => setRelativeTime(formatRelativeTime(lastUpdate));
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  const option = useMemo(() => {
    const timestamps = data.map(d => d.timestamp);
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    return {
      title: {
        text: 'Real-Time Monitoring',
        subtext: `Last updated: ${relativeTime}`
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          formatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime])
        }
      },
      yAxis: {
        type: 'value'
      },
      series: [{
        data: data.map(d => [d.timestamp, d.value]),
        type: 'line',
        smooth: true,
        animation: true
      }]
    };
  }, [data, relativeTime]);

  return <ReactECharts option={option} style={{ height: '300px' }} />;
};

// ========================================
// Example 4: Multi-Series Comparison with Time Range
// ========================================

interface BuildingData {
  buildingName: string;
  data: Array<{ timestamp: number; value: number }>;
}

export const BuildingComparison: React.FC<{ buildings: BuildingData[] }> = ({ buildings }) => {
  const option = useMemo(() => {
    // Get overall time range
    const allTimestamps = buildings.flatMap(b => b.data.map(d => d.timestamp));
    const minTime = Math.min(...allTimestamps);
    const maxTime = Math.max(...allTimestamps);
    const granularity = getOptimalGranularity(minTime, maxTime);

    return {
      title: {
        text: 'Building Comparison',
        subtext: formatTimeRange(minTime, maxTime)
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const time = formatEChartsTooltip(params[0].value[0]);
          const lines = params.map((p: any) =>
            `${p.marker}${p.seriesName}: ${p.value[1]} units`
          );
          return `${time}<br/>${lines.join('<br/>')}`;
        }
      },
      legend: {
        data: buildings.map(b => b.buildingName),
        formatter: (name: string) => {
          const building = buildings.find(b => b.buildingName === name);
          if (!building || building.data.length === 0) return name;

          const buildingTimes = building.data.map(d => d.timestamp);
          const range = formatTimeRange(
            Math.min(...buildingTimes),
            Math.max(...buildingTimes)
          );
          return `${name} (${range})`;
        }
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          formatter: createEChartsFormatter({ granularity })
        }
      },
      yAxis: {
        type: 'value',
        name: 'Value'
      },
      series: buildings.map(building => ({
        name: building.buildingName,
        type: 'line',
        data: building.data.map(d => [d.timestamp, d.value]),
        smooth: true
      }))
    };
  }, [buildings]);

  return <ReactECharts option={option} style={{ height: '450px' }} />;
};

// ========================================
// Example 5: Heatmap with Time-Based Axes
// ========================================

export const TimeHeatmap: React.FC<{
  data: Array<{ timestamp: number; category: string; value: number }>;
}> = ({ data }) => {
  const option = useMemo(() => {
    const timestamps = [...new Set(data.map(d => d.timestamp))].sort();
    const categories = [...new Set(data.map(d => d.category))];
    const minTime = Math.min(...timestamps);
    const maxTime = Math.max(...timestamps);

    // Prepare heatmap data: [x, y, value]
    const heatmapData = data.map(d => [
      d.timestamp,
      categories.indexOf(d.category),
      d.value
    ]);

    return {
      tooltip: {
        formatter: (params: any) => {
          const time = formatEChartsTooltip(params.value[0]);
          const category = categories[params.value[1]];
          const value = params.value[2];
          return `${time}<br/>${category}: ${value}`;
        }
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          formatter: (value: number) => formatEChartsAxisLabel(value, [minTime, maxTime]),
          rotate: 45
        }
      },
      yAxis: {
        type: 'category',
        data: categories
      },
      visualMap: {
        min: 0,
        max: Math.max(...data.map(d => d.value)),
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '0%'
      },
      series: [{
        name: 'Heatmap',
        type: 'heatmap',
        data: heatmapData,
        label: {
          show: false
        }
      }]
    };
  }, [data]);

  return <ReactECharts option={option} style={{ height: '400px' }} />;
};

// ========================================
// Example 6: Time Range Selector Component
// ========================================

export const TimeRangeSelector: React.FC<{
  startTime: number;
  endTime: number;
  onChange: (start: number, end: number) => void;
}> = ({ startTime, endTime, onChange }) => {
  const displayRange = formatTimeRange(startTime, endTime);
  const granularity = getOptimalGranularity(startTime, endTime);

  return (
    <div className="time-range-selector">
      <h3>Selected Range: {displayRange}</h3>
      <p>Optimal Granularity: {granularity}</p>
      {/* Add range picker UI here */}
    </div>
  );
};
