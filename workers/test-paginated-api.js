/**
 * Test Script: ACE IoT Paginated API - Raw Data Testing
 *
 * Tests if the paginated endpoint respects raw_data=true parameter
 * and returns actual collection intervals (not 5-minute buckets)
 */

const ACE_API_URL = 'https://ace-iot-api.specializedeng.com';
const ACE_TOKEN = process.env.ACE_TOKEN || 'YOUR_TOKEN_HERE';

// Test configuration
const TEST_CASES = [
  {
    name: 'With raw_data=true',
    params: {
      start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date().toISOString(),
      raw_data: 'true',
      page_size: '1000',
      point_names: 'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/S.FallsCity_CMC.Vav416.Damper'
    }
  },
  {
    name: 'Without raw_data (default)',
    params: {
      start_time: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end_time: new Date().toISOString(),
      page_size: '1000',
      point_names: 'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/S.FallsCity_CMC.Vav416.Damper'
    }
  }
];

async function testPaginatedEndpoint(testCase) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`TEST: ${testCase.name}`);
  console.log(`${'='.repeat(80)}\n`);

  const url = `${ACE_API_URL}/sites/ses_falls_city/timeseries/paginated`;
  const params = new URLSearchParams(testCase.params);

  console.log(`URL: ${url}?${params}\n`);

  try {
    const response = await fetch(`${url}?${params}`, {
      headers: {
        'x-ace-token': ACE_TOKEN,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const samples = data.point_samples || [];

    console.log(`✅ Response received:`);
    console.log(`   Total samples: ${samples.length}`);
    console.log(`   Has more: ${data.has_more}`);
    console.log(`   Next cursor: ${data.next_cursor ? 'Yes' : 'No'}\n`);

    if (samples.length > 0) {
      console.log(`📊 Sample Analysis (first 10 samples):\n`);

      const timestamps = samples.slice(0, 10).map(s => new Date(s.time));
      const intervals = [];

      for (let i = 1; i < timestamps.length; i++) {
        const intervalSeconds = (timestamps[i] - timestamps[i-1]) / 1000;
        intervals.push(intervalSeconds);
      }

      console.log(`   Sample timestamps:`);
      timestamps.forEach((t, i) => {
        console.log(`   ${i + 1}. ${t.toISOString()}`);
      });

      console.log(`\n   Time intervals between samples:`);
      intervals.forEach((interval, i) => {
        console.log(`   ${i + 1}→${i + 2}: ${interval} seconds (${interval / 60} minutes)`);
      });

      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      console.log(`\n   Average interval: ${avgInterval.toFixed(1)} seconds (${(avgInterval / 60).toFixed(1)} minutes)`);

      // Determine if it's raw data or bucketed
      const isRawData = intervals.some(i => i < 240); // Less than 4 minutes
      const isBucketed = intervals.every(i => Math.abs(i - 300) < 10); // All ~5 minutes

      console.log(`\n   📈 Analysis:`);
      if (isBucketed) {
        console.log(`   ❌ Data appears to be 5-MINUTE BUCKETED`);
      } else if (isRawData) {
        console.log(`   ✅ Data appears to be RAW (collection intervals preserved)`);
      } else {
        console.log(`   ⚠️  Data intervals are inconsistent`);
      }
    } else {
      console.log(`⚠️  No samples returned`);
    }

  } catch (error) {
    console.error(`❌ Test failed: ${error.message}`);
  }
}

async function runAllTests() {
  console.log(`\n🧪 Testing ACE IoT Paginated API - Raw Data Behavior\n`);
  console.log(`Site: ses_falls_city`);
  console.log(`Time range: Last 24 hours`);
  console.log(`Point: Vav416.Damper\n`);

  for (const testCase of TEST_CASES) {
    await testPaginatedEndpoint(testCase);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`CONCLUSION:`);
  console.log(`${'='.repeat(80)}\n`);
  console.log(`If both tests show 5-minute buckets, the ACE API paginated endpoint`);
  console.log(`does NOT support raw_data parameter and always returns bucketed data.\n`);
  console.log(`In that case, you need to either:`);
  console.log(`  1. Contact ACE IoT to add raw_data support to paginated endpoint`);
  console.log(`  2. Use the per-point endpoint which does support raw data`);
  console.log(`  3. Request a new API endpoint that supports both pagination AND raw data\n`);
}

// Run tests
if (process.env.ACE_TOKEN) {
  runAllTests().catch(console.error);
} else {
  console.error('❌ Please set ACE_TOKEN environment variable');
  console.log('\nUsage:');
  console.log('  ACE_TOKEN=your_token_here node test-paginated-api.js');
  process.exit(1);
}
