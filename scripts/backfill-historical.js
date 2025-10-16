#!/usr/bin/env node

/**
 * Historical Data Backfill Script
 *
 * Fetches 1 year of historical data from ACE IoT API and stores directly in R2 as Parquet files.
 * Bypasses D1 for historical data to optimize storage and query performance.
 *
 * Features:
 * - Month-by-month processing to avoid timeouts
 * - Idempotent (skips existing months)
 * - Resume capability if interrupted
 * - Progress tracking with ETAs
 * - Rate limit handling with exponential backoff
 *
 * Usage:
 *   node scripts/backfill-historical.js --env production
 *   node scripts/backfill-historical.js --start-month 2024-01 --end-month 2024-12
 */

import { parseArgs } from 'node:util';
import { readFileSync } from 'node:fs';

// Configuration
const POINTS_PER_REQUEST = 10; // Batch points to reduce API calls
const RETRY_MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 1000;
const PROGRESS_UPDATE_INTERVAL = 1; // % progress

class HistoricalBackfill {
  constructor(config) {
    this.aceApiUrl = config.aceApiUrl;
    this.aceApiKey = config.aceApiKey;
    this.r2Bucket = config.r2Bucket;
    this.points = config.points || [];
    this.startDate = config.startDate;
    this.endDate = config.endDate;

    this.stats = {
      monthsProcessed: 0,
      monthsSkipped: 0,
      totalMonths: 0,
      startTime: Date.now(),
      dataPointsProcessed: 0,
      bytesWritten: 0,
      errors: []
    };
  }

  /**
   * Generate array of months between start and end dates
   */
  generateMonthRange() {
    const months = [];
    const current = new Date(this.startDate);
    const end = new Date(this.endDate);

    while (current <= end) {
      months.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        key: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`
      });
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  /**
   * Check if R2 file exists for a given month/point
   */
  async checkR2FileExists(year, month, pointId) {
    try {
      const key = `timeseries/${year}/${String(month).padStart(2, '0')}/${pointId}.parquet`;
      const response = await fetch(`${this.r2Bucket}/${key}`, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Fetch data from ACE API with retry and rate limiting
   */
  async fetchACEData(pointIds, startDate, endDate, attempt = 1) {
    const url = new URL(`${this.aceApiUrl}/timeseries/query`);

    const body = {
      points: pointIds,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      resolution: '15min' // 15-minute intervals
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.aceApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      if (response.status === 429) {
        // Rate limited - exponential backoff
        if (attempt >= RETRY_MAX_ATTEMPTS) {
          throw new Error(`Rate limit exceeded after ${RETRY_MAX_ATTEMPTS} attempts`);
        }

        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Rate limited. Waiting ${delay}ms before retry ${attempt}/${RETRY_MAX_ATTEMPTS}...`);
        await this.sleep(delay);
        return this.fetchACEData(pointIds, startDate, endDate, attempt + 1);
      }

      if (!response.ok) {
        throw new Error(`ACE API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt < RETRY_MAX_ATTEMPTS) {
        const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.log(`Request failed. Retrying in ${delay}ms (${attempt}/${RETRY_MAX_ATTEMPTS})...`);
        await this.sleep(delay);
        return this.fetchACEData(pointIds, startDate, endDate, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Convert JSON data to Parquet format
   * Using parquetjs library for Node.js
   */
  async convertToParquet(data, pointId) {
    const parquet = await import('parquetjs');

    const schema = new parquet.ParquetSchema({
      timestamp: { type: 'TIMESTAMP_MILLIS' },
      value: { type: 'DOUBLE' },
      quality: { type: 'INT32', optional: true }
    });

    const writer = await parquet.ParquetWriter.openStream(schema);

    for (const record of data) {
      await writer.appendRow({
        timestamp: new Date(record.timestamp).getTime(),
        value: parseFloat(record.value),
        quality: record.quality || 0
      });
    }

    await writer.close();
    return writer.outputStream;
  }

  /**
   * Upload Parquet file to R2
   */
  async uploadToR2(year, month, pointId, parquetData) {
    const key = `timeseries/${year}/${String(month).padStart(2, '0')}/${pointId}.parquet`;

    // This is a placeholder - in production, use Cloudflare Workers or AWS SDK
    // For local testing, you might use wrangler or direct S3-compatible API
    const response = await fetch(`${this.r2Bucket}/${key}`, {
      method: 'PUT',
      body: parquetData,
      headers: {
        'Content-Type': 'application/octet-stream'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to upload to R2: ${response.status} ${response.statusText}`);
    }

    return key;
  }

  /**
   * Process a single month for a batch of points
   */
  async processMonth(year, month, pointIds) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    console.log(`\nProcessing ${year}-${String(month).padStart(2, '0')} for ${pointIds.length} points...`);

    // Check which points already have data
    const existingPoints = await Promise.all(
      pointIds.map(async (pointId) => ({
        pointId,
        exists: await this.checkR2FileExists(year, month, pointId)
      }))
    );

    const pointsToProcess = existingPoints
      .filter(p => !p.exists)
      .map(p => p.pointId);

    const skippedCount = pointIds.length - pointsToProcess.length;
    if (skippedCount > 0) {
      console.log(`  Skipping ${skippedCount} points (already exist)`);
      this.stats.monthsSkipped += skippedCount;
    }

    if (pointsToProcess.length === 0) {
      console.log(`  All points already processed for this month`);
      return;
    }

    // Fetch data from ACE API
    console.log(`  Fetching data for ${pointsToProcess.length} points...`);
    const data = await this.fetchACEData(pointsToProcess, startDate, endDate);

    // Process each point's data
    for (const pointId of pointsToProcess) {
      const pointData = data.points[pointId] || [];

      if (pointData.length === 0) {
        console.log(`  No data found for point ${pointId}`);
        continue;
      }

      // Convert to Parquet
      const parquetData = await this.convertToParquet(pointData, pointId);

      // Upload to R2
      const key = await this.uploadToR2(year, month, pointId, parquetData);

      this.stats.dataPointsProcessed += pointData.length;
      this.stats.bytesWritten += parquetData.length;

      console.log(`  Uploaded ${pointData.length} records to ${key}`);
    }

    this.stats.monthsProcessed += pointsToProcess.length;
  }

  /**
   * Calculate and display progress
   */
  displayProgress() {
    const elapsed = Date.now() - this.stats.startTime;
    const processed = this.stats.monthsProcessed;
    const total = this.stats.totalMonths;
    const percent = ((processed / total) * 100).toFixed(1);

    const rate = processed / (elapsed / 1000); // months per second
    const remaining = total - processed;
    const eta = remaining / rate;

    const formatTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const mins = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${mins}m`;
    };

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Progress: ${percent}% (${processed}/${total} point-months)`);
    console.log(`Elapsed: ${formatTime(elapsed / 1000)}`);
    console.log(`ETA: ${formatTime(eta)}`);
    console.log(`Rate: ${(rate * 3600).toFixed(1)} point-months/hour`);
    console.log(`Data points: ${this.stats.dataPointsProcessed.toLocaleString()}`);
    console.log(`Data written: ${(this.stats.bytesWritten / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Skipped: ${this.stats.monthsSkipped} (already exist)`);
    console.log(`Errors: ${this.stats.errors.length}`);
    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Main execution
   */
  async run() {
    console.log('Historical Data Backfill Starting...');
    console.log(`Date range: ${this.startDate.toISOString()} to ${this.endDate.toISOString()}`);
    console.log(`Points: ${this.points.length}`);

    const months = this.generateMonthRange();
    this.stats.totalMonths = months.length * this.points.length;

    console.log(`Total point-months to process: ${this.stats.totalMonths}`);

    let lastProgressPercent = 0;

    // Process month by month
    for (const monthInfo of months) {
      // Process points in batches to avoid overwhelming the API
      for (let i = 0; i < this.points.length; i += POINTS_PER_REQUEST) {
        const batch = this.points.slice(i, i + POINTS_PER_REQUEST);

        try {
          await this.processMonth(monthInfo.year, monthInfo.month, batch);
        } catch (error) {
          console.error(`Error processing ${monthInfo.key}:`, error);
          this.stats.errors.push({
            month: monthInfo.key,
            error: error.message
          });
        }

        // Display progress at intervals
        const currentPercent = Math.floor((this.stats.monthsProcessed / this.stats.totalMonths) * 100);
        if (currentPercent >= lastProgressPercent + PROGRESS_UPDATE_INTERVAL) {
          this.displayProgress();
          lastProgressPercent = currentPercent;
        }
      }
    }

    // Final report
    console.log('\n\nBackfill Complete!');
    this.displayProgress();

    if (this.stats.errors.length > 0) {
      console.log('\nErrors encountered:');
      this.stats.errors.forEach(err => {
        console.log(`  ${err.month}: ${err.error}`);
      });
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// CLI Entry Point
async function main() {
  const { values } = parseArgs({
    options: {
      env: { type: 'string', default: 'development' },
      'start-month': { type: 'string' },
      'end-month': { type: 'string' },
      config: { type: 'string', default: './wrangler.toml' }
    }
  });

  // Default to 1 year ago to 1 month ago
  const now = new Date();
  const startDate = values['start-month']
    ? new Date(values['start-month'])
    : new Date(now.getFullYear() - 1, now.getMonth(), 1);

  const endDate = values['end-month']
    ? new Date(values['end-month'])
    : new Date(now.getFullYear(), now.getMonth() - 1, 0);

  // Load configuration
  // In production, read from wrangler.toml or environment variables
  const config = {
    aceApiUrl: process.env.ACE_API_URL || 'https://api.ace-iot.com',
    aceApiKey: process.env.ACE_API_KEY,
    r2Bucket: process.env.R2_BUCKET_URL,
    startDate,
    endDate,
    // List of point IDs to backfill
    points: [
      'point-001', 'point-002', 'point-003', 'point-004', 'point-005',
      'point-006', 'point-007', 'point-008', 'point-009', 'point-010'
      // Add all your point IDs here
    ]
  };

  if (!config.aceApiKey) {
    console.error('Error: ACE_API_KEY environment variable is required');
    process.exit(1);
  }

  if (!config.r2Bucket) {
    console.error('Error: R2_BUCKET_URL environment variable is required');
    process.exit(1);
  }

  const backfill = new HistoricalBackfill(config);
  await backfill.run();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { HistoricalBackfill };
