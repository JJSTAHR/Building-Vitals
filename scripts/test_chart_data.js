/**
 * Test Script for Chart Data Retrieval
 * Run this in browser console to test data fetching
 */

async function testChartDataRetrieval() {
  console.log('===========================================');
  console.log('Testing Chart Data Retrieval');
  console.log('===========================================');

  const QUERY_WORKER_URL = 'https://building-vitals-query.jstahr.workers.dev';
  const SITE_NAME = 'ses_falls_city';

  // Test different time ranges
  const testCases = [
    { range: '24h', days: 1 },
    { range: '7d', days: 7 },
    { range: '30d', days: 30 },
    { range: '90d', days: 90 },
    { range: '180d', days: 180 },
    { range: '365d', days: 365 }
  ];

  for (const testCase of testCases) {
    console.log(`\nTesting ${testCase.range} time range:`);
    console.log('-----------------------------------');

    const endTime = new Date();
    const startTime = new Date();
    startTime.setDate(startTime.getDate() - testCase.days);

    const params = new URLSearchParams({
      site_name: SITE_NAME,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      point_names: 'test_point' // Replace with actual point name
    });

    const url = `${QUERY_WORKER_URL}/timeseries/query?${params}`;

    console.log('Request URL:', url);
    console.log('Start Time:', startTime.toISOString());
    console.log('End Time:', endTime.toISOString());

    try {
      const startFetch = performance.now();
      const response = await fetch(url);
      const endFetch = performance.now();

      if (!response.ok) {
        console.error(`❌ Failed: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      console.log(`✅ Success! Response time: ${(endFetch - startFetch).toFixed(2)}ms`);
      console.log('Response metadata:', data.metadata);
      console.log('Data source:', data.metadata?.source || 'unknown');
      console.log('Sample count:', data.metadata?.sample_count || 0);
      console.log('Query time:', data.metadata?.query_time_ms || 'N/A', 'ms');

      // Check if data is from R2 (cold storage)
      if (data.metadata?.source === 'r2') {
        console.log('📦 Data retrieved from R2 cold storage');
      } else if (data.metadata?.source === 'd1') {
        console.log('💾 Data retrieved from D1 hot storage');
      }

      // Check actual data points
      if (data.data && data.data.length > 0) {
        const firstPoint = new Date(data.data[0][0]);
        const lastPoint = new Date(data.data[data.data.length - 1][0]);
        console.log('First data point:', firstPoint.toISOString());
        console.log('Last data point:', lastPoint.toISOString());
        console.log('Total points:', data.data.length);
      } else {
        console.warn('⚠️ No data points returned');
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }

  console.log('\n===========================================');
  console.log('Test Complete!');
  console.log('===========================================');
}

// Run the test
testChartDataRetrieval();

// Also test with custom date range
async function testCustomDateRange(startDate, endDate) {
  console.log('\n===========================================');
  console.log('Testing Custom Date Range');
  console.log('===========================================');

  const QUERY_WORKER_URL = 'https://building-vitals-query.jstahr.workers.dev';
  const SITE_NAME = 'ses_falls_city';

  const params = new URLSearchParams({
    site_name: SITE_NAME,
    start_time: new Date(startDate).toISOString(),
    end_time: new Date(endDate).toISOString(),
    point_names: 'test_point'
  });

  const url = `${QUERY_WORKER_URL}/timeseries/query?${params}`;

  console.log('Custom Range:', startDate, 'to', endDate);
  console.log('Request URL:', url);

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (response.ok) {
      console.log('✅ Success!');
      console.log('Data source:', data.metadata?.source);
      console.log('Sample count:', data.metadata?.sample_count || 0);
    } else {
      console.error('❌ Failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Test a full year of historical data
// testCustomDateRange('2024-01-01', '2024-12-31');