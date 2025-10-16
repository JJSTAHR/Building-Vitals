/// <reference types="vite/client" />

/**
 * Type definitions for Vite environment variables
 */
interface ImportMetaEnv {
  // Default token configuration
  readonly VITE_DEFAULT_TOKEN_FALLS_CITY?: string;
  readonly VITE_DEFAULT_TOKEN_SITE_2?: string;
  readonly VITE_DEFAULT_SITE_ID?: string;

  // Add other environment variables here as needed
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
