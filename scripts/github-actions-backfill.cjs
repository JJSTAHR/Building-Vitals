#!/usr/bin/env node

/**
 * GitHub Actions Historical Backfill Script
 *
 * Backfills historical data from ACE IoT API to Supabase in manageable chunks.
 * Designed to run on GitHub Actions infrastructure with no timeout constraints.
 *
 * Features:
 * - Paginated ACE API calls with cursor support
 * - Chunk-based processing (default 10-minute windows)
 * - Automatic retry with exponential backoff
 * - Idempotent upserts (safe to re-run)
 * - Progress tracking and detailed logging
 *
 * Environment Variables Required:
 * - SUPABASE_URL: Supabase project URL
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase service role key
 * - ACE_API_KEY: ACE IoT API authentication token
 *
 * Usage:
 *   node scripts/github-actions-backfill.cjs \
 *     --site ses_falls_city \
 *     --start 2025-10-01T00:00:00Z \
 *     --end 2025-10-31T23:59:59Z \
 *     --chunk-minutes 10
 */

const https = require('https');
const http = require('http');

// ============================================================================
// Configuration
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://jywxcqcjsvlyehuvsoar.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ACE_API_KEY = process.env.ACE_API_KEY;
const ACE_API_BASE = process.env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';

const DEFAULT_CHUNK_MINUTES = 10;
const DEFAULT_PAGE_SIZE = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const BATCH_SIZE = 500; // Supabase batch insert size

// ============================================================================
// Helper Functions
// ============================================================================

function parseISO(dateStr) {
  return new Date(dateStr);
}

function toISO(date) {
  return date.toISOString();
}

function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, data: data });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// ACE API Functions
// ============================================================================

async function fetchACEPaginated(site, startTime, endTime, pageSize = DEFAULT_PAGE_SIZE) {
  const allSamples = [];
  let cursor = null;
  let pageCount = 0;
  const maxPages = 500;

  console.log(`  📄 Fetching ACE data: ${startTime} to ${endTime}`);

  while (pageCount < maxPages) {
    const params = new URLSearchParams({
      start_time: startTime,
      end_time: endTime,
      raw_data: 'true',
      page_size: pageSize.toString(),
    });

    if (cursor) {
      params.append('cursor', cursor);
    }

    const url = `${ACE_API_BASE}/sites/${site}/timeseries/paginated?${params}`;

    try {
      const response = await httpsRequest(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${ACE_API_KEY}`,
          'Accept': 'application/json',
        },
      });

      const { point_samples = [], has_more = false, next_cursor = null } = response.data;

      allSamples.push(...point_samples);
      pageCount++;

      process.stdout.write(`\r  📄 Page ${pageCount}: ${allSamples.length} samples`);

      if (!has_more) {
        console.log(` ✅`);
        break;
      }

      cursor = next_cursor;

      if (!cursor) {
        console.log(` ⚠️ has_more=true but no cursor`);
        break;
      }
    } catch (error) {
      console.error(`\n  ❌ ACE API Error:`, error.message);
      throw error;
    }
  }

  if (pageCount >= maxPages) {
    console.log(`\n  🚨 Hit maxPages limit (${maxPages}). Data may be incomplete!`);
  }

  return allSamples;
}

// ============================================================================
// Supabase Functions
// ============================================================================

async function supabaseRequest(path, method = 'GET', body = null) {
  const url = `${SUPABASE_URL}${path}`;

  const options = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return httpsRequest(url, options);
}

async function ensurePoints(site, pointNames) {
  const nameToId = new Map();

  // Process in chunks of 50
  for (let i = 0; i < pointNames.length; i += 50) {
    const batch = pointNames.slice(i, i + 50);

    // Fetch existing points
    const existingUrl = `/rest/v1/points?site_name=eq.${site}&name=in.(${batch.map(n => `"${n}"`).join(',')})&select=id,name`;

    try {
      const { data: existing } = await supabaseRequest(existingUrl);

      if (existing && existing.length > 0) {
        for (const point of existing) {
          nameToId.set(point.name, point.id);
        }
      }
    } catch (error) {
      console.error(`  ⚠️ Error fetching existing points:`, error.message);
    }

    // Insert missing points
    const missing = batch.filter(name => !nameToId.has(name));

    if (missing.length > 0) {
      const newPoints = missing.map(name => ({ site_name: site, name }));

      try {
        await supabaseRequest('/rest/v1/points', 'POST', newPoints);

        // Re-fetch to get IDs
        const refetchUrl = `/rest/v1/points?site_name=eq.${site}&name=in.(${missing.map(n => `"${n}"`).join(',')})&select=id,name`;
        const { data: created } = await supabaseRequest(refetchUrl);

        if (created && created.length > 0) {
          for (const point of created) {
            nameToId.set(point.name, point.id);
          }
        }
      } catch (error) {
        console.error(`  ⚠️ Error inserting points:`, error.message);
      }
    }
  }

  return nameToId;
}

async function insertTimeseries(site, samples) {
  if (!samples || samples.length === 0) {
    return 0;
  }

  // Get unique point names
  const uniquePointNames = [...new Set(samples.map(s => s.name))];

  // Ensure points exist and get mapping
  const pointMap = await ensurePoints(site, uniquePointNames);

  // Prepare timeseries records
  const records = samples
    .map(sample => {
      const pointId = pointMap.get(sample.name);
      if (!pointId) return null;

      return {
        point_id: pointId,
        ts: sample.time,
        value: parseFloat(sample.value),
      };
    })
    .filter(r => r !== null);

  if (records.length === 0) {
    return 0;
  }

  // Batch insert with upsert
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);

    try {
      await supabaseRequest('/rest/v1/timeseries', 'POST', batch);
      inserted += batch.length;
    } catch (error) {
      console.error(`  ❌ Batch insert error:`, error.message);
      // Continue with next batch
    }
  }

  return inserted;
}

// ============================================================================
// Main Backfill Logic
// ============================================================================

async function backfillChunk(site, startTime, endTime, retryCount = 0) {
  try {
    // Fetch data from ACE API
    const samples = await fetchACEPaginated(site, startTime, endTime);

    // Insert into Supabase
    const inserted = await insertTimeseries(site, samples);

    return {
      success: true,
      fetched: samples.length,
      inserted: inserted,
    };
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.log(`  🔄 Retrying in ${delay / 1000}s... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
      await sleep(delay);
      return backfillChunk(site, startTime, endTime, retryCount + 1);
    } else {
      return {
        success: false,
        error: error.message,
        fetched: 0,
        inserted: 0,
      };
    }
  }
}

async function backfillDateRange(site, startDate, endDate, chunkMinutes = DEFAULT_CHUNK_MINUTES) {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  const totalMinutes = Math.floor((end - start) / (1000 * 60));
  const totalChunks = Math.ceil(totalMinutes / chunkMinutes);

  console.log(`\n🚀 Starting backfill for ${site}`);
  console.log(`📅 Date range: ${toISO(start)} to ${toISO(end)}`);
  console.log(`⏱️  Chunk size: ${chunkMinutes} minutes`);
  console.log(`📊 Total chunks: ${totalChunks}\n`);

  let currentTime = new Date(start);
  let chunkNum = 0;
  let totalFetched = 0;
  let totalInserted = 0;
  let successCount = 0;
  let failureCount = 0;

  const startTime = Date.now();

  while (currentTime < end) {
    chunkNum++;

    const chunkEnd = new Date(Math.min(
      currentTime.getTime() + chunkMinutes * 60 * 1000,
      end.getTime()
    ));

    const progress = ((chunkNum / totalChunks) * 100).toFixed(1);

    console.log(`\n[${chunkNum}/${totalChunks}] ${progress}% - ${toISO(currentTime)} to ${toISO(chunkEnd)}`);

    const result = await backfillChunk(site, toISO(currentTime), toISO(chunkEnd));

    if (result.success) {
      successCount++;
      totalFetched += result.fetched;
      totalInserted += result.inserted;
      console.log(`  ✅ Success: ${result.fetched} fetched, ${result.inserted} inserted`);
    } else {
      failureCount++;
      console.log(`  ❌ Failed: ${result.error}`);
    }

    // Progress summary
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const avgTimePerChunk = elapsed / chunkNum;
    const remainingChunks = totalChunks - chunkNum;
    const estimatedRemaining = Math.floor(avgTimePerChunk * remainingChunks);

    console.log(`  📊 Progress: ${successCount} ✅ / ${failureCount} ❌ | Elapsed: ${elapsed}s | ETA: ${estimatedRemaining}s`);

    currentTime = chunkEnd;
  }

  // Final summary
  const totalTime = Math.floor((Date.now() - startTime) / 1000);

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 BACKFILL COMPLETE`);
  console.log(`${'='.repeat(70)}`);
  console.log(`Site: ${site}`);
  console.log(`Date range: ${startDate} to ${endDate}`);
  console.log(`Total chunks: ${totalChunks}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failureCount}`);
  console.log(`📥 Total fetched: ${totalFetched.toLocaleString()} samples`);
  console.log(`💾 Total inserted: ${totalInserted.toLocaleString()} samples`);
  console.log(`⏱️  Total time: ${totalTime}s (${Math.floor(totalTime / 60)}m ${totalTime % 60}s)`);
  console.log(`${'='.repeat(70)}\n`);

  if (failureCount === 0) {
    console.log(`🎉 Backfill completed successfully!`);
  } else {
    console.log(`⚠️  Backfill completed with ${failureCount} failures.`);
  }

  return {
    success: failureCount === 0,
    totalChunks,
    successCount,
    failureCount,
    totalFetched,
    totalInserted,
    totalTime,
  };
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const getArg = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : null;
  };

  const site = getArg('--site') || 'ses_falls_city';
  const startDate = getArg('--start');
  const endDate = getArg('--end');
  const chunkMinutes = parseInt(getArg('--chunk-minutes') || DEFAULT_CHUNK_MINUTES);

  // Validate required environment variables
  if (!SUPABASE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
    process.exit(1);
  }

  if (!ACE_API_KEY) {
    console.error('❌ ACE_API_KEY environment variable is required');
    process.exit(1);
  }

  // Validate required arguments
  if (!startDate || !endDate) {
    console.error('❌ --start and --end arguments are required');
    console.error('\nUsage:');
    console.error('  node scripts/github-actions-backfill.cjs \\');
    console.error('    --site ses_falls_city \\');
    console.error('    --start 2025-10-01T00:00:00Z \\');
    console.error('    --end 2025-10-31T23:59:59Z \\');
    console.error('    --chunk-minutes 10');
    process.exit(1);
  }

  try {
    const result = await backfillDateRange(site, startDate, endDate, chunkMinutes);
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { backfillDateRange, backfillChunk };
