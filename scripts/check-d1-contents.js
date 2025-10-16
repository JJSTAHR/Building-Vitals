/**
 * Check D1 Database Contents
 * Verify what data is actually stored in D1
 */

async function checkD1Contents() {
  console.log('🔍 Checking D1 Database Contents\n');

  // Get sample of data from D1
  const url = 'https://building-vitals-query.jstahr.workers.dev/d1-sample';

  try {
    const response = await fetch(url);

    if (!response.ok) {
      // Try alternate method - query any recent data
      console.log('Trying to query any recent data...\n');

      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);

      const queryUrl = new URL('https://building-vitals-query.jstahr.workers.dev/timeseries/query');
      queryUrl.searchParams.set('site_name', 'ses_falls_city');
      queryUrl.searchParams.set('point_names', 'Damper'); // Try short name
      queryUrl.searchParams.set('start_time', oneHourAgo.toString());
      queryUrl.searchParams.set('end_time', now.toString());

      const queryResponse = await fetch(queryUrl.toString());
      const queryData = await queryResponse.json();

      console.log('Query response:', JSON.stringify(queryData, null, 2));
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Let's also check the ETL worker logs to see what point names are being stored
  console.log('\n📋 Check ETL worker to see what point names are being collected:');
  console.log('   View logs at: https://dash.cloudflare.com or use:');
  console.log('   npx wrangler tail --config workers/wrangler-etl.toml --env production\n');

  console.log('💡 TIP: The ETL worker status showed 115,361 samples in D1.');
  console.log('   Let me try to find out what point names exist...\n');
}

checkD1Contents();
