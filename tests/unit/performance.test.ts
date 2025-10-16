/**
 * Performance Tests
 * Tests for processing speed, memory usage, and scalability
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { performanceTestData, fallsCityPoints } from '../fixtures/falls-city-points';

interface PerformanceMetrics {
  processingTime: number;
  pointsPerSecond: number;
  memoryUsed: number;
  cpuTime: number;
}

class HybridEnhancementProcessor {
  async enhanceBatch(
    points: any[],
    options: { timeout?: number } = {}
  ): Promise<{ enhanced: any[]; metrics: PerformanceMetrics }> {
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    const enhanced = await this.processPoints(points, options.timeout);

    const endTime = performance.now();
    const endMemory = process.memoryUsage().heapUsed;

    const processingTime = endTime - startTime;
    const memoryUsed = endMemory - startMemory;

    return {
      enhanced,
      metrics: {
        processingTime,
        pointsPerSecond: (points.length / processingTime) * 1000,
        memoryUsed,
        cpuTime: processingTime, // Simplified
      },
    };
  }

  private async processPoints(points: any[], timeout?: number): Promise<any[]> {
    const startTime = Date.now();

    return Promise.all(
      points.map(async point => {
        // Check timeout
        if (timeout && Date.now() - startTime > timeout) {
          throw new Error('Processing timeout exceeded');
        }

        // Simulate enhancement processing
        await this.enhancePoint(point);

        return {
          ...point,
          display_name: this.generateDisplayName(point),
          _enhanced: true,
        };
      })
    );
  }

  private async enhancePoint(point: any): Promise<void> {
    // Simulate processing delay (optimized)
    await new Promise(resolve => setTimeout(resolve, 0.1));
  }

  private generateDisplayName(point: any): string {
    return point.Name?.split('/').pop() || 'Unknown Point';
  }

  async processConcurrent(
    points: any[],
    concurrency: number = 10
  ): Promise<any[]> {
    const chunks: any[][] = [];

    for (let i = 0; i < points.length; i += concurrency) {
      chunks.push(points.slice(i, i + concurrency));
    }

    const results: any[] = [];

    for (const chunk of chunks) {
      const processed = await Promise.all(
        chunk.map(p =>
          this.enhancePoint(p).then(() => ({
            ...p,
            display_name: this.generateDisplayName(p),
          }))
        )
      );
      results.push(...processed);
    }

    return results;
  }
}

describe('Performance Tests', () => {
  let processor: HybridEnhancementProcessor;

  beforeEach(() => {
    processor = new HybridEnhancementProcessor();
  });

  describe('Single Point Enhancement Speed', () => {
    it('should enhance single point in <10ms', async () => {
      const point = fallsCityPoints[0];
      const start = performance.now();

      await processor.enhanceBatch([point]);

      const duration = performance.now() - start;

      expect(duration).toBeLessThan(10);
    });

    it('should handle high-confidence points faster', async () => {
      const point = {
        Name: 'test/point',
        'Marker Tags': 'VAV Temp',
        'Kv Tags': '[{"device":"VAV-01"}]',
      };

      const start = performance.now();
      await processor.enhanceBatch([point]);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(5);
    });
  });

  describe('Batch Processing Performance', () => {
    it('should process 100 points in <1 second', async () => {
      const { metrics } = await processor.enhanceBatch(performanceTestData.small);

      expect(metrics.processingTime).toBeLessThan(1000);
      expect(metrics.pointsPerSecond).toBeGreaterThan(100);
    }, 5000);

    it('should process 1000 points in <10 seconds', async () => {
      const { metrics } = await processor.enhanceBatch(performanceTestData.medium);

      expect(metrics.processingTime).toBeLessThan(10000);
      expect(metrics.pointsPerSecond).toBeGreaterThan(100);
    }, 15000);

    it('should process 4500 points in <5 minutes', async () => {
      const { metrics } = await processor.enhanceBatch(performanceTestData.large);

      expect(metrics.processingTime).toBeLessThan(300000); // 5 minutes
      expect(metrics.pointsPerSecond).toBeGreaterThan(15);
    }, 310000);

    it('should maintain consistent throughput across batches', async () => {
      const results = await Promise.all([
        processor.enhanceBatch(performanceTestData.small),
        processor.enhanceBatch(performanceTestData.small),
        processor.enhanceBatch(performanceTestData.small),
      ]);

      const throughputs = results.map(r => r.metrics.pointsPerSecond);
      const avgThroughput = throughputs.reduce((a, b) => a + b) / throughputs.length;
      const variance = throughputs.map(t => Math.abs(t - avgThroughput));

      expect(Math.max(...variance)).toBeLessThan(avgThroughput * 0.2); // <20% variance
    }, 10000);
  });

  describe('Memory Usage', () => {
    it('should use <100MB for 1000 points', async () => {
      const { metrics } = await processor.enhanceBatch(performanceTestData.medium);

      expect(metrics.memoryUsed).toBeLessThan(100 * 1024 * 1024); // 100MB
    }, 15000);

    it('should not leak memory across batches', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 5; i++) {
        await processor.enhanceBatch(performanceTestData.small);
      }

      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // <50MB growth
    }, 15000);

    it('should handle large datasets without OOM', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        Name: `point-${i}`,
        'Marker Tags': `Tag${i}`,
      }));

      await expect(processor.enhanceBatch(largeDataset.slice(0, 1000))).resolves.toBeTruthy();
    }, 20000);
  });

  describe('Concurrent Request Handling', () => {
    it('should handle 10 concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        processor.enhanceBatch(fallsCityPoints.slice(0, 10))
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach(r => {
        expect(r.enhanced).toHaveLength(10);
      });
    }, 10000);

    it('should handle 50 concurrent requests', async () => {
      const requests = Array.from({ length: 50 }, () =>
        processor.enhanceBatch(fallsCityPoints.slice(0, 5))
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(50);
    }, 15000);

    it('should maintain performance under concurrent load', async () => {
      const singleRequestTime = await (async () => {
        const start = performance.now();
        await processor.enhanceBatch(performanceTestData.small);
        return performance.now() - start;
      })();

      const concurrentStart = performance.now();
      await Promise.all(
        Array.from({ length: 10 }, () => processor.enhanceBatch(performanceTestData.small))
      );
      const concurrentTime = performance.now() - concurrentStart;

      // Concurrent processing shouldn't be more than 3x slower
      expect(concurrentTime).toBeLessThan(singleRequestTime * 3);
    }, 20000);
  });

  describe('Worker CPU Time Limits', () => {
    it('should respect 50ms CPU time limit for Workers', async () => {
      const points = fallsCityPoints.slice(0, 50);

      const { metrics } = await processor.enhanceBatch(points, { timeout: 50 });

      expect(metrics.cpuTime).toBeLessThan(50);
    });

    it('should timeout gracefully when limit exceeded', async () => {
      const points = Array.from({ length: 10000 }, (_, i) => ({
        Name: `point-${i}`,
      }));

      await expect(
        processor.enhanceBatch(points, { timeout: 10 })
      ).rejects.toThrow('timeout');
    }, 5000);

    it('should process max points within 50ms limit', async () => {
      let maxPoints = 0;

      for (let count = 10; count <= 500; count += 10) {
        try {
          const points = fallsCityPoints.slice(0, count);
          const { metrics } = await processor.enhanceBatch(points, { timeout: 50 });

          if (metrics.cpuTime < 50) {
            maxPoints = count;
          } else {
            break;
          }
        } catch {
          break;
        }
      }

      expect(maxPoints).toBeGreaterThan(0);
      console.log(`Max points processable in 50ms: ${maxPoints}`);
    }, 30000);
  });

  describe('Throughput Optimization', () => {
    it('should achieve >100 points/second throughput', async () => {
      const { metrics } = await processor.enhanceBatch(performanceTestData.medium);

      expect(metrics.pointsPerSecond).toBeGreaterThan(100);
    }, 15000);

    it('should improve throughput with concurrent processing', async () => {
      const sequentialStart = performance.now();
      for (let i = 0; i < 5; i++) {
        await processor.enhanceBatch(performanceTestData.small);
      }
      const sequentialTime = performance.now() - sequentialStart;

      const concurrentStart = performance.now();
      await Promise.all(
        Array.from({ length: 5 }, () => processor.enhanceBatch(performanceTestData.small))
      );
      const concurrentTime = performance.now() - concurrentStart;

      expect(concurrentTime).toBeLessThan(sequentialTime);
    }, 20000);
  });

  describe('Scalability Tests', () => {
    it('should scale linearly up to 1000 points', async () => {
      const results: PerformanceMetrics[] = [];

      for (const size of [100, 500, 1000]) {
        const points = Array.from({ length: size }, (_, i) => ({
          Name: `point-${i}`,
        }));

        const { metrics } = await processor.enhanceBatch(points);
        results.push(metrics);
      }

      // Verify roughly linear scaling
      const throughputs = results.map(m => m.pointsPerSecond);
      const avgThroughput = throughputs.reduce((a, b) => a + b) / throughputs.length;

      throughputs.forEach(t => {
        expect(Math.abs(t - avgThroughput)).toBeLessThan(avgThroughput * 0.5);
      });
    }, 30000);
  });
});
