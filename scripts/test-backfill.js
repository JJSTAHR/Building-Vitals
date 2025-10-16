/**
 * Test script to diagnose backfill worker issues
 * Tests the backfill worker locally with detailed logging
 */

async function testBackfill() {
  const workerUrl = 'https://building-vitals-backfill.jstahr.workers.dev';
  const apiKey = 'BACKFILL_06855205f320278d5e6e0535d3e5e80f03314b688e709c4c0f3c77cea0f8bb8a';

  console.log('='.repeat(80));
  console.log('BACKFILL WORKER DIAGNOSTIC TEST');
  console.log('='.repeat(80));
  console.log();

  // Test 1: Check worker info
  console.log('Test 1: Checking worker info endpoint...');
  try {
    const response = await fetch(workerUrl);
    const data = await response.json();
    console.log('✅ Worker is accessible');
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Failed to access worker:', error.message);
    return;
  }
  console.log();

  // Test 2: Check current status
  console.log('Test 2: Checking backfill status...');
  try {
    const response = await fetch(`${workerUrl}/backfill/status`);
    const data = await response.json();
    console.log('Status Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('❌ Failed to get status:', error.message);
  }
  console.log();

  // Test 3: Start backfill for single day
  console.log('Test 3: Starting single-day backfill (2024-10-14)...');
  try {
    const response = await fetch(`${workerUrl}/backfill/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start_date: '2024-10-13',
        end_date: '2024-10-14',
        force_restart: true
      })
    });

    const data = await response.json();
    console.log('Start Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Backfill started');

      // Wait and check progress
      console.log('Waiting 10 seconds for processing...');
      await new Promise(resolve => setTimeout(resolve, 10000));

      console.log('Checking progress...');
      const statusResponse = await fetch(`${workerUrl}/backfill/status`);
      const statusData = await statusResponse.json();
      console.log('Progress:', JSON.stringify(statusData, null, 2));

      if (statusData.days_completed > 0 || statusData.records_processed > 0) {
        console.log('✅ Backfill is processing data!');
      } else {
        console.log('⚠️  No data processed yet. Possible issues:');
        console.log('   - No data available for this date range');
        console.log('   - ACE API authentication failed');
        console.log('   - Worker timed out or errored');
        console.log('   - Points configuration empty');
      }
    } else {
      console.log('❌ Failed to start backfill:', response.status);
    }
  } catch (error) {
    console.error('❌ Failed to start backfill:', error.message);
  }
  console.log();

  console.log('='.repeat(80));
  console.log('DIAGNOSTIC TEST COMPLETE');
  console.log('='.repeat(80));
}

// Run test
testBackfill().catch(console.error);
