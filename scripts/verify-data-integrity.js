/**
 * Data Integrity Verification Script
 *
 * Comprehensive checks for D1 + R2 time-series data integrity:
 * - Count samples in D1 vs expected
 * - Count samples in R2 vs expected
 * - Check for gaps in time coverage
 * - Verify no duplicates
 * - Generate integrity report
 *
 * Usage:
 *   node scripts/verify-data-integrity.js --site=<site-name> --start=<date> --end=<date>
 */

import { Command } from 'commander';
import chalk from 'chalk';

const program = new Command();

program
  .name('verify-data-integrity')
  .description('Verify data integrity across D1 and R2 storage')
  .requiredOption('-s, --site <site>', 'Site name to verify')
  .option('--start <date>', 'Start date (ISO 8601)', () => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return d.toISOString();
  })
  .option('--end <date>', 'End date (ISO 8601)', new Date().toISOString())
  .option('--interval <interval>', 'Expected interval (1min, 5min, 1hr)', '1min')
  .option('--points <points...>', 'Specific points to verify (optional)')
  .option('--format <format>', 'Output format (text, json)', 'text')
  .parse(process.argv);

const options = program.opts();

/**
 * Main verification function
 */
async function verifyDataIntegrity(env, options) {
  console.log(chalk.blue('\n🔍 Building Vitals - Data Integrity Verification\n'));
  console.log(chalk.gray(`Site: ${options.site}`));
  console.log(chalk.gray(`Time Range: ${options.start} to ${options.end}`));
  console.log(chalk.gray(`Expected Interval: ${options.interval}\n`));

  const results = {
    site: options.site,
    startTime: options.start,
    endTime: options.end,
    interval: options.interval,
    timestamp: new Date().toISOString(),
    d1: {},
    r2: {},
    gaps: [],
    duplicates: [],
    summary: {}
  };

  // Step 1: Verify D1 data
  console.log(chalk.yellow('📊 Step 1: Verifying D1 data...'));
  results.d1 = await verifyD1Data(env.DB, options);

  // Step 2: Verify R2 archives
  console.log(chalk.yellow('\n📦 Step 2: Verifying R2 archives...'));
  results.r2 = await verifyR2Data(env.TIMESERIES_CACHE, options);

  // Step 3: Check for time gaps
  console.log(chalk.yellow('\n🕐 Step 3: Checking for time gaps...'));
  results.gaps = await checkTimeGaps(results.d1, results.r2, options);

  // Step 4: Check for duplicates
  console.log(chalk.yellow('\n🔄 Step 4: Checking for duplicates...'));
  results.duplicates = await checkDuplicates(results.d1, results.r2);

  // Step 5: Generate summary
  results.summary = generateSummary(results);

  // Output results
  if (options.format === 'json') {
    console.log(JSON.stringify(results, null, 2));
  } else {
    printReport(results);
  }

  return results;
}

/**
 * Verify D1 database data
 */
async function verifyD1Data(db, options) {
  const startTimestamp = Math.floor(new Date(options.start).getTime() / 1000);
  const endTimestamp = Math.floor(new Date(options.end).getTime() / 1000);

  // Count total samples
  const countStmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM timeseries_agg
    WHERE site_name = ?
      AND timestamp >= ?
      AND timestamp <= ?
  `);

  const countResult = await countStmt.bind(
    options.site,
    startTimestamp,
    endTimestamp
  ).first();

  // Count samples by point
  const pointCountStmt = db.prepare(`
    SELECT
      point_name,
      COUNT(*) as sample_count,
      MIN(timestamp) as first_timestamp,
      MAX(timestamp) as last_timestamp
    FROM timeseries_agg
    WHERE site_name = ?
      AND timestamp >= ?
      AND timestamp <= ?
    GROUP BY point_name
    ORDER BY point_name
  `);

  const pointCounts = await pointCountStmt.bind(
    options.site,
    startTimestamp,
    endTimestamp
  ).all();

  // Calculate expected samples
  const timeRangeSeconds = endTimestamp - startTimestamp;
  const intervalSeconds = getIntervalSeconds(options.interval);
  const expectedSamplesPerPoint = Math.floor(timeRangeSeconds / intervalSeconds);

  return {
    totalSamples: countResult.count,
    pointCount: pointCounts.results.length,
    pointDetails: pointCounts.results.map(p => ({
      name: p.point_name,
      actualSamples: p.sample_count,
      expectedSamples: expectedSamplesPerPoint,
      coverage: (p.sample_count / expectedSamplesPerPoint * 100).toFixed(2) + '%',
      firstTimestamp: p.first_timestamp,
      lastTimestamp: p.last_timestamp,
      missingDays: calculateMissingDays(p.first_timestamp, p.last_timestamp, timeRangeSeconds)
    })),
    expectedSamplesPerPoint,
    startTimestamp,
    endTimestamp
  };
}

/**
 * Verify R2 archived data
 */
async function verifyR2Data(r2Bucket, options) {
  const prefix = `archives/${options.site}/`;

  // List all archives
  const listed = await r2Bucket.list({ prefix });

  const archives = [];
  let totalRecords = 0;

  for (const obj of listed.objects) {
    const metadata = obj.customMetadata || {};

    const archiveInfo = {
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded,
      recordCount: Number(metadata.recordCount || 0),
      startTimestamp: Number(metadata.startTimestamp || 0),
      endTimestamp: Number(metadata.endTimestamp || 0),
      format: metadata.format || 'unknown'
    };

    archives.push(archiveInfo);
    totalRecords += archiveInfo.recordCount;
  }

  return {
    archiveCount: archives.length,
    totalRecords,
    totalSize: archives.reduce((sum, a) => sum + a.size, 0),
    archives
  };
}

/**
 * Check for time gaps in data coverage
 */
async function checkTimeGaps(d1Data, r2Data, options) {
  const gaps = [];
  const intervalSeconds = getIntervalSeconds(options.interval);
  const maxGapSeconds = intervalSeconds * 5; // More than 5 intervals is a gap

  // Combine all timestamps from D1 and R2
  const allTimestamps = [];

  // Add D1 timestamps
  d1Data.pointDetails.forEach(point => {
    if (point.firstTimestamp && point.lastTimestamp) {
      allTimestamps.push({
        timestamp: point.firstTimestamp,
        source: 'D1',
        point: point.name
      });
      allTimestamps.push({
        timestamp: point.lastTimestamp,
        source: 'D1',
        point: point.name
      });
    }
  });

  // Add R2 timestamps
  r2Data.archives.forEach(archive => {
    if (archive.startTimestamp && archive.endTimestamp) {
      allTimestamps.push({
        timestamp: archive.startTimestamp,
        source: 'R2',
        archive: archive.key
      });
      allTimestamps.push({
        timestamp: archive.endTimestamp,
        source: 'R2',
        archive: archive.key
      });
    }
  });

  // Sort by timestamp
  allTimestamps.sort((a, b) => a.timestamp - b.timestamp);

  // Find gaps
  for (let i = 1; i < allTimestamps.length; i++) {
    const prev = allTimestamps[i - 1];
    const curr = allTimestamps[i];
    const gapSeconds = curr.timestamp - prev.timestamp;

    if (gapSeconds > maxGapSeconds) {
      gaps.push({
        start: new Date(prev.timestamp * 1000).toISOString(),
        end: new Date(curr.timestamp * 1000).toISOString(),
        gapSeconds,
        gapHours: (gapSeconds / 3600).toFixed(2),
        beforeSource: prev.source,
        afterSource: curr.source
      });
    }
  }

  return gaps;
}

/**
 * Check for duplicate timestamps
 */
async function checkDuplicates(d1Data, r2Data) {
  const duplicates = [];
  const seen = new Map();

  // Check D1 point details for overlaps
  d1Data.pointDetails.forEach(point => {
    const key = `${point.name}:${point.firstTimestamp}`;
    if (seen.has(key)) {
      duplicates.push({
        pointName: point.name,
        timestamp: point.firstTimestamp,
        sources: [seen.get(key), 'D1']
      });
    } else {
      seen.set(key, 'D1');
    }
  });

  // Check R2 archives for overlaps
  r2Data.archives.forEach(archive => {
    const startKey = `archive:${archive.startTimestamp}`;
    const endKey = `archive:${archive.endTimestamp}`;

    if (seen.has(startKey) || seen.has(endKey)) {
      duplicates.push({
        archiveKey: archive.key,
        startTimestamp: archive.startTimestamp,
        endTimestamp: archive.endTimestamp,
        sources: ['D1', 'R2']
      });
    }
  });

  return duplicates;
}

/**
 * Generate summary report
 */
function generateSummary(results) {
  const totalSamples = results.d1.totalSamples + results.r2.totalRecords;
  const totalExpected = results.d1.pointCount * results.d1.expectedSamplesPerPoint;

  const coverage = totalExpected > 0
    ? (totalSamples / totalExpected * 100).toFixed(2)
    : 0;

  const issues = [];

  // Check for low coverage
  if (coverage < 90) {
    issues.push({
      severity: 'warning',
      message: `Low data coverage: ${coverage}% (expected >90%)`
    });
  }

  // Check for gaps
  if (results.gaps.length > 0) {
    issues.push({
      severity: 'warning',
      message: `Found ${results.gaps.length} time gap(s) in data`
    });
  }

  // Check for duplicates
  if (results.duplicates.length > 0) {
    issues.push({
      severity: 'error',
      message: `Found ${results.duplicates.length} duplicate(s)`
    });
  }

  return {
    totalSamples,
    totalExpected,
    coverage: coverage + '%',
    d1Percentage: ((results.d1.totalSamples / totalSamples) * 100).toFixed(2) + '%',
    r2Percentage: ((results.r2.totalRecords / totalSamples) * 100).toFixed(2) + '%',
    gapsFound: results.gaps.length,
    duplicatesFound: results.duplicates.length,
    issues,
    status: issues.length === 0 ? 'PASS' : 'FAIL'
  };
}

/**
 * Print formatted report
 */
function printReport(results) {
  console.log(chalk.blue('\n' + '='.repeat(60)));
  console.log(chalk.blue.bold('  DATA INTEGRITY REPORT'));
  console.log(chalk.blue('='.repeat(60) + '\n'));

  // D1 Section
  console.log(chalk.green('📊 D1 Database:'));
  console.log(`  Total Samples: ${results.d1.totalSamples.toLocaleString()}`);
  console.log(`  Points: ${results.d1.pointCount}`);
  console.log(`  Expected per Point: ${results.d1.expectedSamplesPerPoint.toLocaleString()}`);

  // R2 Section
  console.log(chalk.green('\n📦 R2 Archives:'));
  console.log(`  Archives: ${results.r2.archiveCount}`);
  console.log(`  Total Records: ${results.r2.totalRecords.toLocaleString()}`);
  console.log(`  Total Size: ${(results.r2.totalSize / (1024 * 1024)).toFixed(2)} MB`);

  // Summary
  console.log(chalk.green('\n📈 Summary:'));
  console.log(`  Total Samples: ${results.summary.totalSamples.toLocaleString()}`);
  console.log(`  Coverage: ${results.summary.coverage}`);
  console.log(`  D1: ${results.summary.d1Percentage}`);
  console.log(`  R2: ${results.summary.r2Percentage}`);

  // Gaps
  if (results.gaps.length > 0) {
    console.log(chalk.yellow(`\n⚠️  ${results.gaps.length} Time Gap(s) Found:`));
    results.gaps.slice(0, 5).forEach((gap, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${gap.start} → ${gap.end} (${gap.gapHours}h)`));
    });
    if (results.gaps.length > 5) {
      console.log(chalk.gray(`  ... and ${results.gaps.length - 5} more`));
    }
  }

  // Duplicates
  if (results.duplicates.length > 0) {
    console.log(chalk.red(`\n❌ ${results.duplicates.length} Duplicate(s) Found:`));
    results.duplicates.slice(0, 5).forEach((dup, i) => {
      console.log(chalk.gray(`  ${i + 1}. ${dup.pointName || dup.archiveKey}`));
    });
  }

  // Issues
  if (results.summary.issues.length > 0) {
    console.log(chalk.yellow('\n⚠️  Issues:'));
    results.summary.issues.forEach((issue, i) => {
      const icon = issue.severity === 'error' ? '❌' : '⚠️ ';
      console.log(`  ${icon} ${issue.message}`);
    });
  }

  // Status
  console.log();
  if (results.summary.status === 'PASS') {
    console.log(chalk.green.bold('✅ Status: PASS - Data integrity verified'));
  } else {
    console.log(chalk.red.bold('❌ Status: FAIL - Issues found'));
  }

  console.log(chalk.blue('\n' + '='.repeat(60) + '\n'));
}

/**
 * Helper: Get interval in seconds
 */
function getIntervalSeconds(interval) {
  const intervals = {
    '1min': 60,
    '5min': 300,
    '15min': 900,
    '1hr': 3600,
    '1day': 86400
  };
  return intervals[interval] || 60;
}

/**
 * Helper: Calculate missing days
 */
function calculateMissingDays(firstTimestamp, lastTimestamp, expectedRangeSeconds) {
  const actualRangeSeconds = lastTimestamp - firstTimestamp;
  const missingSeconds = expectedRangeSeconds - actualRangeSeconds;
  return Math.max(0, Math.floor(missingSeconds / 86400));
}

// Export for use in tests
export { verifyDataIntegrity, verifyD1Data, verifyR2Data, checkTimeGaps, checkDuplicates };
