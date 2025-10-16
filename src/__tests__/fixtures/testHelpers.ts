/**
 * Testing Utilities for Building Vitals
 * Performance measurement, accuracy calculation, mock data generation
 */

import type { SamplePoint } from './samplePoints';

/**
 * Performance measurement result
 */
export interface PerformanceResult {
  operationsPerSecond: number;
  averageTimeMs: number;
  totalTimeMs: number;
  iterations: number;
  minTimeMs: number;
  maxTimeMs: number;
  medianTimeMs: number;
  p95TimeMs: number;
  p99TimeMs: number;
}

/**
 * Accuracy calculation result
 */
export interface AccuracyResult {
  totalSamples: number;
  correctCleanings: number;
  incorrectCleanings: number;
  accuracyPercent: number;
  byDifficulty: {
    easy: AccuracyMetric;
    medium: AccuracyMetric;
    hard: AccuracyMetric;
    extreme: AccuracyMetric;
  };
  byCategory: Map<string, AccuracyMetric>;
  byEquipment: Map<string, AccuracyMetric>;
  failures: CleaningFailure[];
}

export interface AccuracyMetric {
  total: number;
  correct: number;
  accuracy: number;
}

export interface CleaningFailure {
  original: string;
  expected: string;
  actual: string;
  equipmentType: string;
  category: string;
  difficulty: string;
  reason?: string;
}

/**
 * Measure performance of a cleaning function
 */
export async function measurePerformance(
  cleaningFn: (input: string) => string | Promise<string>,
  testData: string[],
  warmupIterations: number = 10,
  measurementIterations: number = 100
): Promise<PerformanceResult> {
  // Warmup phase
  for (let i = 0; i < warmupIterations; i++) {
    for (const input of testData) {
      await cleaningFn(input);
    }
  }

  // Measurement phase
  const times: number[] = [];
  const totalIterations = measurementIterations * testData.length;

  for (let i = 0; i < measurementIterations; i++) {
    for (const input of testData) {
      const start = performance.now();
      await cleaningFn(input);
      const end = performance.now();
      times.push(end - start);
    }
  }

  // Calculate statistics
  const sortedTimes = [...times].sort((a, b) => a - b);
  const totalTimeMs = times.reduce((sum, t) => sum + t, 0);
  const averageTimeMs = totalTimeMs / times.length;
  const minTimeMs = sortedTimes[0];
  const maxTimeMs = sortedTimes[sortedTimes.length - 1];
  const medianTimeMs = sortedTimes[Math.floor(sortedTimes.length / 2)];
  const p95TimeMs = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
  const p99TimeMs = sortedTimes[Math.floor(sortedTimes.length * 0.99)];
  const operationsPerSecond = (1000 / averageTimeMs);

  return {
    operationsPerSecond,
    averageTimeMs,
    totalTimeMs,
    iterations: totalIterations,
    minTimeMs,
    maxTimeMs,
    medianTimeMs,
    p95TimeMs,
    p99TimeMs
  };
}

/**
 * Calculate accuracy of cleaning results
 */
export function calculateAccuracy(
  samples: SamplePoint[],
  cleaningFn: (input: string) => string
): AccuracyResult {
  const failures: CleaningFailure[] = [];
  let correctCount = 0;

  const byDifficulty = {
    easy: { total: 0, correct: 0, accuracy: 0 },
    medium: { total: 0, correct: 0, accuracy: 0 },
    hard: { total: 0, correct: 0, accuracy: 0 },
    extreme: { total: 0, correct: 0, accuracy: 0 }
  };

  const byCategory = new Map<string, AccuracyMetric>();
  const byEquipment = new Map<string, AccuracyMetric>();

  for (const sample of samples) {
    const actual = cleaningFn(sample.original);
    const isCorrect = normalizeForComparison(actual) === normalizeForComparison(sample.expected);

    if (isCorrect) {
      correctCount++;
    } else {
      failures.push({
        original: sample.original,
        expected: sample.expected,
        actual,
        equipmentType: sample.equipmentType,
        category: sample.category,
        difficulty: sample.difficulty,
        reason: sample.notes
      });
    }

    // Track by difficulty
    byDifficulty[sample.difficulty].total++;
    if (isCorrect) byDifficulty[sample.difficulty].correct++;

    // Track by category
    if (!byCategory.has(sample.category)) {
      byCategory.set(sample.category, { total: 0, correct: 0, accuracy: 0 });
    }
    const categoryMetric = byCategory.get(sample.category)!;
    categoryMetric.total++;
    if (isCorrect) categoryMetric.correct++;

    // Track by equipment
    if (!byEquipment.has(sample.equipmentType)) {
      byEquipment.set(sample.equipmentType, { total: 0, correct: 0, accuracy: 0 });
    }
    const equipmentMetric = byEquipment.get(sample.equipmentType)!;
    equipmentMetric.total++;
    if (isCorrect) equipmentMetric.correct++;
  }

  // Calculate accuracy percentages
  Object.keys(byDifficulty).forEach(key => {
    const metric = byDifficulty[key as keyof typeof byDifficulty];
    metric.accuracy = metric.total > 0 ? (metric.correct / metric.total) * 100 : 0;
  });

  byCategory.forEach(metric => {
    metric.accuracy = metric.total > 0 ? (metric.correct / metric.total) * 100 : 0;
  });

  byEquipment.forEach(metric => {
    metric.accuracy = metric.total > 0 ? (metric.correct / metric.total) * 100 : 0;
  });

  return {
    totalSamples: samples.length,
    correctCleanings: correctCount,
    incorrectCleanings: samples.length - correctCount,
    accuracyPercent: (correctCount / samples.length) * 100,
    byDifficulty,
    byCategory,
    byEquipment,
    failures
  };
}

/**
 * Normalize strings for comparison (ignore case, extra spaces, hyphens vs spaces)
 */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate mock point names with variations
 */
export function generateMockPoints(
  basePattern: string,
  variations: number,
  addNoise: boolean = false
): string[] {
  const points: string[] = [];
  const separators = ['_', '-', '.', ' '];
  const casings = ['upper', 'lower', 'mixed', 'camel'];

  for (let i = 0; i < variations; i++) {
    let point = basePattern.replace(/\{N\}/g, String(i + 1));

    if (addNoise) {
      // Random separator
      const separator = separators[Math.floor(Math.random() * separators.length)];
      point = point.replace(/[_\-. ]/g, separator);

      // Random casing
      const casing = casings[Math.floor(Math.random() * casings.length)];
      switch (casing) {
        case 'upper':
          point = point.toUpperCase();
          break;
        case 'lower':
          point = point.toLowerCase();
          break;
        case 'camel':
          point = toCamelCase(point);
          break;
        // 'mixed' keeps as-is
      }

      // Random extra spaces/underscores
      if (Math.random() > 0.7) {
        point = point.replace(/([_\-. ])/g, '$1$1');
      }

      // Random prefix/suffix
      if (Math.random() > 0.8) {
        const prefixes = ['', 'SITE1:', 'BLDG_A:', ''];
        const suffixes = ['', '_SENSOR', '_VALUE', '_AI_01', ''];
        point = prefixes[Math.floor(Math.random() * prefixes.length)] + point +
                suffixes[Math.floor(Math.random() * suffixes.length)];
      }
    }

    points.push(point);
  }

  return points;
}

/**
 * Convert string to camelCase
 */
function toCamelCase(str: string): string {
  return str
    .split(/[_\-. ]/)
    .map((word, index) => {
      if (index === 0) return word.toLowerCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join('');
}

/**
 * Assertion helper for comparing cleaning results
 */
export function assertCleaningResult(
  actual: string,
  expected: string,
  options: {
    strict?: boolean;
    ignoreCase?: boolean;
    allowExtraSpaces?: boolean;
  } = {}
): { matches: boolean; reason?: string } {
  const {
    strict = false,
    ignoreCase = true,
    allowExtraSpaces = true
  } = options;

  if (strict) {
    const matches = actual === expected;
    return {
      matches,
      reason: matches ? undefined : `Strict match failed: "${actual}" !== "${expected}"`
    };
  }

  let normalizedActual = actual;
  let normalizedExpected = expected;

  if (ignoreCase) {
    normalizedActual = normalizedActual.toLowerCase();
    normalizedExpected = normalizedExpected.toLowerCase();
  }

  if (allowExtraSpaces) {
    normalizedActual = normalizedActual.replace(/\s+/g, ' ').trim();
    normalizedExpected = normalizedExpected.replace(/\s+/g, ' ').trim();
  }

  const matches = normalizedActual === normalizedExpected;
  return {
    matches,
    reason: matches ? undefined : `Normalized match failed: "${actual}" !== "${expected}"`
  };
}

/**
 * Create a performance comparison report
 */
export function comparePerformance(
  baseline: PerformanceResult,
  candidate: PerformanceResult
): {
  speedupFactor: number;
  percentImprovement: number;
  isFaster: boolean;
  summary: string;
} {
  const speedupFactor = candidate.operationsPerSecond / baseline.operationsPerSecond;
  const percentImprovement = ((speedupFactor - 1) * 100);
  const isFaster = speedupFactor > 1;

  const summary = isFaster
    ? `Candidate is ${speedupFactor.toFixed(2)}x faster (${percentImprovement.toFixed(1)}% improvement)`
    : `Candidate is ${(1 / speedupFactor).toFixed(2)}x slower (${Math.abs(percentImprovement).toFixed(1)}% degradation)`;

  return {
    speedupFactor,
    percentImprovement,
    isFaster,
    summary
  };
}

/**
 * Format accuracy result as a readable string
 */
export function formatAccuracyReport(result: AccuracyResult): string {
  const lines: string[] = [];

  lines.push('=== Accuracy Report ===');
  lines.push(`Total Samples: ${result.totalSamples}`);
  lines.push(`Correct: ${result.correctCleanings} (${result.accuracyPercent.toFixed(2)}%)`);
  lines.push(`Incorrect: ${result.incorrectCleanings}`);
  lines.push('');

  lines.push('By Difficulty:');
  Object.entries(result.byDifficulty).forEach(([difficulty, metric]) => {
    lines.push(`  ${difficulty.padEnd(10)}: ${metric.correct}/${metric.total} (${metric.accuracy.toFixed(2)}%)`);
  });
  lines.push('');

  lines.push('By Category:');
  result.byCategory.forEach((metric, category) => {
    lines.push(`  ${category.padEnd(15)}: ${metric.correct}/${metric.total} (${metric.accuracy.toFixed(2)}%)`);
  });
  lines.push('');

  lines.push('By Equipment:');
  result.byEquipment.forEach((metric, equipment) => {
    lines.push(`  ${equipment.padEnd(15)}: ${metric.correct}/${metric.total} (${metric.accuracy.toFixed(2)}%)`);
  });

  if (result.failures.length > 0) {
    lines.push('');
    lines.push(`Failures (showing first 10 of ${result.failures.length}):`);
    result.failures.slice(0, 10).forEach(failure => {
      lines.push(`  Original: "${failure.original}"`);
      lines.push(`  Expected: "${failure.expected}"`);
      lines.push(`  Actual:   "${failure.actual}"`);
      if (failure.reason) {
        lines.push(`  Reason:   ${failure.reason}`);
      }
      lines.push('');
    });
  }

  return lines.join('\n');
}

/**
 * Format performance result as a readable string
 */
export function formatPerformanceReport(result: PerformanceResult): string {
  const lines: string[] = [];

  lines.push('=== Performance Report ===');
  lines.push(`Operations per second: ${result.operationsPerSecond.toFixed(2)}`);
  lines.push(`Average time: ${result.averageTimeMs.toFixed(4)} ms`);
  lines.push(`Total time: ${result.totalTimeMs.toFixed(2)} ms`);
  lines.push(`Iterations: ${result.iterations}`);
  lines.push('');
  lines.push('Percentiles:');
  lines.push(`  Min:    ${result.minTimeMs.toFixed(4)} ms`);
  lines.push(`  Median: ${result.medianTimeMs.toFixed(4)} ms`);
  lines.push(`  P95:    ${result.p95TimeMs.toFixed(4)} ms`);
  lines.push(`  P99:    ${result.p99TimeMs.toFixed(4)} ms`);
  lines.push(`  Max:    ${result.maxTimeMs.toFixed(4)} ms`);

  return lines.join('\n');
}

/**
 * Create a test suite for a cleaning function
 */
export function createTestSuite(
  name: string,
  cleaningFn: (input: string) => string,
  samples: SamplePoint[]
) {
  return {
    name,
    runAccuracyTests: () => calculateAccuracy(samples, cleaningFn),
    runPerformanceTests: async () => {
      const inputs = samples.map(s => s.original);
      return measurePerformance(cleaningFn, inputs);
    },
    runFullReport: async () => {
      const accuracy = calculateAccuracy(samples, cleaningFn);
      const inputs = samples.map(s => s.original);
      const performance = await measurePerformance(cleaningFn, inputs);

      return {
        name,
        accuracy: formatAccuracyReport(accuracy),
        performance: formatPerformanceReport(performance)
      };
    }
  };
}
