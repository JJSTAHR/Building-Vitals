/**
 * Direct D1 Diagnostic Query
 * Queries D1 directly to see what's actually stored
 */

async function queryD1Sample() {
  console.log('🔍 Querying D1 for sample data...\n');

  // Try to get ANY data from the last hour
  const url = new URL('https://building-vitals-query.jstahr.workers.dev/timeseries/query');
  url.searchParams.set('site_name', 'ses_falls_city');

  // Query with partial match or wildcard - try common patterns
  const testPoints = [
    // Full format
    'ses/ses_falls_city/192.168.96.3/n4/FallsCity_CMC/C.Drivers.LonNetwork3.VAV_707.points.Damper',
    // Short names
    'Damper',
    'VAV_707.Damper',
    // Weather points (from ETL worker code)
    'weather.temperature',
    'weather.humidity'
  ];

  for (const pointName of testPoints) {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    url.searchParams.set('point_names', pointName);
    url.searchParams.set('start_time', oneHourAgo.toString());
    url.searchParams.set('end_time', now.toString());

    console.log(`Testing: "${pointName}"`);

    try {
      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.samples && data.samples.length > 0) {
        console.log(`  ✅ Found ${data.samples.length} samples!`);
        console.log(`  First sample:`, JSON.stringify(data.samples[0], null, 2));
        console.log(`  Point name in D1: "${data.samples[0].point_name}"`);
        return; // Found data, we're done
      } else {
        console.log(`  ❌ No samples`);
      }
    } catch (error) {
      console.error(`  ❌ Error:`, error.message);
    }
  }

  console.log('\n⚠️ No data found with any point name pattern');
  console.log('This suggests either:');
  console.log('  1. Data in D1 uses a different point name format');
  console.log('  2. Data is outside the queried time range');
  console.log('  3. Site name doesn\'t match');
}

queryD1Sample();
