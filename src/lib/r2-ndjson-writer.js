/**
 * R2 NDJSON.gz Writer Module
 *
 * Handles compressed NDJSON storage for timeseries data in Cloudflare R2.
 * Supports streaming compression and append mode for efficient data accumulation.
 *
 * Key Features:
 * - Deterministic R2 keys: timeseries/{site}/{YYYY}/{MM}/{DD}.ndjson.gz
 * - Streaming gzip compression for memory efficiency
 * - Append mode to accumulate samples across multiple Worker invocations
 * - Idempotent uploads with consistent key generation
 * - Comprehensive error handling and logging
 */

/**
 * Generate deterministic R2 key for timeseries data
 * @param {string} siteName - Site identifier (e.g., "ses_falls_city")
 * @param {string} date - Date string "YYYY-MM-DD"
 * @returns {string} R2 key path
 */
export function generateR2Key(siteName, date) {
  const [year, month, day] = date.split('-');
  return `timeseries/${siteName}/${year}/${month}/${day}.ndjson.gz`;
}

/**
 * Compress samples array to NDJSON.gz format using streaming compression
 * @param {Array} samples - Array of {point_name, timestamp, value}
 * @returns {Promise<Uint8Array>} Compressed NDJSON data
 */
export async function compressSamplesToNDJSON(samples) {
  // Convert samples to NDJSON format (one JSON object per line)
  const ndjsonLines = samples.map(sample =>
    JSON.stringify({
      point_name: sample.point_name,
      timestamp: sample.timestamp,
      value: sample.value
    })
  ).join('\n');

  // Add trailing newline if samples exist
  const ndjsonData = samples.length > 0 ? ndjsonLines + '\n' : '';

  // Create streaming compression
  const stream = new Response(ndjsonData).body;
  const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));

  // Read all compressed chunks into single Uint8Array
  const reader = compressedStream.getReader();
  const chunks = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  // Combine chunks into single array
  const compressed = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }

  return compressed;
}

/**
 * Decompress NDJSON.gz data from R2
 * @param {ArrayBuffer} compressedData - Compressed NDJSON data
 * @returns {Promise<Array>} Array of parsed samples
 */
export async function decompressNDJSONFromR2(compressedData) {
  // Create decompression stream
  const stream = new Response(compressedData).body;
  const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));

  // Read decompressed data
  const reader = decompressedStream.getReader();
  const chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }

  // Combine chunks and convert to text
  const decoder = new TextDecoder();
  const ndjsonText = chunks.map(chunk => decoder.decode(chunk, { stream: true })).join('');

  // Parse NDJSON lines
  const samples = [];
  const lines = ndjsonText.split('\n').filter(line => line.trim());

  for (const line of lines) {
    try {
      const sample = JSON.parse(line);
      samples.push(sample);
    } catch (error) {
      console.error('Failed to parse NDJSON line:', line, error);
    }
  }

  return samples;
}

/**
 * Append new samples to existing R2 file
 * @param {R2Bucket} r2Bucket - R2 bucket binding
 * @param {string} key - R2 object key
 * @param {Array} newSamples - New samples to append
 * @returns {Promise<Array>} Combined samples array
 */
export async function appendToExistingFile(r2Bucket, key, newSamples) {
  try {
    // Attempt to read existing file
    const existingObject = await r2Bucket.get(key);

    if (!existingObject) {
      // No existing file, return new samples only
      return newSamples;
    }

    // Decompress existing data
    const existingData = await existingObject.arrayBuffer();
    const existingSamples = await decompressNDJSONFromR2(existingData);

    // Combine existing and new samples
    // Remove duplicates based on point_name + timestamp
    const sampleMap = new Map();

    for (const sample of [...existingSamples, ...newSamples]) {
      const key = `${sample.point_name}:${sample.timestamp}`;
      sampleMap.set(key, sample);
    }

    // Convert back to array and sort by timestamp
    const combinedSamples = Array.from(sampleMap.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    return combinedSamples;

  } catch (error) {
    console.error('Error reading existing R2 file:', error);
    // If decompression or parsing fails, return only new samples
    return newSamples;
  }
}

/**
 * Write samples to R2 as compressed NDJSON
 *
 * @param {R2Bucket} r2Bucket - R2 bucket binding from environment
 * @param {string} siteName - Site identifier (e.g., "ses_falls_city")
 * @param {string} date - Date string "YYYY-MM-DD"
 * @param {Array} samples - Array of {point_name, timestamp, value}
 * @param {Object} options - Configuration options
 * @param {boolean} options.append - If true, merge with existing file (default: true)
 * @param {boolean} options.deduplicate - If true, remove duplicate samples (default: true)
 * @returns {Promise<Object>} Result object with success status and metadata
 *
 * @example
 * const result = await writeNDJSONToR2(
 *   env.R2_BUCKET,
 *   "ses_falls_city",
 *   "2024-01-15",
 *   [
 *     { point_name: "ses/ses_falls_city/temp", timestamp: 1705334400000, value: 72.5 },
 *     { point_name: "ses/ses_falls_city/temp", timestamp: 1705334430000, value: 72.6 }
 *   ],
 *   { append: true }
 * );
 */
export async function writeNDJSONToR2(r2Bucket, siteName, date, samples, options = {}) {
  const startTime = Date.now();
  const { append = true, deduplicate = true } = options;

  try {
    // Validate inputs
    if (!r2Bucket) {
      throw new Error('R2 bucket binding is required');
    }
    if (!siteName || typeof siteName !== 'string') {
      throw new Error('Valid site name is required');
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Valid date in YYYY-MM-DD format is required');
    }
    if (!Array.isArray(samples)) {
      throw new Error('Samples must be an array');
    }

    // Generate R2 key
    const r2Key = generateR2Key(siteName, date);

    // Prepare samples for writing
    let samplesToWrite = samples;

    // Handle append mode
    if (append && samples.length > 0) {
      samplesToWrite = await appendToExistingFile(r2Bucket, r2Key, samples);
      console.log(`Append mode: Combined ${samples.length} new samples with existing data. Total: ${samplesToWrite.length}`);
    }

    // Validate sample structure
    for (const sample of samplesToWrite) {
      if (!sample.point_name || typeof sample.timestamp !== 'number' || sample.value === undefined) {
        throw new Error('Invalid sample structure. Each sample must have point_name, timestamp, and value');
      }
    }

    // Compress to NDJSON.gz
    const compressedData = await compressSamplesToNDJSON(samplesToWrite);
    const compressionRatio = samplesToWrite.length > 0
      ? (compressedData.length / (JSON.stringify(samplesToWrite).length))
      : 0;

    // Upload to R2
    await r2Bucket.put(r2Key, compressedData, {
      httpMetadata: {
        contentType: 'application/x-ndjson',
        contentEncoding: 'gzip',
      },
      customMetadata: {
        site_name: siteName,
        date: date,
        sample_count: samplesToWrite.length.toString(),
        original_size: JSON.stringify(samplesToWrite).length.toString(),
        compressed_size: compressedData.length.toString(),
        compression_ratio: compressionRatio.toFixed(3),
        created_at: new Date().toISOString(),
      },
    });

    const duration = Date.now() - startTime;

    // Return success result
    return {
      success: true,
      r2_key: r2Key,
      samples_written: samplesToWrite.length,
      new_samples: samples.length,
      file_size: compressedData.length,
      compression_ratio: compressionRatio,
      duration_ms: duration,
      append_mode: append,
      deduplicated: deduplicate && append,
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    console.error('Error writing NDJSON to R2:', error);

    // Return failure result with details
    return {
      success: false,
      error: error.message,
      error_stack: error.stack,
      samples_attempted: samples.length,
      duration_ms: duration,
      site_name: siteName,
      date: date,
    };
  }
}

/**
 * Read samples from R2 NDJSON.gz file
 * @param {R2Bucket} r2Bucket - R2 bucket binding
 * @param {string} siteName - Site identifier
 * @param {string} date - Date string "YYYY-MM-DD"
 * @returns {Promise<Object>} Result with samples array
 */
export async function readNDJSONFromR2(r2Bucket, siteName, date) {
  const startTime = Date.now();

  try {
    const r2Key = generateR2Key(siteName, date);
    const object = await r2Bucket.get(r2Key);

    if (!object) {
      return {
        success: false,
        error: 'File not found',
        r2_key: r2Key,
        samples: [],
      };
    }

    const compressedData = await object.arrayBuffer();
    const samples = await decompressNDJSONFromR2(compressedData);
    const duration = Date.now() - startTime;

    return {
      success: true,
      r2_key: r2Key,
      samples: samples,
      sample_count: samples.length,
      file_size: compressedData.byteLength,
      duration_ms: duration,
      metadata: object.customMetadata,
    };

  } catch (error) {
    const duration = Date.now() - startTime;

    return {
      success: false,
      error: error.message,
      duration_ms: duration,
      samples: [],
    };
  }
}

/**
 * Delete R2 NDJSON.gz file
 * @param {R2Bucket} r2Bucket - R2 bucket binding
 * @param {string} siteName - Site identifier
 * @param {string} date - Date string "YYYY-MM-DD"
 * @returns {Promise<Object>} Result with success status
 */
export async function deleteNDJSONFromR2(r2Bucket, siteName, date) {
  try {
    const r2Key = generateR2Key(siteName, date);
    await r2Bucket.delete(r2Key);

    return {
      success: true,
      r2_key: r2Key,
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * List all NDJSON files for a site
 * @param {R2Bucket} r2Bucket - R2 bucket binding
 * @param {string} siteName - Site identifier
 * @param {Object} options - List options
 * @returns {Promise<Object>} Result with file list
 */
export async function listNDJSONFiles(r2Bucket, siteName, options = {}) {
  try {
    const prefix = `timeseries/${siteName}/`;
    const listed = await r2Bucket.list({
      prefix: prefix,
      limit: options.limit || 1000,
    });

    const files = listed.objects.map(obj => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      metadata: obj.customMetadata,
    }));

    return {
      success: true,
      files: files,
      truncated: listed.truncated,
      count: files.length,
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      files: [],
    };
  }
}
