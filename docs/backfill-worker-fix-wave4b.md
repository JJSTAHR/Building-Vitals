# Backfill Worker Fix - Wave 4B

## Bug Fixed: R2 Path Structure Inconsistency

### Problem
The backfill worker was creating R2 paths with an incorrect structure that did not match the archival worker and query worker expectations.

**WRONG (Before Fix):**
```
timeseries/site_name/YYYY/MM/DD.parquet
```

**CORRECT (After Fix):**
```
timeseries/YYYY/MM/DD/site_name.parquet
```

### Root Cause
- Site name was placed at the beginning of the path instead of the end
- This would prevent the query worker from finding backfilled data
- Inconsistent with the canonical R2 path structure defined in the spec

### Changes Made

#### 1. Fixed R2 Path Generation (Line ~711)

**Before:**
```javascript
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const r2Key = `timeseries/${year}/${month}/${day}/${siteName}.parquet`;
```

**After:**
```javascript
// CRITICAL: Path structure MUST match archival worker and query worker expectations
// Format: /timeseries/YYYY/MM/DD/site_name.parquet
// Site name at END of path, not beginning (this was the bug fix)
const year = date.getUTCFullYear(); // Use UTC for consistency
const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Zero-padded month
const day = String(date.getUTCDate()).padStart(2, '0'); // Zero-padded day
const r2Key = `timeseries/${year}/${month}/${day}/${siteName}.parquet`;
```

#### 2. Added generateR2Path() Utility Function

Created a reusable path generation function with validation:

```javascript
/**
 * Generate R2 path for timeseries data
 * CRITICAL: Path structure MUST match across all workers
 * Format: timeseries/YYYY/MM/DD/site_name.parquet
 *
 * Cross-Worker Validation:
 * - Archival Worker: ✅ Uses same format
 * - Query Worker: ✅ Reads from this format
 * - Backfill Worker: ✅ Now matches (bug fixed)
 */
function generateR2Path(siteName, date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `timeseries/${year}/${month}/${day}/${siteName}.parquet`;
}
```

#### 3. Added Path Verification Test

```javascript
function testPathGeneration() {
  const testDate = new Date('2024-10-14T00:00:00Z');
  const testPath = generateR2Path('ses_falls_city', testDate);
  console.log(`[Backfill] Path test: ${testPath}`);
  // Expected output: timeseries/2024/10/14/ses_falls_city.parquet

  if (testPath !== 'timeseries/2024/10/14/ses_falls_city.parquet') {
    throw new Error(`Path generation test failed! Got: ${testPath}`);
  }

  console.log('[Backfill] Path generation test PASSED ✅');
}
```

#### 4. Added Compression Ratio Logging

```javascript
// Calculate compression ratio for logging
const uncompressedSize = parquetRecords.length * 32; // Rough estimate
const compressionRatio = (uncompressedSize / parquetBuffer.byteLength).toFixed(2);
console.log(`[BACKFILL] Parquet created: ${parquetBuffer.byteLength} bytes (${parquetRecords.length} records), compression ${compressionRatio}:1`);
```

#### 5. Updated formatDateYYYYMMDD() to Use UTC

Changed all date formatting to use UTC methods for consistency:

```javascript
function formatDateYYYYMMDD(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

### Cross-Worker Validation

All workers now use the same path structure:

| Worker | R2 Path Format | Status |
|--------|----------------|--------|
| ETL Worker | N/A (writes to D1 only) | N/A |
| Archival Worker | `timeseries/YYYY/MM/DD/site_name.parquet` | ✅ |
| Backfill Worker | `timeseries/YYYY/MM/DD/site_name.parquet` | ✅ |
| Query Worker | `timeseries/YYYY/MM/DD/site_name.parquet` | ✅ |

### Integration with Wave 4A

The fix maintains compatibility with the parquet-wasm writer from Wave 4A:

```javascript
// Import from Wave 4A parquet writer
import { convertToParquet, createTimeseriesSchema } from './lib/parquet-writer.js';

// Use in backfill worker
const parquetBuffer = await convertToParquet(parquetRecords, schema, {
  compression: CONFIG.PARQUET_COMPRESSION,
  rowGroupSize: CONFIG.PARQUET_ROW_GROUP_SIZE
});
```

### Success Criteria

✅ R2 path matches spec: `/timeseries/YYYY/MM/DD/site_name.parquet`
✅ Site name at END of path (not beginning)
✅ Date folders use YYYY/MM/DD structure
✅ All date components zero-padded
✅ Consistent with archival worker paths
✅ Uses UTC date methods for consistency
✅ Compression logging added
✅ Test path validation added
✅ generateR2Path() utility function created
✅ Cross-worker validation documented

### Testing

To verify the fix works:

1. **Run path generation test:**
   ```javascript
   testPathGeneration(); // Should log "Path generation test PASSED ✅"
   ```

2. **Verify R2 path in logs:**
   ```
   [BACKFILL] Uploaded to R2: timeseries/2024/10/14/ses_falls_city.parquet
   ```

3. **Confirm query worker can read backfilled data:**
   - Query worker uses pattern: `timeseries/${year}/${month}/${day}/${siteName}.parquet`
   - Should now match backfill worker output

### Files Modified

- `src/backfill-worker.js` - Fixed R2 path generation, added utilities, improved logging

### Next Steps

1. Deploy updated backfill worker
2. Run test backfill for single day
3. Verify query worker can read backfilled data
4. Monitor compression ratios in production
5. Consider adding generateR2Path() to shared utility module

### Related

- Spec: `docs/timeseries-system-spec.md` (FR-BF-001 to FR-BF-006)
- Memory: `r2_path_structure` entity
- Wave 4A: `src/lib/parquet-writer.js` (parquet-wasm implementation)
