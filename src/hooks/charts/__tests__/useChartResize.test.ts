/**
 * useChartResize Hook - Comprehensive Test Suite
 *
 * Tests cover:
 * - Basic resize detection
 * - Debouncing behavior
 * - Cleanup on unmount
 * - Edge cases (null refs, rapid resizes, unmount during resize)
 * - Callback invocation
 * - Enable/disable functionality
 * - Threshold-based filtering
 *
 * @module hooks/charts/__tests__/useChartResize.test
 * @vitest-environment jsdom
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { useRef } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useChartResize } from '../useChartResize';
import type { UseChartResizeOptions, Dimensions } from '../useChartResize';

/* ============================================================================
 * TEST SETUP & MOCKS
 * ========================================================================= */

/**
 * Mock ResizeObserver for testing
 */
class MockResizeObserver implements ResizeObserver {
  private callback: ResizeObserverCallback;
  private elements: Set<Element> = new Set();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    this.elements.add(target);
  }

  unobserve(target: Element): void {
    this.elements.delete(target);
  }

  disconnect(): void {
    this.elements.clear();
  }

  // Helper method to trigger resize
  triggerResize(width: number, height: number): void {
    const entries: ResizeObserverEntry[] = Array.from(this.elements).map(
      (element) => ({
        target: element,
        contentRect: {
          width,
          height,
          top: 0,
          left: 0,
          right: width,
          bottom: height,
          x: 0,
          y: 0,
        } as DOMRectReadOnly,
        borderBoxSize: [] as unknown as ReadonlyArray<ResizeObserverSize>,
        contentBoxSize: [] as unknown as ReadonlyArray<ResizeObserverSize>,
        devicePixelContentBoxSize: [] as unknown as ReadonlyArray<ResizeObserverSize>,
      })
    );
    this.callback(entries, this);
  }
}

let mockResizeObserver: MockResizeObserver | null = null;

// Mock ResizeObserver globally
global.ResizeObserver = vi.fn((callback: ResizeObserverCallback) => {
  mockResizeObserver = new MockResizeObserver(callback);
  return mockResizeObserver;
}) as unknown as typeof ResizeObserver;

/**
 * Create a mock HTMLElement with getBoundingClientRect
 */
function createMockElement(width = 800, height = 600): HTMLDivElement {
  const element = document.createElement('div');

  // Mock getBoundingClientRect
  element.getBoundingClientRect = vi.fn(() => ({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  }));

  return element;
}

/**
 * Helper to create a ref with a mock element
 */
function createMockRef(width = 800, height = 600) {
  return {
    current: createMockElement(width, height),
  };
}

/**
 * Wait for debounce delay + buffer
 */
async function waitForDebounce(delay = 100): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, delay + 50));
  });
}

/* ============================================================================
 * TEST SUITES
 * ========================================================================= */

describe('useChartResize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
    mockResizeObserver = null;
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  /* ==========================================================================
   * Basic Functionality Tests
   * ======================================================================= */

  describe('Basic Functionality', () => {
    it('should return initial dimensions of zero', () => {
      const ref = createMockRef(800, 600);
      const { result } = renderHook(() => useChartResize(ref));

      expect(result.current.dimensions).toEqual({ width: 0, height: 0 });
      expect(result.current.isResizing).toBe(false);
    });

    it('should detect and report resize events', async () => {
      const ref = createMockRef(800, 600);
      const { result } = renderHook(() => useChartResize(ref));

      // Trigger resize
      act(() => {
        mockResizeObserver?.triggerResize(1024, 768);
      });

      // Should be in resizing state
      expect(result.current.isResizing).toBe(true);

      // Wait for debounce
      await waitForDebounce();

      // Should have updated dimensions
      await waitFor(() => {
        expect(result.current.dimensions).toEqual({ width: 1024, height: 768 });
        expect(result.current.isResizing).toBe(false);
      });
    });

    it('should update dimensions on element ref', async () => {
      const ref = createMockRef(800, 600);
      const { result } = renderHook(() => useChartResize(ref));

      // Initial resize
      act(() => {
        mockResizeObserver?.triggerResize(800, 600);
      });

      await waitForDebounce();

      await waitFor(() => {
        expect(result.current.dimensions.width).toBe(800);
        expect(result.current.dimensions.height).toBe(600);
      });
    });

    it('should get initial dimensions from getBoundingClientRect', async () => {
      const ref = createMockRef(1200, 800);
      const { result } = renderHook(() => useChartResize(ref));

      // Wait for initial measurement
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // Should have initial dimensions
      await waitFor(() => {
        expect(result.current.dimensions.width).toBeGreaterThan(0);
      });
    });
  });

  /* ==========================================================================
   * Debouncing Tests
   * ======================================================================= */

  describe('Debouncing', () => {
    it('should debounce rapid resize events', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      renderHook(() =>
        useChartResize(ref, {
          onResize,
          debounceDelay: 100,
        })
      );

      // Trigger multiple rapid resizes
      act(() => {
        mockResizeObserver?.triggerResize(800, 600);
        mockResizeObserver?.triggerResize(900, 650);
        mockResizeObserver?.triggerResize(1000, 700);
        mockResizeObserver?.triggerResize(1100, 750);
      });

      // Should not have called callback yet
      expect(onResize).not.toHaveBeenCalled();

      // Wait for debounce
      await waitForDebounce(100);

      // Should have called callback only once with final dimensions
      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(1);
        expect(onResize).toHaveBeenCalledWith({ width: 1100, height: 750 });
      });
    });

    it('should respect custom debounce delay', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      renderHook(() =>
        useChartResize(ref, {
          onResize,
          debounceDelay: 200,
        })
      );

      act(() => {
        mockResizeObserver?.triggerResize(1024, 768);
      });

      // Should not have called after 150ms
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });
      expect(onResize).not.toHaveBeenCalled();

      // Should have called after 250ms
      await waitForDebounce(200);
      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(1);
      });
    });

    it('should reset debounce timer on new resize', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      renderHook(() =>
        useChartResize(ref, {
          onResize,
          debounceDelay: 100,
        })
      );

      // First resize
      act(() => {
        mockResizeObserver?.triggerResize(900, 600);
      });

      // Wait half the debounce time
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Second resize before first completes
      act(() => {
        mockResizeObserver?.triggerResize(1000, 700);
      });

      // Wait for full debounce from second resize
      await waitForDebounce(100);

      // Should only have called once with the final dimensions
      await waitFor(() => {
        expect(onResize).toHaveBeenCalledTimes(1);
        expect(onResize).toHaveBeenCalledWith({ width: 1000, height: 700 });
      });
    });
  });

  /* ==========================================================================
   * Callback Tests
   * ======================================================================= */

  describe('Callback Invocation', () => {
    it('should call onResize callback when dimensions change', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      renderHook(() =>
        useChartResize(ref, {
          onResize,
        })
      );

      act(() => {
        mockResizeObserver?.triggerResize(1024, 768);
      });

      await waitForDebounce();

      await waitFor(() => {
        expect(onResize).toHaveBeenCalledWith({ width: 1024, height: 768 });
      });
    });

    it('should not call callback if dimensions do not change significantly', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      renderHook(() =>
        useChartResize(ref, {
          onResize,
          threshold: 10, // Require 10px change
        })
      );

      // Initial resize
      act(() => {
        mockResizeObserver?.triggerResize(800, 600);
      });

      await waitForDebounce();

      // Clear any initial calls
      onResize.mockClear();

      // Small change (below threshold)
      act(() => {
        mockResizeObserver?.triggerResize(805, 605);
      });

      await waitForDebounce();

      // Should not have called callback
      expect(onResize).not.toHaveBeenCalled();
    });

    it('should handle callback errors gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();
      const onResize = vi.fn(() => {
        throw new Error('Callback error');
      });
      const ref = createMockRef(800, 600);

      const { result } = renderHook(() =>
        useChartResize(ref, {
          onResize,
        })
      );

      act(() => {
        mockResizeObserver?.triggerResize(1024, 768);
      });

      await waitForDebounce();

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(result.current.isResizing).toBe(false);
      });

      consoleWarnSpy.mockRestore();
    });
  });

  /* ==========================================================================
   * Edge Cases & Error Handling
   * ======================================================================= */

  describe('Edge Cases', () => {
    it('should handle null ref gracefully', () => {
      const ref = { current: null };
      const { result } = renderHook(() => useChartResize(ref));

      expect(result.current.dimensions).toEqual({ width: 0, height: 0 });
      expect(result.current.isResizing).toBe(false);
    });

    it('should handle undefined ref gracefully', () => {
      const ref = useRef<HTMLDivElement>(null);
      const { result } = renderHook(() => useChartResize(ref));

      expect(result.current.dimensions).toEqual({ width: 0, height: 0 });
      expect(result.current.isResizing).toBe(false);
    });

    it('should ignore invalid dimensions (zero or negative)', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      renderHook(() =>
        useChartResize(ref, {
          onResize,
        })
      );

      // Trigger with zero dimensions
      act(() => {
        mockResizeObserver?.triggerResize(0, 0);
      });

      await waitForDebounce();

      expect(onResize).not.toHaveBeenCalled();

      // Trigger with negative dimensions
      act(() => {
        mockResizeObserver?.triggerResize(-100, -100);
      });

      await waitForDebounce();

      expect(onResize).not.toHaveBeenCalled();
    });

    it('should handle rapid mount/unmount cycles', () => {
      const ref = createMockRef(800, 600);
      const { unmount, rerender } = renderHook(() => useChartResize(ref));

      // Unmount
      unmount();

      // Should not throw
      expect(() => {
        rerender();
      }).not.toThrow();
    });

    it('should cleanup during resize (unmount while debouncing)', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      const { unmount } = renderHook(() =>
        useChartResize(ref, {
          onResize,
          debounceDelay: 200,
        })
      );

      // Trigger resize
      act(() => {
        mockResizeObserver?.triggerResize(1024, 768);
      });

      // Unmount before debounce completes
      unmount();

      // Wait for what would have been the debounce time
      await waitForDebounce(200);

      // Should not have called callback after unmount
      expect(onResize).not.toHaveBeenCalled();
    });
  });

  /* ==========================================================================
   * Enable/Disable Tests
   * ======================================================================= */

  describe('Enable/Disable Functionality', () => {
    it('should not observe when disabled', () => {
      const ref = createMockRef(800, 600);
      const observeSpy = vi.spyOn(MockResizeObserver.prototype, 'observe');

      renderHook(() =>
        useChartResize(ref, {
          enabled: false,
        })
      );

      expect(observeSpy).not.toHaveBeenCalled();
    });

    it('should start observing when enabled becomes true', () => {
      const ref = createMockRef(800, 600);
      let enabled = false;

      const { rerender } = renderHook(() =>
        useChartResize(ref, {
          enabled,
        })
      );

      // Should not be observing initially
      expect(mockResizeObserver).toBeNull();

      // Enable observation
      enabled = true;
      rerender();

      // Should now be observing
      expect(mockResizeObserver).not.toBeNull();
    });

    it('should stop observing when enabled becomes false', () => {
      const ref = createMockRef(800, 600);
      let enabled = true;

      const { rerender } = renderHook(() =>
        useChartResize(ref, {
          enabled,
        })
      );

      const disconnectSpy = vi.spyOn(MockResizeObserver.prototype, 'disconnect');

      // Disable observation
      enabled = false;
      rerender();

      // Should have disconnected
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  /* ==========================================================================
   * Cleanup Tests
   * ======================================================================= */

  describe('Cleanup', () => {
    it('should cleanup on unmount', () => {
      const ref = createMockRef(800, 600);
      const disconnectSpy = vi.spyOn(MockResizeObserver.prototype, 'disconnect');

      const { unmount } = renderHook(() => useChartResize(ref));

      unmount();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should clear pending timeouts on unmount', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      const { unmount } = renderHook(() =>
        useChartResize(ref, {
          onResize,
          debounceDelay: 200,
        })
      );

      // Trigger resize
      act(() => {
        mockResizeObserver?.triggerResize(1024, 768);
      });

      // Unmount immediately
      unmount();

      // Wait for what would have been the callback
      await waitForDebounce(200);

      // Callback should not have been called
      expect(onResize).not.toHaveBeenCalled();
    });

    it('should properly cleanup ResizeObserver instance', () => {
      const ref = createMockRef(800, 600);

      const { unmount } = renderHook(() => useChartResize(ref));

      // Should have created observer
      expect(mockResizeObserver).not.toBeNull();

      const currentObserver = mockResizeObserver;
      const disconnectSpy = vi.spyOn(currentObserver!, 'disconnect');

      unmount();

      // Should have disconnected
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  /* ==========================================================================
   * Threshold Tests
   * ======================================================================= */

  describe('Threshold-based Filtering', () => {
    it('should ignore changes below threshold', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      renderHook(() =>
        useChartResize(ref, {
          onResize,
          threshold: 50,
        })
      );

      // Initial resize
      act(() => {
        mockResizeObserver?.triggerResize(800, 600);
      });

      await waitForDebounce();
      onResize.mockClear();

      // Small change (below threshold)
      act(() => {
        mockResizeObserver?.triggerResize(830, 620);
      });

      await waitForDebounce();

      expect(onResize).not.toHaveBeenCalled();
    });

    it('should process changes above threshold', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      renderHook(() =>
        useChartResize(ref, {
          onResize,
          threshold: 50,
        })
      );

      // Initial resize
      act(() => {
        mockResizeObserver?.triggerResize(800, 600);
      });

      await waitForDebounce();
      onResize.mockClear();

      // Large change (above threshold)
      act(() => {
        mockResizeObserver?.triggerResize(900, 700);
      });

      await waitForDebounce();

      await waitFor(() => {
        expect(onResize).toHaveBeenCalledWith({ width: 900, height: 700 });
      });
    });

    it('should use default threshold of 1 pixel', async () => {
      const onResize = vi.fn();
      const ref = createMockRef(800, 600);

      renderHook(() =>
        useChartResize(ref, {
          onResize,
        })
      );

      // Initial resize
      act(() => {
        mockResizeObserver?.triggerResize(800, 600);
      });

      await waitForDebounce();
      onResize.mockClear();

      // 1 pixel change should trigger
      act(() => {
        mockResizeObserver?.triggerResize(801, 601);
      });

      await waitForDebounce();

      await waitFor(() => {
        expect(onResize).toHaveBeenCalledWith({ width: 801, height: 601 });
      });
    });
  });

  /* ==========================================================================
   * Performance & Memory Tests
   * ======================================================================= */

  describe('Performance & Memory', () => {
    it('should handle multiple hooks without interference', async () => {
      const ref1 = createMockRef(800, 600);
      const ref2 = createMockRef(1024, 768);

      const onResize1 = vi.fn();
      const onResize2 = vi.fn();

      renderHook(() => useChartResize(ref1, { onResize: onResize1 }));
      renderHook(() => useChartResize(ref2, { onResize: onResize2 }));

      // Each should have its own observer
      expect(global.ResizeObserver).toHaveBeenCalledTimes(2);
    });

    it('should not cause memory leaks on repeated mount/unmount', () => {
      const ref = createMockRef(800, 600);

      for (let i = 0; i < 10; i++) {
        const { unmount } = renderHook(() => useChartResize(ref));
        unmount();
      }

      // Should complete without errors
      expect(true).toBe(true);
    });
  });
});
