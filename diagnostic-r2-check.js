/**
 * R2 Bucket Contents Inspector
 * Diagnostic worker to check NDJSON.gz file availability
 * 
 * Run with:
 *   npx wrangler publish diagnostic-r2-check.js --name temp-r2-inspector
 *
 * Then call:
 *   https://temp-r2-inspector.your-account.workers.dev?site=ses_falls_city
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const site = url.searchParams.get('site') || 'ses_falls_city';
    const datePrefix = url.searchParams.get('date') || '';

    console.log(`[Inspector] Checking R2 bucket for site: ${site}`);

    try {
      const bucket = env.BUCKET;
      if (!bucket) {
        return new Response(JSON.stringify({
          error: 'R2 BUCKET binding not found',
          help: 'Ensure BUCKET is bound in wrangler.toml'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Build the prefix to search
      let searchPrefix = `timeseries/${site}/`;
      if (datePrefix) {
        // datePrefix can be like "2025/10" or "2025/10/15"
        searchPrefix += datePrefix;
      }

      console.log(`[Inspector] Searching with prefix: ${searchPrefix}`);

      // List all objects with this prefix (paginated)
      const files = [];
      let cursor = null;
      let iterations = 0;
      const maxIterations = 50; // Safety limit

      do {
        iterations++;
        if (iterations > maxIterations) {
          console.warn(`[Inspector] Reached max iterations (${maxIterations})`);
          break;
        }

        const listResult = await bucket.list({
          prefix: searchPrefix,
          cursor: cursor,
          limit: 500 // Batch size
        });

        // Filter for NDJSON.gz files
        const ndjsonFiles = listResult.objects.filter(obj => obj.key.endsWith('.ndjson.gz'));

        for (const obj of ndjsonFiles) {
          files.push({
            key: obj.key,
            size: obj.size,
            sizeKB: Number((obj.size / 1024).toFixed(2)),
            sizeMB: Number((obj.size / (1024 * 1024)).toFixed(2)),
            uploaded: obj.uploaded ? obj.uploaded.toISOString() : null,
            etag: obj.etag
          });
        }

        console.log(`[Inspector] Iteration ${iterations}: Found ${ndjsonFiles.length} files in this batch`);

        // Check if there are more results
        cursor = listResult.truncated ? listResult.cursor : null;

      } while (cursor);

      // Sort by date (newest first)
      files.sort((a, b) => {
        // Extract date from path for sorting
        const aDate = a.key.split('/').slice(-3, -1).join('-') + '-' + a.key.split('/').pop().replace('.ndjson.gz', '');
        const bDate = b.key.split('/').slice(-3, -1).join('-') + '-' + b.key.split('/').pop().replace('.ndjson.gz', '');
        return bDate.localeCompare(aDate);
      });

      // Analyze the data
      const analysis = {
        prefix: searchPrefix,
        totalFiles: files.length,
        totalSize: Number((files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024)).toFixed(2)),
        totalSizeGB: Number((files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024 * 1024)).toFixed(2)),
        avgFileSize: files.length > 0 ? Number((files.reduce((sum, f) => sum + f.size, 0) / files.length / 1024).toFixed(2)) : 0,
        oldestFile: files.length > 0 ? files[files.length - 1] : null,
        newestFile: files.length > 0 ? files[0] : null,
        dateRange: files.length > 0 
          ? `${files[files.length - 1].key.split('/').slice(-3).join('/')} to ${files[0].key.split('/').slice(-3).join('/')}`
          : 'NO DATA'
      };

      // Build response
      const response = {
        summary: analysis,
        hasData: files.length > 0,
        recommendations: [],
        files: files.slice(0, 100) // Show first 100 files
      };

      // Add recommendations
      if (files.length === 0) {
        response.recommendations.push('No NDJSON.gz files found in R2');
        response.recommendations.push('Check: Is the ETL worker writing to R2?');
        response.recommendations.push('Check: Does the site name match exactly?');
        response.recommendations.push('Action: Verify ETL worker has R2_BUCKET binding');
      } else if (files.length < 10) {
        response.recommendations.push(`Only ${files.length} files found - may have limited historical data`);
        response.recommendations.push('Check: Is ETL worker running recently?');
        response.recommendations.push('Expected: ~30 files for 30 days of data');
      } else {
        response.recommendations.push('Good: Historical data exists in R2');
        response.recommendations.push('Data spans: ' + analysis.dateRange);
      }

      return new Response(JSON.stringify(response, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('[Inspector] Error:', error);
      return new Response(JSON.stringify({
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
