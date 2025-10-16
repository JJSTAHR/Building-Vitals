/**
 * Semantic Search Service Test Suite
 *
 * Tests TensorFlow.js integration, embedding generation, and semantic matching
 * Coverage target: >90%
 */

import * as tf from '@tensorflow/tfjs';
import { SemanticSearchService } from '../semanticSearchService';
import type { Point } from '../../../../Building-Vitals/src/types/api';

// Mock TensorFlow.js and USE model
jest.mock('@tensorflow/tfjs', () => ({
  setBackend: jest.fn().mockResolvedValue(undefined),
  ready: jest.fn().mockResolvedValue(undefined),
  tensor: jest.fn((data) => ({
    data: data,
    dataSync: jest.fn(() => data),
    dispose: jest.fn()
  })),
  sum: jest.fn((tensor) => tensor),
  mul: jest.fn((a, b) => ({ dataSync: () => [0.8], dispose: jest.fn() })),
  square: jest.fn((tensor) => tensor),
  sqrt: jest.fn((tensor) => tensor),
  div: jest.fn((a, b) => ({ dataSync: () => [0.8], dispose: jest.fn() })),
  memory: jest.fn(() => ({ numTensors: 10, numBytes: 1000 }))
}));

jest.mock('@tensorflow-models/universal-sentence-encoder', () => ({
  load: jest.fn().mockResolvedValue({
    embed: jest.fn((texts) => Promise.resolve({
      array: jest.fn().mockResolvedValue(
        texts.map(() => Array(512).fill(0).map(() => Math.random()))
      ),
      dispose: jest.fn()
    }))
  })
}));

// Mock embedding cache
jest.mock('../embeddingCache', () => ({
  EmbeddingCache: jest.fn().mockImplementation(() => ({
    getEmbeddings: jest.fn().mockResolvedValue(new Map()),
    setEmbedding: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined)
  }))
}));

describe('SemanticSearchService', () => {
  let service: SemanticSearchService;
  let mockPoints: Point[];

  beforeEach(() => {
    service = SemanticSearchService.getInstance();
    mockPoints = [
      {
        object_id: 'point-1',
        display_name: 'VAV 707 - Room Temperature',
        unit: '°F',
        equipment_name: 'VAV Terminal',
        marker_tags: ['temp', 'sensor', 'vav'],
        object_type: 'temperature',
        bacnet_prefix: 'network.Vav707'
      } as Point,
      {
        object_id: 'point-2',
        display_name: 'AHU 1 - Supply Air Temperature',
        unit: '°F',
        equipment_name: 'Air Handler',
        marker_tags: ['temp', 'sensor', 'ahu', 'supply'],
        object_type: 'temperature',
        bacnet_prefix: 'network.Ahu1'
      } as Point,
      {
        object_id: 'point-3',
        display_name: 'RTU 6 - Fan Speed',
        unit: '%',
        equipment_name: 'Rooftop Unit',
        marker_tags: ['fan', 'speed', 'rtu'],
        object_type: 'control',
        bacnet_prefix: 'network.Rtu6'
      } as Point
    ];
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('returns singleton instance', () => {
      const instance1 = SemanticSearchService.getInstance();
      const instance2 = SemanticSearchService.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('initializes TensorFlow.js backend', async () => {
      await service.initialize();

      expect(tf.setBackend).toHaveBeenCalledWith('webgl');
      expect(tf.ready).toHaveBeenCalled();
    });

    it('loads Universal Sentence Encoder model', async () => {
      await service.initialize();

      expect(service.isReady()).toBe(true);
    });

    it('handles initialization errors gracefully', async () => {
      const mockError = new Error('Failed to load model');
      (tf.setBackend as jest.Mock).mockRejectedValueOnce(mockError);

      await expect(service.initialize()).rejects.toThrow('Failed to load model');
      expect(service.isReady()).toBe(false);
    });

    it('prevents multiple concurrent initializations', async () => {
      const promise1 = service.initialize();
      const promise2 = service.initialize();

      await Promise.all([promise1, promise2]);

      // Should only call setBackend once
      expect(tf.setBackend).toHaveBeenCalledTimes(1);
    });
  });

  describe('Point Text Generation', () => {
    it('generates text representation from point data', () => {
      const point = mockPoints[0];
      // Access private method through any type
      const text = (service as any).getPointText(point);

      expect(text).toContain('vav 707');
      expect(text).toContain('room temperature');
      expect(text).toContain('°f');
      expect(text).toContain('vav terminal');
      expect(text).toContain('temp');
      expect(text).toContain('sensor');
    });

    it('handles missing optional fields', () => {
      const point = {
        object_id: 'point-x',
        display_name: 'Test Point'
      } as Point;

      const text = (service as any).getPointText(point);

      expect(text).toBe('test point');
    });

    it('converts all text to lowercase', () => {
      const point = {
        object_id: 'point-x',
        display_name: 'VAV Temperature SENSOR',
        unit: 'CELSIUS'
      } as Point;

      const text = (service as any).getPointText(point);

      expect(text).toBe('vav temperature sensor celsius');
      expect(text).not.toMatch(/[A-Z]/);
    });
  });

  describe('Embedding Generation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('generates embeddings for all points', async () => {
      await service.generateEmbeddings(mockPoints);

      // Check that embeddings were created
      expect((service as any).embeddings.size).toBe(mockPoints.length);
    });

    it('processes points in batches', async () => {
      const largePointSet = Array.from({ length: 250 }, (_, i) => ({
        object_id: `point-${i}`,
        display_name: `Point ${i}`,
        unit: '°F'
      } as Point));

      await service.generateEmbeddings(largePointSet);

      // Should process in batches of 100
      expect((service as any).embeddings.size).toBe(250);
    });

    it('uses cache for previously generated embeddings', async () => {
      const mockCache = new Map([
        ['point-1', Array(512).fill(0.5)]
      ]);

      (service as any).embeddingCache.getEmbeddings = jest.fn().mockResolvedValue(mockCache);

      await service.generateEmbeddings(mockPoints);

      // Should load from cache for point-1
      expect((service as any).embeddingCache.getEmbeddings).toHaveBeenCalled();
    });

    it('caches newly generated embeddings', async () => {
      await service.generateEmbeddings(mockPoints);

      // Should cache all embeddings
      expect((service as any).embeddingCache.setEmbedding).toHaveBeenCalledTimes(mockPoints.length);
    });

    it('handles errors during embedding generation', async () => {
      (service as any).model = null;

      await expect(service.generateEmbeddings(mockPoints)).rejects.toThrow('Model not initialized');
    });

    it('completes within reasonable time for 50K points', async () => {
      // Simulate 50K points (use smaller subset for testing)
      const largePointSet = Array.from({ length: 500 }, (_, i) => ({
        object_id: `point-${i}`,
        display_name: `Point ${i}`,
        unit: '°F'
      } as Point));

      const startTime = performance.now();
      await service.generateEmbeddings(largePointSet);
      const endTime = performance.now();

      // Should complete in reasonable time (scaled for test size)
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Cosine Similarity', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('calculates similarity between identical vectors', () => {
      const vector = tf.tensor([1, 0, 0, 0]);
      const similarity = (service as any).cosineSimilarity(vector, vector);

      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('calculates similarity between orthogonal vectors', () => {
      const vector1 = tf.tensor([1, 0, 0, 0]);
      const vector2 = tf.tensor([0, 1, 0, 0]);
      const similarity = (service as any).cosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('calculates similarity between opposite vectors', () => {
      const vector1 = tf.tensor([1, 0, 0, 0]);
      const vector2 = tf.tensor([-1, 0, 0, 0]);
      const similarity = (service as any).cosineSimilarity(vector1, vector2);

      expect(similarity).toBeCloseTo(-1.0, 5);
    });

    it('handles normalized vectors correctly', () => {
      const vector1 = tf.tensor([0.6, 0.8, 0, 0]);
      const vector2 = tf.tensor([0.8, 0.6, 0, 0]);
      const similarity = (service as any).cosineSimilarity(vector1, vector2);

      expect(similarity).toBeGreaterThan(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('Keyword Score Calculation', () => {
    it('gives high score for exact matches', () => {
      const query = 'room temperature';
      const point = mockPoints[0];
      const score = (service as any).calculateKeywordScore(query, point);

      expect(score).toBeGreaterThan(0.8);
    });

    it('gives partial score for word matches', () => {
      const query = 'temperature fan';
      const point = mockPoints[0]; // Has 'temperature' but not 'fan'
      const score = (service as any).calculateKeywordScore(query, point);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(1);
    });

    it('gives zero score for no matches', () => {
      const query = 'humidity sensor';
      const point = mockPoints[2]; // Fan speed point, no humidity
      const score = (service as any).calculateKeywordScore(query, point);

      expect(score).toBe(0);
    });

    it('boosts score for display_name matches', () => {
      const query = 'vav';
      const point = mockPoints[0];
      const score = (service as any).calculateKeywordScore(query, point);

      expect(score).toBeGreaterThan(0.5);
    });

    it('is case-insensitive', () => {
      const query1 = 'TEMPERATURE';
      const query2 = 'temperature';
      const point = mockPoints[0];

      const score1 = (service as any).calculateKeywordScore(query1, point);
      const score2 = (service as any).calculateKeywordScore(query2, point);

      expect(score1).toBe(score2);
    });
  });

  describe('Semantic Search', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.generateEmbeddings(mockPoints);
    });

    it('returns empty array for empty query', async () => {
      const results = await service.search('', mockPoints);

      expect(results).toEqual([]);
    });

    it('searches with semantic similarity', async () => {
      const results = await service.search('temperature', mockPoints);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('point');
      expect(results[0]).toHaveProperty('keywordScore');
      expect(results[0]).toHaveProperty('semanticScore');
      expect(results[0]).toHaveProperty('finalScore');
    });

    it('combines keyword and semantic scores', async () => {
      const results = await service.search('temperature', mockPoints, {
        keywordWeight: 0.7,
        semanticWeight: 0.3
      });

      results.forEach(result => {
        expect(result.finalScore).toBeLessThanOrEqual(1);
        expect(result.finalScore).toBeGreaterThanOrEqual(0);
      });
    });

    it('respects threshold parameter', async () => {
      const results = await service.search('temperature', mockPoints, {
        threshold: 0.5
      });

      results.forEach(result => {
        expect(result.finalScore).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('respects maxResults parameter', async () => {
      const results = await service.search('temperature', mockPoints, {
        maxResults: 2
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('sorts results by final score descending', async () => {
      const results = await service.search('temperature', mockPoints);

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].finalScore).toBeGreaterThanOrEqual(results[i].finalScore);
      });
    });

    it('finds synonym matches (temperature finds temp)', async () => {
      const results = await service.search('temperature', mockPoints);

      const tempPoints = results.filter(r =>
        r.point.display_name.toLowerCase().includes('temp')
      );

      expect(tempPoints.length).toBeGreaterThan(0);
    });

    it('finds abbreviation matches (humidity finds rh)', async () => {
      const pointsWithHumidity = [
        ...mockPoints,
        {
          object_id: 'point-4',
          display_name: 'VAV 707 - Room RH',
          unit: '%RH',
          marker_tags: ['humidity', 'rh']
        } as Point
      ];

      await service.generateEmbeddings(pointsWithHumidity);
      const results = await service.search('humidity', pointsWithHumidity);

      const rhPoints = results.filter(r =>
        r.point.display_name.toLowerCase().includes('rh')
      );

      expect(rhPoints.length).toBeGreaterThan(0);
    });

    it('finds context matches (fan finds blower, cfm)', async () => {
      const results = await service.search('fan', mockPoints);

      expect(results.length).toBeGreaterThan(0);
      // Should find "Fan Speed" point
      expect(results.some(r => r.point.display_name.includes('Fan'))).toBe(true);
    });

    it('falls back to keyword search if model fails', async () => {
      (service as any).model = null;

      const results = await service.search('temperature', mockPoints);

      expect(results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.semanticScore).toBe(0);
        expect(result.finalScore).toBe(result.keywordScore);
      });
    });

    it('completes search within 100ms for 50K points', async () => {
      // Simulate large point set
      const largePointSet = Array.from({ length: 500 }, (_, i) => ({
        object_id: `point-${i}`,
        display_name: `Point ${i}`,
        unit: '°F'
      } as Point));

      await service.generateEmbeddings(largePointSet);

      const startTime = performance.now();
      await service.search('temperature', largePointSet);
      const endTime = performance.now();

      // Scaled for test size (500 points instead of 50K)
      expect(endTime - startTime).toBeLessThan(50);
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.generateEmbeddings(mockPoints);
    });

    it('clears embeddings from memory', () => {
      service.clearMemory();

      expect((service as any).embeddings.size).toBe(0);
    });

    it('clears cache', async () => {
      await service.clearCache();

      expect((service as any).embeddingCache.clear).toHaveBeenCalled();
    });

    it('provides memory usage statistics', () => {
      const stats = service.getMemoryStats();

      expect(stats).toHaveProperty('numTensors');
      expect(stats).toHaveProperty('numBytes');
      expect(typeof stats.numTensors).toBe('number');
      expect(typeof stats.numBytes).toBe('number');
    });

    it('disposes tensors when clearing memory', () => {
      const mockDispose = jest.fn();
      (service as any).embeddings.set('test', { dispose: mockDispose });

      service.clearMemory();

      expect(mockDispose).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('handles empty point array', async () => {
      await service.generateEmbeddings([]);

      expect((service as any).embeddings.size).toBe(0);
    });

    it('handles points with minimal data', async () => {
      const minimalPoint = {
        object_id: 'minimal',
        display_name: 'Test'
      } as Point;

      await service.generateEmbeddings([minimalPoint]);

      expect((service as any).embeddings.size).toBe(1);
    });

    it('handles special characters in search query', async () => {
      await service.generateEmbeddings(mockPoints);

      const results = await service.search('temp@#$%^&*()', mockPoints);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('handles very long search queries', async () => {
      await service.generateEmbeddings(mockPoints);

      const longQuery = 'temperature ' + 'sensor '.repeat(100);
      const results = await service.search(longQuery, mockPoints);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('handles Unicode characters in queries', async () => {
      await service.generateEmbeddings(mockPoints);

      const results = await service.search('température', mockPoints);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
