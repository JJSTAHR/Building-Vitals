#!/usr/bin/env node

/**
 * R2 Bucket Content Inspector
 * Lists NDJSON.gz files to understand historical data availability
 */

const { execSync } = require('child_process');

console.log('\n=== R2 Bucket Contents Inspector ===\n');

// Try multiple approaches to list R2 contents
console.log('[1] Attempting to use wrangler r2 bucket info...\n');

try {
  const bucketInfo = execSync('npx wrangler r2 bucket info ace-timeseries', {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log('Bucket Info:\n', bucketInfo);
} catch (error) {
  console.log('Bucket info failed:', error.message.split('\n')[0]);
}

console.log('\n[2] Checking wrangler version and R2 commands...\n');

try {
  const version = execSync('npx wrangler --version', { encoding: 'utf-8' });
  console.log('Wrangler version:', version.trim());
  
  console.log('\nAvailable R2 commands:');
  execSync('npx wrangler r2 object --help', { stdio: 'inherit' });
} catch (error) {
  console.log('Version check failed:', error.message);
}

console.log('\n[3] Using Cloudflare API directly...\n');
console.log('NOTE: To list R2 bucket contents, you need to:');
console.log('  1. Set CLOUDFLARE_API_TOKEN environment variable');
console.log('  2. Use the Cloudflare API directly (not wrangler CLI)');
console.log('\nAlternatively, use a Worker script to list files from within Cloudflare Workers runtime.\n');

