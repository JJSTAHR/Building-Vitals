/**
 * Test ACE IoT API Data Frequency
 *
 * This script directly queries the ACE IoT API to verify the actual data frequency
 * being returned with raw_data=true parameter.
 *
 * Usage:
 *   1. Set your ACE_API_KEY environment variable
 *   2. Run: node scripts/test-ace-api-frequency.js
 *
 * Or run directly with:
 *   ACE_API_KEY="your-key-here" node scripts/test-ace-api-frequency.js
 */

const API_BASE = 'https://flightdeck.aceiot.cloud/api';
const SITE_NAME = 'ses_falls_city';

async function testAPIFrequency() {
  // Check for API key
  const apiKey = process.env.ACE_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: ACE_API_KEY environment variable not set');
    console.error('\nUsage:');
    console.error('  ACE_API_KEY="your-key-here" node scripts/test-ace-api-frequency.js');
    process.exit(1);
  }

  console.log('🔍 Testing ACE IoT API Data Frequency\n');
  console.log(`Site: ${SITE_NAME}`);
  console.log(`API Base: ${API_BASE}`);
  console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

  // Query last 1 hour of data
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago

  const url = new URL(`${API_BASE}/sites/${SITE_NAME}/timeseries/paginated`);
  url.searchParams.set('start_time', startTime.toISOString());
  url.searchParams.set('end_time', endTime.toISOString());
  url.searchParams.set('page_size', '10000');
  url.searchParams.set('raw_data', 'true'); // ⭐ REQUEST RAW DATA

  console.log(`📡 Requesting data from ${startTime.toLocaleTimeString()} to ${endTime.toLocaleTimeString()}`);
  console.log(`URL: ${url.toString()}\n`);
  console.log('⏳ Fetching...\n');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${response.status} ${response.statusText}`);
      console.error(`Details: ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();
    const samples = data.point_samples || [];

    console.log(`✅ Received ${samples.length} total samples\n`);

    if (samples.length === 0) {
      console.log('⚠️  No data returned from API');
      return;
    }

    // Group samples by point name
    const pointGroups = {};
    for (const sample of samples) {
      if (!pointGroups[sample.name]) {
        pointGroups[sample.name] = [];
      }
      pointGroups[sample.name].push({
        time: sample.time,
        value: sample.value,
        timestamp: new Date(sample.time).getTime()
      });
    }

    console.log(`📊 Found ${Object.keys(pointGroups).length} unique points\n`);
    console.log('═'.repeat(100));
    console.log('\n📈 DATA FREQUENCY ANALYSIS:\n');

    // Analyze each point
    const summaryData = [];

    for (const [pointName, pointSamples] of Object.entries(pointGroups)) {
      // Sort by timestamp
      pointSamples.sort((a, b) => a.timestamp - b.timestamp);

      // Calculate intervals between consecutive samples
      const intervals = [];
      for (let i = 1; i < pointSamples.length; i++) {
        const intervalMs = pointSamples[i].timestamp - pointSamples[i - 1].timestamp;
        const intervalSeconds = Math.round(intervalMs / 1000);
        intervals.push(intervalSeconds);
      }

      if (intervals.length === 0) continue;

      // Calculate statistics
      const avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
      const minInterval = Math.min(...intervals);
      const maxInterval = Math.max(...intervals);

      // Count interval frequency
      const intervalCounts = {};
      for (const interval of intervals) {
        intervalCounts[interval] = (intervalCounts[interval] || 0) + 1;
      }

      summaryData.push({
        point: pointName,
        samples: pointSamples.length,
        avg: avgInterval,
        min: minInterval,
        max: maxInterval,
        intervalCounts
      });

      console.log(`Point: ${pointName}`);
      console.log(`  Total samples: ${pointSamples.length}`);
      console.log(`  First sample:  ${pointSamples[0].time}`);
      console.log(`  Last sample:   ${pointSamples[pointSamples.length - 1].time}`);
      console.log(`  Average interval: ${avgInterval} seconds`);
      console.log(`  Min interval: ${minInterval} seconds`);
      console.log(`  Max interval: ${maxInterval} seconds`);

      // Show interval distribution
      console.log(`  Interval distribution:`);
      const sortedIntervals = Object.entries(intervalCounts).sort((a, b) => parseInt(b[1]) - parseInt(a[1]));
      for (const [interval, count] of sortedIntervals.slice(0, 5)) {
        const percentage = ((count / intervals.length) * 100).toFixed(1);
        console.log(`    ${interval}s: ${count} times (${percentage}%)`);
      }

      // Show first 5 sample times
      console.log(`  First 5 timestamps:`);
      for (let i = 0; i < Math.min(5, pointSamples.length); i++) {
        const interval = i > 0 ? pointSamples[i].timestamp - pointSamples[i-1].timestamp : 0;
        console.log(`    ${pointSamples[i].time} ${i > 0 ? `(+${Math.round(interval/1000)}s)` : ''}`);
      }
      console.log();
    }

    console.log('═'.repeat(100));
    console.log('\n🎯 SUMMARY:\n');
    console.log(`Expected interval (per collection setting): 30 seconds`);
    console.log(`Actual intervals observed:\n`);

    for (const item of summaryData) {
      console.log(`  ${item.point}:`);
      console.log(`    Average: ${item.avg}s (${item.avg === 30 ? '✅ MATCHES' : `❌ MISMATCH - ${(item.avg - 30) > 0 ? '+' : ''}${item.avg - 30}s`})`);
    }

    console.log('\n');
    console.log('═'.repeat(100));

    // Check if data matches expected 30-second interval
    const allMatch30s = summaryData.every(item => item.avg >= 28 && item.avg <= 32);

    if (allMatch30s) {
      console.log('✅ SUCCESS: API is returning data at ~30 second intervals as expected!');
    } else {
      console.log('❌ PROBLEM: API is NOT returning data at 30-second intervals!');
      console.log('\nPossible causes:');
      console.log('  1. ACE IoT sensor collection interval not set to 30 seconds');
      console.log('  2. raw_data=true parameter not working as expected');
      console.log('  3. Data being aggregated/downsampled by ACE API');
      console.log('  4. Sensor communication issues causing missed readings');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testAPIFrequency();
