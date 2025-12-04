// integrations/src/gemini/embeddings.service.ts
export class GeminiEmbeddingService {
  private apiKey: string;
  private model = 'text-embedding-004';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Generate embedding cho single text
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/${this.model}:embedContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: `models/${this.model}`,
            content: {
              parts: [{ text }]
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${error}`);
      }

      const data = await response.json();
      return data.embedding.values;
    } catch (error: any) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings cho multiple texts (batch)
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      const batchSize = 100;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        
        const embeddings = await Promise.all(
          batch.map(text => this.generateEmbedding(text))
        );

        results.push(...embeddings);
        
        // Add delay between batches to avoid rate limits
        if (i + batchSize < texts.length) {
          await this.delay(1000);
        }
      }

      return results;
    } catch (error: any) {
      console.error('Error generating embeddings:', error);
      throw new Error(`Failed to generate embeddings: ${error.message}`);
    }
  }

  /**
   * Get embedding dimension
   */
  getEmbeddingDimension(): number {
    // text-embedding-004 has 768 dimensions
    return 768;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}