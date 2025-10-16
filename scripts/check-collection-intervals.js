/**
 * Check ACE IoT Configured Points Collection Intervals
 *
 * This script queries the configured_points endpoint to verify
 * what collection intervals are actually set in the ACE IoT system.
 */

const API_BASE = 'https://flightdeck.aceiot.cloud/api';
const SITE_NAME = 'ses_falls_city';

async function checkCollectionIntervals() {
  const apiKey = process.env.ACE_API_KEY;
  if (!apiKey) {
    console.error('❌ Error: ACE_API_KEY environment variable not set');
    process.exit(1);
  }

  console.log('🔍 Checking ACE IoT Configured Points Collection Intervals\n');
  console.log(`Site: ${SITE_NAME}`);
  console.log(`API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

  let allPoints = [];
  let page = 1;
  let totalPages = 1;

  console.log('📡 Fetching configured points...\n');

  // Fetch all pages
  do {
    const url = `${API_BASE}/sites/${SITE_NAME}/configured_points?page=${page}&per_page=100`;

    try {
      const response = await fetch(url, {
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
      const points = data.items || data.configured_points || data.points || [];

      // Filter to only collect_enabled points
      const collectEnabled = points.filter(p => p.collect_enabled === true);
      allPoints.push(...collectEnabled);

      console.log(`Page ${page}: ${collectEnabled.length} collect-enabled points (${points.length} total)`);

      // Calculate total pages from metadata
      if (page === 1 && data.total) {
        totalPages = Math.ceil(data.total / (data.per_page || 100));
        console.log(`Total pages to fetch: ${totalPages} (${data.total} total points)\n`);
      }

      page++;

      // Safety check
      if (page > 100) {
        console.warn('⚠️  Safety limit reached, stopping pagination');
        break;
      }

    } catch (error) {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }

  } while (page <= totalPages);

  console.log(`\n✅ Fetched ${allPoints.length} collect-enabled configured points\n`);
  console.log('═'.repeat(100));

  // Analyze collection intervals
  const intervalCounts = {};

  for (const point of allPoints) {
    const interval = point.collect_interval || 'unknown';
    intervalCounts[interval] = (intervalCounts[interval] || 0) + 1;
  }

  console.log('\n📊 COLLECTION INTERVAL DISTRIBUTION:\n');

  const sortedIntervals = Object.entries(intervalCounts).sort((a, b) => {
    if (a[0] === 'unknown') return 1;
    if (b[0] === 'unknown') return -1;
    return parseInt(a[0]) - parseInt(b[0]);
  });

  for (const [interval, count] of sortedIntervals) {
    const percentage = ((count / allPoints.length) * 100).toFixed(1);
    const minutes = interval !== 'unknown' ? (parseInt(interval) / 60).toFixed(1) : 'N/A';
    console.log(`  ${interval} seconds (${minutes} min): ${count} points (${percentage}%)`);
  }

  console.log('\n═'.repeat(100));
  console.log('\n📋 SAMPLE POINTS (first 20):\n');

  for (let i = 0; i < Math.min(20, allPoints.length); i++) {
    const point = allPoints[i];
    const name = point.name || point.point_name || 'unknown';
    const interval = point.collect_interval || 'unknown';
    const shortName = name.length > 80 ? name.substring(0, 77) + '...' : name;

    console.log(`${i + 1}. ${shortName}`);
    console.log(`   Collect interval: ${interval} seconds (${interval !== 'unknown' ? (interval / 60).toFixed(1) : 'N/A'} minutes)`);
    console.log(`   Collect enabled: ${point.collect_enabled}`);
    console.log();
  }

  console.log('═'.repeat(100));
  console.log('\n🎯 SUMMARY:\n');

  const expectedInterval = 30;
  const actualInterval = sortedIntervals.length > 0 ? parseInt(sortedIntervals[0][0]) : 0;
  const mostCommonCount = sortedIntervals.length > 0 ? sortedIntervals[0][1] : 0;
  const mostCommonPercentage = ((mostCommonCount / allPoints.length) * 100).toFixed(1);

  console.log(`Expected collection interval: ${expectedInterval} seconds`);
  console.log(`Most common actual interval: ${actualInterval} seconds (${actualInterval / 60} minutes)`);
  console.log(`Points with this interval: ${mostCommonCount} / ${allPoints.length} (${mostCommonPercentage}%)\n`);

  if (actualInterval === expectedInterval) {
    console.log('✅ SUCCESS: Collection intervals match your expected 30-second setting!');
    console.log('\nThis means the ACE IoT API is configured correctly but is NOT');
    console.log('exposing the 30-second data through the timeseries/paginated endpoint.');
    console.log('\nContact ACE IoT support about this discrepancy.');
  } else {
    console.log(`❌ MISMATCH: Collection intervals are set to ${actualInterval} seconds, not ${expectedInterval} seconds!`);
    console.log('\nPossible causes:');
    console.log('  1. Collection interval needs to be updated in ACE IoT settings');
    console.log('  2. Different points may have different collection intervals');
    console.log('  3. Settings may not have been saved/applied correctly');
  }

  console.log('\n');
}

checkCollectionIntervals();
