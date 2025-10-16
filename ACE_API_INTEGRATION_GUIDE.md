# ACE API Integration Guide for Building Vitals

## Overview
This guide explains how to properly use the ACE Deploy API with the Building Vitals application, focusing on the new paginated endpoint for RAW timeseries data.

## Key Endpoints

### 1. Sites Endpoint
**GET** `/api/sites/`
- **Purpose**: Fetch all available sites
- **Important Parameters**:
  - `collect_enabled=true` - Only get sites with data collection enabled
  - `per_page=100000` - Maximum results per page (reduces API calls)
- **Usage in Building Vitals**: Initial site discovery and selection

### 2. Points Endpoint
**GET** `/api/sites/{site_name}/points`
- **Purpose**: Get all points for a specific site
- **Important Parameters**:
  - `per_page=100000` - Get all points in one request if possible
- **Usage in Building Vitals**: Point selection for charts after site selection

### 3. Paginated Timeseries Endpoint (RAW Data) ⚡ NEW
**GET** `/api/sites/{site_name}/timeseries/paginated`
- **Purpose**: Fetch high-resolution RAW timeseries data with pagination
- **Key Parameters**:
  - `raw_data=true` - Get unprocessed, raw data points (no 5-minute aggregation)
  - `page_size=500000` - Maximum points per page (up to 500k)
  - `cursor` - Continue fetching from previous request
  - `start_time` & `end_time` - ISO 8601 format with Z suffix
- **Response**:
  ```json
  {
    "point_samples": [
      {"name": "point_name", "value": "123.45", "time": "2024-01-01T00:00:00Z"}
    ],
    "next_cursor": "encoded_cursor_string",
    "has_more": true
  }
  ```

### 4. Single Point Timeseries
**GET** `/api/points/{point_name}/timeseries`
- **Purpose**: Get timeseries for a single specific point
- **Usage**: When you need data for just one point

### 5. Batch Timeseries (POST)
**POST** `/api/points/get_timeseries`
- **Purpose**: Fetch timeseries for multiple points in one request
- **Body**:
  ```json
  {
    "points": [
      {"name": "point1"},
      {"name": "point2"}
    ]
  }
  ```

## Implementation Examples

### Fetching Sites with Data Collection
```javascript
import { getAceApiClient } from './services/api/aceApiClient';

const client = getAceApiClient();

// Get only sites that are collecting data
const sites = await client.getSites({
  collect_enabled: true,
  per_page: 100000
});
```

### Fetching High-Resolution RAW Data
```javascript
// Fetch RAW data for deviation heatmaps and anomaly detection
const rawData = await client.getSiteTimeseriesPaginated(
  'ses_falls_city',
  '2024-01-01T00:00:00Z',
  '2024-01-31T23:59:59Z',
  {
    raw_data: true,        // ⚡ Critical for high-resolution visualization
    page_size: 500000      // Maximum batch size
  }
);

console.log(`Fetched ${rawData.length} raw data points`);
```

### Handling Large Datasets with Pagination
```javascript
async function fetchAllHistoricalData(siteName, startTime, endTime) {
  let allData = [];
  let cursor = undefined;
  let pageCount = 0;

  do {
    const response = await client.getSiteTimeseriesPaginated(
      siteName,
      startTime,
      endTime,
      {
        raw_data: true,
        page_size: 500000,
        cursor: cursor
      }
    );

    allData.push(...response.point_samples);
    cursor = response.next_cursor;
    pageCount++;

    console.log(`Page ${pageCount}: ${response.point_samples.length} points`);
  } while (cursor);

  return allData;
}
```

## Critical Implementation Notes

### 1. Time Format
- **ALWAYS** use ISO 8601 format with Z suffix
- Example: `2024-01-01T00:00:00Z`
- The API is strict about time format

### 2. Point Name Encoding
- **ALWAYS** URL encode point names with special characters
- Use `encodeURIComponent(pointName)` for paths
- Example: `ses_falls_city:ahu1/sat` → `ses_falls_city%3Aahu1%2Fsat`

### 3. Authorization
- Use Bearer token in Authorization header
- Format: `Authorization: Bearer YOUR_JWT_TOKEN`

### 4. Pagination Strategy
- For dashboards: Use single page with `page_size=100000`
- For exports/analysis: Use cursor pagination with `page_size=500000`
- For real-time: Use smaller `page_size` for faster response

### 5. RAW Data vs Aggregated
- `raw_data=true`: Every single data point (high-resolution)
- `raw_data=false`: 5-minute aggregated buckets (default)
- Use RAW for:
  - Deviation heatmaps
  - Anomaly detection
  - Diagnostic accuracy
  - Data exports

## Performance Optimization

### 1. Batch Requests
- Use `/points/get_timeseries` for multiple points instead of individual requests
- Maximum 50 points per batch recommended

### 2. Caching Strategy
- Sites/Points: Cache for 1 hour (rarely change)
- Timeseries: Cache based on age
  - Today's data: 5 minutes
  - This week: 1 hour
  - Older: 24 hours

### 3. Progressive Loading
- Load recent data first (last 24 hours)
- Fetch historical data in background
- Use cursor pagination for large historical ranges

## Error Handling

### Common Errors
1. **400 Bad Request**: Check time format and point encoding
2. **404 Not Found**: Verify site/point names exist
3. **401 Unauthorized**: Token expired or invalid
4. **429 Too Many Requests**: Implement exponential backoff

### Retry Strategy
```javascript
// Built into aceApiClient.ts
// Automatic retry with exponential backoff
// Maximum 3 retries by default
```

## Migration Checklist

- [ ] Update all API endpoints to use `/api/` prefix
- [ ] Implement paginated endpoint for high-resolution data
- [ ] Add proper URL encoding for point names
- [ ] Update time formatting to ISO 8601 with Z suffix
- [ ] Implement cursor-based pagination for large datasets
- [ ] Add `collect_enabled` filter for site queries
- [ ] Use `raw_data=true` for diagnostic charts
- [ ] Implement proper error handling and retries

## Benefits of the New Paginated Endpoint

1. **High-Resolution Data**: Access to every single data point
2. **Large Dataset Support**: Up to 500,000 points per page
3. **Efficient Pagination**: Cursor-based (no offset calculations)
4. **Flexible Aggregation**: Choose between raw and 5-minute buckets
5. **Memory Efficient**: Stream large datasets without memory issues

## Example: Complete Integration Flow

```javascript
// 1. Initialize client
const client = getAceApiClient();

// 2. Get sites with data collection
const sites = await client.getSites({
  collect_enabled: true
});

// 3. Select a site and get its points
const selectedSite = sites[0].name;
const points = await client.getSitePoints(selectedSite);

// 4. Filter points by marker tags (e.g., temperature sensors)
const tempPoints = points.filter(p =>
  p.marker_tags?.includes('temp') && p.collect_enabled
);

// 5. Fetch RAW timeseries data
const endTime = new Date().toISOString();
const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

const rawData = await client.getSiteTimeseriesPaginated(
  selectedSite,
  startTime,
  endTime,
  { raw_data: true }
);

// 6. Process data for visualization
const chartData = processForHighResChart(rawData);
```

This integration properly leverages the ACE API's capabilities for high-resolution data visualization in Building Vitals!