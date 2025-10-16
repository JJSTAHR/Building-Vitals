/**
 * RequestQueue - Queue management for requests during token refresh
 *
 * Features:
 * - Queue requests during token refresh
 * - Retry all queued requests after successful refresh
 * - Fail all queued requests if refresh fails
 * - Maximum queue size limit (50 requests)
 * - Timeout handling for stale requests
 */

import type { InternalAxiosRequestConfig, AxiosInstance } from 'axios';

export interface QueuedRequest {
  config: InternalAxiosRequestConfig;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timestamp: number;
  requestId: string;
}

export class RequestQueue {
  private queue: QueuedRequest[] = [];
  private readonly MAX_QUEUE_SIZE = 50;
  private readonly REQUEST_TIMEOUT = 30000; // 30 seconds
  private axiosInstance: AxiosInstance | null = null;

  constructor(axiosInstance?: AxiosInstance) {
    this.axiosInstance = axiosInstance || null;
  }

  /**
   * Set axios instance for retrying requests
   * @param instance - Axios instance
   */
  public setAxiosInstance(instance: AxiosInstance): void {
    this.axiosInstance = instance;
  }

  /**
   * Enqueue a request to be retried after token refresh
   * @param config - Axios request configuration
   * @returns Promise that resolves when request is retried
   */
  public enqueue(config: InternalAxiosRequestConfig): Promise<any> {
    // Check queue size limit
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      console.error('[RequestQueue] Queue size limit reached, rejecting request');
      return Promise.reject(new Error('Request queue is full. Please try again later.'));
    }

    // Generate unique request ID
    const requestId = this.generateRequestId();

    return new Promise((resolve, reject) => {
      const queuedRequest: QueuedRequest = {
        config,
        resolve,
        reject,
        timestamp: Date.now(),
        requestId,
      };

      this.queue.push(queuedRequest);
      console.debug(`[RequestQueue] Request queued: ${requestId} (${this.queue.length} in queue)`);
    });
  }

  /**
   * Retry all queued requests after successful token refresh
   */
  public async retryAll(): Promise<void> {
    if (!this.axiosInstance) {
      console.error('[RequestQueue] Cannot retry requests: Axios instance not set');
      this.failAll(new Error('Axios instance not configured'));
      return;
    }

    console.log(`[RequestQueue] Retrying ${this.queue.length} queued requests`);

    // Remove timed-out requests
    this.removeTimedOutRequests();

    // Copy and clear queue
    const requestsToRetry = [...this.queue];
    this.queue = [];

    // Retry all requests in parallel
    const results = await Promise.allSettled(
      requestsToRetry.map(async (queuedRequest) => {
        try {
          const response = await this.axiosInstance!(queuedRequest.config);
          queuedRequest.resolve(response);
          console.debug(`[RequestQueue] Request ${queuedRequest.requestId} succeeded`);
          return { success: true, requestId: queuedRequest.requestId };
        } catch (error) {
          queuedRequest.reject(error);
          console.error(`[RequestQueue] Request ${queuedRequest.requestId} failed:`, error);
          return { success: false, requestId: queuedRequest.requestId, error };
        }
      })
    );

    // Log summary
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;
    console.log(`[RequestQueue] Retry complete: ${successful} succeeded, ${failed} failed`);
  }

  /**
   * Fail all queued requests (e.g., token refresh failed)
   * @param error - Error to reject requests with
   */
  public failAll(error: Error): void {
    console.warn(`[RequestQueue] Failing ${this.queue.length} queued requests`);

    const requestsToFail = [...this.queue];
    this.queue = [];

    requestsToFail.forEach((queuedRequest) => {
      queuedRequest.reject(error);
      console.debug(`[RequestQueue] Request ${queuedRequest.requestId} failed`);
    });
  }

  /**
   * Remove requests that have timed out
   */
  private removeTimedOutRequests(): void {
    const now = Date.now();
    const originalSize = this.queue.length;

    this.queue = this.queue.filter((request) => {
      const age = now - request.timestamp;
      if (age > this.REQUEST_TIMEOUT) {
        request.reject(new Error('Request timeout while waiting for token refresh'));
        console.warn(`[RequestQueue] Request ${request.requestId} timed out after ${age}ms`);
        return false;
      }
      return true;
    });

    const removed = originalSize - this.queue.length;
    if (removed > 0) {
      console.warn(`[RequestQueue] Removed ${removed} timed-out requests`);
    }
  }

  /**
   * Generate unique request ID
   * @returns Unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current queue size
   * @returns Number of queued requests
   */
  public size(): number {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   * @returns True if queue is empty
   */
  public isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Clear all queued requests without retrying
   */
  public clear(): void {
    console.warn(`[RequestQueue] Clearing ${this.queue.length} queued requests`);
    this.failAll(new Error('Request queue cleared'));
  }

  /**
   * Get queue statistics
   * @returns Queue stats object
   */
  public getStats(): {
    size: number;
    oldestRequestAge: number | null;
    requestIds: string[];
  } {
    if (this.queue.length === 0) {
      return {
        size: 0,
        oldestRequestAge: null,
        requestIds: [],
      };
    }

    const now = Date.now();
    const oldestRequest = this.queue.reduce((oldest, current) =>
      current.timestamp < oldest.timestamp ? current : oldest
    );

    return {
      size: this.queue.length,
      oldestRequestAge: now - oldestRequest.timestamp,
      requestIds: this.queue.map((r) => r.requestId),
    };
  }
}

export default RequestQueue;
