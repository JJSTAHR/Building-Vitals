# Building Vitals Scripts

Utility scripts for infrastructure setup and historical data backfill.

## Quick Start

### 1. Infrastructure Setup

Set up Cloudflare D1 and R2 infrastructure:

```bash
# Make setup script executable
chmod +x setup-infrastructure.sh

# Run setup (creates D1 database and R2 bucket)
./setup-infrastructure.sh production
```

### 2. Configure Environment

Copy and configure environment variables:

```bash
cp .env.example .env
# Edit .env with your ACE API credentials and Cloudflare settings
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Historical Backfill

Backfill 1 year of historical data:

```bash
# Using npm script
npm run backfill:production

# Or directly
node backfill-historical.js --env production
```

## Scripts

### setup-infrastructure.sh

Creates and configures Cloudflare infrastructure:
- D1 database for metadata and recent timeseries
- R2 bucket for historical data storage
- Runs database migrations
- Updates wrangler.toml configuration

**Usage:**
```bash
./setup-infrastructure.sh [environment]
```

**Options:**
- `environment` - Optional. Default: "production". Options: "staging", "production"

### backfill-historical.js

Fetches historical IoT data from ACE API and stores in R2 as Parquet files.

**Features:**
- Month-by-month processing (avoids timeouts)
- Idempotent (skips existing files)
- Resume capability if interrupted
- Progress tracking with ETAs
- Automatic rate limit handling
- Exponential backoff retry logic

**Usage:**
```bash
# Default: backfill last 12 months
node backfill-historical.js --env production

# Custom date range
node backfill-historical.js \
  --start-month 2023-01 \
  --end-month 2024-12 \
  --env production

# Using npm scripts
npm run backfill
npm run backfill:production
```

## Configuration

### Environment Variables

Required:
- `ACE_API_KEY` - Your ACE IoT API key
- `ACE_API_URL` - ACE API base URL
- `R2_BUCKET_URL` - Cloudflare R2 bucket URL

Optional:
- `BACKFILL_BATCH_SIZE` - Points per API request (default: 10)
- `BACKFILL_RETRY_ATTEMPTS` - Max retry attempts (default: 5)
- `BACKFILL_RETRY_DELAY_MS` - Base retry delay (default: 1000ms)

### Point IDs

Edit `backfill-historical.js` to configure which points to backfill:

```javascript
const config = {
  points: [
    'point-001', 'point-002', 'point-003',
    // Add your point IDs here
  ]
};
```

## Monitoring Progress

The backfill script displays real-time progress:

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

## Troubleshooting

### "Rate limit exceeded"
- The script automatically retries with exponential backoff
- If persistent, reduce `BACKFILL_BATCH_SIZE`
- Contact ACE API support for higher limits

### "R2 upload failed"
- Verify R2 bucket permissions in Cloudflare dashboard
- Check `R2_BUCKET_URL` is correct
- Ensure Cloudflare API token has R2 write permissions

### "No data found for point"
- Verify point ID exists in ACE API
- Check date range is within available data period
- Confirm API key has access to the point

### Resume Interrupted Backfill
Simply re-run the same command. The script will:
- Check R2 for existing files
- Skip completed months
- Continue from where it left off

## Performance

### Expected Speeds
- **Typical rate**: 200-300 point-months/hour
- **10 points, 1 year**: ~8-12 hours
- **100 points, 1 year**: ~80-120 hours

### Optimization Tips
1. Run during off-peak hours
2. Increase batch size if API supports it
3. Use a server close to ACE API datacenter
4. Run multiple processes for different point groups

## Storage Costs

### R2 Storage
- **Parquet compression**: ~80% reduction vs JSON
- **Typical**: 5-10 MB per point per year
- **100 points, 1 year**: ~0.5-1 GB
- **Cost**: $0.015/GB/month ≈ $0.01-0.02/month

## Documentation

- [Complete Backfill Guide](../docs/BACKFILL_GUIDE.md)
- [Infrastructure Overview](../docs/INFRASTRUCTURE.md)
- [API Documentation](../docs/API.md)

## Support

For issues:
1. Check script output logs
2. Review Cloudflare Workers logs
3. Verify ACE API status
4. Contact infrastructure team
