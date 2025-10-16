/**
 * Test Fixtures Index
 * Central export point for all test fixtures and utilities
 */

// Haystack test data
export {
  HAYSTACK_UNITS,
  HAYSTACK_DEFINITIONS,
  getUnitBySymbol,
  getDefinitionById,
  getDefinitionsByType,
  getUnitsByQuantity,
  type HaystackUnit,
  type HaystackDefinition,
  type HaystackMarker
} from './haystackTestData';

// Sample points
export {
  SAMPLE_POINTS,
  getSamplesByDifficulty,
  getSamplesByEquipment,
  getSamplesByCategory,
  getRandomSamples,
  type SamplePoint
} from './samplePoints';

// Test helpers
export {
  measurePerformance,
  calculateAccuracy,
  generateMockPoints,
  assertCleaningResult,
  comparePerformance,
  formatAccuracyReport,
  formatPerformanceReport,
  createTestSuite,
  type PerformanceResult,
  type AccuracyResult,
  type AccuracyMetric,
  type CleaningFailure
} from './testHelpers';

// Ground truth
export {
  GROUND_TRUTH_DATASET,
  getGroundTruthById,
  getGroundTruthByEquipment,
  getGroundTruthByPointType,
  getGroundTruthByConfidence,
  validateAgainstGroundTruth,
  type GroundTruthEntry
} from './groundTruth';
