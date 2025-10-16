/**
 * IndexedDB cache for storing point embeddings
 * Prevents re-computation of embeddings on page reload
 */

const DB_NAME = 'BuildingVitalsEmbeddings';
const DB_VERSION = 1;
const STORE_NAME = 'embeddings';
const METADATA_STORE = 'metadata';

export interface EmbeddingRecord {
  objectId: string;
  embedding: number[];
  timestamp: number;
}

export interface MetadataRecord {
  key: string;
  value: any;
  timestamp: number;
}

export class EmbeddingCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Initialize database on construction
    this.initPromise = this.initialize();
  }

  /**
   * Initialize IndexedDB database
   */
  private async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized for embeddings');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create embeddings store
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'objectId' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          const metaStore = db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
          metaStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
    }
    if (!this.db) {
      throw new Error('IndexedDB not initialized');
    }
  }

  /**
   * Store an embedding in the cache
   */
  async setEmbedding(objectId: string, embedding: number[]): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record: EmbeddingRecord = {
        objectId,
        embedding,
        timestamp: Date.now()
      };

      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to store embedding:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Retrieve an embedding from the cache
   */
  async getEmbedding(objectId: string): Promise<number[] | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(objectId);

      request.onsuccess = () => {
        const record = request.result as EmbeddingRecord | undefined;
        resolve(record ? record.embedding : null);
      };

      request.onerror = () => {
        console.error('Failed to retrieve embedding:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get all embeddings from the cache
   */
  async getEmbeddings(): Promise<Map<string, number[]>> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = request.result as EmbeddingRecord[];
        const embeddings = new Map<string, number[]>();

        for (const record of records) {
          embeddings.set(record.objectId, record.embedding);
        }

        resolve(embeddings);
      };

      request.onerror = () => {
        console.error('Failed to retrieve embeddings:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Store multiple embeddings in batch
   */
  async setEmbeddings(embeddings: Map<string, number[]>): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const timestamp = Date.now();

      let pending = embeddings.size;
      let hasError = false;

      if (pending === 0) {
        resolve();
        return;
      }

      embeddings.forEach((embedding, objectId) => {
        const record: EmbeddingRecord = {
          objectId,
          embedding,
          timestamp
        };

        const request = store.put(record);

        request.onsuccess = () => {
          pending--;
          if (pending === 0 && !hasError) {
            resolve();
          }
        };

        request.onerror = () => {
          hasError = true;
          console.error('Failed to store embedding:', request.error);
          reject(request.error);
        };
      });
    });
  }

  /**
   * Check if an embedding exists in the cache
   */
  async hasEmbedding(objectId: string): Promise<boolean> {
    const embedding = await this.getEmbedding(objectId);
    return embedding !== null;
  }

  /**
   * Delete an embedding from the cache
   */
  async deleteEmbedding(objectId: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(objectId);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to delete embedding:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clear all embeddings from the cache
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('Embeddings cache cleared');
        resolve();
      };

      request.onerror = () => {
        console.error('Failed to clear embeddings:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    count: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  }> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const countRequest = store.count();

      countRequest.onsuccess = () => {
        const count = countRequest.result;

        if (count === 0) {
          resolve({ count: 0, oldestTimestamp: null, newestTimestamp: null });
          return;
        }

        const index = store.index('timestamp');
        const oldestRequest = index.openCursor(null, 'next');
        const newestRequest = index.openCursor(null, 'prev');

        let oldestTimestamp: number | null = null;
        let newestTimestamp: number | null = null;
        let completed = 0;

        const checkComplete = () => {
          completed++;
          if (completed === 2) {
            resolve({ count, oldestTimestamp, newestTimestamp });
          }
        };

        oldestRequest.onsuccess = () => {
          const cursor = oldestRequest.result;
          if (cursor) {
            oldestTimestamp = (cursor.value as EmbeddingRecord).timestamp;
          }
          checkComplete();
        };

        newestRequest.onsuccess = () => {
          const cursor = newestRequest.result;
          if (cursor) {
            newestTimestamp = (cursor.value as EmbeddingRecord).timestamp;
          }
          checkComplete();
        };
      };

      countRequest.onerror = () => {
        console.error('Failed to get cache stats:', countRequest.error);
        reject(countRequest.error);
      };
    });
  }

  /**
   * Store metadata
   */
  async setMetadata(key: string, value: any): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readwrite');
      const store = transaction.objectStore(METADATA_STORE);

      const record: MetadataRecord = {
        key,
        value,
        timestamp: Date.now()
      };

      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('Failed to store metadata:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Retrieve metadata
   */
  async getMetadata(key: string): Promise<any> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([METADATA_STORE], 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(key);

      request.onsuccess = () => {
        const record = request.result as MetadataRecord | undefined;
        resolve(record ? record.value : null);
      };

      request.onerror = () => {
        console.error('Failed to retrieve metadata:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Clean up old embeddings (older than specified days)
   */
  async cleanOldEmbeddings(daysToKeep: number = 7): Promise<number> {
    await this.ensureInitialized();

    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoffTime);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          store.delete(cursor.primaryKey);
          deletedCount++;
          cursor.continue();
        } else {
          console.log(`Cleaned ${deletedCount} old embeddings`);
          resolve(deletedCount);
        }
      };

      request.onerror = () => {
        console.error('Failed to clean old embeddings:', request.error);
        reject(request.error);
      };
    });
  }
}