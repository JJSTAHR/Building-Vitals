#!/usr/bin/env node
/**
 * Sync Flightdeck API data to Supabase
 * Used by GitHub Actions for hourly sync and backfill
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SITE_ID = process.env.SITE_ID || 'ses_falls_city';
const FLIGHTDECK_TOKEN = process.env.FLIGHTDECK_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Date range (from CLI args or default to last hour)
const START_TIME = process.argv[2] || new Date(Date.now() - 60 * 60 * 1000).toISOString();
const END_TIME = process.argv[3] || new Date().toISOString();

// Validate required environment variables
if (!FLIGHTDECK_TOKEN) {
  console.error('❌ Error: FLIGHTDECK_TOKEN environment variable is required');
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Generate consistent integer ID from point name
 */
function hashPointName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    const char = name.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Fetch data from Flightdeck API with pagination
 */
async function fetchFromFlightdeck(siteId, startTime, endTime) {
  const url = new URL(`https://flightdeck.aceiot.cloud/api/sites/${siteId}/timeseries/paginated`);
  url.searchParams.set('start_time', startTime);
  url.searchParams.set('end_time', endTime);
  url.searchParams.set('page_size', '1000');
  url.searchParams.set('raw_data', 'true');

  console.log(`🔍 Fetching data from Flightdeck...`);
  console.log(`   Site: ${siteId}`);
  console.log(`   Start: ${startTime}`);
  console.log(`   End: ${endTime}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${FLIGHTDECK_TOKEN}`,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Flightdeck API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  if (!data.point_samples || !Array.isArray(data.point_samples)) {
    throw new Error('Invalid API response: missing point_samples array');
  }

  console.log(`✅ Fetched ${data.point_samples.length} records from Flightdeck`);
  return data.point_samples;
}

/**
 * Insert data into Supabase timeseries table
 * Uses upsert to handle duplicates
 */
async function insertToSupabase(records) {
  if (records.length === 0) {
    console.log('ℹ️  No records to insert');
    return { inserted: 0, updated: 0 };
  }

  console.log(`📝 Inserting ${records.length} records to Supabase...`);

  // Transform records to match database schema
  // API returns: {name: string, value: string, time: string}
  // DB expects: {point_id: integer, ts: timestamptz, value: double precision}
  const transformedRecords = records.map(record => ({
    point_id: hashPointName(record.name),
    ts: record.time,
    value: parseFloat(record.value) || 0
  }));

  // Batch insert with upsert (handles duplicates)
  const BATCH_SIZE = 500;
  let totalInserted = 0;
  let totalUpdated = 0;

  for (let i = 0; i < transformedRecords.length; i += BATCH_SIZE) {
    const batch = transformedRecords.slice(i, i + BATCH_SIZE);

    const { data, error } = await supabase
      .from('timeseries')
      .upsert(batch, {
        onConflict: 'point_id,ts',
        ignoreDuplicates: false
      });

    if (error) {
      console.error(`❌ Batch insert error (batch ${Math.floor(i / BATCH_SIZE) + 1}):`, error);
      throw error;
    }

    totalInserted += batch.length;
    console.log(`   ✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records`);
  }

  console.log(`✅ Successfully processed ${totalInserted} records`);
  return { inserted: totalInserted, updated: 0 };
}

/**
 * Update sync_state table with last sync info
 */
async function updateSyncState(siteId, lastTs, recordsSynced) {
  const source = `flightdeck:${siteId}`;

  console.log(`📊 Updating sync state for ${source}...`);

  // Check if sync_state table exists
  const { data: tableCheck, error: tableError } = await supabase
    .from('sync_state')
    .select('source')
    .limit(1);

  if (tableError && tableError.code === '42P01') {
    console.log('⚠️  sync_state table does not exist, skipping state update');
    return;
  }

  // Upsert sync state
  const { error } = await supabase
    .from('sync_state')
    .upsert({
      source,
      last_ts: lastTs,
      last_sync_at: new Date().toISOString(),
      records_synced: recordsSynced,
      errors_count: 0,
      last_error: null
    }, {
      onConflict: 'source'
    });

  if (error) {
    console.warn('⚠️  Warning: Could not update sync_state:', error.message);
  } else {
    console.log(`✅ Updated sync state: last_ts=${lastTs}`);
  }
}

/**
 * Main sync function
 */
async function main() {
  const startTime = Date.now();
  console.log('\n==============================================');
  console.log('🚀 Flightdeck → Supabase Sync');
  console.log('==============================================\n');

  try {
    // 1. Fetch from Flightdeck API
    const records = await fetchFromFlightdeck(SITE_ID, START_TIME, END_TIME);

    // 2. Insert to Supabase
    const result = await insertToSupabase(records);

    // 3. Update sync state
    if (records.length > 0) {
      const lastTs = records.reduce((latest, record) => {
        return record.ts > latest ? record.ts : latest;
      }, records[0].ts);

      await updateSyncState(SITE_ID, lastTs, records.length);
    }

    // 4. Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n==============================================');
    console.log('✅ Sync Complete');
    console.log('==============================================');
    console.log(`   Records: ${result.inserted}`);
    console.log(`   Duration: ${duration}s`);
    console.log(`   Time Range: ${START_TIME} → ${END_TIME}`);
    console.log('==============================================\n');

    process.exit(0);

  } catch (error) {
    console.error('\n==============================================');
    console.error('❌ Sync Failed');
    console.error('==============================================');
    console.error(`   Error: ${error.message}`);
    console.error(`   Stack: ${error.stack}`);
    console.error('==============================================\n');

    // Try to update sync_state with error
    try {
      const source = `flightdeck:${SITE_ID}`;
      await supabase.from('sync_state').upsert({
        source,
        last_ts: START_TIME,
        last_sync_at: new Date().toISOString(),
        records_synced: 0,
        errors_count: 1,
        last_error: error.message
      }, { onConflict: 'source' });
    } catch (e) {
      // Ignore errors when updating error state
    }

    process.exit(1);
  }
}

// Run main function
main();
