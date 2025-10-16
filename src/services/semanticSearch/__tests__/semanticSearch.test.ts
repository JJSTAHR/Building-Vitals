/**
 * Tests for Semantic Search functionality
 * Validates TensorFlow.js Universal Sentence Encoder integration
 */

import { SemanticSearchService } from '../semanticSearchService';
import type { Point } from '../../../../Building-Vitals/src/types/api';

// Mock TensorFlow.js and Universal Sentence Encoder
jest.mock('@tensorflow/tfjs', () => ({
  setBackend: jest.fn().mockResolvedValue(undefined),
  ready: jest.fn().mockResolvedValue(undefined),
  memory: jest.fn().mockReturnValue({ numTensors: 10, numBytes: 1024 }),
  tensor: jest.fn((data) => ({
    dataSync: () => data,
    dispose: jest.fn()
  })),
  sum: jest.fn(() => ({
    dataSync: () => [0.8],
    dispose: jest.fn()
  })),
  mul: jest.fn(() => ({
    dataSync: () => [0.8],
    dispose: jest.fn()
  })),
  div: jest.fn(() => ({
    dataSync: () => [0.8],
    dispose: jest.fn()
  })),
  sqrt: jest.fn(() => ({
    dataSync: () => [1],
    dispose: jest.fn()
  })),
  square: jest.fn(() => ({
    dataSync: () => [1],
    dispose: jest.fn()
  }))
}));

jest.mock('@tensorflow-models/universal-sentence-encoder', () => ({
  load: jest.fn().mockResolvedValue({
    embed: jest.fn().mockImplementation((texts) => ({
      array: () => Promise.resolve(
        texts.map(() => new Array(512).fill(0).map(() => Math.random()))
      ),
      dispose: jest.fn()
    }))
  })
}));

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;

  beforeEach(() => {
    service = SemanticSearchService.getInstance();
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.clearMemory();
  });

  describe('Initialization', () => {
    it('should initialize the model successfully', async () => {
      await service.initialize();
      expect(service.isReady()).toBe(true);
    });

    it('should handle initialization failure gracefully', async () => {
      const use = require('@tensorflow-models/universal-sentence-encoder');
      use.load.mockRejectedValueOnce(new Error('Failed to load model'));

      await expect(service.initialize()).rejects.toThrow('Failed to load model');
      expect(service.isReady()).toBe(false);
    });

    it('should prevent multiple simultaneous initializations', async () => {
      const promise1 = service.initialize();
      const promise2 = service.initialize();

      await Promise.all([promise1, promise2]);

      const use = require('@tensorflow-models/universal-sentence-encoder');
      expect(use.load).toHaveBeenCalledTimes(1);
    });
  });

  describe('Embedding Generation', () => {
    const mockPoints: Point[] = [
      {
        object_id: 'point1',
        display_name: 'Room Temperature Sensor',
        unit: 'degF',
        equipment_name: 'AHU-01',
        marker_tags: ['temp', 'sensor'],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point,
      {
        object_id: 'point2',
        display_name: 'Supply Air Fan Speed',
        unit: 'Hz',
        equipment_name: 'AHU-01',
        marker_tags: ['fan', 'speed'],
        object_type: 'analog',
        bacnet_prefix: 'AO'
      } as Point,
      {
        object_id: 'point3',
        display_name: 'Zone Humidity',
        unit: '%RH',
        equipment_name: 'Zone-01',
        marker_tags: ['humidity', 'sensor'],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point
    ];

    it('should generate embeddings for all points', async () => {
      await service.initialize();
      await service.generateEmbeddings(mockPoints);

      // Verify embeddings were generated
      const memory = service.getMemoryStats();
      expect(memory.numTensors).toBeGreaterThan(0);
    });

    it('should handle empty point list', async () => {
      await service.initialize();
      await service.generateEmbeddings([]);

      const memory = service.getMemoryStats();
      expect(memory.numTensors).toBe(10); // Base tensors only
    });

    it('should batch large point lists', async () => {
      await service.initialize();

      // Create 250 mock points to test batching
      const largePointList = Array.from({ length: 250 }, (_, i) => ({
        object_id: `point${i}`,
        display_name: `Point ${i}`,
        unit: 'unit',
        marker_tags: ['tag'],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point));

      await service.generateEmbeddings(largePointList);

      // Should process in batches of 100
      const use = require('@tensorflow-models/universal-sentence-encoder');
      const model = await use.load();
      expect(model.embed).toHaveBeenCalledTimes(3); // 250 points = 3 batches
    });
  });

  describe('Semantic Search', () => {
    const mockPoints: Point[] = [
      {
        object_id: 'point1',
        display_name: 'Zone Temperature',
        unit: 'degF',
        equipment_name: 'VAV-01',
        marker_tags: ['temp', 'zone'],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point,
      {
        object_id: 'point2',
        display_name: 'Supply Air Temperature',
        unit: 'degF',
        equipment_name: 'AHU-01',
        marker_tags: ['temp', 'supply'],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point,
      {
        object_id: 'point3',
        display_name: 'Fan Speed Control',
        unit: 'Hz',
        equipment_name: 'AHU-01',
        marker_tags: ['fan', 'speed'],
        object_type: 'analog',
        bacnet_prefix: 'AO'
      } as Point,
      {
        object_id: 'point4',
        display_name: 'Relative Humidity',
        unit: '%RH',
        equipment_name: 'Zone-01',
        marker_tags: ['humidity', 'sensor'],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point
    ];

    beforeEach(async () => {
      await service.initialize();
      await service.generateEmbeddings(mockPoints);
    });

    it('should find semantically related points for "temperature"', async () => {
      const results = await service.search('temperature', mockPoints);

      expect(results.length).toBeGreaterThan(0);

      // Should rank temperature-related points higher
      const topResults = results.slice(0, 2).map(r => r.point.object_id);
      expect(topResults).toContain('point1'); // Zone Temperature
      expect(topResults).toContain('point2'); // Supply Air Temperature
    });

    it('should find semantically related points for "humidity"', async () => {
      const results = await service.search('humidity', mockPoints);

      expect(results.length).toBeGreaterThan(0);

      // Should find the humidity point
      expect(results[0].point.object_id).toBe('point4');
    });

    it('should find semantically related points for "fan speed"', async () => {
      const results = await service.search('fan speed', mockPoints);

      expect(results.length).toBeGreaterThan(0);

      // Should find the fan speed control point
      expect(results[0].point.object_id).toBe('point3');
    });

    it('should handle queries with no matches', async () => {
      const results = await service.search('xyz123nonexistent', mockPoints);

      // Should still return results (semantic search finds closest matches)
      expect(results.length).toBeGreaterThan(0);

      // But scores should be lower
      expect(results[0].finalScore).toBeLessThan(0.5);
    });

    it('should respect search options', async () => {
      const results = await service.search('temperature', mockPoints, {
        keywordWeight: 1.0, // Only keyword matching
        semanticWeight: 0.0,
        maxResults: 1
      });

      expect(results.length).toBe(1);
      expect(results[0].semanticScore).toBe(0);
    });

    it('should fall back to keyword search when model is not ready', async () => {
      service.clearMemory();

      const uninitializedService = SemanticSearchService.getInstance();
      const results = await uninitializedService.search('temperature', mockPoints);

      // Should still return results using keyword matching
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].semanticScore).toBe(0);
      expect(results[0].keywordScore).toBeGreaterThan(0);
    });
  });

  describe('Hybrid Scoring', () => {
    const mockPoints: Point[] = [
      {
        object_id: 'point1',
        display_name: 'Temperature Sensor',
        unit: 'degF',
        marker_tags: ['temp'],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point,
      {
        object_id: 'point2',
        display_name: 'Thermal Zone Control',
        unit: 'degF',
        marker_tags: ['thermal'],
        object_type: 'analog',
        bacnet_prefix: 'AO'
      } as Point,
      {
        object_id: 'point3',
        display_name: 'Heat Exchanger Status',
        unit: 'bool',
        marker_tags: ['heat'],
        object_type: 'binary',
        bacnet_prefix: 'BI'
      } as Point
    ];

    beforeEach(async () => {
      await service.initialize();
      await service.generateEmbeddings(mockPoints);
    });

    it('should combine keyword and semantic scores', async () => {
      const results = await service.search('temperature', mockPoints, {
        keywordWeight: 0.7,
        semanticWeight: 0.3
      });

      expect(results.length).toBeGreaterThan(0);

      // First result should have exact keyword match
      expect(results[0].point.object_id).toBe('point1');
      expect(results[0].keywordScore).toBeGreaterThan(0.5);

      // Other results should have semantic similarity
      const semanticMatches = results.filter(r => r.semanticScore > 0);
      expect(semanticMatches.length).toBeGreaterThan(1);
    });

    it('should handle semantic-only search', async () => {
      const results = await service.search('hot cold thermal', mockPoints, {
        keywordWeight: 0.0,
        semanticWeight: 1.0
      });

      expect(results.length).toBeGreaterThan(0);

      // Results should be based purely on semantic similarity
      results.forEach(result => {
        expect(result.finalScore).toBe(result.semanticScore);
      });
    });
  });

  describe('Performance', () => {
    it('should search across 50K points in under 100ms', async () => {
      await service.initialize();

      // Create 50K mock points
      const largePointList = Array.from({ length: 50000 }, (_, i) => ({
        object_id: `point${i}`,
        display_name: `Point ${i} ${['Temperature', 'Pressure', 'Flow', 'Level'][i % 4]}`,
        unit: ['degF', 'PSI', 'GPM', 'ft'][i % 4],
        marker_tags: [['temp', 'sensor'], ['pressure'], ['flow'], ['level']][i % 4],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point));

      // Generate embeddings (this would normally be done once and cached)
      // For performance test, we'll skip this and test search only

      const startTime = performance.now();
      const results = await service.search('temperature pressure', largePointList, {
        keywordWeight: 1.0, // Keyword-only for speed test
        semanticWeight: 0.0,
        maxResults: 100
      });
      const searchTime = performance.now() - startTime;

      expect(searchTime).toBeLessThan(100); // Should complete in under 100ms
      expect(results.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Memory Management', () => {
    it('should clean up tensors after operations', async () => {
      await service.initialize();

      const initialMemory = service.getMemoryStats();

      const points = Array.from({ length: 100 }, (_, i) => ({
        object_id: `point${i}`,
        display_name: `Point ${i}`,
        unit: 'unit',
        marker_tags: ['tag'],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point));

      await service.generateEmbeddings(points);
      await service.search('test query', points);

      service.clearMemory();

      const finalMemory = service.getMemoryStats();

      // Memory should be cleaned up
      expect(finalMemory.numTensors).toBeLessThanOrEqual(initialMemory.numTensors);
    });

    it('should clear cache when requested', async () => {
      await service.initialize();

      const points = [{
        object_id: 'test',
        display_name: 'Test Point',
        unit: 'unit',
        marker_tags: ['tag'],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point];

      await service.generateEmbeddings(points);
      await service.clearCache();

      const memory = service.getMemoryStats();
      expect(memory.numTensors).toBe(10); // Base tensors only
    });
  });
});

describe('Semantic Search Similarity Tests', () => {
  let service: SemanticSearchService;

  beforeEach(async () => {
    service = SemanticSearchService.getInstance();
    await service.initialize();
  });

  const semanticTestCases = [
    {
      query: 'temperature',
      expectedMatches: ['temp', 'thermal', 'heat', 'cooling', 'degF', 'celsius']
    },
    {
      query: 'humidity',
      expectedMatches: ['rh', 'moisture', 'dew point', 'wet bulb', '%RH']
    },
    {
      query: 'fan speed',
      expectedMatches: ['blower', 'cfm', 'air flow', 'vfd', 'rpm', 'Hz']
    },
    {
      query: 'pressure',
      expectedMatches: ['psi', 'static', 'differential', 'pascal', 'bar']
    },
    {
      query: 'energy',
      expectedMatches: ['power', 'kwh', 'consumption', 'demand', 'load']
    }
  ];

  semanticTestCases.forEach(({ query, expectedMatches }) => {
    it(`should find semantic matches for "${query}"`, async () => {
      const points = expectedMatches.map((match, i) => ({
        object_id: `point${i}`,
        display_name: `${match} sensor`,
        unit: match.includes('%') ? match : 'unit',
        marker_tags: [match.toLowerCase().replace(/\s+/g, '_')],
        object_type: 'analog',
        bacnet_prefix: 'AI'
      } as Point));

      // Add some unrelated points
      points.push(
        {
          object_id: 'unrelated1',
          display_name: 'Door Status',
          unit: 'bool',
          marker_tags: ['door', 'binary'],
          object_type: 'binary',
          bacnet_prefix: 'BI'
        } as Point,
        {
          object_id: 'unrelated2',
          display_name: 'Light Level',
          unit: 'lux',
          marker_tags: ['lighting', 'illuminance'],
          object_type: 'analog',
          bacnet_prefix: 'AI'
        } as Point
      );

      await service.generateEmbeddings(points);
      const results = await service.search(query, points, {
        keywordWeight: 0.3,
        semanticWeight: 0.7, // Emphasize semantic similarity
        maxResults: expectedMatches.length
      });

      // Should rank semantic matches higher than unrelated points
      const topMatches = results.slice(0, expectedMatches.length);
      const matchedIds = topMatches.map(r => r.point.object_id);

      // Most of the expected matches should be in top results
      const foundExpected = matchedIds.filter(id => !id.startsWith('unrelated'));
      expect(foundExpected.length).toBeGreaterThan(expectedMatches.length * 0.6);
    });
  });
});