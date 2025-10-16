/**
 * ============================================================================
 * R2 Client Library - NDJSON.gz File Reader for Cold Storage
 * ============================================================================
 *
 * Provides functions to read and filter NDJSON.gz files from R2 cold storage.
 * Implements efficient streaming decompression and row filtering for timeseries queries.
 *
 * File Structure: /timeseries/{site_name}/{YYYY}/{MM}/{DD}.ndjson.gz
 * Format: Newline-delimited JSON with gzip compression
 * Schema: { timestamp: number, point_name: string, value: number }
 *
 * Features:
 * - Daily partition path resolution
 * - Parallel file reading (up to 10 concurrent)
 * - Filtering for point_names and timestamp range
 * - Streaming gzip decompression
 * - Error recovery with partial results
 *
 * Implementation:
 * - Uses native DecompressionStream API (Cloudflare Workers)
 * - No external dependencies
 * - Efficient memory usage with streaming reads
 *
 * @module r2-client
 */

import { decompressNDJSONFromR2 } from './r2-ndjson-writer.js';

// ============================================================================
// Constants
// ============================================================================

const MAX_CONCURRENT_FILES = 10; // Limit parallel R2 reads
const GZIP_MAGIC = [0x1f, 0x8b]; // Gzip file magic bytes

// ============================================================================
// Main Query Function
// ============================================================================

/**
 * Query timeseries data from R2 cold storage (NDJSON.gz files)
 *
 * @param {R2Bucket} bucket - R2 bucket instance
 * @param {string} siteName - Site identifier
 * @param {Array<string>} pointNames - Point names to filter
 * @param {number} startTime - Start timestamp (milliseconds)
 * @param {number} endTime - End timestamp (milliseconds)
 * @returns {Promise<Array>} Array of samples
 */
export async function queryR2Timeseries(bucket, siteName, pointNames, startTime, endTime) {
  console.log(`[R2] Querying ${pointNames.length} points from ${new Date(startTime).toISOString()} to ${new Date(endTime).toISOString()}`);

  try {
    // Determine which daily NDJSON.gz files to read
    const filePaths = generateFilePaths(siteName, startTime, endTime);
    console.log(`[R2] Need to read ${filePaths.length} daily NDJSON.gz files`);

    if (filePaths.length === 0) {
      return [];
    }

    // Read files in parallel (with concurrency limit)
    const allSamples = [];

    for (let i = 0; i < filePaths.length; i += MAX_CONCURRENT_FILES) {
      const batch = filePaths.slice(i, i + MAX_CONCURRENT_FILES);

      const batchResults = await Promise.allSettled(
        batch.map(path => readAndFilterNDJSONFile(bucket, path, pointNames, startTime, endTime))
      );

      // Collect successful results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          allSamples.push(...result.value);
        } else {
          console.error(`[R2] Failed to read file:`, result.reason);
        }
      }
    }

    // Sort by point_name, then timestamp
    allSamples.sort((a, b) => {
      if (a.point_name !== b.point_name) {
        return a.point_name.localeCompare(b.point_name);
      }
      return a.timestamp - b.timestamp;
    });

    console.log(`[R2] Query returned ${allSamples.length} samples from ${filePaths.length} files`);

    return allSamples;

  } catch (error) {
    console.error('[R2] Query failed:', error);
    throw error;
  }
}

// ============================================================================
// File Path Generation
// ============================================================================

/**
 * Generate R2 file paths for all days in the time range
 * Path format: /timeseries/{site_name}/{YYYY}/{MM}/{DD}.ndjson.gz
 *
 * @param {string} siteName - Site identifier
 * @param {number} startTime - Start timestamp (milliseconds)
 * @param {number} endTime - End timestamp (milliseconds)
 * @returns {Array<string>} Array of R2 file paths
 */
function generateFilePaths(siteName, startTime, endTime) {
  const paths = [];

  // Start from beginning of start day
  const startDate = new Date(startTime);
  startDate.setHours(0, 0, 0, 0);

  // End at end of end day
  const endDate = new Date(endTime);
  endDate.setHours(23, 59, 59, 999);

  // Iterate through each day
  const current = new Date(startDate);

  while (current <= endDate) {
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');

    const path = `timeseries/${siteName}/${year}/${month}/${day}.ndjson.gz`;
    paths.push(path);

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  return paths;
}

// ============================================================================
// NDJSON.gz File Reading (Production Implementation)
// ============================================================================

/**
 * Read and filter a single NDJSON.gz file from R2
 *
 * Uses native DecompressionStream for efficient gzip decompression in Cloudflare Workers.
 * Applies filtering for point names and timestamp range after decompression.
 *
 * @param {R2Bucket} bucket - R2 bucket instance
 * @param {string} filePath - Path to NDJSON.gz file in R2
 * @param {Array<string>} pointNames - Point names to filter
 * @param {number} startTime - Start timestamp (milliseconds)
 * @param {number} endTime - End timestamp (milliseconds)
 * @returns {Promise<Array>} Filtered samples from this file
 */
async function readAndFilterNDJSONFile(bucket, filePath, pointNames, startTime, endTime) {
  console.log(`[R2] Reading file: ${filePath}`);

  try {
    // Check if file exists
    const object = await bucket.head(filePath);

    if (!object) {
      console.log(`[R2] File not found: ${filePath}`);
      return [];
    }

    console.log(`[R2] File exists: ${filePath} (${object.size} bytes)`);

    // Download NDJSON.gz file from R2
    const fileData = await bucket.get(filePath);
    if (!fileData) {
      console.error(`[R2] Failed to download ${filePath}`);
      return [];
    }

    const arrayBuffer = await fileData.arrayBuffer();
    console.log(`[R2] Downloaded ${filePath}: ${arrayBuffer.byteLength} bytes`);

    // Verify gzip magic number
    if (!isValidGzipFile(arrayBuffer)) {
      console.error(`[R2] Invalid gzip file: ${filePath}`);
      return [];
    }

    // Decompress and parse NDJSON file
    const allSamples = await decompressNDJSONFromR2(arrayBuffer);
    console.log(`[R2] Decompressed ${filePath}: ${allSamples.length} total samples`);

    // Filter samples
    const filteredSamples = filterSamples(allSamples, pointNames, startTime, endTime);
    console.log(`[R2] Filtered ${filePath}: ${filteredSamples.length} samples matched criteria`);

    return filteredSamples;

  } catch (error) {
    console.error(`[R2] Error reading ${filePath}:`, error);
    // Return empty array on error to allow other files to succeed
    return [];
  }
}

/**
 * Filter samples by point names and timestamp range
 *
 * @param {Array} samples - Array of decompressed samples
 * @param {Array<string>} pointNames - Point names to include
 * @param {number} startTime - Start timestamp (milliseconds)
 * @param {number} endTime - End timestamp (milliseconds)
 * @returns {Array} Filtered samples
 */
function filterSamples(samples, pointNames, startTime, endTime) {
  const pointSet = new Set(pointNames); // Fast O(1) lookup
  const filtered = [];

  for (const sample of samples) {
    // Validate sample structure
    if (!sample || typeof sample !== 'object') {
      continue;
    }

    // Extract fields
    const pointName = sample.point_name;
    const timestamp = sample.timestamp;
    const value = sample.value;

    // Skip invalid samples
    if (!pointName || timestamp === undefined || value === undefined) {
      continue;
    }

    // Filter by point name
    if (!pointSet.has(pointName)) {
      continue;
    }

    // Filter by timestamp range
    if (timestamp < startTime || timestamp > endTime) {
      continue;
    }

    // Add to filtered results
    filtered.push({
      point_name: pointName,
      timestamp: timestamp,
      value: value
    });
  }

  return filtered;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify gzip file magic bytes
 *
 * @param {ArrayBuffer} buffer - File data
 * @returns {boolean} True if valid gzip file
 */
function isValidGzipFile(buffer) {
  if (buffer.byteLength < 2) {
    return false;
  }

  const view = new Uint8Array(buffer, 0, 2);
  return view[0] === GZIP_MAGIC[0] && view[1] === GZIP_MAGIC[1];
}

/**
 * Calculate metadata from NDJSON.gz file path
 * (Used for query optimization)
 *
 * @param {string} filePath - R2 file path
 * @returns {Object} File metadata
 */
export function parseFileMetadata(filePath) {
  // Extract date from path: timeseries/{site}/{YYYY}/{MM}/{DD}.ndjson.gz
  const parts = filePath.split('/');

  if (parts.length !== 5) {
    throw new Error(`Invalid file path format: ${filePath}`);
  }

  const [_, siteName, year, month, day] = parts;
  const dateStr = `${year}-${month}-${day.replace('.ndjson.gz', '')}`;

  return {
    site_name: siteName,
    date: dateStr,
    year: parseInt(year),
    month: parseInt(month),
    day: parseInt(day.replace('.ndjson.gz', '')),
    file_path: filePath
  };
}

// ============================================================================
// Future Enhancements (Wave 3+)
// ============================================================================

/**
 * List all available NDJSON.gz files for a site
 * (Useful for manifest generation and query optimization)
 *
 * @param {R2Bucket} bucket - R2 bucket instance
 * @param {string} siteName - Site identifier
 * @returns {Promise<Array>} List of file metadata
 */
export async function listTimeseriesFiles(bucket, siteName) {
  const prefix = `timeseries/${siteName}/`;
  const files = [];

  const listed = await bucket.list({ prefix });

  for (const object of listed.objects) {
    if (object.key.endsWith('.ndjson.gz')) {
      files.push({
        key: object.key,
        size: object.size,
        uploaded: object.uploaded,
        metadata: parseFileMetadata(object.key)
      });
    }
  }

  return files;
}

/**
 * Generate manifest file for a specific day
 * (Speeds up queries by providing min/max timestamps, point counts, etc.)
 *
 * @param {Object} fileInfo - NDJSON.gz file metadata
 * @returns {Object} Manifest JSON
 */
export function generateManifest(fileInfo) {
  return {
    date: fileInfo.date,
    site_name: fileInfo.site_name,
    file_path: fileInfo.file_path,
    file_size_bytes: fileInfo.size,
    compression: 'gzip',
    created_at: fileInfo.uploaded,

    // These will be populated by reading the NDJSON.gz file
    row_count: null,
    min_timestamp: null,
    max_timestamp: null,
    point_count: null,
    point_names: null
  };
}

// ============================================================================
// Legacy Functions (Preserved for Compatibility)
// ============================================================================

/**
 * Upload a NDJSON.gz file to R2
 * @param {R2Bucket} r2 - R2 bucket binding
 * @param {string} key - Object key/path in R2
 * @param {Buffer|ArrayBuffer|Uint8Array} data - NDJSON.gz file data
 * @param {Object} options - Additional options
 * @returns {Promise<void>}
 */
export async function uploadNDJSONFile(r2, key, data, options = {}) {
  if (!r2) {
    throw new Error('R2 bucket binding not found');
  }

  if (!key) {
    throw new Error('R2 key is required');
  }

  if (!data || data.byteLength === 0) {
    throw new Error('Data is required and cannot be empty');
  }

  const metadata = {
    uploadedAt: new Date().toISOString(),
    contentType: 'application/x-ndjson',
    recordCount: options.recordCount || 'unknown',
    ...options.metadata
  };

  try {
    await r2.put(key, data, {
      httpMetadata: {
        contentType: 'application/x-ndjson',
        contentEncoding: 'gzip'
      },
      customMetadata: metadata
    });

    console.log(`R2: Successfully uploaded ${key} (${data.byteLength} bytes)`);
  } catch (error) {
    console.error(`R2: Failed to upload ${key}:`, error);
    throw new Error(`R2 upload failed: ${error.message}`);
  }
}

/**
 * Check if a file exists in R2
 * @param {R2Bucket} r2 - R2 bucket binding
 * @param {string} key - Object key/path to check
 * @returns {Promise<boolean>}
 */
export async function checkFileExists(r2, key) {
  if (!r2) {
    throw new Error('R2 bucket binding not found');
  }

  if (!key) {
    throw new Error('R2 key is required');
  }

  try {
    const object = await r2.head(key);
    return object !== null;
  } catch (error) {
    console.error(`R2: Error checking existence of ${key}:`, error);
    return false;
  }
}

/**
 * List NDJSON.gz files in R2 with optional prefix filter
 * @param {R2Bucket} r2 - R2 bucket binding
 * @param {string} prefix - Prefix to filter by (e.g., 'timeseries/2024/')
 * @param {Object} options - List options
 * @returns {Promise<Array>} Array of R2 objects
 */
export async function listNDJSONFiles(r2, prefix = '', options = {}) {
  if (!r2) {
    throw new Error('R2 bucket binding not found');
  }

  const allObjects = [];
  let cursor = options.cursor;
  const maxKeys = options.maxKeys || 1000;

  try {
    let hasMore = true;

    while (hasMore) {
      const listed = await r2.list({
        prefix,
        cursor,
        limit: Math.min(maxKeys - allObjects.length, 1000)
      });

      // Filter for .ndjson.gz files only
      const ndjsonFiles = listed.objects.filter(obj => obj.key.endsWith('.ndjson.gz'));
      allObjects.push(...ndjsonFiles);

      cursor = listed.truncated ? listed.cursor : null;
      hasMore = listed.truncated && allObjects.length < maxKeys;
    }

    console.log(`R2: Listed ${allObjects.length} NDJSON.gz files with prefix '${prefix}'`);
    return allObjects;

  } catch (error) {
    console.error(`R2: Failed to list files with prefix ${prefix}:`, error);
    throw new Error(`R2 list failed: ${error.message}`);
  }
}

/**
 * Get metadata for a NDJSON.gz file without downloading it
 * @param {R2Bucket} r2 - R2 bucket binding
 * @param {string} key - Object key
 * @returns {Promise<Object|null>} Object metadata or null if not found
 */
export async function getFileMetadata(r2, key) {
  if (!r2) {
    throw new Error('R2 bucket binding not found');
  }

  try {
    const object = await r2.head(key);

    if (!object) {
      return null;
    }

    return {
      key: object.key,
      size: object.size,
      etag: object.etag,
      uploaded: object.uploaded,
      httpMetadata: object.httpMetadata,
      customMetadata: object.customMetadata
    };
  } catch (error) {
    console.error(`R2: Failed to get metadata for ${key}:`, error);
    return null;
  }
}

/**
 * Download a NDJSON.gz file from R2
 * @param {R2Bucket} r2 - R2 bucket binding
 * @param {string} key - Object key
 * @returns {Promise<ArrayBuffer|null>} File data or null if not found
 */
export async function downloadNDJSONFile(r2, key) {
  if (!r2) {
    throw new Error('R2 bucket binding not found');
  }

  try {
    const object = await r2.get(key);

    if (!object) {
      console.warn(`R2: File not found: ${key}`);
      return null;
    }

    const data = await object.arrayBuffer();
    console.log(`R2: Downloaded ${key} (${data.byteLength} bytes)`);

    return data;
  } catch (error) {
    console.error(`R2: Failed to download ${key}:`, error);
    throw new Error(`R2 download failed: ${error.message}`);
  }
}

/**
 * Delete a NDJSON.gz file from R2
 * @param {R2Bucket} r2 - R2 bucket binding
 * @param {string} key - Object key to delete
 * @returns {Promise<void>}
 */
export async function deleteNDJSONFile(r2, key) {
  if (!r2) {
    throw new Error('R2 bucket binding not found');
  }

  try {
    await r2.delete(key);
    console.log(`R2: Deleted ${key}`);
  } catch (error) {
    console.error(`R2: Failed to delete ${key}:`, error);
    throw new Error(`R2 delete failed: ${error.message}`);
  }
}
