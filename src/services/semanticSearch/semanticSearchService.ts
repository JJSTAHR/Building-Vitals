/**
 * Semantic Search Service using TensorFlow.js Universal Sentence Encoder
 * Provides intelligent semantic matching for point search
 */

import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import type { Point } from '../../../Building-Vitals/src/types/api';
import { EmbeddingCache } from './embeddingCache';

export interface SearchResult {
  point: Point;
  keywordScore: number;
  semanticScore: number;
  finalScore: number;
}

export interface SearchOptions {
  keywordWeight?: number; // Default: 0.7
  semanticWeight?: number; // Default: 0.3
  threshold?: number; // Minimum score threshold
  maxResults?: number; // Maximum results to return
}

export class SemanticSearchService {
  private static instance: SemanticSearchService;
  private model: use.UniversalSentenceEncoder | null = null;
  private embeddingCache: EmbeddingCache;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;
  private embeddings: Map<string, tf.Tensor> = new Map();

  private constructor() {
    this.embeddingCache = new EmbeddingCache();
  }

  static getInstance(): SemanticSearchService {
    if (!this.instance) {
      this.instance = new SemanticSearchService();
    }
    return this.instance;
  }

  /**
   * Initialize the Universal Sentence Encoder model
   */
  async initialize(): Promise<void> {
    if (this.model) return;
    if (this.isLoading) {
      return this.loadPromise!;
    }

    this.isLoading = true;
    this.loadPromise = this.loadModel();

    try {
      await this.loadPromise;
    } finally {
      this.isLoading = false;
      this.loadPromise = null;
    }
  }

  private async loadModel(): Promise<void> {
    try {
      // Set TensorFlow.js backend
      await tf.setBackend('webgl');
      await tf.ready();

      // Load Universal Sentence Encoder
      console.log('Loading Universal Sentence Encoder model...');
      this.model = await use.load();
      console.log('Universal Sentence Encoder loaded successfully');
    } catch (error) {
      console.error('Failed to load Universal Sentence Encoder:', error);
      this.model = null;
      throw error;
    }
  }

  /**
   * Generate text representation for a point
   */
  private getPointText(point: Point): string {
    const components = [
      point.display_name,
      point.unit || '',
      point.equipment_name || '',
      ...(point.marker_tags || []),
      point.object_type || '',
      point.bacnet_prefix || ''
    ].filter(Boolean);

    return components.join(' ').toLowerCase();
  }

  /**
   * Generate embeddings for all points
   */
  async generateEmbeddings(points: Point[]): Promise<void> {
    if (!this.model) {
      throw new Error('Model not initialized. Call initialize() first.');
    }

    console.log(`Generating embeddings for ${points.length} points...`);
    const startTime = performance.now();

    // Check cache first
    const cachedEmbeddings = await this.embeddingCache.getEmbeddings();
    const needsEmbedding: Point[] = [];

    for (const point of points) {
      const cached = cachedEmbeddings.get(point.object_id);
      if (cached) {
        this.embeddings.set(point.object_id, tf.tensor(cached));
      } else {
        needsEmbedding.push(point);
      }
    }

    if (needsEmbedding.length === 0) {
      console.log('All embeddings loaded from cache');
      return;
    }

    // Process in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < needsEmbedding.length; i += batchSize) {
      const batch = needsEmbedding.slice(i, i + batchSize);
      const texts = batch.map(p => this.getPointText(p));

      // Generate embeddings
      const embeddings = await this.model.embed(texts);
      const embeddingArray = await embeddings.array();

      // Store in memory and cache
      for (let j = 0; j < batch.length; j++) {
        const point = batch[j];
        const embedding = embeddingArray[j];

        this.embeddings.set(point.object_id, tf.tensor(embedding));
        await this.embeddingCache.setEmbedding(point.object_id, embedding);
      }

      // Clean up tensor
      embeddings.dispose();

      // Progress update
      const processed = Math.min(i + batchSize, needsEmbedding.length);
      console.log(`Processed ${processed}/${needsEmbedding.length} embeddings`);
    }

    const endTime = performance.now();
    console.log(`Embeddings generated in ${(endTime - startTime).toFixed(2)}ms`);
  }

  /**
   * Calculate cosine similarity between two tensors
   */
  private cosineSimilarity(a: tf.Tensor, b: tf.Tensor): number {
    const dotProduct = tf.sum(tf.mul(a, b));
    const normA = tf.sqrt(tf.sum(tf.square(a)));
    const normB = tf.sqrt(tf.sum(tf.square(b)));
    const similarity = tf.div(dotProduct, tf.mul(normA, normB));

    const result = similarity.dataSync()[0];

    // Clean up tensors
    dotProduct.dispose();
    normA.dispose();
    normB.dispose();
    similarity.dispose();

    return result;
  }

  /**
   * Calculate keyword match score
   */
  private calculateKeywordScore(query: string, point: Point): number {
    const queryLower = query.toLowerCase();
    const pointText = this.getPointText(point);
    const queryWords = queryLower.split(/\s+/).filter(Boolean);

    if (queryWords.length === 0) return 0;

    let matchScore = 0;

    // Exact match gets highest score
    if (pointText.includes(queryLower)) {
      matchScore = 1.0;
    } else {
      // Partial word matching
      let matchedWords = 0;
      for (const word of queryWords) {
        if (pointText.includes(word)) {
          matchedWords++;
        }
      }
      matchScore = matchedWords / queryWords.length;
    }

    // Boost score for display_name matches
    if (point.display_name.toLowerCase().includes(queryLower)) {
      matchScore = Math.min(1.0, matchScore * 1.5);
    }

    return matchScore;
  }

  /**
   * Perform semantic search on points
   */
  async search(
    query: string,
    points: Point[],
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      keywordWeight = 0.7,
      semanticWeight = 0.3,
      threshold = 0,
      maxResults = 50
    } = options;

    if (!query.trim()) {
      return [];
    }

    const results: SearchResult[] = [];

    // If model is available, use semantic search
    if (this.model && this.embeddings.size > 0) {
      const queryEmbedding = await this.model.embed([query.toLowerCase()]);
      const queryArray = await queryEmbedding.array();
      const queryTensor = tf.tensor(queryArray[0]);

      for (const point of points) {
        const pointEmbedding = this.embeddings.get(point.object_id);
        if (!pointEmbedding) continue;

        // Calculate scores
        const keywordScore = this.calculateKeywordScore(query, point);
        const semanticScore = this.cosineSimilarity(queryTensor, pointEmbedding);
        const finalScore = (keywordWeight * keywordScore) + (semanticWeight * semanticScore);

        if (finalScore >= threshold) {
          results.push({
            point,
            keywordScore,
            semanticScore,
            finalScore
          });
        }
      }

      // Clean up
      queryEmbedding.dispose();
      queryTensor.dispose();
    } else {
      // Fallback to keyword-only search
      console.warn('Semantic search not available, using keyword search only');
      for (const point of points) {
        const keywordScore = this.calculateKeywordScore(query, point);

        if (keywordScore >= threshold) {
          results.push({
            point,
            keywordScore,
            semanticScore: 0,
            finalScore: keywordScore
          });
        }
      }
    }

    // Sort by final score and return top results
    results.sort((a, b) => b.finalScore - a.finalScore);
    return results.slice(0, maxResults);
  }

  /**
   * Clear embeddings from memory
   */
  clearMemory(): void {
    for (const embedding of this.embeddings.values()) {
      embedding.dispose();
    }
    this.embeddings.clear();
  }

  /**
   * Clear all cached embeddings
   */
  async clearCache(): Promise<void> {
    await this.embeddingCache.clear();
    this.clearMemory();
  }

  /**
   * Check if model is loaded and ready
   */
  isReady(): boolean {
    return this.model !== null;
  }

  /**
   * Get memory usage statistics
   */
  getMemoryStats(): { numTensors: number; numBytes: number } {
    const memory = tf.memory();
    return {
      numTensors: memory.numTensors,
      numBytes: memory.numBytes
    };
  }
}

export const semanticSearchService = SemanticSearchService.getInstance();