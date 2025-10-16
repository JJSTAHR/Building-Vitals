import axios from 'axios';
import type { BackfillStatus, BackfillConfig, BackfillResponse } from '../types/backfill';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class BackfillService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/backfill`;
  }

  /**
   * Get current backfill status
   */
  async getStatus(): Promise<BackfillStatus> {
    try {
      const response = await axios.get<BackfillStatus>(`${this.baseUrl}/status`);
      return response.data;
    } catch (error) {
      console.error('Failed to fetch backfill status:', error);
      throw new Error('Failed to fetch backfill status');
    }
  }

  /**
   * Start a new backfill operation
   */
  async start(config: BackfillConfig): Promise<BackfillResponse> {
    try {
      const response = await axios.post<BackfillResponse>(`${this.baseUrl}/start`, config);
      return response.data;
    } catch (error) {
      console.error('Failed to start backfill:', error);
      throw new Error('Failed to start backfill operation');
    }
  }

  /**
   * Pause the current backfill operation
   */
  async pause(): Promise<BackfillResponse> {
    try {
      const response = await axios.post<BackfillResponse>(`${this.baseUrl}/pause`);
      return response.data;
    } catch (error) {
      console.error('Failed to pause backfill:', error);
      throw new Error('Failed to pause backfill operation');
    }
  }

  /**
   * Resume a paused backfill operation
   */
  async resume(): Promise<BackfillResponse> {
    try {
      const response = await axios.post<BackfillResponse>(`${this.baseUrl}/resume`);
      return response.data;
    } catch (error) {
      console.error('Failed to resume backfill:', error);
      throw new Error('Failed to resume backfill operation');
    }
  }

  /**
   * Stop the current backfill operation
   */
  async stop(): Promise<BackfillResponse> {
    try {
      const response = await axios.post<BackfillResponse>(`${this.baseUrl}/stop`);
      return response.data;
    } catch (error) {
      console.error('Failed to stop backfill:', error);
      throw new Error('Failed to stop backfill operation');
    }
  }

  /**
   * Retry failed dates
   */
  async retryFailed(): Promise<BackfillResponse> {
    try {
      const response = await axios.post<BackfillResponse>(`${this.baseUrl}/retry-failed`);
      return response.data;
    } catch (error) {
      console.error('Failed to retry failed dates:', error);
      throw new Error('Failed to retry failed dates');
    }
  }

  /**
   * Clear all backfill data and reset status
   */
  async reset(): Promise<BackfillResponse> {
    try {
      const response = await axios.post<BackfillResponse>(`${this.baseUrl}/reset`);
      return response.data;
    } catch (error) {
      console.error('Failed to reset backfill:', error);
      throw new Error('Failed to reset backfill');
    }
  }

  /**
   * Calculate estimated completion time
   */
  calculateETA(status: BackfillStatus): string | null {
    if (!status.isRunning || !status.startedAt || status.processedDays === 0) {
      return null;
    }

    const startTime = new Date(status.startedAt).getTime();
    const now = Date.now();
    const elapsed = now - startTime;

    const avgTimePerDay = elapsed / status.processedDays;
    const remainingDays = status.totalDays - status.processedDays;
    const estimatedRemainingTime = avgTimePerDay * remainingDays;

    const estimatedCompletion = new Date(now + estimatedRemainingTime);
    return estimatedCompletion.toISOString();
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  }

  /**
   * Get status type for badge display
   */
  getStatusType(status: BackfillStatus): 'running' | 'paused' | 'failed' | 'completed' | 'idle' {
    if (status.errors.length > 0 && !status.isRunning) {
      return 'failed';
    }
    if (status.isRunning) {
      return 'running';
    }
    if (status.isPaused) {
      return 'paused';
    }
    if (status.processedDays === status.totalDays && status.totalDays > 0) {
      return 'completed';
    }
    return 'idle';
  }
}

export const backfillService = new BackfillService();
export default backfillService;
