/**
 * ============================================================================
 * Backfill Worker - Continuation-Based Historical Data Import
 * ============================================================================
 *
 * Architecture: Continuation-based processing (5 API pages per invocation)
 * Date Range: Dec 10, 2024 - Oct 12, 2025 (306 days)
 * Pattern: Each invocation processes 5 pages (~10 seconds), returns continuation signal
 *
 * Key Design:
 * - Processes 5 API pages per invocation (prevents timeout)
 * - Uses cursor-based pagination for resume capability
 * - Stores state in KV (current date, cursor position)
 * - Writes compressed NDJSON to R2
 * - Returns progress status for client-driven continuation
 *
 * Integration:
 * - R2 Writer: writeNDJSONToR2() from './lib/r2-ndjson-writer.js'
 * - KV State: getBackfillState(), updateBackfillState() from './lib/backfill-state.js'
 *
 * Endpoints:
 * - POST /trigger - Start or continue backfill (returns status + continuation flag)
 * - GET /status - Get current progress
 * - GET /health - Health check
 *
 * @module backfill-worker
 */

import { writeNDJSONToR2 } from './lib/r2-ndjson-writer.js';
import { getBackfillState, updateBackfillState } from './lib/backfill-state.js';

// ============================================================================
// Configuration Constants
// ============================================================================

const BACKFILL_CONFIG = {
  // Date range configuration
  START_DATE: '2024-12-10',
  END_DATE: '2025-10-12',

  // Continuation configuration
  PAGES_PER_INVOCATION: 5, // Process 5 API pages per call (~10 seconds)

  // ACE API configuration
  ACE_API_BASE: 'https://flightdeck.aceiot.cloud/api',
  API_TIMEOUT_MS: 30000,
  API_RETRY_ATTEMPTS: 3,
  API_RETRY_DELAY_MS: 1000,

  // Default site
  DEFAULT_SITE: 'building-vitals-hq'
};

// ============================================================================
// Worker Entry Point
// ============================================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route: Health check
      if (path === '/health' && request.method === 'GET') {
        return handleHealth();
      }

      // Route: Status check
      if (path === '/status' && request.method === 'GET') {
        return handleStatus(env);
      }

      // Route: Trigger backfill
      if (path === '/trigger' && request.method === 'POST') {
        return handleTrigger(request, env, ctx);
      }

      // Default: Not found
      return new Response(JSON.stringify({
        error: 'Not Found',
        message: 'Available endpoints: POST /trigger, GET /status, GET /health'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[Backfill Worker] Unhandled error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

// ============================================================================
// HTTP Request Handlers
// ============================================================================

/**
 * Health check endpoint
 * Returns worker status and configuration
 */
async function handleHealth() {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'backfill-worker',
    version: '1.0.0',
    config: {
      pages_per_invocation: BACKFILL_CONFIG.PAGES_PER_INVOCATION,
      date_range: {
        start: BACKFILL_CONFIG.START_DATE,
        end: BACKFILL_CONFIG.END_DATE,
        total_days: calculateTotalDays(BACKFILL_CONFIG.START_DATE, BACKFILL_CONFIG.END_DATE)
      }
    },
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Status endpoint
 * Returns current backfill progress
 */
async function handleStatus(env) {
  try {
    const siteName = env.SITE_NAME || BACKFILL_CONFIG.DEFAULT_SITE;
    const state = await getBackfillState(env.BACKFILL_STATE, siteName);

    if (!state) {
      return new Response(JSON.stringify({
        status: 'not_started',
        message: 'Backfill has not been initiated. POST to /trigger to start.'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const totalDays = calculateTotalDays(BACKFILL_CONFIG.START_DATE, BACKFILL_CONFIG.END_DATE);
    const percentComplete = ((state.completed_dates.length / totalDays) * 100).toFixed(2);

    return new Response(JSON.stringify({
      status: state.status,
      progress: {
        current_date: state.current_date,
        current_cursor: state.current_cursor,
        completed_dates: state.completed_dates,
        total_dates: totalDays,
        percent: `${percentComplete}%`,
        samples_fetched: state.samples_fetched || 0
      },
      last_updated: state.last_updated,
      started_at: state.started_at,
      errors: state.errors || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Status] Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to retrieve status',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Trigger endpoint
 * Starts or continues backfill processing
 *
 * Request body (optional):
 * {
 *   "site": "site-name",
 *   "reset": false
 * }
 */
async function handleTrigger(request, env, ctx) {
  try {
    // Parse request body
    const body = await request.json().catch(() => ({}));
    const site = body.site || env.SITE_NAME || BACKFILL_CONFIG.DEFAULT_SITE;
    const forceReset = body.reset || false;

    // Get or initialize state
    let state = await getBackfillState(env.BACKFILL_STATE, site);

    if (!state || forceReset || state.status === 'not_started') {
      state = {
        site_name: site,
        backfill_start: env.BACKFILL_START_DATE || BACKFILL_CONFIG.START_DATE,
        backfill_end: env.BACKFILL_END_DATE || BACKFILL_CONFIG.END_DATE,
        current_date: env.BACKFILL_START_DATE || BACKFILL_CONFIG.START_DATE,
        current_cursor: null,
        pages_fetched_today: 0,
        samples_today: 0,
        completed_dates: [],  // Must be array, not number!
        failed_dates: [],
        total_samples: 0,
        status: 'in_progress',
        started_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
        error_log: []
      };
      await updateBackfillState(env.BACKFILL_STATE, site, state);
    }

    // Check if already complete
    if (state.status === 'complete') {
      return new Response(JSON.stringify({
        status: 'complete',
        message: 'Backfill already completed',
        progress: {
          completed_dates: state.completed_dates,
          samples_fetched: state.samples_fetched
        },
        continuation: false
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Process batch of pages
    const result = await processBackfillBatch(env, site, state);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Trigger] Error:', error);

    // Log error to KV
    try {
      const site = body?.site || env.SITE_NAME || BACKFILL_CONFIG.DEFAULT_SITE;
      const state = await getBackfillState(env.BACKFILL_STATE, site);
      if (state) {
        state.errors = state.errors || [];
        state.errors.push({
          timestamp: new Date().toISOString(),
          error: error.message,
          stack: error.stack
        });
        await updateBackfillState(env.BACKFILL_STATE, site, state);
      }
    } catch (kvError) {
      console.error('[Trigger] Failed to log error:', kvError);
    }

    return new Response(JSON.stringify({
      status: 'error',
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================================
// Core Backfill Processing
// ============================================================================

/**
 * Process a batch of API pages (up to PAGES_PER_INVOCATION)
 * Returns progress status with continuation flag
 */
async function processBackfillBatch(env, site, state) {
  let pagesProcessed = 0;
  let samplesInBatch = 0;
  let currentDate = state.current_date;
  let currentCursor = state.current_cursor;

  const totalDays = calculateTotalDays(BACKFILL_CONFIG.START_DATE, BACKFILL_CONFIG.END_DATE);

  console.log(`[Backfill] Starting batch: date=${currentDate}, cursor=${currentCursor}, pages_target=${BACKFILL_CONFIG.PAGES_PER_INVOCATION}`);

  // Process up to PAGES_PER_INVOCATION pages
  while (pagesProcessed < BACKFILL_CONFIG.PAGES_PER_INVOCATION) {
    // Check if we've reached the end date
    if (new Date(currentDate) > new Date(BACKFILL_CONFIG.END_DATE)) {
      state.status = 'complete';
      state.current_date = currentDate;
      state.last_updated = new Date().toISOString();
      await updateBackfillState(env.BACKFILL_STATE, site, state);

      console.log('[Backfill] Completed successfully');

      return {
        status: 'complete',
        progress: {
          current_date: currentDate,
          completed_dates: state.completed_dates,
          total_dates: totalDays,
          percent: '100%',
          samples_fetched: state.samples_fetched
        },
        continuation: false,
        message: 'Backfill completed successfully'
      };
    }

    // Fetch one page of data for current date
    console.log(`[Backfill] Fetching page ${pagesProcessed + 1}/${BACKFILL_CONFIG.PAGES_PER_INVOCATION} for date=${currentDate}`);

    const pageResult = await fetchTimeseriesPage(
      env,
      site,
      currentDate,
      currentCursor
    );

    if (pageResult.error) {
      // Handle error - update state and return error status
      state.errors = state.errors || [];
      state.errors.push({
        timestamp: new Date().toISOString(),
        date: currentDate,
        cursor: currentCursor,
        error: pageResult.error
      });
      state.last_updated = new Date().toISOString();
      await updateBackfillState(env.BACKFILL_STATE, site, state);

      console.error(`[Backfill] Error: ${pageResult.error}`);

      return {
        status: 'error',
        error: pageResult.error,
        progress: {
          current_date: currentDate,
          completed_dates: state.completed_dates,
          total_dates: totalDays,
          percent: ((state.completed_dates.length / totalDays) * 100).toFixed(2) + '%',
          samples_fetched: state.samples_fetched
        },
        continuation: false
      };
    }

    // Write data to R2 if we have samples
    if (pageResult.data && pageResult.data.length > 0) {
      console.log(`[Backfill] Writing ${pageResult.data.length} samples to R2`);

      await writeNDJSONToR2(
        env.R2,
        site,
        currentDate,
        pageResult.data
      );

      samplesInBatch += pageResult.data.length;
    } else if (!pageResult.next_cursor) {
      // No data and no more pages - this is an error condition
      console.error(`[Backfill] No data returned for ${currentDate}`);
      state.errors = state.errors || [];
      state.errors.push({
        timestamp: new Date().toISOString(),
        date: currentDate,
        error: `No data returned from ACE API for ${currentDate}`
      });
      // Skip to next date but don't mark as complete
      currentDate = incrementDate(currentDate);
      currentCursor = null;
      pagesProcessed++;
      continue;
    }

    pagesProcessed++;

    // Update cursor for next page
    if (pageResult.next_cursor) {
      // More pages for this date
      currentCursor = pageResult.next_cursor;
      console.log(`[Backfill] More pages available for ${currentDate}, cursor=${currentCursor}`);
    } else {
      // No more pages for this date - move to next date
      console.log(`[Backfill] Completed date ${currentDate}, moving to next day`);

      // Add to completed dates only if not already present
      if (!state.completed_dates.includes(currentDate)) {
        state.completed_dates.push(currentDate);
      }

      currentDate = incrementDate(currentDate);
      currentCursor = null;
    }
  }

  // Update state after processing batch
  state.current_date = currentDate;
  state.current_cursor = currentCursor;
  state.samples_fetched += samplesInBatch;
  state.last_updated = new Date().toISOString();
  await updateBackfillState(env.BACKFILL_STATE, site, state);

  const percentComplete = ((state.completed_dates.length / totalDays) * 100).toFixed(2);

  console.log(`[Backfill] Batch complete: pages=${pagesProcessed}, samples=${samplesInBatch}, progress=${percentComplete}%`);

  return {
    status: 'in_progress',
    progress: {
      current_date: currentDate,
      completed_dates: state.completed_dates,
      total_dates: totalDays,
      percent: `${percentComplete}%`,
      samples_fetched: state.samples_fetched
    },
    continuation: true,
    message: `Processed ${pagesProcessed} pages. Continue backfill.`,
    samples_in_batch: samplesInBatch
  };
}

// ============================================================================
// ACE API Client
// ============================================================================

/**
 * Fetch a single page of timeseries data from ACE API
 * Uses cursor-based pagination for resume capability
 *
 * @param {Object} env - Worker environment
 * @param {string} site - Site name
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string|null} cursor - Pagination cursor
 * @returns {Object} { data, next_cursor, error }
 */
async function fetchTimeseriesPage(env, site, date, cursor = null) {
  const startTime = `${date}T00:00:00Z`;
  const endTime = `${date}T23:59:59Z`;

  // Build URL with pagination using URL parameters (matching ETL worker format)
  const url = new URL(`${BACKFILL_CONFIG.ACE_API_BASE}/sites/${site}/timeseries/paginated`);
  url.searchParams.set('start_time', startTime);
  url.searchParams.set('end_time', endTime);
  url.searchParams.set('page_size', '100000'); // Large page size to minimize API calls
  url.searchParams.set('raw_data', 'true'); // Get actual sensor readings

  if (cursor) {
    url.searchParams.set('cursor', cursor);
  }

  // Retry logic with exponential backoff
  for (let attempt = 1; attempt <= BACKFILL_CONFIG.API_RETRY_ATTEMPTS; attempt++) {
    try {
      console.log(`[ACE API] Attempt ${attempt}: ${url.toString()}`);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${env.ACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(BACKFILL_CONFIG.API_TIMEOUT_MS)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ACE API error (${response.status}): ${errorText}`);
      }

      const result = await response.json();

      console.log(`[ACE API] Success: ${result.data?.length || 0} samples, has_more=${!!result.next_cursor}`);

      return {
        data: result.data || [],
        next_cursor: result.next_cursor || null,
        error: null
      };

    } catch (error) {
      console.error(`[ACE API] Attempt ${attempt} failed:`, error.message);

      // If last attempt, return error
      if (attempt === BACKFILL_CONFIG.API_RETRY_ATTEMPTS) {
        return {
          data: null,
          next_cursor: null,
          error: `Failed after ${BACKFILL_CONFIG.API_RETRY_ATTEMPTS} attempts: ${error.message}`
        };
      }

      // Wait before retry (exponential backoff)
      const delay = BACKFILL_CONFIG.API_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
      console.log(`[ACE API] Waiting ${delay}ms before retry...`);
      await sleep(delay);
    }
  }

  // Should never reach here
  return {
    data: null,
    next_cursor: null,
    error: 'Unknown error in fetchTimeseriesPage'
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate total number of days between start and end dates
 */
function calculateTotalDays(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1; // Include both start and end dates
}

/**
 * Increment a date string by one day
 * @param {string} dateStr - Date string (YYYY-MM-DD)
 * @returns {string} Next day (YYYY-MM-DD)
 */
function incrementDate(dateStr) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + 1);
  return date.toISOString().split('T')[0];
}

/**
 * Sleep utility for delays
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
