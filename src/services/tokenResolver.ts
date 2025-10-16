/**
 * Token Resolver Service
 *
 * Smart token resolution with 4-level priority fallback chain:
 * 1. Site-specific token (user-configured)
 * 2. Default token (environment-based)
 * 3. Global token (legacy support)
 * 4. No token (trigger user prompt)
 *
 * Features:
 * - 5-minute TTL caching for performance
 * - Cache hit rate tracking
 * - Event emission for missing tokens
 * - Comprehensive logging
 * - Source tracking for debugging
 *
 * Performance Targets:
 * - Cache hit: < 5ms
 * - Cache miss: < 10ms
 * - Cache hit rate: > 90%
 */

import { EventEmitter } from 'events';
import { getDefaultToken } from '../config/defaultTokens';
import type {
  CachedToken,
  TokenSource,
  TokenResolutionResult,
  TokenResolverConfig,
  CacheStatistics,
  TokenMissingEvent,
  ITokenProvider,
} from '../types/token.types';

/**
 * Default cache TTL: 5 minutes in milliseconds
 */
const DEFAULT_CACHE_TTL = 5 * 60 * 1000;

/**
 * Global token identifier for legacy support
 */
const GLOBAL_TOKEN_KEY = '__global__';

/**
 * TokenResolver class - manages token resolution with caching and fallback chain
 */
export class TokenResolver extends EventEmitter {
  private cache: Map<string, CachedToken> = new Map();
  private readonly cacheTtl: number;
  private readonly debug: boolean;
  private readonly trackMetrics: boolean;
  private readonly logger: (message: string, data?: Record<string, unknown>) => void;

  // Performance metrics
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheEvictions = 0;

  // Token provider (e.g., MultiTokenManager)
  private tokenProvider: ITokenProvider | null = null;

  /**
   * Creates a new TokenResolver instance
   * @param config - Configuration options
   */
  constructor(config: TokenResolverConfig = {}) {
    super();
    this.cacheTtl = config.cacheTtl ?? DEFAULT_CACHE_TTL;
    this.debug = config.debug ?? false;
    this.trackMetrics = config.trackMetrics ?? true;
    this.logger = config.logger ?? this.defaultLogger.bind(this);

    if (this.debug) {
      this.logger('[TokenResolver] Initialized', {
        cacheTtl: this.cacheTtl,
        debug: this.debug,
        trackMetrics: this.trackMetrics,
      });
    }
  }

  /**
   * Set the token provider (e.g., MultiTokenManager instance)
   * @param provider - Token provider implementation
   */
  public setTokenProvider(provider: ITokenProvider): void {
    this.tokenProvider = provider;
    if (this.debug) {
      this.logger('[TokenResolver] Token provider set', {
        providerType: provider.constructor.name,
      });
    }
  }

  /**
   * Resolve a token for the given site ID using the priority chain
   *
   * Priority chain:
   * 1. Site-specific token (from tokenProvider)
   * 2. Default token (from environment)
   * 3. Global token (legacy, from tokenProvider)
   * 4. null (no token found)
   *
   * @param siteId - Site identifier
   * @returns Promise resolving to token or null
   */
  public async resolveToken(siteId: string): Promise<string | null> {
    const startTime = performance.now();

    // Check cache first
    const cached = this.getCached(siteId);
    if (cached) {
      const elapsedMs = performance.now() - startTime;
      if (this.debug) {
        this.logger('[TokenResolver] Cache hit', {
          siteId,
          source: cached.source,
          elapsedMs: elapsedMs.toFixed(2),
        });
      }
      return cached.token;
    }

    // Cache miss - resolve from chain
    if (this.trackMetrics) {
      this.cacheMisses++;
    }

    const token = await this.resolveFromChain(siteId);
    const elapsedMs = performance.now() - startTime;

    // Cache the result if we found a token
    if (token) {
      const source = await this.determineSource(siteId, token);
      this.cacheToken(siteId, token, source);

      if (this.debug) {
        this.logger('[TokenResolver] Token resolved', {
          siteId,
          source,
          cached: false,
          elapsedMs: elapsedMs.toFixed(2),
        });
      }
    } else {
      // No token found - emit event
      this.emitTokenMissing(siteId);

      if (this.debug) {
        this.logger('[TokenResolver] No token found', {
          siteId,
          elapsedMs: elapsedMs.toFixed(2),
        });
      }
    }

    return token;
  }

  /**
   * Resolve token with detailed result information
   * @param siteId - Site identifier
   * @returns Promise resolving to detailed resolution result
   */
  public async resolveTokenWithDetails(siteId: string): Promise<TokenResolutionResult> {
    const startTime = performance.now();

    // Check cache
    const cached = this.getCached(siteId);
    if (cached) {
      const elapsedMs = performance.now() - startTime;
      return {
        token: cached.token,
        source: cached.source,
        fromCache: true,
        resolutionTimeMs: elapsedMs,
      };
    }

    // Resolve from chain
    const token = await this.resolveFromChain(siteId);
    const elapsedMs = performance.now() - startTime;
    const source = token ? await this.determineSource(siteId, token) : 'none' as TokenSource;

    if (token) {
      this.cacheToken(siteId, token, source);
    } else {
      this.emitTokenMissing(siteId);
    }

    return {
      token,
      source,
      fromCache: false,
      resolutionTimeMs: elapsedMs,
    };
  }

  /**
   * Get the resolution source for a cached token
   * @param siteId - Site identifier
   * @returns Token source or null if not cached
   */
  public getResolutionSource(siteId: string): TokenSource | null {
    const cached = this.cache.get(siteId);
    if (!cached) {
      return null;
    }

    // Check if still valid
    if (Date.now() - cached.timestamp > this.cacheTtl) {
      this.cache.delete(siteId);
      if (this.trackMetrics) {
        this.cacheEvictions++;
      }
      return null;
    }

    return cached.source;
  }

  /**
   * Invalidate cache for specific site or all sites
   * @param siteId - Optional site identifier (omit to clear all)
   */
  public invalidateCache(siteId?: string): void {
    if (siteId) {
      const deleted = this.cache.delete(siteId);
      if (deleted && this.trackMetrics) {
        this.cacheEvictions++;
      }
      if (this.debug) {
        this.logger('[TokenResolver] Cache invalidated', { siteId });
      }
    } else {
      const size = this.cache.size;
      this.cache.clear();
      if (this.trackMetrics) {
        this.cacheEvictions += size;
      }
      if (this.debug) {
        this.logger('[TokenResolver] All cache cleared', { entriesCleared: size });
      }
    }
  }

  /**
   * Warm the cache by preloading tokens for multiple sites
   * @param siteIds - Array of site identifiers to preload
   * @returns Promise resolving when all tokens are loaded
   */
  public async warmCache(siteIds: string[]): Promise<void> {
    if (this.debug) {
      this.logger('[TokenResolver] Warming cache', { siteCount: siteIds.length });
    }

    const startTime = performance.now();

    // Resolve tokens in parallel
    const promises = siteIds.map(siteId => this.resolveToken(siteId));
    await Promise.all(promises);

    const elapsedMs = performance.now() - startTime;

    if (this.debug) {
      this.logger('[TokenResolver] Cache warmed', {
        siteCount: siteIds.length,
        cacheSize: this.cache.size,
        elapsedMs: elapsedMs.toFixed(2),
      });
    }
  }

  /**
   * Get cache statistics
   * @returns Cache statistics object
   */
  public getCacheStatistics(): CacheStatistics {
    const hits = this.cacheHits;
    const misses = this.cacheMisses;
    const total = hits + misses;
    const hitRate = total > 0 ? hits / total : 0;

    return {
      hits,
      misses,
      hitRate,
      size: this.cache.size,
      evictions: this.cacheEvictions,
    };
  }

  /**
   * Reset cache statistics
   */
  public resetStatistics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheEvictions = 0;

    if (this.debug) {
      this.logger('[TokenResolver] Statistics reset');
    }
  }

  /**
   * Resolve token through the 4-level priority chain
   * @param siteId - Site identifier
   * @returns Promise resolving to token or null
   */
  private async resolveFromChain(siteId: string): Promise<string | null> {
    // Level 1: Site-specific token
    if (this.tokenProvider) {
      try {
        const token = await this.tokenProvider.getToken(siteId);
        if (token) {
          if (this.debug) {
            this.logger('[TokenResolver] Resolved from site-specific', { siteId });
          }
          return token;
        }
      } catch (error) {
        console.error('[TokenResolver] Error fetching site-specific token:', error);
      }
    }

    // Level 2: Default token
    const defaultToken = getDefaultToken(siteId);
    if (defaultToken) {
      if (this.debug) {
        this.logger('[TokenResolver] Resolved from default', { siteId });
      }
      return defaultToken;
    }

    // Level 3: Global token (legacy)
    if (this.tokenProvider) {
      try {
        const globalToken = await this.tokenProvider.getToken(GLOBAL_TOKEN_KEY);
        if (globalToken) {
          if (this.debug) {
            this.logger('[TokenResolver] Resolved from global (legacy)', { siteId });
          }
          return globalToken;
        }
      } catch (error) {
        console.error('[TokenResolver] Error fetching global token:', error);
      }
    }

    // Level 4: No token found
    return null;
  }

  /**
   * Determine the source of a resolved token
   * @param siteId - Site identifier
   * @param token - The resolved token
   * @returns Token source enum
   */
  private async determineSource(siteId: string, token: string): Promise<TokenSource> {
    // Check site-specific
    if (this.tokenProvider) {
      try {
        const siteToken = await this.tokenProvider.getToken(siteId);
        if (siteToken === token) {
          return 'site_specific' as TokenSource;
        }
      } catch {
        // Ignore errors
      }
    }

    // Check default
    const defaultToken = getDefaultToken(siteId);
    if (defaultToken === token) {
      return 'default' as TokenSource;
    }

    // Check global
    if (this.tokenProvider) {
      try {
        const globalToken = await this.tokenProvider.getToken(GLOBAL_TOKEN_KEY);
        if (globalToken === token) {
          return 'global' as TokenSource;
        }
      } catch {
        // Ignore errors
      }
    }

    // Shouldn't reach here, but default to site_specific
    return 'site_specific' as TokenSource;
  }

  /**
   * Get cached token if valid
   * @param siteId - Site identifier
   * @returns Cached token or null
   */
  private getCached(siteId: string): CachedToken | null {
    const cached = this.cache.get(siteId);

    if (!cached) {
      return null;
    }

    // Check TTL
    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTtl) {
      this.cache.delete(siteId);
      if (this.trackMetrics) {
        this.cacheEvictions++;
      }
      return null;
    }

    // Valid cache hit
    if (this.trackMetrics) {
      this.cacheHits++;
    }

    return cached;
  }

  /**
   * Cache a token with source information
   * @param siteId - Site identifier
   * @param token - Token to cache
   * @param source - Token source
   */
  private cacheToken(siteId: string, token: string, source: TokenSource): void {
    this.cache.set(siteId, {
      token,
      timestamp: Date.now(),
      source,
    });
  }

  /**
   * Emit token missing event
   * @param siteId - Site identifier
   */
  private emitTokenMissing(siteId: string): void {
    const event: TokenMissingEvent = {
      siteId,
      timestamp: Date.now(),
      sourcesChecked: ['site_specific', 'default', 'global'] as TokenSource[],
    };

    this.emit('tokenMissing', event);
  }

  /**
   * Default logger implementation
   * @param message - Log message
   * @param data - Optional log data
   */
  private defaultLogger(message: string, data?: Record<string, unknown>): void {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
}

/**
 * Singleton instance for global use
 */
let globalTokenResolver: TokenResolver | null = null;

/**
 * Get or create the global TokenResolver instance
 * @param config - Optional configuration (only used on first call)
 * @returns Global TokenResolver instance
 */
export function getTokenResolver(config?: TokenResolverConfig): TokenResolver {
  if (!globalTokenResolver) {
    globalTokenResolver = new TokenResolver(config);
  }
  return globalTokenResolver;
}

/**
 * Reset the global TokenResolver instance (mainly for testing)
 */
export function resetTokenResolver(): void {
  if (globalTokenResolver) {
    globalTokenResolver.removeAllListeners();
    globalTokenResolver.invalidateCache();
  }
  globalTokenResolver = null;
}
