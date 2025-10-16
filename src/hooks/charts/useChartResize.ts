/**
 * useChartResize Hook
 *
 * Centralized resize handling hook for all Building Vitals charts.
 * Provides efficient ResizeObserver-based resize detection with debouncing,
 * cleanup management, and flexible configuration options.
 *
 * @module hooks/charts/useChartResize
 * @version 1.0.0
 * @author Building Vitals Team
 * @date 2025-10-13
 *
 * @example Basic Usage
 * ```typescript
 * const chartRef = useRef<HTMLDivElement>(null);
 * const { dimensions, isResizing } = useChartResize(chartRef);
 *
 * // Use dimensions in your chart
 * console.log(`Chart size: ${dimensions.width}x${dimensions.height}`);
 * ```
 *
 * @example With Callback
 * ```typescript
 * const chartRef = useRef<HTMLDivElement>(null);
 * const { dimensions } = useChartResize(chartRef, {
 *   onResize: (dims) => {
 *     console.log('Chart resized:', dims);
 *     echartsInstance.resize();
 *   },
 *   debounceDelay: 150
 * });
 * ```
 *
 * @example Conditional Enable/Disable
 * ```typescript
 * const chartRef = useRef<HTMLDivElement>(null);
 * const { dimensions } = useChartResize(chartRef, {
 *   enabled: isChartVisible,
 *   debounceDelay: 200
 * });
 * ```
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';

/* ============================================================================
 * TYPES & INTERFACES
 * ========================================================================= */

/**
 * Represents the dimensions of a container element
 */
export interface Dimensions {
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
}

/**
 * Configuration options for useChartResize hook
 */
export interface UseChartResizeOptions {
  /**
   * Debounce delay in milliseconds for resize events
   * @default 100
   */
  debounceDelay?: number;

  /**
   * Callback function triggered when resize occurs
   * Called after debounce delay with new dimensions
   */
  onResize?: (dimensions: Dimensions) => void;

  /**
   * Enable or disable resize observation
   * Useful for conditional chart rendering
   * @default true
   */
  enabled?: boolean;

  /**
   * Minimum dimension change (in pixels) to trigger resize
   * Prevents excessive callbacks for tiny dimension changes
   * @default 1
   */
  threshold?: number;
}

/**
 * Return value from useChartResize hook
 */
export interface UseChartResizeReturn {
  /** Current dimensions of the observed element */
  dimensions: Dimensions;

  /** Indicates if a resize is currently being debounced */
  isResizing: boolean;
}

/* ============================================================================
 * CONSTANTS
 * ========================================================================= */

/**
 * Default configuration values
 */
const DEFAULT_OPTIONS: Required<Omit<UseChartResizeOptions, 'onResize'>> = {
  debounceDelay: 100,
  enabled: true,
  threshold: 1,
};

/**
 * Initial dimensions before measurement
 */
const INITIAL_DIMENSIONS: Dimensions = {
  width: 0,
  height: 0,
};

/* ============================================================================
 * HOOK IMPLEMENTATION
 * ========================================================================= */

/**
 * Custom hook for efficient chart resize handling using ResizeObserver API.
 *
 * Features:
 * - Uses modern ResizeObserver API for efficient resize detection
 * - Configurable debouncing to prevent excessive updates
 * - Proper cleanup on unmount
 * - Null-safe ref handling
 * - TypeScript strict mode compliant
 * - Memoized callbacks for performance
 * - Threshold-based triggering to ignore tiny changes
 *
 * Performance Considerations:
 * - ResizeObserver is more efficient than window resize listeners
 * - Debouncing reduces unnecessary chart redraws
 * - Threshold prevents micro-adjustments from triggering updates
 * - Automatic cleanup prevents memory leaks
 *
 * @param ref - React ref attached to the element to observe
 * @param options - Configuration options for resize behavior
 * @returns Object containing current dimensions and resizing state
 *
 * @throws Does not throw - handles all errors gracefully with console warnings
 */
export function useChartResize(
  ref: React.RefObject<HTMLElement>,
  options: UseChartResizeOptions = {}
): UseChartResizeReturn {
  // ===== Merge options with defaults =====
  const {
    debounceDelay = DEFAULT_OPTIONS.debounceDelay,
    onResize,
    enabled = DEFAULT_OPTIONS.enabled,
    threshold = DEFAULT_OPTIONS.threshold,
  } = options;

  // ===== State Management =====
  const [dimensions, setDimensions] = useState<Dimensions>(INITIAL_DIMENSIONS);
  const [isResizing, setIsResizing] = useState(false);

  // ===== Refs for tracking =====
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastDimensionsRef = useRef<Dimensions>(INITIAL_DIMENSIONS);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // ===== Memoized callback to prevent unnecessary effect re-runs =====
  const onResizeCallback = useCallback(
    (dims: Dimensions) => {
      if (onResize) {
        onResize(dims);
      }
    },
    [onResize]
  );

  // ===== Check if dimensions changed beyond threshold =====
  const hasSignificantChange = useCallback(
    (newDims: Dimensions, oldDims: Dimensions): boolean => {
      return (
        Math.abs(newDims.width - oldDims.width) >= threshold ||
        Math.abs(newDims.height - oldDims.height) >= threshold
      );
    },
    [threshold]
  );

  // ===== Debounced resize handler =====
  const handleResize = useCallback(
    (entries: ResizeObserverEntry[]) => {
      // Extract dimensions from ResizeObserver entry
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;

      // Validate dimensions (must be positive)
      if (width <= 0 || height <= 0) return;

      const newDimensions: Dimensions = { width, height };

      // Check if change is significant enough to process
      if (!hasSignificantChange(newDimensions, lastDimensionsRef.current)) {
        return;
      }

      // Update last dimensions
      lastDimensionsRef.current = newDimensions;

      // Set resizing state
      setIsResizing(true);

      // Clear any pending timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      // Debounce the actual resize callback
      resizeTimeoutRef.current = setTimeout(() => {
        try {
          // Update state with new dimensions
          setDimensions(newDimensions);

          // Trigger callback if provided
          onResizeCallback(newDimensions);

          // Clear resizing state
          setIsResizing(false);
        } catch (error) {
          console.warn('[useChartResize] Error in resize handler:', error);
          setIsResizing(false);
        } finally {
          resizeTimeoutRef.current = null;
        }
      }, debounceDelay);
    },
    [debounceDelay, onResizeCallback, hasSignificantChange]
  );

  // ===== Main effect: Set up ResizeObserver =====
  useEffect(() => {
    // Skip if disabled or ref not available
    if (!enabled || !ref.current) {
      return;
    }

    const element = ref.current;

    // Create ResizeObserver instance
    try {
      resizeObserverRef.current = new ResizeObserver(handleResize);
      resizeObserverRef.current.observe(element);

      // Get initial dimensions immediately
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const initialDims: Dimensions = {
          width: rect.width,
          height: rect.height,
        };
        setDimensions(initialDims);
        lastDimensionsRef.current = initialDims;
      }
    } catch (error) {
      console.warn('[useChartResize] Failed to create ResizeObserver:', error);
    }

    // ===== Cleanup function =====
    return () => {
      // Clear any pending timeout
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
        resizeTimeoutRef.current = null;
      }

      // Disconnect ResizeObserver
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }

      // Reset resizing state
      setIsResizing(false);
    };
  }, [enabled, ref, handleResize]);

  // ===== Return memoized result =====
  return useMemo(
    () => ({
      dimensions,
      isResizing,
    }),
    [dimensions, isResizing]
  );
}

/* ============================================================================
 * EXPORTS
 * ========================================================================= */

export default useChartResize;
