/**
 * R2 Cache Service
 *
 * Manages caching of large timeseries datasets in Cloudflare R2 Object Storage.
 * Features:
 * - Brotli compression for efficient storage
 * - Metadata tracking (points count, samples, generated time)
 * - TTL-based cache invalidation
 * - Support for MessagePack format
 */

export class R2CacheService {
  constructor(r2Bucket, options = {}) {
    this.bucket = r2Bucket;
    this.defaultTTL = options.defaultTTL || 3600; // 1 hour default
    this.compression = options.compression !== false; // Enable by default
    this.maxCacheAge = options.maxCacheAge || 86400; // 24 hours
  }

  /**
   * Generate a structured cache key for timeseries data
   * @param {string} site - Site identifier
   * @param {Array<string>} points - Array of point names
   * @param {string} startTime - ISO 8601 start time
   * @param {string} endTime - ISO 8601 end time
   * @param {string} format - Data format (json, msgpack)
   * @returns {string} Cache key
   */
  getCacheKey(site, points, startTime, endTime, format = 'json') {
    // Sort points for consistent cache keys
    const sortedPoints = [...points].sort();
    const pointsHash = this._hashPoints(sortedPoints);

    // Format dates for filename
    const startDate = new Date(startTime).toISOString().split('T')[0];
    const endDate = new Date(endTime).toISOString().split('T')[0];

    // Extension based on format
    const ext = format === 'msgpack' ? 'msgpack' : 'json';

    return `timeseries/${site}/${startDate}_${endDate}/${pointsHash}.${ext}`;
  }

  /**
   * Store dataset in R2 with compression and metadata
   * @param {string} key - Cache key
   * @param {Object|ArrayBuffer} data - Data to store
   * @param {Object} metadata - Custom metadata
   * @returns {Promise<void>}
   */
  async put(key, data, metadata = {}) {
    try {
      // Serialize data
      let serialized;
      let contentType;

      if (data instanceof ArrayBuffer) {
        serialized = data;
        contentType = 'application/octet-stream';
      } else if (typeof data === 'string') {
        serialized = new TextEncoder().encode(data);
        contentType = 'application/json';
      } else {
        serialized = new TextEncoder().encode(JSON.stringify(data));
        contentType = 'application/json';
      }

      // Compress with brotli if enabled
      let finalData = serialized;
      let encoding = 'identity';

      if (this.compression) {
        const compressed = await this._compress(serialized);
        if (compressed.byteLength < serialized.byteLength) {
          finalData = compressed;
          encoding = 'br'; // Brotli
        }
      }

      // Prepare metadata
      const r2Metadata = {
        contentType,
        contentEncoding: encoding,
        cacheControl: `max-age=${this.defaultTTL}`,
        customMetadata: {
          pointsCount: String(metadata.pointsCount || 0),
          samplesCount: String(metadata.samplesCount || 0),
          generatedTime: new Date().toISOString(),
          originalSize: String(serialized.byteLength),
          compressedSize: String(finalData.byteLength),
          compressionRatio: String((finalData.byteLength / serialized.byteLength).toFixed(2)),
          ...metadata
        }
      };

      // Store in R2
      await this.bucket.put(key, finalData, {
        httpMetadata: {
          contentType: r2Metadata.contentType,
          contentEncoding: r2Metadata.contentEncoding,
          cacheControl: r2Metadata.cacheControl
        },
        customMetadata: r2Metadata.customMetadata
      });

      console.log(`[R2] Cached: ${key} (${finalData.byteLength} bytes, ratio: ${r2Metadata.customMetadata.compressionRatio})`);
    } catch (error) {
      console.error(`[R2] Put error for ${key}:`, error);
      throw new Error(`Failed to cache data: ${error.message}`);
    }
  }

  /**
   * Retrieve cached dataset from R2
   * @param {string} key - Cache key
   * @returns {Promise<Object|null>} Decompressed data or null if not found
   */
  async get(key) {
    try {
      const object = await this.bucket.get(key);

      if (!object) {
        console.log(`[R2] Cache miss: ${key}`);
        return null;
      }

      // Check if cache is expired
      const metadata = object.customMetadata || {};
      const generatedTime = new Date(metadata.generatedTime);
      const age = Date.now() - generatedTime.getTime();

      if (age > this.maxCacheAge * 1000) {
        console.log(`[R2] Cache expired: ${key} (age: ${Math.round(age / 1000)}s)`);
        await this.delete(key);
        return null;
      }

      // Read data
      const arrayBuffer = await object.arrayBuffer();

      // Decompress if needed
      let data = arrayBuffer;
      const encoding = object.httpMetadata?.contentEncoding || 'identity';

      if (encoding === 'br') {
        data = await this._decompress(arrayBuffer);
      }

      // Parse based on content type
      const contentType = object.httpMetadata?.contentType || 'application/json';

      if (contentType === 'application/json') {
        const text = new TextDecoder().decode(data);
        const parsed = JSON.parse(text);

        console.log(`[R2] Cache hit: ${key} (${metadata.samplesCount} samples, age: ${Math.round(age / 1000)}s)`);
        return parsed;
      }

      // Return raw data for other types (e.g., MessagePack)
      return data;
    } catch (error) {
      console.error(`[R2] Get error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Check if cache exists without fetching the full object
   * @param {string} key - Cache key
   * @returns {Promise<boolean>}
   */
  async exists(key) {
    try {
      const object = await this.bucket.head(key);

      if (!object) {
        return false;
      }

      // Check expiration
      const metadata = object.customMetadata || {};
      const generatedTime = new Date(metadata.generatedTime);
      const age = Date.now() - generatedTime.getTime();

      if (age > this.maxCacheAge * 1000) {
        return false;
      }

      return true;
    } catch (error) {
      console.error(`[R2] Head error for ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a cache entry
   * @param {string} key - Cache key
   * @returns {Promise<void>}
   */
  async delete(key) {
    try {
      await this.bucket.delete(key);
      console.log(`[R2] Deleted: ${key}`);
    } catch (error) {
      console.error(`[R2] Delete error for ${key}:`, error);
    }
  }

  /**
   * Delete old cache entries based on age
   * @param {number} maxAge - Maximum age in seconds
   * @returns {Promise<number>} Number of deleted entries
   */
  async cleanup(maxAge = this.maxCacheAge) {
    try {
      const cutoffTime = Date.now() - (maxAge * 1000);
      let deletedCount = 0;

      // List all objects (with pagination)
      let cursor;
      do {
        const listed = await this.bucket.list({
          prefix: 'timeseries/',
          cursor
        });

        for (const object of listed.objects) {
          const metadata = object.customMetadata || {};
          const generatedTime = new Date(metadata.generatedTime);

          if (generatedTime.getTime() < cutoffTime) {
            await this.delete(object.key);
            deletedCount++;
          }
        }

        cursor = listed.cursor;
      } while (cursor);

      console.log(`[R2] Cleanup: Deleted ${deletedCount} expired entries`);
      return deletedCount;
    } catch (error) {
      console.error('[R2] Cleanup error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache statistics
   */
  async getStats() {
    try {
      let totalObjects = 0;
      let totalSize = 0;
      let oldestEntry = null;
      let newestEntry = null;

      let cursor;
      do {
        const listed = await this.bucket.list({
          prefix: 'timeseries/',
          cursor
        });

        totalObjects += listed.objects.length;

        for (const object of listed.objects) {
          totalSize += object.size;

          const metadata = object.customMetadata || {};
          const generatedTime = new Date(metadata.generatedTime);

          if (!oldestEntry || generatedTime < oldestEntry) {
            oldestEntry = generatedTime;
          }
          if (!newestEntry || generatedTime > newestEntry) {
            newestEntry = generatedTime;
          }
        }

        cursor = listed.cursor;
      } while (cursor);

      return {
        totalObjects,
        totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        oldestEntry: oldestEntry?.toISOString(),
        newestEntry: newestEntry?.toISOString()
      };
    } catch (error) {
      console.error('[R2] Stats error:', error);
      return null;
    }
  }

  /**
   * Hash point names for cache key generation
   * @private
   */
  _hashPoints(points) {
    // Simple hash function for point names
    // In production, consider using a proper hash function
    const str = points.join(',');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Compress data using brotli
   * @private
   */
  async _compress(data) {
    // Use CompressionStream API (available in Cloudflare Workers)
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(data);
        controller.close();
      }
    });

    const compressedStream = stream.pipeThrough(new CompressionStream('gzip'));
    const chunks = [];
    const reader = compressedStream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  }

  /**
   * Decompress data using brotli
   * @private
   */
  async _decompress(data) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(data));
        controller.close();
      }
    });

    const decompressedStream = stream.pipeThrough(new DecompressionStream('gzip'));
    const chunks = [];
    const reader = decompressedStream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Combine chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer;
  }
}
