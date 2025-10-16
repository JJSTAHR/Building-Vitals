# ACE IoT API Complete Reference

**Generated:** 2025-10-16
**API Base:** https://flightdeck.aceiot.cloud/api

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Sites API](#sites-api)
3. [Points API](#points-api)
4. [Timeseries API](#timeseries-api)
5. [Weather API](#weather-api)
6. [Data Models](#data-models)

---

## Authentication

All API requests require JWT Bearer token authentication.

```bash
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

**Example:**
```bash
curl -H "Authorization: Bearer $ACE_API_KEY" \
     -H "Content-Type: application/json" \
     "https://flightdeck.aceiot.cloud/api/sites"
```

---

## Sites API

### List Sites

**GET** `/sites`

Returns paginated list of all sites.

**Query Parameters:**
- `page` (integer) - Page number
- `per_page` (integer) - Items per page

**Response:**
```json
{
  "page": 1,
  "pages": 5,
  "per_page": 20,
  "total": 100,
  "items": [
    {
      "id": 1,
      "name": "ses_falls_city",
      "client": "SES Healthcare",
      "address": "123 Main St, Falls City, NE",
      "nice_name": "SES Falls City Hospital",
      "ansible_user": "deploy",
      "vtron_user": "volttron",
      "vtron_ip": "192.168.1.100",
      "geo_location": "Falls City, NE",
      "mqtt_prefix": "ses/ses_falls_city",
      "latitude": 40.0581,
      "longitude": -95.6019,
      "archived": false
    }
  ]
}
```

### Get Site

**GET** `/sites/{site_name}`

Returns single site details.

**Path Parameters:**
- `site_name` (string, required) - Site identifier (e.g., "ses_falls_city")

**Response:** Single site object (same structure as items above)

---

## Points API

### List Configured Points

**GET** `/sites/{site_name}/configured_points`

Returns all points configured for data collection at a site.

**Path Parameters:**
- `site_name` (string, required) - Site identifier

**Query Parameters:**
- `page` (integer) - Page number (default: 1)
- `per_page` (integer) - Items per page (default: 100, max: 100)

**Response:**
```json
{
  "page": 1,
  "pages": 46,
  "per_page": 100,
  "total": 4583,
  "items": [
    {
      "id": 12345,
      "name": "ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.AHUDampers.points.Exhaust_Damper",
      "client": "ses",
      "site": "ses_falls_city",
      "kv_tags": {
        "equipment": "AHU",
        "location": "Mechanical Room"
      },
      "bacnet_data": {
        "device_address": "192.168.96.3",
        "device_id": 100,
        "object_type": "analogInput",
        "object_index": 1,
        "object_name": "Exhaust_Damper",
        "device_name": "AHUDampers",
        "object_description": "Exhaust Air Damper Position",
        "device_description": "AHU Damper Controller",
        "scrape_interval": 30,
        "scrape_enabled": true,
        "present_value": "45.5"
      },
      "marker_tags": ["damper", "ahu", "exhaust"],
      "collect_config": {},
      "point_type": "bacnet",
      "collect_enabled": true,
      "collect_interval": 30,
      "updated": "2025-10-15T12:00:00Z",
      "created": "2025-09-16T08:00:00Z"
    }
  ]
}
```

**Field Descriptions:**

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Unique point ID |
| name | string | Full hierarchical point path (ACE IoT format) |
| client | string | Client identifier |
| site | string | Site identifier |
| kv_tags | object | Key-value metadata tags |
| bacnet_data | object | BACnet communication metadata |
| marker_tags | array | Categorical tags |
| collect_config | object | Point-type-specific configuration |
| point_type | string | Data collection protocol (e.g., "bacnet") |
| collect_enabled | boolean | Whether data collection is active |
| collect_interval | integer | **Collection interval in seconds** |
| updated | ISO8601 | Last configuration update |
| created | ISO8601 | Point creation date |

---

## Timeseries API

### Paginated Timeseries Query

**GET** `/sites/{site_name}/timeseries/paginated`

Returns timeseries data with cursor-based pagination.

**⚠️ CRITICAL:** This is the recommended endpoint for large-scale data collection.

**Path Parameters:**
- `site_name` (string, required) - Site identifier

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `start_time` | ISO8601 | ✅ Yes | - | Start of time range |
| `end_time` | ISO8601 | ✅ Yes | - | End of time range |
| `page_size` | integer | No | 10000 | Samples per page |
| `cursor` | string | No | - | Pagination cursor |
| `raw_data` | boolean | No | false | Return raw data vs 5-min buckets |

**Valid page_size values:**
- 3, 10, 50, 100, 500, 1000, 5000, 10000, 50000, 100000, 300000, 500000

**raw_data Parameter:**
- `false` (default): Returns aggregated 5-minute buckets
- `true`: Returns raw sensor readings without aggregation

**⚠️ KNOWN LIMITATION:** As of Oct 2025, `raw_data=true` still returns 5-minute data. Contact ACE IoT support for higher resolution data access.

**Request Example:**
```javascript
const url = new URL('https://flightdeck.aceiot.cloud/api/sites/ses_falls_city/timeseries/paginated');
url.searchParams.set('start_time', '2025-10-16T00:00:00Z');
url.searchParams.set('end_time', '2025-10-16T01:00:00Z');
url.searchParams.set('page_size', '100000');
url.searchParams.set('raw_data', 'true');

const response = await fetch(url.toString(), {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
```

**Response:**
```json
{
  "point_samples": [
    {
      "name": "ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.AHUDampers.points.Exhaust_Damper",
      "value": "45.5",
      "time": "2025-10-16T00:05:00Z"
    },
    {
      "name": "ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.AHUDampers.points.Exhaust_Damper",
      "value": "46.2",
      "time": "2025-10-16T00:10:00Z"
    }
  ],
  "next_cursor": "eyJvZmZzZXQiOjEwMDAwMH0=",
  "has_more": true
}
```

**Pagination Pattern:**
```javascript
async function fetchAllPages(startTime, endTime) {
  const allSamples = [];
  let cursor = null;

  do {
    const url = new URL(`${API_BASE}/sites/${SITE_NAME}/timeseries/paginated`);
    url.searchParams.set('start_time', startTime);
    url.searchParams.set('end_time', endTime);
    url.searchParams.set('page_size', '100000');
    url.searchParams.set('raw_data', 'true');

    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    const response = await fetch(url.toString(), { headers });
    const data = await response.json();

    allSamples.push(...data.point_samples);
    cursor = data.next_cursor;

  } while (data.has_more && cursor);

  return allSamples;
}
```

### Legacy Timeseries Endpoint

**GET** `/sites/{site_name}/timeseries`

Returns non-paginated timeseries data.

**⚠️ WARNING:** Limited to small datasets. Use `/timeseries/paginated` for production.

**Response:**
```json
{
  "point_samples": [
    {
      "name": "point_name",
      "value": "value",
      "time": "2025-10-16T00:00:00Z"
    }
  ]
}
```

---

## Weather API

### Get Current Weather

**GET** `/sites/{site_name}/weather/current`

Returns latest weather readings for all weather points.

**Response:**
```json
{
  "temp": {
    "name": "ses/ses_falls_city/weather/temp",
    "value": "20.5",
    "time": "2025-10-16T03:00:00Z"
  },
  "feels_like": {
    "name": "ses/ses_falls_city/weather/feels_like",
    "value": "18.3",
    "time": "2025-10-16T03:00:00Z"
  },
  "pressure": {
    "name": "ses/ses_falls_city/weather/pressure",
    "value": "1013.25",
    "time": "2025-10-16T03:00:00Z"
  },
  "humidity": {
    "name": "ses/ses_falls_city/weather/humidity",
    "value": "65",
    "time": "2025-10-16T03:00:00Z"
  },
  "dew_point": {
    "name": "ses/ses_falls_city/weather/dew_point",
    "value": "14.2",
    "time": "2025-10-16T03:00:00Z"
  },
  "clouds": {
    "name": "ses/ses_falls_city/weather/clouds",
    "value": "40",
    "time": "2025-10-16T03:00:00Z"
  },
  "wind_speed": {
    "name": "ses/ses_falls_city/weather/wind_speed",
    "value": "5.5",
    "time": "2025-10-16T03:00:00Z"
  },
  "wind_deg": {
    "name": "ses/ses_falls_city/weather/wind_deg",
    "value": "180",
    "time": "2025-10-16T03:00:00Z"
  },
  "wet_bulb": {
    "name": "ses/ses_falls_city/weather/wet_bulb",
    "value": "16.8",
    "time": "2025-10-16T03:00:00Z"
  }
}
```

---

## Data Models

### Point Sample

Represents a single timeseries data point.

```typescript
interface PointSample {
  name: string;        // Full point path (ACE IoT format)
  value: string;       // Sensor reading (numeric as string)
  time: string;        // ISO8601 timestamp
}
```

### BACnet Data

BACnet protocol-specific metadata.

```typescript
interface BACnetData {
  device_address: string;      // IP address
  device_id: number;           // BACnet device ID
  object_type: string;         // BACnet object type
  object_index: number;        // BACnet object instance
  object_name: string;         // Object name
  device_name: string;         // Device name
  object_description: string;  // Human-readable description
  device_description: string;  // Device description
  scrape_interval: number;     // Polling interval (seconds)
  scrape_enabled: boolean;     // Whether polling is active
  present_value: string;       // Last known value
  [key: string]: any;         // Additional fields
}
```

### Site

Facility/building information.

```typescript
interface Site {
  id: number;                  // Unique site ID
  name: string;                // Site path identifier
  client: string;              // Client organization
  address: string;             // Physical address
  nice_name: string;           // Display name
  ansible_user?: string;       // Deployment user
  vtron_user?: string;         // Volttron user
  vtron_ip?: string;           // Volttron IP
  geo_location: string;        // Geographic location
  mqtt_prefix: string;         // MQTT topic prefix
  latitude: number;            // GPS latitude
  longitude: number;           // GPS longitude
  archived: boolean;           // Archive status
}
```

### Point

Configured data collection point.

```typescript
interface Point {
  id: number;                  // Unique point ID
  name: string;                // Full hierarchical path
  client: string;              // Client identifier
  site: string;                // Site identifier
  kv_tags: Record<string, string>;  // Key-value metadata
  bacnet_data?: BACnetData;    // BACnet-specific data
  marker_tags: string[];       // Categorical tags
  collect_config: object;      // Protocol-specific config
  point_type: string;          // Collection protocol
  collect_enabled: boolean;    // Collection status
  collect_interval: number;    // Collection interval (seconds)
  updated: string;             // Last update (ISO8601)
  created: string;             // Creation date (ISO8601)
}
```

### Paginated Response

Generic pagination wrapper.

```typescript
interface PaginatedResponse<T> {
  page: number;                // Current page number
  pages: number;               // Total pages
  per_page: number;            // Items per page
  total: number;               // Total items
  items: T[];                  // Page data
}
```

### Timeseries Paginated Response

Cursor-based pagination for timeseries.

```typescript
interface TimeseriesPaginatedResponse {
  point_samples: PointSample[];  // Data samples
  next_cursor?: string;          // Next page cursor
  has_more: boolean;             // More data available
}
```

---

## Best Practices

### 1. Use Paginated Endpoint for Large Queries

✅ **DO:**
```javascript
// Use /timeseries/paginated with cursor pagination
const url = `${API_BASE}/sites/${site}/timeseries/paginated`;
// Handle cursor-based pagination
```

❌ **DON'T:**
```javascript
// Use /timeseries for large datasets
const url = `${API_BASE}/sites/${site}/timeseries`;
```

### 2. Request Raw Data

✅ **DO:**
```javascript
url.searchParams.set('raw_data', 'true');
```

❌ **DON'T:**
```javascript
// Omit raw_data (defaults to 5-minute aggregation)
```

### 3. Use Maximum Page Size

✅ **DO:**
```javascript
url.searchParams.set('page_size', '100000');  // Minimize API calls
```

❌ **DON'T:**
```javascript
url.searchParams.set('page_size', '100');  // Many API calls
```

### 4. Use Full Point Names

✅ **DO:**
```javascript
const pointName = 'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.AHUDampers.points.Exhaust_Damper';
```

❌ **DON'T:**
```javascript
const pointName = 'Exhaust_Damper';  // Too short, won't match
```

### 5. Handle Pagination Properly

✅ **DO:**
```javascript
do {
  const data = await fetchPage(cursor);
  allSamples.push(...data.point_samples);
  cursor = data.next_cursor;
} while (data.has_more && cursor);
```

❌ **DON'T:**
```javascript
// Assume single page response
const data = await fetchPage();
return data.point_samples;
```

---

## Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 401 | Unauthorized | Check API key is valid and not expired |
| 404 | Not Found | Verify site name and endpoint path |
| 422 | Validation Error | Check parameter formats and types |
| 500 | Server Error | Retry with exponential backoff |
| 503 | Service Unavailable | Wait and retry |

---

## Rate Limits

- No documented rate limits as of Oct 2025
- Recommend implementing client-side rate limiting (10 req/sec)
- Use cursor pagination to minimize total API calls

---

## Support

**ACE IoT API Issues:**
- Contact ACE IoT support for API-specific questions
- Report data resolution issues (e.g., raw_data=true returning 5-min data)

**Building Vitals Integration:**
- See STORAGE_STATUS.md for ETL worker status
- See QUERY_EXAMPLES.md for working query examples
