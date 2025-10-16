#!/usr/bin/env node
/**
 * Backfill Automation Script
 *
 * Continuously triggers the backfill worker until completion.
 * Processes all 306 days from December 10, 2024 to October 12, 2025.
 *
 * Usage:
 *   node scripts/run-backfill.js
 *
 * Features:
 * - Automatic continuation until complete
 * - Progress reporting every 10 iterations
 * - Error handling and retry logic
 * - Graceful shutdown on Ctrl+C
 */

const WORKER_URL = 'https://building-vitals-backfill.jstahr.workers.dev';
const DELAY_MS = 1000; // 1 second between requests
const PROGRESS_INTERVAL = 10; // Report progress every N iterations

let iteration = 0;
let running = true;

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n⏸️  Backfill paused. Progress has been saved.');
  console.log('Run this script again to continue from where you left off.');
  running = false;
  process.exit(0);
});

async function triggerBackfill() {
  try {
    const response = await fetch(`${WORKER_URL}/trigger`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error(`❌ Error triggering backfill: ${error.message}`);
    throw error;
  }
}

async function getStatus() {
  try {
    const response = await fetch(`${WORKER_URL}/status`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ Error getting status: ${error.message}`);
    return null;
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatProgress(completedDates, totalDates, currentDate, samplesFetched) {
  const completed = Array.isArray(completedDates) ? completedDates.length : completedDates;
  const percent = ((completed / totalDates) * 100).toFixed(2);
  return `[${completed}/${totalDates}] ${percent}% - Current: ${currentDate} - Samples: ${samplesFetched || 0}`;
}

async function runBackfill() {
  console.log('🚀 Starting Backfill Automation');
  console.log('================================\n');

  // Get initial status
  const initialStatus = await getStatus();
  if (initialStatus) {
    console.log(`📊 Initial Status:`);
    console.log(`   Date Range: ${initialStatus.progress.total_dates} days`);
    console.log(`   Current Date: ${initialStatus.progress.current_date}`);
    console.log(`   Completed: ${Array.isArray(initialStatus.progress.completed_dates) ? initialStatus.progress.completed_dates.length : initialStatus.progress.completed_dates} days`);
    console.log('');
  }

  while (running) {
    iteration++;

    try {
      const result = await triggerBackfill();

      // Check if complete
      if (result.status === 'complete') {
        console.log('\n✅ BACKFILL COMPLETE!');
        console.log(`   Total samples collected: ${result.progress.samples_fetched || 0}`);
        console.log(`   All ${result.progress.total_dates} days processed`);
        break;
      }

      // Check if error occurred
      if (result.status === 'error') {
        console.error(`\n❌ Error: ${result.error}`);
        console.log('   Waiting 5 seconds before retry...');
        await sleep(5000);
        continue;
      }

      // Report progress every N iterations
      if (iteration % PROGRESS_INTERVAL === 0 || result.samples_in_batch > 0) {
        const progress = formatProgress(
          result.progress.completed_dates,
          result.progress.total_dates,
          result.progress.current_date,
          result.progress.samples_fetched
        );

        if (result.samples_in_batch > 0) {
          console.log(`\n📦 DATA FOUND! Batch #${iteration}: ${result.samples_in_batch} samples`);
          console.log(`   ${progress}`);
        } else {
          console.log(`   Batch #${iteration}: ${progress}`);
        }
      } else {
        // Show minimal progress indicator
        process.stdout.write('.');
      }

      // Wait before next request
      await sleep(DELAY_MS);

    } catch (error) {
      console.error(`\n❌ Fatal error in iteration ${iteration}:`, error.message);
      console.log('   Waiting 10 seconds before retry...');
      await sleep(10000);
    }
  }

  console.log('\n\n🏁 Backfill automation stopped.');
}

// Start the backfill automation
runBackfill().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
