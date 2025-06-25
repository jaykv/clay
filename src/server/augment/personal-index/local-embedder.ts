/**
 * Local Embedder - Uses transformers.js for local embedding generation (Augment pattern)
 * Provides secure, local-only embedding generation without external API calls
 */

import { pipeline } from '@huggingface/transformers';
import { logger } from '../../utils/logger';
import { getConfig } from '../../utils/config';
import { CodeChunk, SupportedLanguage } from './models';

/**
 * Embedding configuration
 */
interface EmbeddingConfig {
  modelName: string;
  maxLength: number;
  batchSize: number;
  device: 'cpu' | 'gpu';
}

/**
 * Local embedder using transformers.js (security-first approach)
 */
export class LocalEmbedder {
  private pipeline: any | null = null;
  private config: EmbeddingConfig;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    const augmentConfig = getConfig().augment.personalIndex;
    this.config = {
      modelName: augmentConfig.embeddingModel,
      maxLength: augmentConfig.chunkSize,
      batchSize: 8, // Process multiple chunks at once
      device: 'cpu', // Use CPU for now (can be upgraded to WebGPU later)
    };

    logger.info(`LocalEmbedder initialized with model: ${this.config.modelName}`);
  }

  /**
   * Initialize the embedding pipeline
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      logger.info('Initializing embedding pipeline...');
      
      // Create feature extraction pipeline for embeddings
      this.pipeline = await pipeline('feature-extraction', this.config.modelName);

      this.isInitialized = true;
      logger.info('Embedding pipeline initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize embedding pipeline:', error);
      this.initializationPromise = null;
      throw error;
    }
  }

  /**
   * Generate embedding for a single text
   */
  public async generateEmbedding(text: string): Promise<Float32Array> {
    await this.initialize();

    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    try {
      // Preprocess text for better code understanding
      const processedText = this.preprocessText(text);
      
      // Generate embedding
      const result = await this.pipeline(processedText);

      // Convert to Float32Array
      const embedding = new Float32Array(result.data);
      
      logger.debug(`Generated embedding for text (${text.length} chars) -> ${embedding.length} dimensions`);
      return embedding;
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple code chunks (batch processing)
   */
  public async generateEmbeddings(chunks: CodeChunk[]): Promise<Map<string, Float32Array>> {
    await this.initialize();

    if (!this.pipeline) {
      throw new Error('Embedding pipeline not initialized');
    }

    const embeddings = new Map<string, Float32Array>();
    
    // Process in batches for efficiency
    for (let i = 0; i < chunks.length; i += this.config.batchSize) {
      const batch = chunks.slice(i, i + this.config.batchSize);
      
      try {
        const batchTexts = batch.map(chunk => this.prepareChunkForEmbedding(chunk));
        
        // Generate embeddings for the batch
        const results = await Promise.all(
          batchTexts.map(text => this.generateEmbedding(text))
        );

        // Store results
        batch.forEach((chunk, index) => {
          embeddings.set(chunk.id, results[index]);
        });

        logger.debug(`Processed batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(chunks.length / this.config.batchSize)}`);
      } catch (error) {
        logger.error(`Failed to process batch starting at index ${i}:`, error);
        // Continue with next batch instead of failing completely
      }
    }

    logger.info(`Generated embeddings for ${embeddings.size}/${chunks.length} chunks`);
    return embeddings;
  }

  /**
   * Prepare code chunk for embedding generation
   */
  private prepareChunkForEmbedding(chunk: CodeChunk): string {
    // Create a rich text representation for better embeddings
    const parts: string[] = [];

    // Add type and name information
    if (chunk.name) {
      parts.push(`${chunk.type}: ${chunk.name}`);
    } else {
      parts.push(chunk.type);
    }

    // Add language context
    parts.push(`Language: ${chunk.language}`);

    // Add documentation if available
    if (chunk.metadata.documentation) {
      parts.push(`Documentation: ${chunk.metadata.documentation}`);
    }

    // Add the actual code content
    parts.push(`Code:\n${chunk.content}`);

    // Add context if available
    if (chunk.context && chunk.context !== chunk.content) {
      parts.push(`Context:\n${chunk.context}`);
    }

    // Add dependencies
    if (chunk.dependencies.length > 0) {
      parts.push(`Dependencies: ${chunk.dependencies.join(', ')}`);
    }

    const fullText = parts.join('\n\n');
    
    // Truncate if too long
    if (fullText.length > this.config.maxLength) {
      return fullText.substring(0, this.config.maxLength) + '...';
    }

    return fullText;
  }

  /**
   * Preprocess text for better code understanding
   */
  private preprocessText(text: string): string {
    // Remove excessive whitespace but preserve structure
    let processed = text.replace(/\n\s*\n\s*\n/g, '\n\n'); // Reduce multiple empty lines
    processed = processed.replace(/[ \t]+/g, ' '); // Normalize spaces
    processed = processed.trim();

    return processed;
  }

  /**
   * Calculate similarity between two embeddings
   */
  public calculateSimilarity(embedding1: Float32Array, embedding2: Float32Array): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimension');
    }

    // Calculate cosine similarity
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    const similarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    return Math.max(0, Math.min(1, similarity)); // Clamp to [0, 1]
  }

  /**
   * Find most similar embeddings
   */
  public findSimilar(
    queryEmbedding: Float32Array,
    candidateEmbeddings: Map<string, Float32Array>,
    topK: number = 10
  ): Array<{ id: string; similarity: number }> {
    const similarities: Array<{ id: string; similarity: number }> = [];

    for (const [id, embedding] of candidateEmbeddings) {
      const similarity = this.calculateSimilarity(queryEmbedding, embedding);
      similarities.push({ id, similarity });
    }

    // Sort by similarity (descending) and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }

  /**
   * Get embedding dimension
   */
  public async getEmbeddingDimension(): Promise<number> {
    await this.initialize();
    
    // Generate a test embedding to get dimension
    const testEmbedding = await this.generateEmbedding('test');
    return testEmbedding.length;
  }

  /**
   * Check if embedder is ready
   */
  public isReady(): boolean {
    return this.isInitialized && this.pipeline !== null;
  }

  /**
   * Get model information
   */
  public getModelInfo(): { name: string; device: string; ready: boolean } {
    return {
      name: this.config.modelName,
      device: this.config.device,
      ready: this.isReady(),
    };
  }

  /**
   * Cleanup resources
   */
  public async dispose(): Promise<void> {
    if (this.pipeline) {
      // Note: transformers.js doesn't have explicit disposal yet
      this.pipeline = null;
    }
    this.isInitialized = false;
    this.initializationPromise = null;
    logger.info('LocalEmbedder disposed');
  }
}
