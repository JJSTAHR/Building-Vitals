/**
 * TokenInterceptor - Automatic token injection for Axios requests
 *
 * Features:
 * - Automatic token injection into X-ACE-Token header
 * - Site ID extraction from multiple sources (URL, params, body, store, config)
 * - 401/403 response handling with token refresh
 * - Request queueing during token refresh
 * - Retry logic after successful token update
 * - Event emission for token errors
 * - Request ID tracking for debugging
 *
 * Site ID Extraction Priority:
 * 1. URL path: /api/sites/{siteId}/...
 * 2. Query params: ?siteId=xxx or ?site_id=xxx
 * 3. Request body: { siteId: 'xxx' }
 * 4. Redux store: current selected site
 * 5. Config: manually specified in config.siteId
 * 6. Default: DEFAULT_SITE_ID
 */

import type { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { getTokenResolver } from './tokenResolver';
import { RequestQueue } from './requestQueue';
import { DEFAULT_SITE_ID } from '../config/defaultTokens';

export interface TokenRefreshEvent {
  siteId: string;
  timestamp: number;
  reason: 'unauthorized' | 'forbidden' | 'expired';
}

export interface TokenErrorEvent {
  siteId: string;
  error: Error;
  timestamp: number;
  requestUrl?: string;
}

/**
 * TokenInterceptor class for managing automatic token injection
 */
export class TokenInterceptor {
  private tokenResolver = getTokenResolver();
  private requestQueue: RequestQueue;
  private isRefreshing = false;
  private refreshPromise: Promise<void> | null = null;
  private requestIdCounter = 0;

  constructor(private axiosInstance: AxiosInstance) {
    this.requestQueue = new RequestQueue(axiosInstance);
    this.setupInterceptors();
  }

  /**
   * Setup request and response interceptors
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      async (config) => await this.onRequest(config),
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => await this.onResponseError(error)
    );

    console.log('[TokenInterceptor] Interceptors initialized');
  }

  /**
   * Request interceptor handler - injects token into headers
   * @param config - Axios request configuration
   * @returns Modified request configuration
   */
  private async onRequest(
    config: InternalAxiosRequestConfig
  ): Promise<InternalAxiosRequestConfig> {
    // Generate request ID for tracking
    const requestId = this.generateRequestId();
    (config as any).requestId = requestId;

    // Extract siteId from request
    const siteId = this.extractSiteId(config);

    // Resolve token for this site
    const token = await this.tokenResolver.resolveToken(siteId);

    if (token) {
      // Inject token into header
      config.headers['X-ACE-Token'] = token;
      console.debug(
        `[TokenInterceptor] Token injected for ${siteId} (request: ${requestId}, url: ${config.url})`
      );
    } else {
      console.warn(
        `[TokenInterceptor] No token available for ${siteId}, request may fail (request: ${requestId})`
      );

      // Emit event for missing token
      this.emitTokenError({
        siteId,
        error: new Error(`No token available for site: ${siteId}`),
        timestamp: Date.now(),
        requestUrl: config.url,
      });
    }

    // Add metadata to config for debugging
    (config as any).tokenMetadata = {
      siteId,
      hasToken: !!token,
      requestId,
      timestamp: Date.now(),
    };

    return config;
  }

  /**
   * Response error interceptor - handles 401/403 with token refresh
   * @param error - Axios error
   * @returns Retried request or rejected promise
   */
  private async onResponseError(error: AxiosError): Promise<any> {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Check if error is 401/403 (unauthorized/forbidden)
    if (!originalRequest || (error.response?.status !== 401 && error.response?.status !== 403)) {
      return Promise.reject(error);
    }

    // Prevent infinite retry loops
    if (originalRequest._retry) {
      console.error('[TokenInterceptor] Token refresh already attempted, failing request');
      return Promise.reject(error);
    }

    const requestId = (originalRequest as any).requestId;
    const siteId = this.extractSiteId(originalRequest);

    console.warn(
      `[TokenInterceptor] ${error.response?.status} error for ${siteId} (request: ${requestId}), attempting token refresh`
    );

    // If refresh is already in progress, queue this request
    if (this.isRefreshing && this.refreshPromise) {
      console.debug(`[TokenInterceptor] Token refresh in progress, queueing request ${requestId}`);
      return this.requestQueue.enqueue(originalRequest);
    }

    // Mark request as retry attempt
    originalRequest._retry = true;

    // Start token refresh
    this.isRefreshing = true;
    this.refreshPromise = this.refreshToken(siteId);

    try {
      // Wait for token refresh to complete
      await this.refreshPromise;

      // Retry all queued requests
      await this.requestQueue.retryAll();

      // Retry original request
      console.debug(`[TokenInterceptor] Retrying request ${requestId} with new token`);
      return this.axiosInstance(originalRequest);
    } catch (refreshError) {
      // Token refresh failed
      console.error('[TokenInterceptor] Token refresh failed:', refreshError);

      // Fail all queued requests
      this.requestQueue.failAll(
        refreshError instanceof Error ? refreshError : new Error('Token refresh failed')
      );

      // Emit token error event
      this.emitTokenError({
        siteId,
        error: refreshError instanceof Error ? refreshError : new Error('Token refresh failed'),
        timestamp: Date.now(),
        requestUrl: originalRequest.url,
      });

      return Promise.reject(refreshError);
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Extract site ID from request configuration
   * Priority: URL path > query params > request body > store > config > default
   * @param config - Axios request configuration
   * @returns Site identifier
   */
  private extractSiteId(config: InternalAxiosRequestConfig): string {
    // 1. Extract from URL path: /api/sites/{siteId}/...
    const match = config.url?.match(/\/sites\/([^\/\?]+)/);
    if (match && match[1]) {
      return match[1];
    }

    // 2. Extract from query params: ?siteId=xxx or ?site_id=xxx
    const urlObj = config.url ? new URL(config.url, 'http://dummy.com') : null;
    if (urlObj) {
      const siteIdParam =
        urlObj.searchParams.get('siteId') || urlObj.searchParams.get('site_id');
      if (siteIdParam) {
        return siteIdParam;
      }
    }

    // 3. Extract from request body: { siteId: 'xxx' }
    if (config.data && typeof config.data === 'object' && 'siteId' in config.data) {
      return (config.data as any).siteId;
    }

    // 4. Extract from Redux store: current selected site
    const storeSiteId = this.getCurrentSiteFromStore();
    if (storeSiteId) {
      return storeSiteId;
    }

    // 5. Extract from config: manually specified
    if ((config as any).siteId) {
      return (config as any).siteId;
    }

    // 6. Default site
    return DEFAULT_SITE_ID;
  }

  /**
   * Get current site ID from Redux store
   * @returns Current site ID or null
   */
  private getCurrentSiteFromStore(): string | null {
    try {
      // Note: This would require importing the store
      // For now, try to access it from window if available
      const globalWindow = window as any;
      if (globalWindow.__REDUX_STORE__) {
        const state = globalWindow.__REDUX_STORE__.getState();
        return state.sites?.currentSiteId || null;
      }
    } catch (error) {
      console.debug('[TokenInterceptor] Could not access Redux store:', error);
    }
    return null;
  }

  /**
   * Refresh token for a site
   * @param siteId - Site identifier
   * @returns Promise that resolves when refresh complete
   */
  private async refreshToken(siteId: string): Promise<void> {
    console.log(`[TokenInterceptor] Starting token refresh for ${siteId}`);

    // Invalidate cache to force fresh token lookup
    this.tokenResolver.invalidateCache(siteId);

    // Emit token refresh needed event
    window.dispatchEvent(
      new CustomEvent<TokenRefreshEvent>('token:refresh-needed', {
        detail: {
          siteId,
          timestamp: Date.now(),
          reason: 'unauthorized',
        },
      })
    );

    // Wait for token refresh (user action or automatic refresh)
    return this.waitForTokenRefresh(siteId, 30000); // 30 second timeout
  }

  /**
   * Wait for token refresh to complete
   * @param siteId - Site identifier
   * @param timeout - Timeout in milliseconds
   * @returns Promise that resolves when token refreshed
   */
  private waitForTokenRefresh(siteId: string, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        cleanup();
        reject(new Error(`Token refresh timeout for ${siteId} after ${timeout}ms`));
      }, timeout);

      const handler = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail?.siteId === siteId) {
          cleanup();
          resolve();
        }
      };

      const cleanup = () => {
        clearTimeout(timeoutId);
        window.removeEventListener('token:refreshed', handler);
      };

      window.addEventListener('token:refreshed', handler);
    });
  }

  /**
   * Emit token error event
   * @param event - Token error event data
   */
  private emitTokenError(event: TokenErrorEvent): void {
    window.dispatchEvent(
      new CustomEvent<TokenErrorEvent>('token:error', {
        detail: event,
      })
    );
  }

  /**
   * Generate unique request ID
   * @returns Request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${++this.requestIdCounter}`;
  }

  /**
   * Get interceptor statistics
   * @returns Statistics object
   */
  public getStats(): {
    isRefreshing: boolean;
    queueSize: number;
    queueStats: ReturnType<RequestQueue['getStats']>;
    cacheStats: ReturnType<typeof this.tokenResolver.getCacheStats>;
  } {
    return {
      isRefreshing: this.isRefreshing,
      queueSize: this.requestQueue.size(),
      queueStats: this.requestQueue.getStats(),
      cacheStats: this.tokenResolver.getCacheStats(),
    };
  }
}

// Export singleton instance creator
let interceptorInstance: TokenInterceptor | null = null;

/**
 * Initialize token interceptor for an axios instance
 * @param axiosInstance - Axios instance to add interceptors to
 * @returns TokenInterceptor instance
 */
export function initializeTokenInterceptor(axiosInstance: AxiosInstance): TokenInterceptor {
  if (!interceptorInstance) {
    interceptorInstance = new TokenInterceptor(axiosInstance);
    console.log('[TokenInterceptor] Initialized');
  }
  return interceptorInstance;
}

/**
 * Get existing token interceptor instance
 * @returns TokenInterceptor instance or null
 */
export function getTokenInterceptor(): TokenInterceptor | null {
  return interceptorInstance;
}

export default TokenInterceptor;
