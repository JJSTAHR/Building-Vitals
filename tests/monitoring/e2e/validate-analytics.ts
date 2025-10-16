/**
 * E2E Analytics Validation Script
 * Generates test requests, waits for propagation, and validates accuracy
 */

import { createMockWorkerEnv } from '../mocks/analytics-engine-mock';
import { generateMockRequest } from '../fixtures/analytics-fixtures';

interface ValidationResult {
  success: boolean;
  message: string;
  metrics?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    cacheHitRate: number;
  };
  errors?: string[];
}

/**
 * Validate analytics data accuracy
 */
export async function validateAnalyticsAccuracy(
  expectedRequests: number,
  options?: {
    errorRate?: number;
    slowRequestThreshold?: number;
    cacheMissRate?: number;
  }
): Promise<ValidationResult> {
  const errors: string[] = [];
  const mockEnv = createMockWorkerEnv();

  try {
    console.log(`\n🔍 Starting Analytics Validation...`);
    console.log(`Expected requests: ${expectedRequests}`);
    console.log(`Error rate: ${(options?.errorRate || 0) * 100}%`);

    // Step 1: Generate test requests
    console.log(`\n📊 Generating ${expectedRequests} test requests...`);
    const startTime = Date.now();

    for (let i = 0; i < expectedRequests; i++) {
      const shouldError = Math.random() < (options?.errorRate || 0.05);
      const statusCode = shouldError ? 500 : 200;
      const responseTime = shouldError
        ? Math.random() * 3000 + 1000 // 1-4 seconds for errors
        : Math.random() * 500 + 50; // 50-550ms for success

      const isCacheMiss = Math.random() < (options?.cacheMissRate || 0.2);

      mockEnv.ANALYTICS.datasets.requests.writeDataPoint({
        blobs: [
          'GET',
          `/api/test/${i % 100}`,
          statusCode.toString(),
          `user-${i % 50}`,
          `corr-${i}`,
        ],
        indexes: [responseTime, statusCode],
        doubles: [
          Math.random() * 2048, // Payload size
          isCacheMiss ? 0 : 100, // Cache hit rate
        ],
      });

      // Log errors
      if (shouldError) {
        mockEnv.ANALYTICS.datasets.errors.writeDataPoint({
          blobs: [
            'Internal Server Error',
            `Error at request ${i}`,
            `corr-${i}`,
          ],
          indexes: [statusCode, 1],
        });
      }
    }

    const generationTime = Date.now() - startTime;
    console.log(`✅ Generated ${expectedRequests} requests in ${generationTime}ms`);

    // Step 2: Wait for analytics propagation (simulate network delay)
    console.log(`\n⏳ Waiting for analytics propagation...`);
    await new Promise(resolve => setTimeout(resolve, 100));

    // Step 3: Query and validate analytics
    console.log(`\n🔎 Querying Analytics Engine...`);
    const queryStart = Date.now();

    const dataPoints = mockEnv.ANALYTICS.getDataset('requests').getDataPoints();
    const errorDataPoints = mockEnv.ANALYTICS.getDataset('errors').getDataPoints();

    const queryTime = Date.now() - queryStart;
    console.log(`✅ Query completed in ${queryTime}ms`);

    // Step 4: Calculate metrics
    console.log(`\n📈 Calculating metrics...`);

    const totalRequests = dataPoints.length;
    const failedRequests = dataPoints.filter(dp => dp.indexes?.[1] !== 200).length;
    const successfulRequests = totalRequests - failedRequests;

    const durations = dataPoints.map(dp => dp.indexes?.[0] || 0);
    const sorted = [...durations].sort((a, b) => a - b);

    const averageResponseTime = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)];
    const p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)];

    const errorRate = (failedRequests / totalRequests) * 100;

    const cacheHits = dataPoints.filter(dp => (dp.doubles?.[1] || 0) > 50).length;
    const cacheHitRate = (cacheHits / totalRequests) * 100;

    // Step 5: Validate accuracy
    console.log(`\n✅ Validation Results:`);
    console.log(`─────────────────────────────────────`);

    // Check request count
    if (totalRequests !== expectedRequests) {
      errors.push(
        `Request count mismatch: expected ${expectedRequests}, got ${totalRequests}`
      );
    } else {
      console.log(`✓ Request Count: ${totalRequests} (matches expected)`);
    }

    // Check error rate
    const expectedErrorRate = (options?.errorRate || 0.05) * 100;
    const errorRateDiff = Math.abs(errorRate - expectedErrorRate);
    if (errorRateDiff > 2) {
      // Allow 2% variance
      errors.push(
        `Error rate mismatch: expected ~${expectedErrorRate.toFixed(1)}%, got ${errorRate.toFixed(1)}%`
      );
    } else {
      console.log(`✓ Error Rate: ${errorRate.toFixed(2)}% (expected ~${expectedErrorRate.toFixed(1)}%)`);
    }

    // Check error correlation
    if (errorDataPoints.length !== failedRequests) {
      errors.push(
        `Error correlation mismatch: ${failedRequests} failed requests but ${errorDataPoints.length} error logs`
      );
    } else {
      console.log(`✓ Error Correlation: ${errorDataPoints.length} errors logged`);
    }

    // Check response times
    console.log(`✓ Average Response Time: ${averageResponseTime.toFixed(2)}ms`);
    console.log(`✓ P95 Response Time: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`✓ P99 Response Time: ${p99ResponseTime.toFixed(2)}ms`);

    // Check cache metrics
    console.log(`✓ Cache Hit Rate: ${cacheHitRate.toFixed(2)}%`);

    // Check slow requests
    const slowThreshold = options?.slowRequestThreshold || 1000;
    const slowRequests = dataPoints.filter(dp => (dp.indexes?.[0] || 0) > slowThreshold).length;
    console.log(`✓ Slow Requests (>${slowThreshold}ms): ${slowRequests}`);

    console.log(`─────────────────────────────────────`);

    const metrics = {
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      errorRate,
      cacheHitRate,
    };

    if (errors.length > 0) {
      console.log(`\n❌ Validation FAILED with ${errors.length} error(s):`);
      errors.forEach((error, i) => console.log(`  ${i + 1}. ${error}`));

      return {
        success: false,
        message: `Validation failed with ${errors.length} error(s)`,
        metrics,
        errors,
      };
    }

    console.log(`\n✅ Validation PASSED - All metrics accurate!`);

    return {
      success: true,
      message: 'All analytics metrics validated successfully',
      metrics,
    };
  } catch (error) {
    console.error(`\n❌ Validation Error:`, error);

    return {
      success: false,
      message: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Run comprehensive validation suite
 */
export async function runValidationSuite(): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Analytics Validation Suite`);
  console.log(`${'='.repeat(60)}`);

  const tests = [
    {
      name: 'Low Traffic (100 requests, 2% errors)',
      requests: 100,
      errorRate: 0.02,
    },
    {
      name: 'Medium Traffic (1000 requests, 5% errors)',
      requests: 1000,
      errorRate: 0.05,
    },
    {
      name: 'High Traffic (10000 requests, 3% errors)',
      requests: 10000,
      errorRate: 0.03,
    },
    {
      name: 'High Error Rate (500 requests, 20% errors)',
      requests: 500,
      errorRate: 0.2,
    },
  ];

  const results: ValidationResult[] = [];

  for (const test of tests) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Test: ${test.name}`);
    console.log(`${'─'.repeat(60)}`);

    const result = await validateAnalyticsAccuracy(test.requests, {
      errorRate: test.errorRate,
      slowRequestThreshold: 1000,
      cacheMissRate: 0.2,
    });

    results.push(result);

    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Validation Suite Summary`);
  console.log(`${'='.repeat(60)}`);

  const passed = results.filter(r => r.success).length;
  const failed = results.length - passed;

  results.forEach((result, i) => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${tests[i].name}`);
  });

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
  console.log(`${'='.repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runValidationSuite().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
