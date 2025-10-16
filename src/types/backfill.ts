export interface BackfillStatus {
  isRunning: boolean;
  isPaused: boolean;
  currentDate: string | null;
  startDate: string;
  endDate: string;
  completedDates: string[];
  totalDays: number;
  processedDays: number;
  recordsFetched: number;
  errors: BackfillError[];
  startedAt: string | null;
  estimatedCompletion: string | null;
  lastUpdated: string;
}

export interface BackfillError {
  date: string;
  error: string;
  timestamp: string;
  retryCount: number;
}

export interface BackfillConfig {
  startDate: string;
  endDate: string;
  batchSize?: number;
  delayMs?: number;
}

export interface BackfillResponse {
  success: boolean;
  message: string;
  status?: BackfillStatus;
}

export type BackfillStatusType = 'running' | 'paused' | 'failed' | 'completed' | 'idle';
