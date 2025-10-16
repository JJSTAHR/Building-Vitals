/**
 * R2 Bucket Contents Inspector
 * 
 * This script creates a temporary worker to list R2 contents
 * Then analyzes the NDJSON.gz files to understand data availability
 * 
 * Run with:
 *   npx wrangler publish --name temp-r2-inspector
 *   curl https://temp-r2-inspector.workers.dev?inspect=timeseries/ses_falls_city/2025/
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const inspect = url.searchParams.get('inspect') || 'timeseries/ses_falls_city/';
    
    console.log(`[R2 Inspector] Listing bucket contents with prefix: ${inspect}`);
    
    try {
      const bucket = env.BUCKET; // R2 bucket binding from wrangler.toml
      
      if (!bucket) {
        return new Response(JSON.stringify({
          error: 'R2 bucket binding not found',
          help: 'Make sure BUCKET is bound in wrangler.toml'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // List all objects with this prefix
      const listed = await bucket.list({ prefix: inspect, limit: 1000 });
      
      // Filter for NDJSON.gz files
      const ndjsonFiles = listed.objects
        .filter(obj => obj.key.endsWith('.ndjson.gz'))
        .map(obj => ({
          key: obj.key,
          size: obj.size,
          sizeKB: (obj.size / 1024).toFixed(2),
          sizeMB: (obj.size / (1024 * 1024)).toFixed(2),
          uploaded: obj.uploaded?.toISOString() || 'unknown',
          etag: obj.etag
        }))
        .sort((a, b) => b.uploaded.localeCompare(a.uploaded));

      // Parse file paths to extract dates
      const filesByDate = {};
      const filesByMonth = {};
      
      for (const file of ndjsonFiles) {
        // Extract date from path: timeseries/{site}/{YYYY}/{MM}/{DD}.ndjson.gz
        const parts = file.key.split('/');
        if (parts.length >= 5) {
          const [_, site, year, month, day] = parts;
          const dateStr = `${year}-${month}-${day.replace('.ndjson.gz', '')}`;
          const monthStr = `${year}-${month}`;
          
          if (!filesByDate[dateStr]) filesByDate[dateStr] = [];
          if (!filesByMonth[monthStr]) filesByMonth[monthStr] = { count: 0, totalSize: 0, dates: [] };
          
          filesByDate[dateStr].push(file);
          filesByMonth[monthStr].count++;
          filesByMonth[monthStr].totalSize += file.size;
          filesByMonth[monthStr].dates.push(dateStr);
        }
      }

      // Compute statistics
      const sortedDates = Object.keys(filesByDate).sort().reverse();
      const oldestFile = ndjsonFiles.length > 0 ? ndjsonFiles[ndjsonFiles.length - 1] : null;
      const newestFile = ndjsonFiles.length > 0 ? ndjsonFiles[0] : null;

      return new Response(JSON.stringify({
        summary: {
          prefix: inspect,
          totalFiles: ndjsonFiles.length,
          totalSize: (ndjsonFiles.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(2) + ' MB',
          dateRange: ndjsonFiles.length > 0 
            ? `${sortedDates[sortedDates.length - 1]} to ${sortedDates[0]}`
            : 'NO DATA',
          newestFile: newestFile?.uploaded || 'N/A',
          oldestFile: oldestFile?.uploaded || 'N/A',
          daysWithData: sortedDates.length
        },
        byMonth: filesByMonth,
        recentDates: sortedDates.slice(0, 10),
        files: ndjsonFiles.slice(0, 50), // Show first 50 files
        hasMissingData: ndjsonFiles.length === 0
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[R2 Inspector] Error:', error);
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
