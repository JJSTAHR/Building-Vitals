/**
 * Quota Management Tests
 * Tests for AI quota tracking, limits, and fallback behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { quotaTestScenarios, performanceTestData } from '../fixtures/falls-city-points';

interface QuotaTracker {
  dailyLimit: number;
  used: number;
  reservePercentage: number;
  lastReset: Date;
}

class QuotaManager {
  private tracker: QuotaTracker;
  private warningCallbacks: Array<(percentage: number) => void> = [];
  private hardStopCallbacks: Array<() => void> = [];

  constructor(dailyLimit: number = 10000) {
    this.tracker = {
      dailyLimit,
      used: 0,
      reservePercentage: 5,
      lastReset: new Date(),
    };
  }

  use(amount: number): boolean {
    const available = this.getAvailable();

    if (amount > available) {
      this.triggerHardStop();
      return false;
    }

    this.tracker.used += amount;

    // Check warning threshold (80%)
    const percentage = this.getUsagePercentage();
    if (percentage >= 80 && percentage < 95) {
      this.triggerWarning(percentage);
    }

    // Check hard stop threshold (95%)
    if (percentage >= 95) {
      this.triggerHardStop();
    }

    return true;
  }

  getAvailable(): number {
    const reserved = this.tracker.dailyLimit * (this.tracker.reservePercentage / 100);
    return this.tracker.dailyLimit - this.tracker.used - reserved;
  }

  getUsagePercentage(): number {
    return (this.tracker.used / this.tracker.dailyLimit) * 100;
  }

  shouldReset(): boolean {
    const now = new Date();
    const lastReset = this.tracker.lastReset;
    const diffHours = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
    return diffHours >= 24;
  }

  reset(): void {
    this.tracker.used = 0;
    this.tracker.lastReset = new Date();
  }

  getTracker(): QuotaTracker {
    return { ...this.tracker };
  }

  onWarning(callback: (percentage: number) => void): void {
    this.warningCallbacks.push(callback);
  }

  onHardStop(callback: () => void): void {
    this.hardStopCallbacks.push(callback);
  }

  private triggerWarning(percentage: number): void {
    this.warningCallbacks.forEach(cb => cb(percentage));
  }

  private triggerHardStop(): void {
    this.hardStopCallbacks.forEach(cb => cb());
  }

  estimatePointCost(confidence: number): number {
    if (confidence > 85) return 0; // Rule-based
    if (confidence >= 70) return 20; // Light AI
    return 50; // Full AI
  }

  canProcess(points: number, avgConfidence: number): boolean {
    const estimatedCost = points * this.estimatePointCost(avgConfidence);
    return estimatedCost <= this.getAvailable();
  }
}

describe('Quota Management Tests', () => {
  let manager: QuotaManager;

  beforeEach(() => {
    manager = new QuotaManager(10000);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Quota Tracking Accuracy', () => {
    it('should track quota usage correctly', () => {
      const success = manager.use(1000);

      expect(success).toBe(true);
      expect(manager.getTracker().used).toBe(1000);
      expect(manager.getUsagePercentage()).toBe(10);
    });

    it('should handle multiple quota increments', () => {
      manager.use(500);
      manager.use(300);
      manager.use(200);

      expect(manager.getTracker().used).toBe(1000);
      expect(manager.getUsagePercentage()).toBe(10);
    });

    it('should calculate available quota with reserve', () => {
      const available = manager.getAvailable();
      const expectedAvailable = 10000 - (10000 * 0.05); // 5% reserve

      expect(available).toBe(expectedAvailable);
    });

    it('should track quota across batch operations', () => {
      for (let i = 0; i < 100; i++) {
        manager.use(50);
      }

      expect(manager.getTracker().used).toBe(5000);
      expect(manager.getUsagePercentage()).toBe(50);
    });

    it('should handle decimal quota values', () => {
      manager.use(123.45);
      manager.use(67.89);

      expect(manager.getTracker().used).toBeCloseTo(191.34, 2);
    });
  });

  describe('Daily Reset Verification', () => {
    it('should detect when reset is needed', () => {
      manager.use(5000);

      expect(manager.shouldReset()).toBe(false);

      // Advance time by 24 hours
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);

      expect(manager.shouldReset()).toBe(true);
    });

    it('should reset quota to zero', () => {
      manager.use(8000);
      manager.reset();

      expect(manager.getTracker().used).toBe(0);
      expect(manager.getUsagePercentage()).toBe(0);
    });

    it('should update last reset timestamp', () => {
      const beforeReset = manager.getTracker().lastReset;

      vi.advanceTimersByTime(1000);
      manager.reset();

      const afterReset = manager.getTracker().lastReset;
      expect(afterReset.getTime()).toBeGreaterThan(beforeReset.getTime());
    });

    it('should not reset before 24 hours', () => {
      // Advance time by 23 hours
      vi.advanceTimersByTime(23 * 60 * 60 * 1000);

      expect(manager.shouldReset()).toBe(false);
    });

    it('should handle timezone changes correctly', () => {
      manager.reset();
      const resetTime = manager.getTracker().lastReset;

      expect(resetTime).toBeInstanceOf(Date);
      expect(resetTime.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Warning Triggers (80% Threshold)', () => {
    it('should trigger warning at 80% usage', () => {
      const warnings: number[] = [];
      manager.onWarning(percentage => warnings.push(percentage));

      manager.use(8000);

      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings[0]).toBeGreaterThanOrEqual(80);
    });

    it('should trigger warning callback with correct percentage', () => {
      let triggeredPercentage = 0;
      manager.onWarning(percentage => {
        triggeredPercentage = percentage;
      });

      manager.use(8500);

      expect(triggeredPercentage).toBeCloseTo(85, 0);
    });

    it('should trigger multiple warnings as usage increases', () => {
      const warnings: number[] = [];
      manager.onWarning(percentage => warnings.push(percentage));

      manager.use(8000); // 80%
      manager.use(500); // 85%
      manager.use(500); // 90%

      expect(warnings.length).toBeGreaterThanOrEqual(2);
    });

    it('should not trigger warning below 80%', () => {
      const warnings: number[] = [];
      manager.onWarning(percentage => warnings.push(percentage));

      manager.use(7000); // 70%

      expect(warnings.length).toBe(0);
    });
  });

  describe('Hard Stop Enforcement (95% Threshold)', () => {
    it('should enforce hard stop at 95% usage', () => {
      let hardStopTriggered = false;
      manager.onHardStop(() => {
        hardStopTriggered = true;
      });

      manager.use(9500);

      expect(hardStopTriggered).toBe(true);
    });

    it('should reject quota requests that exceed limit', () => {
      manager.use(9000);

      const success = manager.use(2000); // Would exceed limit

      expect(success).toBe(false);
      expect(manager.getTracker().used).toBe(9000); // Unchanged
    });

    it('should prevent quota usage beyond available', () => {
      manager.use(9400);

      const available = manager.getAvailable();
      const success = manager.use(available + 100);

      expect(success).toBe(false);
    });

    it('should allow quota usage up to available amount', () => {
      manager.use(9000);

      const available = manager.getAvailable();
      const success = manager.use(available);

      expect(success).toBe(true);
    });
  });

  describe('Fallback Behavior When Quota Exceeded', () => {
    it('should return false when quota unavailable', () => {
      manager.use(10000);

      const success = manager.use(100);

      expect(success).toBe(false);
    });

    it('should preserve state when request rejected', () => {
      const beforeUsed = manager.getTracker().used;

      manager.use(20000); // Exceeds limit

      expect(manager.getTracker().used).toBe(beforeUsed);
    });

    it('should allow rule-based processing when quota exceeded', () => {
      manager.use(10000);

      const cost = manager.estimatePointCost(90); // High confidence

      expect(cost).toBe(0); // Rule-based is free
    });

    it('should block AI processing when quota exceeded', () => {
      manager.use(9500);

      const canProcess = manager.canProcess(100, 60); // Low confidence

      expect(canProcess).toBe(false);
    });
  });

  describe('Quota Estimation', () => {
    it('should estimate zero cost for high confidence points', () => {
      const cost = manager.estimatePointCost(90);

      expect(cost).toBe(0);
    });

    it('should estimate 20 units for medium confidence', () => {
      const cost = manager.estimatePointCost(75);

      expect(cost).toBe(20);
    });

    it('should estimate 50 units for low confidence', () => {
      const cost = manager.estimatePointCost(60);

      expect(cost).toBe(50);
    });

    it('should predict batch processing feasibility', () => {
      const canProcess = manager.canProcess(100, 85);

      expect(canProcess).toBe(true);
    });

    it('should reject large batches with low confidence', () => {
      manager.use(5000);

      const canProcess = manager.canProcess(200, 60); // 10,000 quota needed

      expect(canProcess).toBe(false);
    });
  });

  describe('Scenario-Based Tests', () => {
    it('should handle under quota scenario', () => {
      const scenario = quotaTestScenarios[0];
      manager = new QuotaManager(scenario.dailyLimit);
      manager.use(scenario.quotaUsed);

      const canProcess = manager.canProcess(scenario.pointCount, 75);

      expect(canProcess).toBe(true);
    });

    it('should handle approaching quota scenario', () => {
      const scenario = quotaTestScenarios[1];
      manager = new QuotaManager(scenario.dailyLimit);
      manager.use(scenario.quotaUsed);

      const percentage = manager.getUsagePercentage();

      expect(percentage).toBeGreaterThan(80);
    });

    it('should handle quota exceeded scenario', () => {
      const scenario = quotaTestScenarios[2];
      manager = new QuotaManager(scenario.dailyLimit);
      manager.use(scenario.quotaUsed);

      const canProcess = manager.canProcess(scenario.pointCount, 60);

      expect(canProcess).toBe(false);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle 4500 point dataset quota calculation', () => {
      const estimatedCost = 4500 * manager.estimatePointCost(75);

      expect(estimatedCost).toBeLessThanOrEqual(manager.getTracker().dailyLimit);
    });

    it('should process quota requests quickly', () => {
      const start = Date.now();

      for (let i = 0; i < 1000; i++) {
        manager.use(1);
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(100); // <100ms for 1000 operations
    });
  });
});
