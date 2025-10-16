# Historical Data Backfill Guide

## Overview

The historical backfill system populates 1 year of historical IoT data from the ACE API directly into Cloudflare R2 storage, bypassing D1 for optimal query performance on large historical datasets.

## Architecture

```
ACE IoT API → Backfill Script → R2 (Parquet files)
                     ↓
            Progress Tracking & Resume
```

### Storage Strategy

- **Recent Data (30 days)**: D1 database for fast queries
- **Historical Data (1+ year)**: R2 Parquet files for cost-effective storage
- **File Organization**: `/timeseries/{year}/{month}/{point-id}.parquet`

## Prerequisites

1. **Cloudflare Infrastructure** (run setup script first):
   ```bash
   chmod +x scripts/setup-infrastructure.sh
   ./scripts/setup-infrastructure.sh production
   ```

2. **Environment Variables**:
   ```bash
   export ACE_API_KEY="your-ace-api-key"
   export ACE_API_URL="https://api.ace-iot.com"
   export R2_BUCKET_URL="https://your-bucket.r2.cloudflarestorage.com"
   ```

3. **Node.js Dependencies**:
   ```bash
   cd scripts
   npm install
   ```

## Usage

### Basic Backfill (1 year)

```bash
node scripts/backfill-historical.js --env production
```

This will:
- Fetch data from 12 months ago to 1 month ago
- Process month-by-month
- Skip already existing files
- Display progress with ETAs

### Custom Date Range

```bash
node scripts/backfill-historical.js \
  --start-month 2023-01 \
  --end-month 2024-12 \
  --env production
```

### Resume Interrupted Backfill

The script is idempotent - simply re-run the same command. It will:
- Check R2 for existing files
- Skip completed months
- Continue from where it left off

```bash
# If interrupted, just run again
node scripts/backfill-historical.js --env production
```

## Configuration

### Point IDs

Edit `scripts/backfill-historical.js` to specify which points to backfill:

```javascript
const config = {
  points: [
    'point-001', 'point-002', 'point-003',
    // Add all your point IDs here
  ]
};
```

### Batch Size

Adjust concurrent API requests in the script:

```javascript
const POINTS_PER_REQUEST = 10; // Process 10 points at a time
```

### Rate Limiting

The script automatically handles ACE API rate limits with exponential backoff:

```javascript
const RETRY_MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1000; // 1 second base delay
```

## Progress Tracking

### Real-time Progress

The script displays progress every 1% completion:

```
============================================================
Progress: 45.2% (542/1200 point-months)
Elapsed: 2h 15m
ETA: 2h 45m
Rate: 240.5 point-months/hour
Data points: 1,234,567
Data written: 456.78 MB
Skipped: 12 (already exist)
Errors: 0
============================================================
```

### Metrics

- **Point-months**: Number of point/month combinations processed
- **Data points**: Total individual readings stored
- **Data written**: Size of Parquet files uploaded
- **Skipped**: Files already in R2 (idempotent operation)
- **Errors**: Failed operations (logged for review)

## Error Handling

### Automatic Retries

- **Network errors**: 5 retry attempts with exponential backoff
- **Rate limits**: Automatic delay and retry
- **Partial failures**: Continue processing other points

### Error Log

Failed operations are logged in the final summary:

```
Errors encountered:
  2024-06: ACE API timeout for point-042
  2024-07: Failed to upload point-103.parquet
```

### Recovery

1. Review errors in the output
2. Fix any configuration issues
3. Re-run the script (it will skip completed months)

## Performance Expectations

### Processing Speed

- **Typical rate**: 200-300 point-months/hour
- **1 year, 10 points**: ~8-12 hours total
- **1 year, 100 points**: ~80-120 hours total

### Factors Affecting Speed

- ACE API rate limits
- Network bandwidth
- Parquet compression settings
- R2 upload speed
- Data density (readings per month)

### Optimization Tips

1. **Run during off-peak hours** to avoid API congestion
2. **Increase batch size** if your API supports it
3. **Run on a server** closer to ACE API datacenter
4. **Use multiple processes** for different point groups

## Storage Costs

### R2 Storage

- **Parquet compression**: ~80% reduction vs JSON
- **Typical usage**: 5-10 MB per point per year
- **100 points, 1 year**: ~0.5-1 GB total
- **Cost**: $0.015/GB/month = ~$0.01-0.02/month

### Data Transfer

- **Class A operations** (uploads): $4.50 per million
- **1 year, 100 points**: 1,200 uploads = $0.005
- **Negligible cost** for backfill

## Validation

### Verify Backfill Completion

```bash
# List R2 files
wrangler r2 object list building-vitals-storage \
  --prefix=timeseries/2024/

# Check file sizes
wrangler r2 object get building-vitals-storage \
  timeseries/2024/01/point-001.parquet \
  --file=/dev/null
```

### Query Test

Test that data is accessible via your API:

```bash
curl -X POST https://your-worker.workers.dev/api/timeseries/query \
  -H "Content-Type: application/json" \
  -d '{
    "pointIds": ["point-001"],
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-01-31T23:59:59Z"
  }'
```

### Data Quality Checks

1. **Record counts**: Verify expected number of readings
2. **Timestamp coverage**: Check for gaps in data
3. **Value ranges**: Ensure readings are within expected bounds

## Maintenance

### Regular Backfills

Set up a monthly cron job to backfill the previous month:

```bash
# Crontab entry - run on 1st of each month at 2am
0 2 1 * * cd /path/to/project && node scripts/backfill-historical.js \
  --start-month $(date -d "2 months ago" +\%Y-\%m) \
  --end-month $(date -d "1 month ago" +\%Y-\%m)
```

### Monitoring

Track backfill jobs:
- Success/failure status
- Duration and throughput
- Error rates
- Storage growth

### Troubleshooting

#### "Rate limit exceeded"
- Wait for rate limit to reset
- Reduce POINTS_PER_REQUEST
- Contact ACE API support for higher limits

#### "R2 upload failed"
- Check R2 bucket permissions
- Verify R2_BUCKET_URL is correct
- Check Cloudflare account status

#### "No data found for point"
- Verify point ID exists in ACE API
- Check date range is valid
- Confirm API key has access

## Advanced Usage

### Parallel Backfills

Run multiple backfill processes for different point groups:

```bash
# Terminal 1 - Points 1-50
node scripts/backfill-historical.js --points-file points-1-50.txt

# Terminal 2 - Points 51-100
node scripts/backfill-historical.js --points-file points-51-100.txt
```

### Custom Parquet Schema

Modify the schema in `convertToParquet()`:

```javascript
const schema = new parquet.ParquetSchema({
  timestamp: { type: 'TIMESTAMP_MILLIS' },
  value: { type: 'DOUBLE' },
  quality: { type: 'INT32', optional: true },
  // Add custom fields
  source: { type: 'UTF8', optional: true },
  metadata: { type: 'UTF8', optional: true }
});
```

### Integration with Data Pipeline

Extend the script to:
- Send notifications on completion
- Update metadata database
- Trigger downstream analytics
- Generate data quality reports

## Support

For issues or questions:
- Check logs in script output
- Review Cloudflare Workers logs
- Verify ACE API status
- Contact infrastructure team

## Related Documentation

- [Infrastructure Setup](./INFRASTRUCTURE.md)
- [API Documentation](./API.md)
- [Querying Historical Data](./QUERYING.md)
