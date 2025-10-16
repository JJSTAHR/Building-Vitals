# Working Query Examples for Building Vitals

## ✅ Verified Working Queries

These examples use **actual point names** from your D1 database and have been tested successfully.

## Query Endpoint

```
https://building-vitals-query.jstahr.workers.dev/timeseries/query
```

## Example 1: Weather Data (Last Hour)

```javascript
const now = Date.now();
const oneHourAgo = now - (60 * 60 * 1000);

const url = new URL('https://building-vitals-query.jstahr.workers.dev/timeseries/query');
url.searchParams.set('site_name', 'ses_falls_city');
url.searchParams.set('point_names', 'ses/ses_falls_city/weather/temp,ses/ses_falls_city/weather/humidity');
url.searchParams.set('start_time', oneHourAgo.toString());
url.searchParams.set('end_time', now.toString());

const response = await fetch(url.toString());
const data = await response.json();
console.log(data.samples);
```

## Example 2: AHU Dampers (Last 24 Hours)

```javascript
const now = Date.now();
const oneDayAgo = now - (24 * 60 * 60 * 1000);

const pointNames = [
  'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.AHUDampers.points.Exhaust_Damper',
  'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.AHUDampers.points.Outside_Damper',
  'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.AHUDampers.points.Return_Damper'
];

const url = new URL('https://building-vitals-query.jstahr.workers.dev/timeseries/query');
url.searchParams.set('site_name', 'ses_falls_city');
url.searchParams.set('point_names', pointNames.join(','));
url.searchParams.set('start_time', oneDayAgo.toString());
url.searchParams.set('end_time', now.toString());

const response = await fetch(url.toString());
const data = await response.json();
console.log(data.samples);
```

## Example 3: Chiller Data (Last Week)

```javascript
const now = Date.now();
const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);

const pointNames = [
  'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.SurgeryChiller.points.Capacity',
  'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.SurgeryChiller.points.ChillerPump_Speed',
  'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.SurgeryChiller.points.CondTemp',
  'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork1.SurgeryChiller.points.CondPress'
];

const url = new URL('https://building-vitals-query.jstahr.workers.dev/timeseries/query');
url.searchParams.set('site_name', 'ses_falls_city');
url.searchParams.set('point_names', pointNames.join(','));
url.searchParams.set('start_time', oneWeekAgo.toString());
url.searchParams.set('end_time', now.toString());

const response = await fetch(url.toString());
const data = await response.json();
console.log(data.samples);
```

## Example 4: CURL Command (Testing)

```bash
# Get weather data for last hour
curl "https://building-vitals-query.jstahr.workers.dev/timeseries/query?\
site_name=ses_falls_city&\
point_names=ses/ses_falls_city/weather/temp&\
start_time=$(($(date +%s)000 - 3600000))&\
end_time=$(($(date +%s)000))"
```

## Response Format

All queries return data in this format:

```json
{
  "samples": [
    {
      "point_name": "ses/ses_falls_city/weather/temp",
      "timestamp": 1760583640000,
      "value": 20.94
    },
    {
      "point_name": "ses/ses_falls_city/weather/humidity",
      "timestamp": 1760583640000,
      "value": 73
    }
  ]
}
```

## Important Notes

### ⚠️ Point Name Requirements
- **MUST** use full ACE IoT path format
- Point names are case-sensitive
- Use exact names as stored in D1

### ⏰ Timestamp Format
- Query parameters: Unix milliseconds (e.g., `1760583640000`)
- Response timestamps: Unix milliseconds
- Data resolution: 5-minute intervals (ACE API limitation)

### 📊 Available Point Names

To find available point names, query D1:
```bash
npx wrangler d1 execute DB --config workers/wrangler-etl.toml --env production --remote --command="SELECT DISTINCT point_name FROM timeseries_raw LIMIT 100"
```

## Common Patterns

### Get All Weather Points
```javascript
const weatherPoints = [
  'ses/ses_falls_city/weather/temp',
  'ses/ses_falls_city/weather/humidity',
  'ses/ses_falls_city/weather/pressure',
  'ses/ses_falls_city/weather/dew_point',
  'ses/ses_falls_city/weather/feels_like'
];
```

### Get Points for Specific Equipment
```javascript
// Pattern: ses/ses_falls_city/[IP]/n4/FallsCity_CMC/C.Drivers.[Network].[Equipment].points.[Point]
// Example for VAV_707:
const vavPoints = [
  'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork3.VAV_707.points.Damper',
  'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork3.VAV_707.points.Airflow',
  'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork3.VAV_707.points.AirflowSetpt'
];
```

## Data Availability

- **Start Date:** September 16, 2025 (when paginated endpoint was created)
- **Current Data:** ~135,913 samples across all points (actively growing)
- **Latest Data:** Within last 5 minutes (real-time collection)
- **Resolution:** 5-minute intervals
- **Coverage:** Equipment points + weather data (4,583 configured points)
- **Storage:** D1 (< 20 days), R2 (> 20 days)

## Troubleshooting

### No Data Returned

1. **Check point name format** - Must be exact full path
2. **Verify time range** - Data only exists since Sept 16, 2025
3. **Check site name** - Must be `ses_falls_city`
4. **Confirm timestamp format** - Milliseconds, not seconds

### Wrong Time Range

```javascript
// ❌ Wrong (seconds):
start_time: 1760583640

// ✅ Correct (milliseconds):
start_time: 1760583640000
```

### Point Not Found

```bash
# List available points matching a pattern
npx wrangler d1 execute DB --config workers/wrangler-etl.toml --env production --remote --command="SELECT DISTINCT point_name FROM timeseries_raw WHERE point_name LIKE '%VAV_707%'"
```
