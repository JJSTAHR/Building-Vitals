/**
 * Test script to directly query ACE IoT API and verify data frequency
 * Run with: wrangler dev --local test-ace-api-frequency.js
 * Or deploy and call via HTTP
 */

export default {
  async fetch(request, env, ctx) {
    const apiBase = env.ACE_API_BASE || 'https://flightdeck.aceiot.cloud/api';
    const siteName = 'ses_falls_city';

    // Get last 1 hour of data to check frequency
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 60 * 60 * 1000); // 1 hour ago

    const url = new URL(`${apiBase}/sites/${siteName}/timeseries/paginated`);
    url.searchParams.set('start_time', startTime.toISOString());
    url.searchParams.set('end_time', endTime.toISOString());
    url.searchParams.set('page_size', '10000');
    url.searchParams.set('raw_data', 'true'); // REQUEST RAW DATA

    console.log('Fetching from ACE API:', url.toString());

    const response = await fetch(url.toString(), {
      headers: {
        'authorization': `Bearer ${env.ACE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ACE API Error:', response.status, errorText);
      return new Response(JSON.stringify({
        error: `API error: ${response.status} ${response.statusText}`,
        details: errorText,
        requestUrl: url.toString(),
        hasApiKey: !!env.ACE_API_KEY,
        apiKeyLength: env.ACE_API_KEY ? env.ACE_API_KEY.length : 0
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();

    // Analyze timestamp intervals
    const samples = data.point_samples || [];

    // Group by point name
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

    // Calculate intervals for each point
    const analysis = {};
    for (const [pointName, pointSamples] of Object.entries(pointGroups)) {
      // Sort by timestamp
      pointSamples.sort((a, b) => a.timestamp - b.timestamp);

      // Calculate intervals between consecutive samples
      const intervals = [];
      for (let i = 1; i < pointSamples.length; i++) {
        const intervalMs = pointSamples[i].timestamp - pointSamples[i-1].timestamp;
        const intervalSeconds = Math.round(intervalMs / 1000);
        intervals.push(intervalSeconds);
      }

      // Calculate statistics
      const avgInterval = intervals.length > 0
        ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length)
        : 0;
      const minInterval = intervals.length > 0 ? Math.min(...intervals) : 0;
      const maxInterval = intervals.length > 0 ? Math.max(...intervals) : 0;

      analysis[pointName] = {
        totalSamples: pointSamples.length,
        firstTimestamp: pointSamples[0]?.time,
        lastTimestamp: pointSamples[pointSamples.length - 1]?.time,
        intervals: {
          avg: avgInterval,
          min: minInterval,
          max: maxInterval,
          all: intervals.slice(0, 20) // Show first 20 intervals
        },
        samples: pointSamples.slice(0, 10) // Show first 10 samples
      };
    }

    return new Response(JSON.stringify({
      requestParams: {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        rawData: true,
        siteName
      },
      totalSamples: samples.length,
      uniquePoints: Object.keys(pointGroups).length,
      analysis,
      summary: {
        message: 'Check the intervals.avg field for each point to see the average time between samples in seconds.',
        expectedInterval: '30 seconds (per your collection interval setting)',
        actualIntervals: Object.entries(analysis).map(([name, data]) => ({
          point: name,
          avgIntervalSeconds: data.intervals.avg,
          totalSamples: data.totalSamples
        }))
      }
    }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
