/**
 * Backfill State Management Module
 *
 * Manages stateful progress tracking for historical data backfill operations
 * across 306 days using Cloudflare Workers KV storage.
 *
 * Key Features:
 * - Cursor-based pagination state persistence
 * - Resumable backfill operations
 * - Atomic state updates with metadata
 * - Progress calculation and validation
 * - Error tracking and recovery
 */

// ============================================================================
// Constants
// ============================================================================

const KV_KEY_PREFIX = 'backfill:progress';
const DEFAULT_START_DATE = '2024-12-10';
const DEFAULT_END_DATE = '2025-10-12';

// ============================================================================
// Main State Management Functions
// ============================================================================

/**
 * Get current backfill state from KV storage
 *
 * @param {KVNamespace} kv - Cloudflare KV namespace binding
 * @param {string} siteName - Site identifier (e.g., "ses_falls_city")
 * @returns {Promise<Object>} Current backfill state or initial state if none exists
 *
 * @throws {Error} If KV namespace is not provided or siteName is invalid
 */
export async function getBackfillState(kv, siteName) {
  validateInputs(kv, siteName);

  const key = buildStateKey(siteName);

  try {
    const state = await kv.get(key, { type: 'json' });

    if (!state) {
      // Return fresh initial state
      return createInitialState(siteName);
    }

    // Validate retrieved state structure
    validateStateStructure(state);

    return state;
  } catch (error) {
    throw new Error(`Failed to retrieve backfill state for ${siteName}: ${error.message}`);
  }
}

/**
 * Update backfill state with new progress information
 *
 * Performs atomic merge of updates with existing state and writes back to KV.
 * Automatically updates last_updated timestamp.
 *
 * @param {KVNamespace} kv - Cloudflare KV namespace binding
 * @param {string} siteName - Site identifier
 * @param {Object} updates - Partial state updates to merge
 * @returns {Promise<Object>} Updated state object
 *
 * @example
 * await updateBackfillState(kv, "ses_falls_city", {
 *   current_cursor: "abc123",
 *   pages_fetched_today: 45,
 *   samples_today: 4500000
 * });
 */
export async function updateBackfillState(kv, siteName, updates) {
  validateInputs(kv, siteName);

  if (!updates || typeof updates !== 'object') {
    throw new Error('Updates must be a valid object');
  }

  const key = buildStateKey(siteName);

  try {
    // Get current state
    const currentState = await getBackfillState(kv, siteName);

    // Merge updates with current state
    const updatedState = {
      ...currentState,
      ...updates,
      last_updated: new Date().toISOString()
    };

    // Validate merged state
    validateStateStructure(updatedState);

    // Write to KV with metadata
    await kv.put(key, JSON.stringify(updatedState), {
      metadata: {
        site_name: siteName,
        updated_at: updatedState.last_updated,
        status: updatedState.status,
        progress_pct: calculateProgress(updatedState)
      }
    });

    return updatedState;
  } catch (error) {
    throw new Error(`Failed to update backfill state for ${siteName}: ${error.message}`);
  }
}

/**
 * Reset backfill state to initial conditions
 *
 * Deletes existing state from KV storage, forcing fresh start on next operation.
 *
 * @param {KVNamespace} kv - Cloudflare KV namespace binding
 * @param {string} siteName - Site identifier
 * @returns {Promise<void>}
 */
export async function resetBackfillState(kv, siteName) {
  validateInputs(kv, siteName);

  const key = buildStateKey(siteName);

  try {
    await kv.delete(key);
  } catch (error) {
    throw new Error(`Failed to reset backfill state for ${siteName}: ${error.message}`);
  }
}

// ============================================================================
// State Transition Functions
// ============================================================================

/**
 * Mark current date as complete and advance to next date in sequence
 *
 * Moves current_date to completed_dates array, increments to next date,
 * and resets cursor and daily counters.
 *
 * @param {Object} state - Current backfill state
 * @returns {Object} Updated state with next date as current
 *
 * @throws {Error} If state is invalid or backfill is already complete
 */
export function advanceToNextDate(state) {
  validateStateStructure(state);

  // Check if already complete
  if (state.status === 'complete') {
    throw new Error('Backfill already complete, cannot advance');
  }

  // Add current date to completed dates if not already there
  const completedDates = state.completed_dates.includes(state.current_date)
    ? state.completed_dates
    : [...state.completed_dates, state.current_date];

  // Calculate next date
  const nextDate = addDays(state.current_date, 1);

  // Check if we've reached the end
  const isComplete = nextDate > state.backfill_end;

  return {
    ...state,
    current_date: isComplete ? state.backfill_end : nextDate,
    current_cursor: null,
    pages_fetched_today: 0,
    samples_today: 0,
    completed_dates: completedDates,
    status: isComplete ? 'complete' : 'in_progress',
    last_updated: new Date().toISOString()
  };
}

/**
 * Record an error for the current date
 *
 * @param {Object} state - Current backfill state
 * @param {string} errorMessage - Error description
 * @param {boolean} markDateAsFailed - Whether to add current_date to failed_dates
 * @returns {Object} Updated state with error logged
 */
export function recordError(state, errorMessage, markDateAsFailed = false) {
  validateStateStructure(state);

  const errorEntry = {
    date: state.current_date,
    timestamp: new Date().toISOString(),
    message: errorMessage
  };

  // Keep only last 50 errors to prevent unbounded growth
  const errorLog = [errorEntry, ...state.error_log].slice(0, 50);

  const failedDates = markDateAsFailed && !state.failed_dates.includes(state.current_date)
    ? [...state.failed_dates, state.current_date]
    : state.failed_dates;

  return {
    ...state,
    error_log: errorLog,
    failed_dates: failedDates,
    status: markDateAsFailed ? 'error' : state.status,
    last_updated: new Date().toISOString()
  };
}

/**
 * Update progress within current date (cursor-based pagination)
 *
 * @param {Object} state - Current backfill state
 * @param {string|null} cursor - Next cursor token (null if page complete)
 * @param {number} samplesFetched - Number of samples in this page
 * @returns {Object} Updated state
 */
export function updatePageProgress(state, cursor, samplesFetched) {
  validateStateStructure(state);

  return {
    ...state,
    current_cursor: cursor,
    pages_fetched_today: state.pages_fetched_today + 1,
    samples_today: state.samples_today + samplesFetched,
    total_samples: state.total_samples + samplesFetched,
    last_updated: new Date().toISOString()
  };
}

// ============================================================================
// Progress Calculation Functions
// ============================================================================

/**
 * Calculate backfill progress as percentage (0-100)
 *
 * @param {Object} state - Current backfill state
 * @returns {number} Progress percentage rounded to 2 decimal places
 */
export function calculateProgress(state) {
  validateStateStructure(state);

  const totalDays = getDaysBetween(state.backfill_start, state.backfill_end);
  const completedDays = state.completed_dates.length;

  if (totalDays === 0) {
    return 100;
  }

  const percentage = (completedDays / totalDays) * 100;
  return Math.round(percentage * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate estimated time remaining based on current velocity
 *
 * @param {Object} state - Current backfill state
 * @returns {Object} Estimate with days_remaining and estimated_completion_date
 */
export function estimateTimeRemaining(state) {
  validateStateStructure(state);

  const totalDays = getDaysBetween(state.backfill_start, state.backfill_end);
  const completedDays = state.completed_dates.length;
  const remainingDays = totalDays - completedDays;

  if (state.status === 'complete' || remainingDays <= 0) {
    return {
      days_remaining: 0,
      estimated_completion_date: state.backfill_end,
      velocity_days_per_hour: 0
    };
  }

  // Calculate velocity (days completed per hour)
  const startedAt = new Date(state.started_at);
  const now = new Date();
  const hoursElapsed = (now - startedAt) / (1000 * 60 * 60);

  if (hoursElapsed === 0 || completedDays === 0) {
    return {
      days_remaining: remainingDays,
      estimated_completion_date: null,
      velocity_days_per_hour: 0
    };
  }

  const velocityDaysPerHour = completedDays / hoursElapsed;
  const estimatedHoursRemaining = remainingDays / velocityDaysPerHour;
  const estimatedCompletionDate = new Date(now.getTime() + (estimatedHoursRemaining * 60 * 60 * 1000));

  return {
    days_remaining: remainingDays,
    estimated_completion_date: estimatedCompletionDate.toISOString(),
    velocity_days_per_hour: Math.round(velocityDaysPerHour * 100) / 100
  };
}

/**
 * Get summary statistics for current backfill
 *
 * @param {Object} state - Current backfill state
 * @returns {Object} Summary statistics
 */
export function getBackfillSummary(state) {
  validateStateStructure(state);

  const totalDays = getDaysBetween(state.backfill_start, state.backfill_end);
  const progress = calculateProgress(state);
  const estimate = estimateTimeRemaining(state);

  return {
    site_name: state.site_name,
    status: state.status,
    progress_pct: progress,
    total_days: totalDays,
    completed_days: state.completed_dates.length,
    failed_days: state.failed_dates.length,
    remaining_days: estimate.days_remaining,
    total_samples: state.total_samples,
    current_date: state.current_date,
    has_cursor: state.current_cursor !== null,
    started_at: state.started_at,
    last_updated: state.last_updated,
    estimated_completion: estimate.estimated_completion_date,
    velocity_days_per_hour: estimate.velocity_days_per_hour,
    recent_errors: state.error_log.slice(0, 5)
  };
}

// ============================================================================
// Date Utility Functions
// ============================================================================

/**
 * Calculate number of days between two dates (inclusive)
 *
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @returns {number} Number of days between dates (inclusive)
 */
export function getDaysBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  const diffTime = Math.abs(end - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays + 1; // Add 1 to make it inclusive
}

/**
 * Add days to a date string
 *
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {number} days - Number of days to add
 * @returns {string} New date in YYYY-MM-DD format
 */
export function addDays(dateStr, days) {
  const date = new Date(dateStr);

  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  date.setDate(date.getDate() + days);

  return formatDate(date);
}

/**
 * Format Date object as YYYY-MM-DD string
 *
 * @param {Date} date - Date object
 * @returns {string} Date in YYYY-MM-DD format
 */
export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

/**
 * Validate date string format (YYYY-MM-DD)
 *
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid format
 */
export function isValidDateFormat(dateStr) {
  if (typeof dateStr !== 'string') {
    return false;
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return false;
  }

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Build KV storage key for site's backfill state
 *
 * @param {string} siteName - Site identifier
 * @returns {string} KV key
 */
function buildStateKey(siteName) {
  return `${KV_KEY_PREFIX}:${siteName}`;
}

/**
 * Create initial backfill state object
 *
 * @param {string} siteName - Site identifier
 * @returns {Object} Initial state structure
 */
function createInitialState(siteName) {
  const now = new Date().toISOString();

  return {
    site_name: siteName,
    backfill_start: DEFAULT_START_DATE,
    backfill_end: DEFAULT_END_DATE,
    current_date: DEFAULT_START_DATE,
    current_cursor: null,
    pages_fetched_today: 0,
    samples_today: 0,
    completed_dates: [],
    failed_dates: [],
    total_samples: 0,
    status: 'not_started',
    started_at: now,
    last_updated: now,
    error_log: []
  };
}

/**
 * Validate KV namespace and site name inputs
 *
 * @param {KVNamespace} kv - KV namespace to validate
 * @param {string} siteName - Site name to validate
 * @throws {Error} If validation fails
 */
function validateInputs(kv, siteName) {
  if (!kv || typeof kv.get !== 'function') {
    throw new Error('Invalid KV namespace provided');
  }

  if (!siteName || typeof siteName !== 'string' || siteName.trim() === '') {
    throw new Error('Invalid site name provided');
  }
}

/**
 * Validate state object structure
 *
 * Ensures all required fields are present and have correct types.
 *
 * @param {Object} state - State object to validate
 * @throws {Error} If state structure is invalid
 */
function validateStateStructure(state) {
  if (!state || typeof state !== 'object') {
    throw new Error('State must be a valid object');
  }

  const requiredFields = [
    'site_name',
    'backfill_start',
    'backfill_end',
    'current_date',
    'current_cursor',
    'pages_fetched_today',
    'samples_today',
    'completed_dates',
    'failed_dates',
    'total_samples',
    'status',
    'started_at',
    'last_updated',
    'error_log'
  ];

  for (const field of requiredFields) {
    if (!(field in state)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Validate field types
  if (typeof state.site_name !== 'string') {
    throw new Error('site_name must be a string');
  }

  if (!isValidDateFormat(state.backfill_start)) {
    throw new Error('backfill_start must be in YYYY-MM-DD format');
  }

  if (!isValidDateFormat(state.backfill_end)) {
    throw new Error('backfill_end must be in YYYY-MM-DD format');
  }

  if (!isValidDateFormat(state.current_date)) {
    throw new Error('current_date must be in YYYY-MM-DD format');
  }

  if (state.current_cursor !== null && typeof state.current_cursor !== 'string') {
    throw new Error('current_cursor must be a string or null');
  }

  if (!Array.isArray(state.completed_dates)) {
    throw new Error('completed_dates must be an array');
  }

  if (!Array.isArray(state.failed_dates)) {
    throw new Error('failed_dates must be an array');
  }

  if (!Array.isArray(state.error_log)) {
    throw new Error('error_log must be an array');
  }

  if (typeof state.pages_fetched_today !== 'number' || state.pages_fetched_today < 0) {
    throw new Error('pages_fetched_today must be a non-negative number');
  }

  if (typeof state.samples_today !== 'number' || state.samples_today < 0) {
    throw new Error('samples_today must be a non-negative number');
  }

  if (typeof state.total_samples !== 'number' || state.total_samples < 0) {
    throw new Error('total_samples must be a non-negative number');
  }

  const validStatuses = ['not_started', 'in_progress', 'complete', 'error'];
  if (!validStatuses.includes(state.status)) {
    throw new Error(`status must be one of: ${validStatuses.join(', ')}`);
  }
}
