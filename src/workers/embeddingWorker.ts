/**
 * Web Worker for background embedding computation
 * Prevents UI blocking during TensorFlow operations
 */

// Worker message types
export interface WorkerMessage {
  type: 'INIT' | 'GENERATE_EMBEDDINGS' | 'SEARCH' | 'CLEAR' | 'STATUS';
  data?: any;
}

export interface WorkerResponse {
  type: 'SUCCESS' | 'ERROR' | 'PROGRESS' | 'STATUS';
  data?: any;
  error?: string;
}

// This would be the worker script (embeddingWorker.worker.ts)
const workerScript = `
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';

let model = null;
let embeddings = new Map();

// Handle messages from main thread
self.addEventListener('message', async (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'INIT':
      try {
        await tf.setBackend('webgl');
        await tf.ready();
        model = await use.load();
        self.postMessage({ type: 'SUCCESS', data: 'Model loaded' });
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
      }
      break;

    case 'GENERATE_EMBEDDINGS':
      try {
        if (!model) {
          throw new Error('Model not initialized');
        }

        const { texts, ids } = data;
        const batchSize = 50;

        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize);
          const batchIds = ids.slice(i, i + batchSize);

          const tensors = await model.embed(batch);
          const embeddingArray = await tensors.array();

          for (let j = 0; j < batchIds.length; j++) {
            embeddings.set(batchIds[j], embeddingArray[j]);
          }

          tensors.dispose();

          // Send progress
          const progress = Math.min(i + batchSize, texts.length) / texts.length;
          self.postMessage({
            type: 'PROGRESS',
            data: { progress, processed: Math.min(i + batchSize, texts.length), total: texts.length }
          });
        }

        // Convert embeddings to transferable format
        const embeddingData = {};
        embeddings.forEach((value, key) => {
          embeddingData[key] = value;
        });

        self.postMessage({ type: 'SUCCESS', data: embeddingData });
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
      }
      break;

    case 'SEARCH':
      try {
        if (!model) {
          throw new Error('Model not initialized');
        }

        const { query, pointEmbeddings, keywordWeight = 0.7, semanticWeight = 0.3 } = data;

        // Generate query embedding
        const queryTensor = await model.embed([query]);
        const queryEmbedding = (await queryTensor.array())[0];
        queryTensor.dispose();

        // Calculate similarities
        const results = [];
        for (const [id, embedding] of Object.entries(pointEmbeddings)) {
          const similarity = cosineSimilarity(queryEmbedding, embedding);
          results.push({ id, similarity });
        }

        self.postMessage({ type: 'SUCCESS', data: results });
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
      }
      break;

    case 'CLEAR':
      embeddings.clear();
      tf.disposeVariables();
      self.postMessage({ type: 'SUCCESS', data: 'Cleared' });
      break;

    case 'STATUS':
      const memory = tf.memory();
      self.postMessage({
        type: 'STATUS',
        data: {
          modelLoaded: model !== null,
          embeddingsCount: embeddings.size,
          memory: {
            numTensors: memory.numTensors,
            numBytes: memory.numBytes
          }
        }
      });
      break;

    default:
      self.postMessage({ type: 'ERROR', error: 'Unknown command' });
  }
});

function cosineSimilarity(a, b) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
`;

/**
 * EmbeddingWorker class for managing web worker
 */
export class EmbeddingWorker {
  private worker: Worker | null = null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private progressCallback: ((progress: number, processed: number, total: number) => void) | null = null;

  /**
   * Initialize the worker
   */
  initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create blob URL for worker
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);

        this.worker = new Worker(workerUrl);

        // Set up message handler
        this.worker.onmessage = (event) => {
          const { type, data, error } = event.data as WorkerResponse;

          if (type === 'PROGRESS' && this.progressCallback) {
            this.progressCallback(data.progress, data.processed, data.total);
          }

          const handler = this.messageHandlers.get(type);
          if (handler) {
            handler(error || data);
          }
        };

        this.worker.onerror = (error) => {
          console.error('Worker error:', error);
          reject(error);
        };

        // Initialize model in worker
        this.messageHandlers.set('SUCCESS', () => {
          this.messageHandlers.delete('SUCCESS');
          this.messageHandlers.delete('ERROR');
          resolve();
        });

        this.messageHandlers.set('ERROR', (error) => {
          this.messageHandlers.delete('SUCCESS');
          this.messageHandlers.delete('ERROR');
          reject(new Error(error));
        });

        this.worker.postMessage({ type: 'INIT' });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate embeddings in worker
   */
  generateEmbeddings(
    texts: string[],
    ids: string[],
    onProgress?: (progress: number, processed: number, total: number) => void
  ): Promise<Record<string, number[]>> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.progressCallback = onProgress || null;

      this.messageHandlers.set('SUCCESS', (data) => {
        this.messageHandlers.delete('SUCCESS');
        this.messageHandlers.delete('ERROR');
        this.progressCallback = null;
        resolve(data);
      });

      this.messageHandlers.set('ERROR', (error) => {
        this.messageHandlers.delete('SUCCESS');
        this.messageHandlers.delete('ERROR');
        this.progressCallback = null;
        reject(new Error(error));
      });

      this.worker.postMessage({
        type: 'GENERATE_EMBEDDINGS',
        data: { texts, ids }
      });
    });
  }

  /**
   * Search using embeddings in worker
   */
  search(
    query: string,
    pointEmbeddings: Record<string, number[]>,
    keywordWeight: number = 0.7,
    semanticWeight: number = 0.3
  ): Promise<Array<{ id: string; similarity: number }>> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.messageHandlers.set('SUCCESS', (data) => {
        this.messageHandlers.delete('SUCCESS');
        this.messageHandlers.delete('ERROR');
        resolve(data);
      });

      this.messageHandlers.set('ERROR', (error) => {
        this.messageHandlers.delete('SUCCESS');
        this.messageHandlers.delete('ERROR');
        reject(new Error(error));
      });

      this.worker.postMessage({
        type: 'SEARCH',
        data: { query, pointEmbeddings, keywordWeight, semanticWeight }
      });
    });
  }

  /**
   * Get worker status
   */
  getStatus(): Promise<{
    modelLoaded: boolean;
    embeddingsCount: number;
    memory: { numTensors: number; numBytes: number };
  }> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.messageHandlers.set('STATUS', (data) => {
        this.messageHandlers.delete('STATUS');
        resolve(data);
      });

      this.worker.postMessage({ type: 'STATUS' });
    });
  }

  /**
   * Clear worker memory
   */
  clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      this.messageHandlers.set('SUCCESS', () => {
        this.messageHandlers.delete('SUCCESS');
        this.messageHandlers.delete('ERROR');
        resolve();
      });

      this.messageHandlers.set('ERROR', (error) => {
        this.messageHandlers.delete('SUCCESS');
        this.messageHandlers.delete('ERROR');
        reject(new Error(error));
      });

      this.worker.postMessage({ type: 'CLEAR' });
    });
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.messageHandlers.clear();
      this.progressCallback = null;
    }
  }
}

// Create singleton instance
let workerInstance: EmbeddingWorker | null = null;

export function getEmbeddingWorker(): EmbeddingWorker {
  if (!workerInstance) {
    workerInstance = new EmbeddingWorker();
  }
  return workerInstance;
}

export function terminateEmbeddingWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
  }
}