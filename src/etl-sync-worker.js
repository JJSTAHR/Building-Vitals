/**
 * ============================================================================
 * ETL Sync Worker - Cloudflare Worker for ACE IoT Data Synchronization
 * ============================================================================
 *
 * Scheduled worker that syncs timeseries data from ACE IoT API to D1 database
 * every 5 minutes. Handles incremental sync with state tracking in KV.
 *
 * Key Features:
 * - Incremental sync using last_sync_timestamp from KV
 * - Batch processing (1000 records per batch) for performance
 * - Robust error handling with retries and DLQ
 * - Idempotent processing (safe for restarts)
 * - Comprehensive logging to KV for monitoring
 * - Handles 6.48M samples/day without timeouts
 *
 * Environment Variables Required:
 * - D1 binding: BUILDING_VITALS_DB
 * - KV binding: ETL_STATE
 * - Secret: ACE_API_KEY
 *
 * @module etl-sync-worker
 */

// D1/R2 removed as primary stores; Supabase is the single source of truth
// import { healthCheck, getStats } from './lib/d1-client.js';
import * as Supa from './lib/supabase-store.js';

// ============================================================================
// Configuration Constants
// ============================================================================

const CONFIG = {
  // ACE API Configuration (will be overridden by env.ACE_API_BASE)
  ACE_TIMEOUT_MS: 180000,

  // Sync Configuration
  SYNC_INTERVAL_MINUTES: 5,
  // For mixed intervals (e.g., 30s and 5min), use a small lookback buffer so
  // slower points aren't missed between runs. D1 writes are idempotent.
  LOOKBACK_BUFFER_MINUTES: 10, // 10 minute buffer to ensure data capture
  // Cap each incremental sync window to avoid oversized API pulls
  MAX_SYNC_WINDOW_MINUTES: 30,
  MAX_RECORDS_PER_SYNC: 100000, // Increased for historical backfill

  // Batch Configuration
  BATCH_SIZE: 1000, // D1 batch limit

  // Pagination Configuration
  PAGE_SIZE: 100000, // Large page size for site-wide fetching

  // Retry Configuration
  MAX_API_RETRIES: 3,
  API_RETRY_DELAY_MS: 2000,

  // Data Quality Thresholds
  EXPECTED_SAMPLES_PER_5MIN: 5, // 1 sample per minute
  MIN_QUALITY_SCORE: 0.8,

  // KV Keys
  KV_LAST_SYNC_KEY: 'etl:last_sync_timestamp',
  KV_ERROR_LOG_PREFIX: 'etl:errors:',
  KV_METRICS_PREFIX: 'etl:metrics:',
  KV_STATE_PREFIX: 'etl:state:',
  KV_POINTS_CACHE_PREFIX: 'etl:points_cache:',

  // Cache Configuration
  POINTS_CACHE_TTL_SECONDS: 3600 // Cache configured points for 1 hour
};

// ============================================================================
// Auth Helper
// ============================================================================

/**
 * Resolve ACE auth token from env.
 * Prefers ACE_API_KEY (service key), falls back to ACE_SITE_TOKEN/SITE_TOKEN (JWT).
 */
function getAceAuth(env) {
  return env.ACE_API_KEY || env.ACE_SITE_TOKEN || env.SITE_TOKEN || '';
}

// ============================================================================
// Worker Entry Points
// ============================================================================

/**
 * Scheduled event handler - Runs every 5 minutes
 * This is the main entry point for the ETL sync process
 */
export default {
  async scheduled(event, env, ctx) {
    console.log('[ETL] Scheduled sync started at', new Date().toISOString());

    const startTime = Date.now();
    const syncId = generateSyncId();

    try {
      // Acquire minute-level lock to prevent overlap and thrash
      const shardOf = parseInt(env.SHARD_OF || '1', 10) || 1;
      const shardMod = parseInt(env.SHARD_MOD || '0', 10) || 0;
      const lockKey = `etl:minute:${shardOf}:${shardMod}`;
      const lockOk = await acquireDbLock(env, lockKey, 120);
      if (!lockOk) {
        console.log('[ETL] Another run is in progress; skipping this tick');
        return;
      }

      // Fast no-op when data is already fresh (<= 60s)
      try {
        const age = await getHotAgeSeconds(env);
        if (age !== null && age <= 60) {
          console.log(`[ETL] Hot data is fresh (age=${age}s) — skipping`);
          return;
        }
      } catch (e) {
        console.warn('[ETL] Freshness check failed; proceeding anyway:', e?.message || e);
      }

      // Pre-flight checks
      await performHealthChecks(env);

      // Auto-refresh site registry periodically (no user intervention)
      try {
        await autoRefreshSiteRegistry(env);
      } catch (e) {
        console.warn('[ETL] autoRefreshSiteRegistry failed:', e?.message || e);
      }

      // Get sync state (includes sites from KV registry)
      const syncState = await getSyncState(env);
      console.log('[ETL] Sync state:', syncState);

      // Choose a bounded subset of sites this tick (urgent first)
      const selectedSites = await pickSitesForThisTick(env, syncState.sites);
      const boundedState = { ...syncState, sites: selectedSites };
      console.log(`[ETL] Selected ${selectedSites.length}/${syncState.sites.length} site(s) for this tick: ${selectedSites.join(', ')}`);

      // Execute initial sync for selected sites
      let result = await executeSyncCycle(env, boundedState, syncId);

      // Update state based on the actual newest processed timestamp
      await updateSyncState(env, result, syncId);

      // Adaptive catch-up loop: if we're behind, run limited extra cycles
      const TARGET_LAG_SEC = 90; // 1.5 minutes
      const MAX_CATCHUP_CYCLES = 20;
      const MAX_BUDGET_MS = 90000; // slightly larger budget
      const loopStart = Date.now();

      for (let i = 0; i < MAX_CATCHUP_CYCLES; i++) {
        try {
          // Compute current hot lag (prefer Supabase)
          const ageCheck = await getHotAgeSeconds(env);
          const ageSec = (ageCheck == null) ? Number.MAX_SAFE_INTEGER : ageCheck;
          if (ageSec <= TARGET_LAG_SEC) break; // caught up enough

          // Safety time budget
          if ((Date.now() - loopStart) > MAX_BUDGET_MS) break;

          // Run another incremental cycle (KV lastSync updated each pass)
          const nextStateFull = await getSyncState(env);
          const nextSelected = await pickSitesForThisTick(env, nextStateFull.sites);
          const nextState = { ...nextStateFull, sites: nextSelected };
          const nextId = generateSyncId();
          const extra = await executeSyncCycle(env, nextState, nextId);
          await updateSyncState(env, extra, nextId);
          await recordMetrics(env, extra, startTime, nextId);
        } catch (e) {
          console.warn('[ETL] Catch-up cycle failed:', e?.message || e);
          break; // avoid thrashing
        }
      }

      // Hourly backfill: once at the top of the hour, re-sync the last hour window to fill any gaps
      try {
        const now = new Date();
        const minute = now.getUTCMinutes();
        // Only run on the top of the hour to avoid doing this every minute
        if (minute === 0) {
          const hourlyStateFull = await getSyncState(env);
          const hourlySelected = await pickSitesForThisTick(env, hourlyStateFull.sites);
          const hourlyState = { ...hourlyStateFull, sites: hourlySelected };
          await runHourlyBackfill(env, hourlyState);
          // Supabase gap backfill (bounded, idempotent, raw only)
          await runSupabaseHourlyBackfill(env, hourlyState.sites);
          // Monthly retention: on 1st day at 02:00 UTC, drop partitions older than 12 months
          const day = now.getUTCDate();
          const hour = now.getUTCHours();
          if (day === 1 && hour === 2) {
            try {
              await dropOldTimeseriesPartitions(env);
              console.log('[ETL] Supabase monthly retention: partitions older than 12 months dropped');
            } catch (re) {
              console.warn('[ETL] Supabase monthly retention failed:', re?.message || re);
            }
          }
        } else {
          // Every minute: quick tail fill (bounded one small chunk) (one small chunk)
          try {
            const age = await getHotAgeSeconds(env);
            if (age !== null && age > 90) {
              const state = await getSyncState(env);
              await runSupabaseQuickTailFill(env, state.sites);
            }
          } catch {}
        }
      } catch (e) {
        console.warn('[ETL] Hourly backfill skipped:', e?.message || e);
      }

      // Record metrics
      await recordMetrics(env, result, startTime, syncId);

      console.log('[ETL] Sync completed successfully:', result);

    } catch (error) {
      console.error('[ETL] Sync failed:', error);
      await handleSyncError(env, error, syncId, startTime);

      // Re-throw for monitoring systems to catch
      throw error;
    } finally {
      // Ensure lock release even on early return or error
      try {
        await releaseDbLock(env, lockKey);
      } catch (e) {
        console.warn('[ETL] Failed to release lock:', e?.message || e);
      }
    }
  },

  /**
   * HTTP handler for manual triggers and status checks
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Route handlers
    if (url.pathname === '/health') {
      return handleHealthCheck(env);
    }

    if (url.pathname === '/status') {
      return handleStatusCheck(env);
    }

    if (url.pathname === '/trigger' && request.method === 'POST') {
      // Manual sync trigger (requires auth)
      return handleManualTrigger(request, env, ctx);
    }

    if (url.pathname === '/stats') {
      return handleStatsRequest(env);
    }

    if (url.pathname === '/admin/sites') {
      // Lightweight admin; use any token header for auth parity with proxy
      const tok = request.headers.get('Authorization') || request.headers.get('X-ACE-Token');
      if (!tok) return new Response(JSON.stringify({ error: true, message: 'Missing authentication token' }), { status: 401, headers: { 'content-type': 'application/json' } });
      return handleSitesAdmin(request, env);
    }

    return new Response('ETL Sync Worker - Use /health, /status, /stats, or /trigger', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

// ============================================================================
// Core Sync Logic
// ============================================================================

/**
 * Execute a complete sync cycle
 *
 * @param {Object} env - Worker environment bindings
 * @param {Object} syncState - Current sync state
 * @param {string} syncId - Unique sync identifier
 * @returns {Promise<Object>} Sync result summary
 */
async function executeSyncCycle(env, syncState, syncId) {
  const result = {
    syncId,
    startTime: new Date().toISOString(),
    recordsFetched: 0,
    recordsInserted: 0,
    recordsFailed: 0,
    pointsProcessed: 0,
    apiCalls: 0,
    duration: 0,
    errors: [],
    latestTimestampMs: 0
  };

  try {
    // Calculate time range for this sync
    const timeRange = calculateTimeRange(syncState);
    console.log('[ETL] Sync time range:', timeRange);

    // Sync all configured sites
    console.log(`[ETL] Syncing ${syncState.sites.length} site(s): ${syncState.sites.join(', ')}`);

    for (const siteName of syncState.sites) {
      console.log(`[ETL] === Processing site: ${siteName} ===`);

      try {
        // Sync timeseries data (no filtering - store all points)
        // This avoids the 30-second timeout from fetching 46 pages of configured points
        console.log(`[ETL] Syncing ALL timeseries data for site (filtering disabled to prevent timeout)`);
        const syncResult = await syncAllPointsNoFilter(
          env,
          siteName,
          timeRange,
          syncId
        );

        result.recordsFetched += syncResult.fetched;
        result.recordsInserted += syncResult.inserted;
        result.recordsFailed += syncResult.failed;
        result.apiCalls += syncResult.apiCalls;
        if (syncResult.maxTimestampMs && syncResult.maxTimestampMs > (result.latestTimestampMs || 0)) {
          result.latestTimestampMs = syncResult.maxTimestampMs;
        }
        // Note: We no longer fetch configured points list to avoid timeouts
        // Point count can be inferred from unique point_names in fetched samples
        result.pointsProcessed += syncResult.fetched; // Approximate point activity

        console.log(`[ETL] Site ${siteName} timeseries complete: ${syncResult.inserted} records inserted`);

        // Fetch and store weather data for this site
        try {
          const weatherResult = await syncWeatherData(env, siteName);
          console.log(`[ETL] Site ${siteName} weather data: ${weatherResult.inserted} record inserted`);

          result.recordsInserted += weatherResult.inserted;
          result.apiCalls += weatherResult.apiCalls;
        } catch (weatherError) {
          console.error(`[ETL] Failed to sync weather data for ${siteName}:`, weatherError);
          result.errors.push({
            stage: 'sync_weather',
            site: siteName,
            error: weatherError.message
          });
        }

      } catch (error) {
        console.error(`[ETL] Failed to sync site ${siteName}:`, error);
        result.errors.push({
          stage: 'sync_site',
          site: siteName,
          error: error.message
        });
      }
    }

    result.endTime = new Date().toISOString();
    result.duration = Date.now() - new Date(result.startTime).getTime();

    return result;

  } catch (error) {
    result.errors.push({
      stage: 'sync_cycle',
      error: error.message
    });
    throw error;
  }
}

/**
 * Sync RAW timeseries data for ALL points (no filtering)
 * Optimized to avoid 30-second timeout from fetching configured points list
 *
 * INCREMENTAL SYNC STRATEGY:
 * - Uses raw_data=true to get actual sensor readings (not averaged)
 * - ACE API has current data with no processing lag
 * - First sync: Fetches last 24 hours of data
 * - Subsequent syncs: Incremental from last sync timestamp to now
 * - No filtering: Stores ALL points to avoid timeout
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} siteName - Site identifier
 * @param {Object} timeRange - Time range to sync
 * @param {string} syncId - Unique sync identifier
 * @returns {Promise<Object>} Sync result
 */
async function syncAllPointsNoFilter(env, siteName, timeRange, syncId) {
  console.log(`[ETL] Fetching RAW timeseries for ALL points (no filtering - raw sensor readings)`);

  const result = {
    fetched: 0,
    inserted: 0,
    failed: 0,
    apiCalls: 0,
    maxTimestampMs: 0
  };

  // Fetch ALL timeseries data from ACE API (point-chunked if available)
  const enabledPoints = await (async () => {
    try {
      const pts = await fetchPointsList(env, siteName);
      return Array.isArray(pts) ? pts.map(p => p.name || p.point || p.id).filter(Boolean) : [];
    } catch {
      return [];
    }
  })();

  // For vendor base (flightdeck), omit point_names to avoid API-side filters at large scale
  const apiBase = env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';
  const usePointNames = !/flightdeck\.aceiot\.cloud\/api/i.test(apiBase);
  const namesForFetch = usePointNames && enabledPoints && enabledPoints.length > 0 ? enabledPoints : null;

  const allTimeseriesData = await fetchAllTimeseries(
    env,
    siteName,
    timeRange.start,
    timeRange.end,
    result,
    namesForFetch
  );

  if (!allTimeseriesData || allTimeseriesData.length === 0) {
    console.log(`[ETL] No timeseries data returned from API`);
    return result;
  }

  console.log(`[ETL] Fetched ${allTimeseriesData.length} total samples from API`);

  // Build enabled set for filtering if we have it
  let enabledSet = null;
  if (enabledPoints && enabledPoints.length > 0) {
    enabledSet = new Set(enabledPoints);
    console.log(`[ETL] Loaded ${enabledSet.size} collect-enabled points for filtering`);
  }

  // Filter out NULL/NaN values and restrict to collect-enabled points if available
  const filteredSamples = allTimeseriesData.filter(sample => {
    if (enabledSet && enabledSet.size > 0 && !enabledSet.has(sample.name)) return false;
    // Filter out NULL values
    if (sample.value == null) return false;

    // Filter out string "NaN" values from ACE API
    if (sample.value === "NaN" || sample.value === "nan") return false;

    // Filter out actual NaN after parsing
    const parsed = parseFloat(sample.value);
    return !isNaN(parsed);
  });

  console.log(`[ETL] Filtered from ${allTimeseriesData.length} total samples to ${filteredSamples.length} valid samples (NULL/NaN values removed)`);

  result.fetched = filteredSamples.length;

  if (filteredSamples.length === 0) {
    console.log(`[ETL] No data for configured points`);
    return result;
  }

  // Transform flat samples to normalized format
  const allNormalizedSamples = filteredSamples.map(sample => {
    // Parse timestamp - ACE API returns "time" field with ISO 8601 string
    const timestamp = Math.floor(new Date(sample.time).getTime());

    // Get value from sample
    const value = parseFloat(sample.value);

    return {
      site_name: siteName,
      point_name: sample.name,
      timestamp, // milliseconds since Unix epoch
      avg_value: value
    };
  });

  // Track the newest timestamp we are actually processing (ms)
  if (allNormalizedSamples.length > 0) {
    try {
      const maxTs = Math.max(...allNormalizedSamples.map(s => s.timestamp));
      if (Number.isFinite(maxTs)) {
        result.maxTimestampMs = Math.max(result.maxTimestampMs || 0, maxTs);
      }
    } catch {}
  }

  console.log(`[ETL] Transformed ${allNormalizedSamples.length} samples for Supabase insert`);

  if (allNormalizedSamples.length === 0) {
    console.log(`[ETL] No data for configured points`);
    return result;
  }

  // Write to Supabase (if configured)
  if (env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) {
    try {
      console.log(`[ETL] Writing ${allNormalizedSamples.length} samples to Supabase (raw)`);
      const supaRes = await Supa.insertRaw(env, siteName, allNormalizedSamples);
      console.log(`[ETL] Supabase write complete: ${supaRes.inserted} rows`);
      result.inserted = supaRes.inserted;
      result.failed = 0;
    } catch (e) {
      console.error('[ETL] Supabase write failed (non-fatal):', e?.message || e);
      result.failed = allNormalizedSamples.length;
    }
  }

  return result;
}

// ============================================================================
// Hourly Backfill (Last 60 Minutes)
// ============================================================================

/**
 * Run a small backfill for the last 60 minutes for all configured sites.
 * This is safe to run hourly; D1 writes are idempotent (INSERT OR REPLACE).
 */
async function runHourlyBackfill(env, syncState) {
  const endSec = Math.floor(Date.now() / 1000);
  const startSec = endSec - (60 * 60);
  const timeRange = { start: startSec, end: endSec };

  console.log('[ETL] Hourly backfill: last 60 minutes');

  for (const siteName of syncState.sites) {
    try {
      console.log(`[ETL] Hourly backfill -> site=${siteName} range=${new Date(startSec*1000).toISOString()} to ${new Date(endSec*1000).toISOString()}`);
      const backfillResult = await syncAllPointsNoFilter(env, siteName, timeRange, `hourly_${Date.now()}`);
      console.log('[ETL] Hourly backfill result:', {
        site: siteName,
        fetched: backfillResult.fetched,
        inserted: backfillResult.inserted,
        failed: backfillResult.failed,
        apiCalls: backfillResult.apiCalls
      });
    } catch (e) {
      console.warn('[ETL] Hourly backfill failed for site', siteName, e?.message || e);
    }
  }
}

// ============================================================================
// Supabase Hourly Backfill (Bounded, Idempotent)
// ============================================================================

const SUPA_BACKFILL = {
  KV_CURSOR_PREFIX: 'supa:backfill:cursor:',
  CHUNK_MINUTES: 10,
  MAX_CHUNKS_PER_HOUR: 6,
  EARLIEST_ISO: '2025-10-01T00:00:00Z'
};

async function runSupabaseHourlyBackfill(env, sites) {
  // Only run if Supabase is configured
  if (!env.SUPABASE_URL || !(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) return;

  const nowMs = Date.now();
  const chunkMinutes = parseInt(env.SUPA_BACKFILL_CHUNK_MIN || String(SUPA_BACKFILL.CHUNK_MINUTES || 10), 10) || 10;
  const maxChunks = parseInt(env.SUPA_BACKFILL_MAX_CHUNKS || String(SUPA_BACKFILL.MAX_CHUNKS_PER_HOUR || 6), 10) || 6;
  const chunkMs = chunkMinutes * 60 * 1000;
  const earliestMs = Date.parse(env.SUPA_BACKFILL_START_ISO || SUPA_BACKFILL.EARLIEST_ISO);
  if (!Number.isFinite(earliestMs)) return;

  for (const siteName of sites || []) {
    try {
      const cursorKey = `${SUPA_BACKFILL.KV_CURSOR_PREFIX}${siteName}`;
      let endIso = await env.ETL_STATE.get(cursorKey);
      if (!endIso) endIso = new Date(nowMs).toISOString();
      let endMs = Date.parse(endIso);
      if (!Number.isFinite(endMs) || endMs <= 0) endMs = nowMs;

      let processed = 0;
      while (processed < maxChunks && endMs > earliestMs) {
        const startMs = endMs - chunkMs;
        const startSec = Math.floor(startMs / 1000);
        const endSec = Math.floor(endMs / 1000);

        try {
          const tmpRes = { apiCalls: 0 };
          // Fetch ACE raw window using existing paginated client (raw_data=true)
          const samples = await fetchAllTimeseries(env, siteName, startSec, endSec, tmpRes, null);
          if (samples && samples.length > 0) {
            const normalized = samples.map(s => ({
              point_name: s.name,
              timestamp: Math.floor(new Date(s.time).getTime()),
              value: parseFloat(s.value)
            })).filter(r => r.point_name && Number.isFinite(r.timestamp) && Number.isFinite(r.value));
            if (normalized.length > 0) {
              // Idempotent upsert (adapter ignores duplicates)
              await Supa.insertRaw(env, siteName, normalized);
              console.log(`[SupabaseBackfill] ${siteName} inserted ${normalized.length} rows for ${new Date(startMs).toISOString()} -> ${new Date(endMs).toISOString()}`);
            }
          }
        } catch (e) {
          console.warn('[SupabaseBackfill] window failed', siteName, new Date(startMs).toISOString(), new Date(endMs).toISOString(), e?.message || e);
          break; // stop looping this hour if an error occurs
        }

        endMs = startMs; // step back
        processed++;
      }

      // Persist new cursor
      await env.ETL_STATE.put(cursorKey, new Date(endMs).toISOString());
    } catch (e) {
      console.warn('[SupabaseBackfill] skipped for site', siteName, e?.message || e);
    }
  }
}

// ============================================================================
// Supabase Quick Tail Fill (single recent chunk)
// ============================================================================
/**
 * Run a single small backfill window ending at now for each site.
 * Used every ~5 minutes when hot data is lagging to reduce age quickly.
 *
 * - Bounded to one chunk per site (default 10 minutes)
 * - Idempotent via insertRaw ignore-duplicates
 */
async function runSupabaseQuickTailFill(env, sites) {
  if (!env.SUPABASE_URL || !(env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) return;
  const chunkMinutes = parseInt(env.SUPA_BACKFILL_CHUNK_MIN || '10', 10) || 10;
  const endMs = Date.now();
  const startMs = endMs - (chunkMinutes * 60 * 1000);
  const startSec = Math.floor(startMs / 1000);
  const endSec = Math.floor(endMs / 1000);

  for (const siteName of sites || []) {
    try {
      const tmpRes = { apiCalls: 0 };
      const samples = await fetchAllTimeseries(env, siteName, startSec, endSec, tmpRes, null);
      if (!samples || samples.length === 0) continue;
      const normalized = samples.map(s => ({
        point_name: s.name,
        timestamp: Math.floor(new Date(s.time).getTime()),
        value: parseFloat(s.value)
      })).filter(r => r.point_name && Number.isFinite(r.timestamp) && Number.isFinite(r.value));
      if (normalized.length > 0) {
        await Supa.insertRaw(env, siteName, normalized);
        console.log(`[QuickTail] ${siteName} inserted ${normalized.length} rows for ${new Date(startMs).toISOString()} -> ${new Date(endMs).toISOString()}`);
      }
    } catch (e) {
      console.warn('[QuickTail] failed for site', siteName, e?.message || e);
    }
  }
}

// Call Supabase RPC to drop old partitions (> 12 months)
async function dropOldTimeseriesPartitions(env) {
  const baseUrl = (env.SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
  if (!baseUrl || !key) return;
  const url = `${baseUrl}/rest/v1/rpc/drop_old_timeseries_partitions`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: '{}'
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(()=>'');
    throw new Error(`Supabase RPC drop_old_timeseries_partitions failed: ${resp.status} ${txt}`);
  }
}

// ============================================================================
// ACE API Client
// ============================================================================

/**
 * Fetch ALL configured points for a site with pagination and KV caching
 * Handles ~4,583 points across multiple pages (cached for 1 hour to prevent timeouts)
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} siteName - Site identifier
 * @returns {Promise<Array>} Array of all collect-enabled point objects
 */
async function fetchPointsList(env, siteName) {
  // Check KV cache first to avoid fetching 46 pages on every sync
  const cacheKey = `${CONFIG.KV_POINTS_CACHE_PREFIX}${siteName}`;
  const cachedPoints = await env.ETL_STATE.get(cacheKey, { type: 'json' });

  if (cachedPoints && Array.isArray(cachedPoints)) {
    console.log(`[KV Cache] Using cached configured points: ${cachedPoints.length} points`);
    return cachedPoints;
  }

  console.log(`[KV Cache] No cache found, fetching fresh configured points from API`);

  const apiBase = env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';
  const allPoints = [];
  let page = 1;
  let totalPages = 1;

  console.log(`[ACE API] Fetching configured points for site: ${siteName}`);

  // Fetch all pages
  do {
    const url = `${apiBase}/sites/${siteName}/configured_points?page=${page}&per_page=100`;

    const response = await fetchWithRetry(url, {
      headers: {
        'authorization': `Bearer ${getAceAuth(env)}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch points list (page ${page}): ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const points = data.items || data.configured_points || data.points || [];

    // Filter to only collect_enabled points
    const collectEnabled = points.filter(p => p.collect_enabled === true);
    allPoints.push(...collectEnabled);

    console.log(`[ACE API] Page ${page}: ${collectEnabled.length} collect-enabled points (${points.length} total)`);

    // Calculate total pages from metadata
    if (page === 1 && data.total) {
      totalPages = Math.ceil(data.total / (data.per_page || 100));
      console.log(`[ACE API] Total pages to fetch: ${totalPages} (${data.total} total points)`);
    }

    page++;

    // Safety check - prevent infinite loops
    if (page > 500) {
      console.warn('[ACE API] Too many pages, stopping pagination');
      break;
    }

  } while (page <= totalPages);

  console.log(`[ACE API] Fetched ${allPoints.length} collect-enabled configured points across ${page - 1} pages`);

  // Cache the result in KV for 1 hour
  await env.ETL_STATE.put(
    cacheKey,
    JSON.stringify(allPoints),
    {
      expirationTtl: CONFIG.POINTS_CACHE_TTL_SECONDS
    }
  );
  console.log(`[KV Cache] Cached ${allPoints.length} configured points for ${CONFIG.POINTS_CACHE_TTL_SECONDS}s`);

  return allPoints;
}

/**
 * Fetch ALL timeseries data for the site from ACE API with cursor-based pagination
 * Uses the correct paginated endpoint: /sites/{site}/timeseries/paginated
 * Returns flat array of samples for ALL points, which we filter worker-side
 *
 * RAW DATA MODE:
 * - raw_data=true: Gets actual sensor readings (not 5-min averages)
 * - No processing lag: ACE API has current data available
 * - Time range: Queries data from last sync to now
 * - Incremental sync: Fetches only new data since last sync
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} siteName - Site identifier
 * @param {number} startTime - Start timestamp (Unix seconds)
 * @param {number} endTime - End timestamp (Unix seconds)
 * @param {Object} result - Result object to update with API call count
 * @returns {Promise<Array>} Flat array of samples { name, value, time }
 */
async function fetchAllTimeseries(env, siteName, startTime, endTime, result, pointNames = null) {
  const apiBase = env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';
  const allSamples = [];
  let cursor = null;
  let pageCount = 0;

  // Convert Unix seconds to ISO 8601 format for ACE API
  const startISO = new Date(startTime * 1000).toISOString();
  const endISO = new Date(endTime * 1000).toISOString();

  console.log(`[ACE API] Fetching site timeseries (RAW mode - actual sensor readings): ${startISO} to ${endISO}`);

  const pointChunks = Array.isArray(pointNames) && pointNames.length > 0
    ? Array.from({ length: Math.ceil(pointNames.length / 400) }, (_, i) => pointNames.slice(i * 400, (i + 1) * 400))
    : [null];

  for (const pnChunk of pointChunks) {
    cursor = null;
    pageCount = 0;
    do {
    // Build paginated endpoint URL
    const url = new URL(`${apiBase}/sites/${siteName}/timeseries/paginated`);
    url.searchParams.set('start_time', startISO);
    url.searchParams.set('end_time', endISO);
    url.searchParams.set('page_size', '100000'); // Larger pages for high-point sites
    url.searchParams.set('raw_data', 'true'); // RAW MODE: Get actual sensor readings per user requirement

    if (pnChunk && pnChunk.length > 0) {
      url.searchParams.set('point_names', pnChunk.join(','));
    }
    if (cursor) {
      url.searchParams.set('cursor', cursor);
    }

    pageCount++;
    console.log(`[ACE API] Fetching page ${pageCount} (raw_data=true - raw sensor readings)${cursor ? ` (cursor: ${cursor.substring(0, 20)}...)` : ''}`);

    const response = await fetchWithRetry(url.toString(), {
      headers: {
        'authorization': `Bearer ${getAceAuth(env)}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(CONFIG.ACE_TIMEOUT_MS)
    });

    result.apiCalls++;

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ACE API timeseries error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();

    // ACE API returns: { point_samples: [{name, value, time}], next_cursor, has_more }
    if (data.point_samples && Array.isArray(data.point_samples)) {
      allSamples.push(...data.point_samples);
      console.log(`[ACE API] Page ${pageCount}: ${data.point_samples.length} samples`);
    }

    // Check for next page via cursor
    cursor = data.next_cursor || null;

    // Respect has_more flag
    if (data.has_more === false) {
      cursor = null;
    }

    // Safety limit to prevent infinite loops
    if (pageCount > 200) {
      console.warn('[ACE API] Reached page limit (200), stopping pagination');
      break;
    }

    } while (cursor);
  }

  console.log(`[ACE API] Timeseries fetch complete: ${pageCount} pages, ${allSamples.length} total samples`);
  return allSamples;
}

/**
 * Fetch sites list from ACE API (auto-discovery), with pagination & safety.
 */
async function fetchAceSites(env) {
  const apiBase = env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';
  const headers = {
    'authorization': `Bearer ${getAceAuth(env)}`,
    'Content-Type': 'application/json'
  };
  const result = [];
  let page = 1;
  let totalPages = 1;
  do {
    const url = `${apiBase}/sites?page=${page}&per_page=100`;
    const resp = await fetchWithRetry(url, { headers, signal: AbortSignal.timeout(CONFIG.ACE_TIMEOUT_MS) });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`ACE sites list failed: ${resp.status} ${resp.statusText} ${t}`);
    }
    const data = await resp.json().catch(()=>({}));
    const items = data.items || data.sites || data || [];
    for (const it of (items || [])) {
      const name = it.name || it.site_name || it.slug || it.id || null;
      if (name) result.push(String(name));
    }
    if (page === 1) {
      const total = data.total || data.count || result.length;
      const per = data.per_page || 100;
      totalPages = Math.max(1, Math.ceil(total / per));
    }
    page++;
    if (page > 200) break;
  } while (page <= totalPages);
  return Array.from(new Set(result)).sort();
}

/**
 * Periodically refresh the site registry from ACE without user intervention.
 * Uses ETL_STATE keys: sites:list and sites:last_refresh.
 */
async function autoRefreshSiteRegistry(env) {
  const ttlMin = parseInt(env.SITES_REFRESH_MINUTES || '10', 10) || 10;
  const now = Date.now();
  const lastStr = await env.ETL_STATE.get('sites:last_refresh').catch(()=>null);
  const last = lastStr ? parseInt(lastStr, 10) : 0;
  if (last && (now - last) < ttlMin * 60 * 1000) return; // fresh enough
  try {
    const sites = await fetchAceSites(env);
    if (sites && sites.length > 0) {
      await env.ETL_STATE.put('sites:list', JSON.stringify(sites));
      await env.ETL_STATE.put('sites:last_refresh', String(now));
      console.log(`[ETL] Auto-refreshed site registry (${sites.length} sites)`);
    }
  } catch (e) {
    console.warn('[ETL] Auto site refresh failed:', e?.message || e);
  }
}

/**
 * Pick a bounded set of sites for this tick, prioritizing lagging sites.
 * Stores a round-robin cursor in KV to fairly rotate.
 */
async function pickSitesForThisTick(env, allSites) {
  const sites = Array.from(new Set((allSites || []).map(String).filter(Boolean)));
  const max = Math.max(1, parseInt(env.MAX_SITES_PER_TICK || '6', 10) || 6);
  if (sites.length <= max) return sites;

  // Compute per-site age (Supabase preferred)
  const ages = new Map();
  for (const s of sites) {
    try {
      if (env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) {
        const a = await Supa.getFreshnessAgeSecondsBySite(env, s);
        ages.set(s, (a == null ? Number.POSITIVE_INFINITY : a));
      } else {
        const row = await env.DB.prepare('SELECT MAX(timestamp) AS max_ts FROM timeseries_raw WHERE site_name = ?').bind(s).first();
        const mx = row?.max_ts ? row.max_ts * 1000 : 0;
        const a = mx > 0 ? Math.floor((Date.now() - mx) / 1000) : Number.POSITIVE_INFINITY;
        ages.set(s, a);
      }
    } catch {
      ages.set(s, Number.POSITIVE_INFINITY);
    }
  }

  // Urgent first (age > 90s)
  const urgent = sites.filter(s => (ages.get(s) ?? 0) > 300);
  const selected = urgent.slice(0, max);
  if (selected.length >= max) return selected;

  // Round-robin remainder
  const cursorStr = await env.ETL_STATE.get('sites:cursor').catch(()=>null);
  let cursor = cursorStr ? parseInt(cursorStr, 10) : 0;
  const nonUrgent = sites.filter(s => !urgent.includes(s));
  const rr = [];
  for (let i = 0; i < nonUrgent.length && selected.length + rr.length < max; i++) {
    rr.push(nonUrgent[(cursor + i) % nonUrgent.length]);
  }
  cursor = (cursor + rr.length) % Math.max(1, nonUrgent.length);
  await env.ETL_STATE.put('sites:cursor', String(cursor));
  return Array.from(new Set([...selected, ...rr])).slice(0, max);
}

/**
 * Fetch weather data for a site from ACE API
 * Returns current weather conditions including temperature, humidity, wind, etc.
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} siteName - Site identifier
 * @returns {Promise<Object>} Weather data object
 */
async function fetchWeatherData(env, siteName) {
  const apiBase = env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';
  const url = `${apiBase}/sites/${siteName}/weather`;

  console.log(`[ACE API] Fetching weather data for site: ${siteName}`);

  const response = await fetchWithRetry(url, {
    headers: {
      'authorization': `Bearer ${getAceAuth(env)}`,
      'Content-Type': 'application/json'
    },
    signal: AbortSignal.timeout(CONFIG.ACE_TIMEOUT_MS)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ACE API weather error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const weatherData = await response.json();
  console.log(`[ACE API] Weather data received:`, weatherData);

  return weatherData;
}

/**
 * Sync weather data to D1 database
 * Stores current weather conditions for the site
 *
 * @param {Object} env - Worker environment bindings
 * @param {string} siteName - Site identifier
 * @returns {Promise<Object>} Sync result { inserted, failed, apiCalls }
 */
async function syncWeatherData(env, siteName) {
  const result = {
    inserted: 0,
    failed: 0,
    apiCalls: 0
  };

  try {
    // Fetch weather data from ACE API
    const weatherData = await fetchWeatherData(env, siteName);
    result.apiCalls++;

    if (!weatherData || Object.keys(weatherData).length === 0) {
      console.log(`[ETL] No weather data returned for site ${siteName}`);
      return result;
    }

    // Transform weather data to timeseries format
    // Each weather metric becomes a point in timeseries_raw
    const timestamp = Math.floor(Date.now() / 1000); // Current time in seconds
    const weatherPoints = [];

    // Map weather fields to point names
    const weatherMapping = {
      temp: 'weather.temperature',
      feels_like: 'weather.feels_like',
      pressure: 'weather.pressure',
      humidity: 'weather.humidity',
      dew_point: 'weather.dew_point',
      clouds: 'weather.clouds',
      wind_speed: 'weather.wind_speed',
      wind_deg: 'weather.wind_direction',
      wet_bulb: 'weather.wet_bulb'
    };

    for (const [field, pointName] of Object.entries(weatherMapping)) {
      if (weatherData[field] != null && !isNaN(parseFloat(weatherData[field]))) {
        weatherPoints.push({
          site_name: siteName,
          point_name: pointName,
          timestamp: timestamp * 1000, // Convert to milliseconds for D1 client
          avg_value: parseFloat(weatherData[field])
        });
      }
    }

    console.log(`[ETL] Transformed ${weatherPoints.length} weather metrics for Supabase insert`);

    if (weatherPoints.length === 0) {
      console.log(`[ETL] No valid weather metrics to insert`);
      return result;
    }

    // Insert weather data into Supabase
    try {
      const supaRes = await Supa.insertRaw(env, siteName, weatherPoints);
      result.inserted = supaRes.inserted || 0;
      result.failed = 0;
    } catch (e) {
      console.error('[ETL] Weather Supabase write failed:', e?.message || e);
      result.failed = weatherPoints.length;
    }

    return result;

  } catch (error) {
    console.error('[ETL] Weather sync error:', error);
    result.failed++;
    throw error;
  }
}

/**
 * Fetch with retry logic and exponential backoff
 *
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, options) {
  let lastError = null;

  for (let attempt = 1; attempt <= CONFIG.MAX_API_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);

      // Retry on 5xx errors
      if (response.status >= 500) {
        throw new Error(`Server error: ${response.status}`);
      }

      return response;

    } catch (error) {
      lastError = error;
      console.warn(`[ACE API] Request failed (attempt ${attempt}/${CONFIG.MAX_API_RETRIES}):`, error.message);

      if (attempt < CONFIG.MAX_API_RETRIES) {
        const delay = CONFIG.API_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

// ============================================================================
// Data Transformation
// ============================================================================

/**
 * Transform ACE API samples to normalized D1 format
 *
 * @param {Array} samples - Raw samples from ACE API
 * @param {string} siteName - Site identifier
 * @param {string} pointName - Point identifier
 * @returns {Array} Normalized samples
 */
function transformSamples(samples, siteName, pointName) {
  return samples.map(sample => {
    // Parse timestamp - ACE API returns "time" field with ISO 8601 string
    const timestamp = Math.floor(new Date(sample.time).getTime());

    // Get value from sample
    const value = parseFloat(sample.value);

    return {
      site_name: siteName,
      point_name: pointName,
      timestamp, // milliseconds since Unix epoch
      avg_value: value
    };
  });
}

// ============================================================================
// State Management
// ============================================================================

/**
 * Get current sync state from KV
 *
 * @param {Object} env - Worker environment bindings
 * @returns {Promise<Object>} Sync state
 */
async function getSyncState(env) {
  const lastSyncStr = await env.ETL_STATE.get(CONFIG.KV_LAST_SYNC_KEY);

  const now = Date.now();
  // ACE API has current data with no processing lag
  // First sync starts from 24 hours ago, then incremental from last sync timestamp
  const defaultStartTime = now - (24 * 60 * 60 * 1000); // 24 hours for first sync

  // Load sites from KV registry if present; fallback to comma-separated env var
  let sites = [];
  try {
    const json = await env.ETL_STATE.get('sites:list', { type: 'json' });
    if (Array.isArray(json) && json.length > 0) {
      sites = json.map(s => String(s).trim()).filter(Boolean);
    }
  } catch {}
  if (!sites || sites.length === 0) {
    const sitesConfig = env.SITE_NAME || 'ses_falls_city';
    sites = sitesConfig.split(',').map(s => s.trim()).filter(Boolean);
  }
  // Optional sharding: keep only sites matching SHARD_MOD of SHARD_OF
  const shardOf = parseInt(env.SHARD_OF || '1', 10) || 1;
  const shardMod = parseInt(env.SHARD_MOD || '0', 10) || 0;
  if (shardOf > 1) {
    sites = sites.filter(s => (hashStr(s) % shardOf) === shardMod);
  }

  return {
    lastSyncTimestamp: lastSyncStr ? parseInt(lastSyncStr) : defaultStartTime,
    sites, // Array of site names
    siteName: sites[0], // Primary site for backward compatibility
    syncInterval: CONFIG.SYNC_INTERVAL_MINUTES
  };
}

/**
 * Update sync state in KV after successful sync
 *
 * @param {Object} env - Worker environment bindings
 * @param {Object} result - Sync result
 * @param {string} syncId - Unique sync identifier
 */
async function updateSyncState(env, result, syncId) {
  const now = Date.now();
  // Advance only when we actually processed data; otherwise retain last value
  let effectiveTs = now;
  if (result && result.latestTimestampMs && Number.isFinite(result.latestTimestampMs)) {
    effectiveTs = result.latestTimestampMs;
  } else {
    try {
      const state = await getSyncState(env);
      effectiveTs = state.lastSyncTimestamp || now;
    } catch {
      effectiveTs = now;
    }
  }

  // Update last sync timestamp
  await env.ETL_STATE.put(
    CONFIG.KV_LAST_SYNC_KEY,
    String(effectiveTs),
    {
      metadata: {
        syncId,
        recordsInserted: result.recordsInserted,
        timestamp: new Date().toISOString()
      }
    }
  );

  // Store sync state snapshot
  const stateKey = `${CONFIG.KV_STATE_PREFIX}${syncId}`;
  await env.ETL_STATE.put(
    stateKey,
    JSON.stringify(result),
    {
      expirationTtl: 86400 * 7 // Keep for 7 days
    }
  );
}

/**
 * Calculate time range for current sync with incremental strategy
 *
 * INCREMENTAL SYNC STRATEGY:
 * - ACE API has current data with no processing lag
 * - First sync: Query last 24 hours of data (from 24h ago to now)
 * - Subsequent syncs: Incremental from last sync timestamp to now
 * - End time: ALWAYS now (current time)
 *
 * This ensures we capture current data and prevents missing samples.
 *
 * @param {Object} syncState - Current sync state
 * @returns {Object} Time range { start, end }
 */
function calculateTimeRange(syncState) {
  const now = Date.now();

  // Determine if this is first sync (last sync > 7 days ago or not set)
  const isFirstSync = !syncState.lastSyncTimestamp ||
                      syncState.lastSyncTimestamp < (now - 7 * 86400000);

  let start, end;

  if (isFirstSync) {
    // First sync: Get last 24 hours of data
    start = Math.floor((now - 86400000) / 1000); // 24h ago in seconds
    end = Math.floor(now / 1000);                 // now in seconds
    console.log(`[ETL] FIRST SYNC: Fetching last 24 hours of data`);
  } else {
    // Incremental: From last sync minus lookback buffer to now (to capture 5-min/30s points)
    const bufferMs = CONFIG.LOOKBACK_BUFFER_MINUTES * 60 * 1000;
    start = Math.floor((syncState.lastSyncTimestamp - bufferMs) / 1000);
    if (start < 0) start = 0;
    end = Math.floor(now / 1000);
    console.log(`[ETL] INCREMENTAL SYNC: From last sync to now`);
  }

  // Cap the window length to avoid oversized queries per cycle
  const maxWindowSec = (CONFIG.MAX_SYNC_WINDOW_MINUTES || 15) * 60;
  if ((end - start) > maxWindowSec) {
    end = start + maxWindowSec;
    console.log(`[ETL] Window capped to ${CONFIG.MAX_SYNC_WINDOW_MINUTES} minutes to prevent large pulls`);
  }

  console.log(`[ETL] Time range: ${new Date(start * 1000).toISOString()} → ${new Date(end * 1000).toISOString()} (${isFirstSync ? 'FIRST' : 'INCREMENTAL'})`);

  return { start, end };
}

// ============================================================================
// Metadata and Quality Tracking
// ============================================================================

/**
 * Update point metadata after sync
 */
async function updatePointMetadata(db, siteName, pointName, samples) {
  if (samples.length === 0) return;

  const timestamps = samples.map(s => s.timestamp);

  await updateQueryMetadata(db, siteName, pointName, {
    dataStart: Math.min(...timestamps),
    dataEnd: Math.max(...timestamps),
    totalSamples: samples.length,
    lastAggregated: Math.floor(Date.now() / 1000)
  });
}

/**
 * Record data quality metrics
 */
async function recordPointQuality(db, siteName, pointName, samples, timeRange) {
  if (samples.length === 0) return;

  const date = parseInt(new Date().toISOString().slice(0, 10).replace(/-/g, ''));
  const timeRangeMinutes = (timeRange.end - timeRange.start) / 60;
  const expectedSamples = Math.floor(timeRangeMinutes);
  const actualSamples = samples.length;
  const missingSamples = Math.max(0, expectedSamples - actualSamples);
  const qualityScore = actualSamples / expectedSamples;

  await recordDataQuality(db, {
    site_name: siteName,
    point_name: pointName,
    date,
    expected_samples: expectedSamples,
    actual_samples: actualSamples,
    missing_samples: missingSamples,
    outlier_count: 0, // TODO: Implement outlier detection
    quality_score: Math.min(1.0, qualityScore)
  });
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Handle sync errors and log to KV
 */
async function handleSyncError(env, error, syncId, startTime) {
  const errorLog = {
    syncId,
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    error: error.message,
    stack: error.stack
  };

  // Log to KV
  const errorKey = `${CONFIG.KV_ERROR_LOG_PREFIX}${syncId}`;
  await env.ETL_STATE.put(
    errorKey,
    JSON.stringify(errorLog),
    {
      expirationTtl: 86400 * 30 // Keep errors for 30 days
    }
  );

  console.error('[ETL] Error logged to KV:', errorKey);
}

// ============================================================================
// Monitoring and Health Checks
// ============================================================================

/**
 * Perform pre-flight health checks
 */
async function performHealthChecks(env) {
  // Check KV availability
  try {
    await env.ETL_STATE.get('health_check');
  } catch (error) {
    throw new Error('KV namespace health check failed');
  }

  // Optional: check Supabase availability
  try {
    if (env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) {
      await Supa.getFreshnessAgeSeconds(env).catch(()=>null);
    }
  } catch {}

  console.log('[ETL] Health checks passed');
}

/**
 * Record sync metrics to KV
 */
async function recordMetrics(env, result, startTime, syncId) {
  const metrics = {
    syncId,
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    recordsFetched: result.recordsFetched,
    recordsInserted: result.recordsInserted,
    recordsFailed: result.recordsFailed,
    pointsProcessed: result.pointsProcessed,
    apiCalls: result.apiCalls,
    errors: result.errors.length
  };

  const metricsKey = `${CONFIG.KV_METRICS_PREFIX}${syncId}`;
  await env.ETL_STATE.put(
    metricsKey,
    JSON.stringify(metrics),
    {
      expirationTtl: 86400 * 7 // Keep for 7 days
    }
  );
}

/**
 * Handle health check request
 */
async function handleHealthCheck(env) {
  try {
    return new Response(JSON.stringify({
      status: 'healthy',
      database: 'supabase',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle status check request
 */
async function handleStatusCheck(env) {
  try {
    const syncState = await getSyncState(env);
    const age = await getHotAgeSeconds(env);
    const payload = {
      status: 'running',
      lastSync: new Date(syncState.lastSyncTimestamp).toISOString(),
      sites: syncState.sites,
      freshness_age_sec: age,
      db: 'supabase',
      timestamp: new Date().toISOString()
    };
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle stats request
 */
async function handleStatsRequest(env) {
  try {
    const age = await getHotAgeSeconds(env);
    const out = { freshness_age_sec: age, db: 'supabase', time: new Date().toISOString() };
    return new Response(JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle manual sync trigger
 */
async function handleManualTrigger(request, env, ctx) {
  // TODO: Add authentication check

  const syncId = generateSyncId();

  // Execute sync asynchronously
  ctx.waitUntil((async () => {
    try {
      const syncState = await getSyncState(env);
      const result = await executeSyncCycle(env, syncState, syncId);
      await updateSyncState(env, result, syncId);
      await recordMetrics(env, result, Date.now(), syncId);
    } catch (error) {
      await handleSyncError(env, error, syncId, Date.now());
    }
  })());

  return new Response(JSON.stringify({
    status: 'triggered',
    syncId,
    message: 'Sync started in background'
  }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate unique sync ID
 */
function generateSyncId() {
  return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// Locking & Freshness Utilities
// ============================================================================

/**
 * Acquire a minute-level lock using KV to avoid overlapping runs.
 * Non-atomic but sufficient for Worker cron jitter; TTL keeps it bounded.
 *
 * @param {Object} env
 * @param {string} key - Logical lock name
 * @param {number} ttlSec - Time-to-live in seconds
 * @returns {Promise<boolean>} true if acquired, false if held by another
 */
async function acquireDbLock(env, key, ttlSec = 120) {
  try {
    const kvKey = `lock:${key}`;
    const now = Date.now();
    const existing = await env.ETL_STATE.get(kvKey, { type: 'json' });
    if (existing && typeof existing.expiresAt === 'number' && existing.expiresAt > now) {
      return false; // lock currently held
    }

    const record = {
      acquiredAt: now,
      expiresAt: now + (ttlSec * 1000),
      id: generateSyncId()
    };

    await env.ETL_STATE.put(kvKey, JSON.stringify(record), { expirationTtl: ttlSec });
    return true;
  } catch (e) {
    console.warn('[ETL] acquireDbLock error, proceeding without lock:', e?.message || e);
    // Fail-open to avoid stopping ETL entirely
    return true;
  }
}

/**
 * Release a KV lock (best-effort). Safe if key is already gone/expired.
 */
async function releaseDbLock(env, key) {
  try {
    const kvKey = `lock:${key}`;
    await env.ETL_STATE.delete(kvKey);
  } catch (e) {
    console.warn('[ETL] releaseDbLock error:', e?.message || e);
  }
}

// ============================================================================
// Site Registry Admin (ETL_STATE)
// ============================================================================

function hashStr(s) {
  // djb2
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h) + s.charCodeAt(i);
    h = h | 0;
  }
  return Math.abs(h);
}

async function getSiteRegistry(env) {
  try {
    const arr = await env.ETL_STATE.get('sites:list', { type: 'json' });
    if (Array.isArray(arr)) return Array.from(new Set(arr.map(x => String(x).trim()).filter(Boolean)));
  } catch {}
  const cfg = (env.SITE_NAME || 'ses_falls_city').split(',').map(s => s.trim()).filter(Boolean);
  return Array.from(new Set(cfg));
}

async function setSiteRegistry(env, sites) {
  const list = Array.from(new Set((sites || []).map(x => String(x).trim()).filter(Boolean)));
  await env.ETL_STATE.put('sites:list', JSON.stringify(list));
  return list;
}

async function handleSitesAdmin(request, env) {
  const url = new URL(request.url);
  if (request.method === 'GET') {
    const sites = await getSiteRegistry(env);
    return new Response(JSON.stringify({ sites }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (request.method === 'POST') {
    const body = await request.json().catch(()=>({}));
    let sites = await getSiteRegistry(env);
    const add = Array.isArray(body?.add) ? body.add : (body?.site ? [body.site] : []);
    if (Array.isArray(body?.set)) sites = [];
    const merged = Array.from(new Set([...sites, ...add.map(x => String(x).trim()).filter(Boolean)]));
    const saved = await setSiteRegistry(env, merged);
    return new Response(JSON.stringify({ sites: saved }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (request.method === 'DELETE') {
    const body = await request.json().catch(()=>({}));
    const remove = Array.isArray(body?.remove) ? body.remove : (body?.site ? [body.site] : []);
    const set = await getSiteRegistry(env);
    const next = set.filter(s => !remove.includes(s));
    const saved = await setSiteRegistry(env, next);
    return new Response(JSON.stringify({ sites: saved }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('Method not allowed', { status: 405 });
}

/**
 * Compute hot data age (seconds) from D1 by checking MAX(timestamp) in timeseries_raw.
 * Returns null if table empty or query fails.
 */
async function getHotAgeSeconds(env) {
  // Prefer Supabase freshness when configured; fallback to D1
  try {
    if (env.SUPABASE_URL && (env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY)) {
      try {
        const age = await Supa.getFreshnessAgeSeconds(env);
        if (age != null) return Math.max(0, age);
      } catch (e) {
        console.warn('[ETL] Supabase freshness check failed; falling back to D1:', e?.message || e);
      }
    }
    const row = await env.DB.prepare('SELECT MAX(timestamp) AS max_ts FROM timeseries_raw').first();
    const maxSec = row?.max_ts || 0;
    if (!maxSec) return null;
    const ageSec = Math.floor((Date.now() - (maxSec * 1000)) / 1000);
    return Math.max(0, ageSec);
  } catch (e) {
    console.warn('[ETL] getHotAgeSeconds failed:', e?.message || e);
    return null;
  }
}
