/**
 * React hook for semantic search functionality
 * Provides loading states, error handling, and progressive enhancement
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Point } from '../../Building-Vitals/src/types/api';
import {
  semanticSearchService,
  SearchResult,
  SearchOptions
} from '../services/semanticSearch/semanticSearchService';

export interface SemanticSearchState {
  isModelLoading: boolean;
  isModelReady: boolean;
  isGeneratingEmbeddings: boolean;
  embeddingsProgress: number;
  error: Error | null;
  searchResults: SearchResult[];
  isSearching: boolean;
  memoryStats: { numTensors: number; numBytes: number } | null;
}

export interface UseSemanticSearchOptions {
  autoInitialize?: boolean;
  generateOnMount?: boolean;
  searchOptions?: SearchOptions;
  onProgress?: (progress: number) => void;
}

export function useSemanticSearch(
  points: Point[],
  options: UseSemanticSearchOptions = {}
) {
  const {
    autoInitialize = true,
    generateOnMount = true,
    searchOptions = {},
    onProgress
  } = options;

  const [state, setState] = useState<SemanticSearchState>({
    isModelLoading: false,
    isModelReady: false,
    isGeneratingEmbeddings: false,
    embeddingsProgress: 0,
    error: null,
    searchResults: [],
    isSearching: false,
    memoryStats: null
  });

  const initializationRef = useRef(false);
  const embeddingsGeneratedRef = useRef(false);
  const searchAbortController = useRef<AbortController | null>(null);

  /**
   * Initialize the semantic search model
   */
  const initializeModel = useCallback(async () => {
    if (initializationRef.current || state.isModelReady) {
      return;
    }

    initializationRef.current = true;
    setState(prev => ({ ...prev, isModelLoading: true, error: null }));

    try {
      await semanticSearchService.initialize();
      setState(prev => ({
        ...prev,
        isModelLoading: false,
        isModelReady: true,
        memoryStats: semanticSearchService.getMemoryStats()
      }));
    } catch (error) {
      console.error('Failed to initialize semantic search:', error);
      setState(prev => ({
        ...prev,
        isModelLoading: false,
        isModelReady: false,
        error: error as Error
      }));
      initializationRef.current = false;
    }
  }, [state.isModelReady]);

  /**
   * Generate embeddings for all points
   */
  const generateEmbeddings = useCallback(async () => {
    if (!state.isModelReady || embeddingsGeneratedRef.current || points.length === 0) {
      return;
    }

    embeddingsGeneratedRef.current = true;
    setState(prev => ({
      ...prev,
      isGeneratingEmbeddings: true,
      embeddingsProgress: 0,
      error: null
    }));

    try {
      // Create progress tracking
      let lastProgress = 0;
      const progressInterval = setInterval(() => {
        const progress = Math.min(lastProgress + 0.1, 0.9);
        lastProgress = progress;
        setState(prev => ({ ...prev, embeddingsProgress: progress }));
        if (onProgress) {
          onProgress(progress);
        }
      }, 500);

      await semanticSearchService.generateEmbeddings(points);

      clearInterval(progressInterval);
      setState(prev => ({
        ...prev,
        isGeneratingEmbeddings: false,
        embeddingsProgress: 1,
        memoryStats: semanticSearchService.getMemoryStats()
      }));

      if (onProgress) {
        onProgress(1);
      }
    } catch (error) {
      console.error('Failed to generate embeddings:', error);
      setState(prev => ({
        ...prev,
        isGeneratingEmbeddings: false,
        embeddingsProgress: 0,
        error: error as Error
      }));
      embeddingsGeneratedRef.current = false;
    }
  }, [state.isModelReady, points, onProgress]);

  /**
   * Perform semantic search
   */
  const search = useCallback(async (
    query: string,
    customOptions?: SearchOptions
  ): Promise<SearchResult[]> => {
    // Abort any pending search
    if (searchAbortController.current) {
      searchAbortController.current.abort();
    }

    searchAbortController.current = new AbortController();

    setState(prev => ({ ...prev, isSearching: true, error: null }));

    try {
      const startTime = performance.now();

      const results = await semanticSearchService.search(
        query,
        points,
        { ...searchOptions, ...customOptions }
      );

      const searchTime = performance.now() - startTime;
      console.log(`Search completed in ${searchTime.toFixed(2)}ms for query: "${query}"`);

      // Check if search was aborted
      if (!searchAbortController.current?.signal.aborted) {
        setState(prev => ({
          ...prev,
          isSearching: false,
          searchResults: results,
          memoryStats: semanticSearchService.getMemoryStats()
        }));
      }

      return results;
    } catch (error) {
      if (!searchAbortController.current?.signal.aborted) {
        console.error('Search failed:', error);
        setState(prev => ({
          ...prev,
          isSearching: false,
          error: error as Error
        }));
      }
      return [];
    }
  }, [points, searchOptions]);

  /**
   * Clear search results
   */
  const clearResults = useCallback(() => {
    setState(prev => ({ ...prev, searchResults: [] }));
  }, []);

  /**
   * Clear cache and memory
   */
  const clearCache = useCallback(async () => {
    try {
      await semanticSearchService.clearCache();
      embeddingsGeneratedRef.current = false;
      setState(prev => ({
        ...prev,
        embeddingsProgress: 0,
        memoryStats: semanticSearchService.getMemoryStats()
      }));
    } catch (error) {
      console.error('Failed to clear cache:', error);
      setState(prev => ({ ...prev, error: error as Error }));
    }
  }, []);

  /**
   * Retry initialization and embedding generation
   */
  const retry = useCallback(async () => {
    initializationRef.current = false;
    embeddingsGeneratedRef.current = false;
    setState(prev => ({
      ...prev,
      error: null,
      isModelReady: false,
      embeddingsProgress: 0
    }));

    await initializeModel();
    if (semanticSearchService.isReady()) {
      await generateEmbeddings();
    }
  }, [initializeModel, generateEmbeddings]);

  /**
   * Format memory stats for display
   */
  const getFormattedMemoryStats = useCallback(() => {
    if (!state.memoryStats) return null;

    const formatBytes = (bytes: number): string => {
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    };

    return {
      tensors: state.memoryStats.numTensors,
      memory: formatBytes(state.memoryStats.numBytes)
    };
  }, [state.memoryStats]);

  // Auto-initialize on mount if enabled
  useEffect(() => {
    if (autoInitialize && !initializationRef.current) {
      initializeModel();
    }
  }, [autoInitialize, initializeModel]);

  // Generate embeddings when model is ready and points are available
  useEffect(() => {
    if (generateOnMount && state.isModelReady && !embeddingsGeneratedRef.current && points.length > 0) {
      generateEmbeddings();
    }
  }, [generateOnMount, state.isModelReady, points, generateEmbeddings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchAbortController.current) {
        searchAbortController.current.abort();
      }
    };
  }, []);

  return {
    // State
    ...state,
    formattedMemoryStats: getFormattedMemoryStats(),

    // Actions
    initializeModel,
    generateEmbeddings,
    search,
    clearResults,
    clearCache,
    retry,

    // Utility flags
    isReady: state.isModelReady && !state.isGeneratingEmbeddings,
    hasEmbeddings: state.embeddingsProgress === 1,
    canSearch: state.isModelReady && state.embeddingsProgress > 0
  };
}

/**
 * Hook for simple semantic search without detailed state management
 */
export function useSimpleSemanticSearch(points: Point[]) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  const {
    isReady,
    search,
    isSearching,
    error
  } = useSemanticSearch(points, {
    autoInitialize: true,
    generateOnMount: true
  });

  const performSearch = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);
    if (searchQuery.trim() && isReady) {
      const searchResults = await search(searchQuery);
      setResults(searchResults);
    } else {
      setResults([]);
    }
  }, [isReady, search]);

  return {
    query,
    setQuery: performSearch,
    results,
    isSearching,
    error,
    isReady
  };
}