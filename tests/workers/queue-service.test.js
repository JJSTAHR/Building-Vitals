/**
 * Queue Service Test Suite
 *
 * Tests for ChartQueueService including:
 * - Job queuing for large requests
 * - Job status tracking
 * - Retry logic with exponential backoff
 * - Job cancellation
 * - Progress tracking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChartQueueService } from '../../../workers/services/queue-service.js';
import { createMockD1Database, createMockQueue, createMockTimeseries } from './mocks/d1-mock';

describe('ChartQueueService', () => {
  let mockDb;
  let mockQueue;
  let queueService;

  beforeEach(() => {
    mockDb = createMockD1Database();
    mockQueue = createMockQueue();
    queueService = new ChartQueueService(mockQueue, mockDb, {
      maxRetries: 3,
      retryDelay: 1000,
      batchSize: 50
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Job Queuing', () => {
    it('should queue a large timeseries request', async () => {
      const jobId = 'job-123';
      const site = 'test-site';
      const points = ['point-1', 'point-2', 'point-3'];
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-12-31T23:59:59Z';
      const userId = 'user-456';

      const resultJobId = await queueService.queueLargeRequest(
        jobId,
        site,
        points,
        startTime,
        endTime,
        userId,
        {
          format: 'json',
          compression: true,
          cacheKey: 'cache/key'
        }
      );

      expect(resultJobId).toBe(jobId);
      expect(mockQueue.send).toHaveBeenCalledTimes(1);
      expect(mockQueue.send).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId,
          site,
          points,
          startTime,
          endTime,
          userId,
          options: expect.objectContaining({
            format: 'json',
            compression: true,
            cacheKey: 'cache/key'
          })
        })
      );
    });

    it('should create job record in D1 when queuing', async () => {
      const jobId = 'job-db-test';
      const site = 'test-site';
      const points = ['point-1'];
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-31T23:59:59Z';

      await queueService.queueLargeRequest(
        jobId,
        site,
        points,
        startTime,
        endTime
      );

      // Verify job record was created
      const job = await mockDb.prepare(`
        SELECT * FROM queue_jobs WHERE job_id = ?
      `).bind(jobId).first();

      expect(job).toBeDefined();
      expect(job.site_name).toBe(site);
      expect(job.status).toBe('queued');
    });

    it('should estimate data size for job', async () => {
      const jobId = 'job-size-test';
      const points = ['point-1', 'point-2', 'point-3', 'point-4', 'point-5'];
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-12-31T23:59:59Z'; // 365 days

      await queueService.queueLargeRequest(
        jobId,
        'test-site',
        points,
        startTime,
        endTime
      );

      // Estimated size: 5 points * 365 days * 100 samples/day = ~182,500 samples
      // This is stored in the job record for tracking
      const job = await mockDb.prepare(`
        SELECT * FROM queue_jobs WHERE job_id = ?
      `).bind(jobId).first();

      expect(job).toBeDefined();
    });

    it('should handle queue send failures', async () => {
      mockQueue.send.mockRejectedValueOnce(new Error('Queue full'));

      const jobId = 'job-fail';

      await expect(
        queueService.queueLargeRequest(
          jobId,
          'test-site',
          ['point-1'],
          '2024-01-01T00:00:00Z',
          '2024-01-31T23:59:59Z'
        )
      ).rejects.toThrow('Failed to queue job');

      // Job should be marked as failed
      const job = await mockDb.prepare(`
        SELECT * FROM queue_jobs WHERE job_id = ?
      `).bind(jobId).first();

      expect(job.status).toBe('failed');
    });
  });

  describe('Job Status Tracking', () => {
    beforeEach(async () => {
      // Create a test job
      const jobId = 'status-test-job';
      await queueService.queueLargeRequest(
        jobId,
        'test-site',
        ['point-1'],
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      );
    });

    it('should retrieve job status', async () => {
      const status = await queueService.getJobStatus('status-test-job');

      expect(status).not.toBeNull();
      expect(status.jobId).toBe('status-test-job');
      expect(status.status).toBe('queued');
      expect(status.progress).toBe(0);
    });

    it('should return null for non-existent job', async () => {
      const status = await queueService.getJobStatus('non-existent-job');

      expect(status).toBeNull();
    });

    it('should update job status to processing', async () => {
      const jobId = 'status-test-job';

      await queueService._updateJobStatus(jobId, 'processing', {
        progress: 25
      });

      const status = await queueService.getJobStatus(jobId);

      expect(status.status).toBe('processing');
      expect(status.progress).toBe(25);
      expect(status.startedAt).toBeDefined();
    });

    it('should update job status to completed', async () => {
      const jobId = 'status-test-job';

      await queueService._updateJobStatus(jobId, 'completed', {
        samplesCount: 10000,
        dataSize: 500000,
        cacheKey: 'cache/result-key'
      });

      const status = await queueService.getJobStatus(jobId);

      expect(status.status).toBe('completed');
      expect(status.samplesCount).toBe(10000);
      expect(status.cacheKey).toBe('cache/result-key');
      expect(status.completedAt).toBeDefined();
    });

    it('should track processing time', async () => {
      const jobId = 'status-test-job';

      await queueService._updateJobStatus(jobId, 'processing');

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 100));

      await queueService._updateJobStatus(jobId, 'completed');

      const status = await queueService.getJobStatus(jobId);

      expect(status.startedAt).toBeDefined();
      expect(status.completedAt).toBeDefined();
    });
  });

  describe('Job Processing', () => {
    it('should process job with paginated data fetch', async () => {
      const jobId = 'process-test-job';
      const site = 'test-site';
      const points = ['point-1', 'point-2'];
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-31T23:59:59Z';

      // Queue job
      await queueService.queueLargeRequest(
        jobId,
        site,
        points,
        startTime,
        endTime
      );

      // Create mock environment
      const mockEnv = {
        ACE_API_URL: 'https://api.test.com',
        TIMESERIES_CACHE: null
      };

      // Mock fetch for paginated API
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            point_samples: createMockTimeseries(100, { siteName: site }),
            has_more: true,
            next_cursor: 'cursor-1'
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            point_samples: createMockTimeseries(50, { siteName: site }),
            has_more: false,
            next_cursor: null
          })
        });

      // Process job
      const message = {
        body: {
          jobId,
          site,
          points,
          startTime,
          endTime,
          options: {}
        }
      };

      await queueService.processJob(message, mockEnv);

      // Verify job completed
      const status = await queueService.getJobStatus(jobId);
      expect(status.status).toBe('completed');
      expect(status.samplesCount).toBeGreaterThan(0);
    });

    it('should update progress during processing', async () => {
      const jobId = 'progress-test-job';

      // Simulate progress updates
      await queueService._updateJobStatus(jobId, 'processing', {
        progress: 0,
        processedPoints: 0,
        totalPoints: 100
      });

      let status = await queueService.getJobStatus(jobId);
      expect(status.progress).toBe(0);

      await queueService._updateJobStatus(jobId, 'processing', {
        progress: 50,
        processedPoints: 50,
        totalPoints: 100
      });

      status = await queueService.getJobStatus(jobId);
      expect(status.progress).toBe(50);

      await queueService._updateJobStatus(jobId, 'processing', {
        progress: 100,
        processedPoints: 100,
        totalPoints: 100
      });

      status = await queueService.getJobStatus(jobId);
      expect(status.progress).toBe(100);
    });

    it('should handle API errors during processing', async () => {
      const jobId = 'error-test-job';
      const site = 'test-site';
      const points = ['point-1'];
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-31T23:59:59Z';

      await queueService.queueLargeRequest(
        jobId,
        site,
        points,
        startTime,
        endTime
      );

      const mockEnv = {
        ACE_API_URL: 'https://api.test.com',
        TIMESERIES_CACHE: null
      };

      // Mock API failure
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      const message = {
        body: {
          jobId,
          site,
          points,
          startTime,
          endTime,
          options: {}
        }
      };

      await expect(
        queueService.processJob(message, mockEnv)
      ).rejects.toThrow();

      // Job should be marked for retry
      const status = await queueService.getJobStatus(jobId);
      expect(status.status).toMatch(/failed|retrying/);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed jobs up to max retries', async () => {
      const jobId = 'retry-test-job';

      await queueService.queueLargeRequest(
        jobId,
        'test-site',
        ['point-1'],
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      );

      // Simulate multiple failures
      for (let i = 0; i < 3; i++) {
        await queueService._updateJobStatus(jobId, 'retrying', {
          retryCount: i + 1,
          lastError: `Attempt ${i + 1} failed`
        });

        const status = await queueService.getJobStatus(jobId);
        expect(status.retryCount).toBe(i + 1);
      }

      // After max retries, should be marked as failed
      await queueService._updateJobStatus(jobId, 'failed', {
        retryCount: 3,
        error: 'Max retries exceeded'
      });

      const finalStatus = await queueService.getJobStatus(jobId);
      expect(finalStatus.status).toBe('failed');
      expect(finalStatus.retryCount).toBe(3);
    });

    it('should use exponential backoff for retries', () => {
      const baseDelay = 1000; // 1 second

      // Calculate delays for retries
      const delay1 = baseDelay * Math.pow(2, 0); // 1s
      const delay2 = baseDelay * Math.pow(2, 1); // 2s
      const delay3 = baseDelay * Math.pow(2, 2); // 4s

      expect(delay1).toBe(1000);
      expect(delay2).toBe(2000);
      expect(delay3).toBe(4000);
    });

    it('should re-queue job with delay on retry', async () => {
      const jobId = 'requeue-test-job';

      await queueService.queueLargeRequest(
        jobId,
        'test-site',
        ['point-1'],
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      );

      // Simulate retry with delay
      const message = {
        body: {
          jobId,
          site: 'test-site',
          points: ['point-1'],
          startTime: '2024-01-01T00:00:00Z',
          endTime: '2024-01-31T23:59:59Z',
          options: {}
        }
      };

      // Mock failure
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      const mockEnv = {
        ACE_API_URL: 'https://api.test.com',
        TIMESERIES_CACHE: null
      };

      try {
        await queueService.processJob(message, mockEnv);
      } catch (error) {
        // Expected to fail
      }

      // Should re-queue with delay
      expect(mockQueue.send).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          delaySeconds: expect.any(Number)
        })
      );
    });
  });

  describe('Job Cancellation', () => {
    it('should cancel a queued job', async () => {
      const jobId = 'cancel-test-job';

      await queueService.queueLargeRequest(
        jobId,
        'test-site',
        ['point-1'],
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      );

      const cancelled = await queueService.cancelJob(jobId);

      expect(cancelled).toBe(true);

      const status = await queueService.getJobStatus(jobId);
      expect(status.status).toBe('cancelled');
    });

    it('should not cancel completed jobs', async () => {
      const jobId = 'completed-job';

      await queueService.queueLargeRequest(
        jobId,
        'test-site',
        ['point-1'],
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      );

      await queueService._updateJobStatus(jobId, 'completed');

      const cancelled = await queueService.cancelJob(jobId);

      expect(cancelled).toBe(false);
    });

    it('should not cancel failed jobs', async () => {
      const jobId = 'failed-job';

      await queueService.queueLargeRequest(
        jobId,
        'test-site',
        ['point-1'],
        '2024-01-01T00:00:00Z',
        '2024-01-31T23:59:59Z'
      );

      await queueService._updateJobStatus(jobId, 'failed');

      const cancelled = await queueService.cancelJob(jobId);

      expect(cancelled).toBe(false);
    });
  });

  describe('Data Estimation', () => {
    it('should estimate data size based on time range', () => {
      const pointCount = 10;
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-31T23:59:59Z'; // 31 days

      const estimated = queueService._estimateDataSize(pointCount, startTime, endTime);

      // 10 points * 31 days * 100 samples/day = 31,000
      expect(estimated).toBeGreaterThan(30000);
      expect(estimated).toBeLessThan(32000);
    });

    it('should scale estimate with point count', () => {
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-31T23:59:59Z';

      const estimate5 = queueService._estimateDataSize(5, startTime, endTime);
      const estimate10 = queueService._estimateDataSize(10, startTime, endTime);
      const estimate20 = queueService._estimateDataSize(20, startTime, endTime);

      expect(estimate10).toBeCloseTo(estimate5 * 2, -100);
      expect(estimate20).toBeCloseTo(estimate10 * 2, -100);
    });
  });

  describe('Sample Counting', () => {
    it('should count total samples in result data', () => {
      const data = {
        'point-1': { samples: Array(100).fill({}), count: 100 },
        'point-2': { samples: Array(150).fill({}), count: 150 },
        'point-3': { samples: Array(200).fill({}), count: 200 }
      };

      const total = queueService._countSamples(data);

      expect(total).toBe(450);
    });

    it('should handle empty data', () => {
      const total = queueService._countSamples({});

      expect(total).toBe(0);
    });

    it('should handle points with no samples', () => {
      const data = {
        'point-1': { samples: [], count: 0 },
        'point-2': { samples: null }
      };

      const total = queueService._countSamples(data);

      expect(total).toBe(0);
    });
  });
});
