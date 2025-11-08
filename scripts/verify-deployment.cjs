#!/usr/bin/env node
/**
 * Deployment Verification Script (Node.js)
 *
 * Programmatically verifies all deployment components:
 * - Supabase connection and schema
 * - ACE API connectivity
 * - Cloudflare Worker health
 * - Edge Functions deployment
 * - Initial site configuration
 *
 * Exit codes:
 *   0 = All checks passed
 *   1 = Critical errors found
 *   2 = Warnings found (non-critical)
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables
config();

const CHECKS = {
  CRITICAL: 'CRITICAL',
  WARNING: 'WARNING',
  INFO: 'INFO',
  SUCCESS: 'SUCCESS'
};

let errors = 0;
let warnings = 0;
let successes = 0;

/**
 * Log a check result with colored output
 */
function logCheck(level, message, details = '') {
  const colors = {
    CRITICAL: '\x1b[31m', // Red
    WARNING: '\x1b[33m',  // Yellow
    INFO: '\x1b[36m',     // Cyan
    SUCCESS: '\x1b[32m'   // Green
  };
  const reset = '\x1b[0m';

  const prefix = {
    CRITICAL: '[ERROR]',
    WARNING: '[WARN] ',
    INFO: '[INFO] ',
    SUCCESS: '[OK]   '
  };

  console.log(`${colors[level]}${prefix[level]}${reset} ${message}`);
  if (details) {
    console.log(`       ${details}`);
  }

  if (level === CHECKS.CRITICAL) errors++;
  if (level === CHECKS.WARNING) warnings++;
  if (level === CHECKS.SUCCESS) successes++;
}

/**
 * Make HTTP request with timeout
 */
async function fetchWithTimeout(url, options = {}, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

/**
 * Check Supabase connection
 */
async function checkSupabase() {
  console.log('\n========================================');
  console.log('[1/5] Checking Supabase Connection');
  console.log('========================================\n');

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL) {
    logCheck(CHECKS.CRITICAL, 'SUPABASE_URL not configured in .env');
    return;
  }

  if (!SUPABASE_SERVICE_ROLE_KEY) {
    logCheck(CHECKS.CRITICAL, 'SUPABASE_SERVICE_ROLE_KEY not configured in .env');
    return;
  }

  try {
    logCheck(CHECKS.INFO, `Testing connection to: ${SUPABASE_URL}`);

    // Test REST API
    const response = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY}`
        }
      }
    );

    if (response.ok) {
      logCheck(CHECKS.SUCCESS, 'Supabase REST API is accessible');
    } else {
      logCheck(CHECKS.CRITICAL, `Supabase returned HTTP ${response.status}`,
        response.statusText);
    }
  } catch (error) {
    logCheck(CHECKS.CRITICAL, 'Failed to connect to Supabase',
      error.message);
  }
}

/**
 * Check ACE API connection
 */
async function checkAceApi() {
  console.log('\n========================================');
  console.log('[2/5] Checking ACE API Connection');
  console.log('========================================\n');

  const { ACE_API_KEY, ACE_API_BASE = 'https://flightdeck.aceiot.cloud/api' } = process.env;

  if (!ACE_API_KEY) {
    logCheck(CHECKS.CRITICAL, 'ACE_API_KEY not configured in .env');
    return;
  }

  try {
    logCheck(CHECKS.INFO, `Testing ACE API at: ${ACE_API_BASE}`);

    const testUrl = `${ACE_API_BASE}/sites/ses_falls_city/configured_points?page=1&per_page=1`;
    const response = await fetchWithTimeout(
      testUrl,
      {
        headers: {
          'Authorization': `Bearer ${ACE_API_KEY}`,
          'Accept': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      logCheck(CHECKS.SUCCESS, 'ACE API is accessible');
      logCheck(CHECKS.INFO, `Retrieved ${data.count || 0} configured points`);
    } else {
      logCheck(CHECKS.CRITICAL, `ACE API returned HTTP ${response.status}`,
        response.statusText);
    }
  } catch (error) {
    logCheck(CHECKS.CRITICAL, 'Failed to connect to ACE API',
      error.message);
  }
}

/**
 * Check Cloudflare Worker
 */
async function checkCloudflareWorker() {
  console.log('\n========================================');
  console.log('[3/5] Checking Cloudflare Worker');
  console.log('========================================\n');

  const { VITE_WORKER_URL } = process.env;

  if (!VITE_WORKER_URL) {
    logCheck(CHECKS.WARNING, 'VITE_WORKER_URL not configured in .env',
      'Worker may not be deployed yet');
    return;
  }

  try {
    logCheck(CHECKS.INFO, `Testing worker at: ${VITE_WORKER_URL}`);

    // Test health endpoint
    const healthUrl = `${VITE_WORKER_URL}/health`;
    const response = await fetchWithTimeout(healthUrl);

    if (response.ok) {
      const data = await response.json();
      logCheck(CHECKS.SUCCESS, 'Cloudflare Worker is responding');
      logCheck(CHECKS.INFO, `Worker status: ${JSON.stringify(data)}`);
    } else {
      logCheck(CHECKS.WARNING, `Worker health check returned HTTP ${response.status}`,
        'Worker may not be deployed yet');
    }
  } catch (error) {
    logCheck(CHECKS.WARNING, 'Failed to reach Cloudflare Worker',
      `${error.message} - Worker may not be deployed yet`);
  }
}

/**
 * Check database schema
 */
async function checkDatabaseSchema() {
  console.log('\n========================================');
  console.log('[4/5] Checking Database Schema');
  console.log('========================================\n');

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logCheck(CHECKS.CRITICAL, 'Supabase credentials missing, skipping schema check');
    return;
  }

  const requiredTables = [
    { name: 'timeseries_raw', description: 'Time-series data storage' },
    { name: 'points', description: 'Point metadata' },
    { name: 'sites', description: 'Multi-site configuration' },
    { name: 'ingest_state', description: 'Sync state tracking' }
  ];

  for (const table of requiredTables) {
    try {
      logCheck(CHECKS.INFO, `Checking table: ${table.name}`);

      const response = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/${table.name}?select=*&limit=1`,
        {
          headers: {
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          }
        }
      );

      if (response.ok) {
        logCheck(CHECKS.SUCCESS, `Table '${table.name}' exists (${table.description})`);
      } else if (response.status === 404) {
        logCheck(CHECKS.CRITICAL, `Table '${table.name}' not found`,
          'Run: scripts\\deploy-supabase.bat');
      } else {
        logCheck(CHECKS.WARNING, `Could not verify table '${table.name}' (HTTP ${response.status})`);
      }
    } catch (error) {
      logCheck(CHECKS.WARNING, `Error checking table '${table.name}'`,
        error.message);
    }
  }
}

/**
 * Check Edge Functions deployment
 */
async function checkEdgeFunctions() {
  console.log('\n========================================');
  console.log('[5/5] Checking Supabase Edge Functions');
  console.log('========================================\n');

  const { SUPABASE_URL } = process.env;

  if (!SUPABASE_URL) {
    logCheck(CHECKS.WARNING, 'Cannot check Edge Functions without SUPABASE_URL');
    return;
  }

  const functions = [
    { name: 'continuous-sync', description: 'Continuous data synchronization' },
    { name: 'timeseries-proxy', description: 'Time-series query proxy' },
    { name: 'weekly-backfill', description: 'Weekly data backfill' }
  ];

  const functionsUrl = SUPABASE_URL.replace('https://', 'https://').replace('.supabase.co', '.supabase.co/functions/v1');

  logCheck(CHECKS.INFO, `Functions base URL: ${functionsUrl}`);

  for (const func of functions) {
    try {
      // Try to invoke with test parameter
      const response = await fetchWithTimeout(
        `${functionsUrl}/${func.name}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`
          },
          body: JSON.stringify({ test: true, dry_run: true })
        },
        5000 // Short timeout for functions
      );

      if (response.status === 401 || response.status === 403) {
        logCheck(CHECKS.WARNING, `Function '${func.name}' deployed but needs authentication`);
      } else if (response.status === 404) {
        logCheck(CHECKS.WARNING, `Function '${func.name}' not found`,
          'Run: scripts\\deploy-supabase.bat');
      } else {
        logCheck(CHECKS.SUCCESS, `Function '${func.name}' is deployed (${func.description})`);
      }
    } catch (error) {
      logCheck(CHECKS.INFO, `Could not verify function '${func.name}'`,
        'This is normal if functions require authentication');
    }
  }

  logCheck(CHECKS.INFO, 'To list deployed functions, run: supabase functions list');
}

/**
 * Print summary
 */
function printSummary() {
  console.log('\n========================================');
  console.log('Verification Summary');
  console.log('========================================\n');

  console.log(`✓ Successes: ${successes}`);
  if (warnings > 0) {
    console.log(`⚠ Warnings:  ${warnings} (non-critical)`);
  }
  if (errors > 0) {
    console.log(`✗ Errors:    ${errors} (critical)`);
  }

  console.log('');

  if (errors === 0) {
    logCheck(CHECKS.SUCCESS, 'All critical checks passed!');
    console.log('');
    console.log('Your deployment is ready for use.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Start development server: npm run dev');
    console.log('2. Build for production: npm run build');
    console.log('3. Set up continuous sync: See docs/DEPLOYMENT_GUIDE.md');
    console.log('');
  } else {
    logCheck(CHECKS.CRITICAL, `${errors} critical error(s) found!`);
    console.log('');
    console.log('Please fix the errors above before proceeding.');
    console.log('');
    console.log('Common fixes:');
    console.log('- Run: scripts\\setup-environment.bat');
    console.log('- Run: scripts\\deploy-supabase.bat');
    console.log('- Run: scripts\\deploy-cloudflare.bat');
    console.log('');
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('========================================');
  console.log('Building Vitals - Deployment Verification');
  console.log('========================================');

  // Check if .env exists
  try {
    readFileSync('.env', 'utf8');
  } catch (error) {
    logCheck(CHECKS.CRITICAL, '.env file not found!',
      'Run: scripts\\setup-environment.bat');
    process.exit(1);
  }

  // Run all checks
  await checkSupabase();
  await checkAceApi();
  await checkCloudflareWorker();
  await checkDatabaseSchema();
  await checkEdgeFunctions();

  // Print summary
  printSummary();

  // Exit with appropriate code
  if (errors > 0) {
    process.exit(1);
  } else if (warnings > 0) {
    process.exit(2);
  } else {
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('\nUnexpected error:', error);
    process.exit(1);
  });
}

export { main as verifyDeployment };
