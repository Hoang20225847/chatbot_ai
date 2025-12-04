// rag/src/retrieval/vector-search.ts
import { AuditFinding } from '../../../data/src/models/audit-finding.model';
import { OpenAIEmbeddingService } from '../../../integrations/src/openai/embeddings.service';

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: {
    protocol: string;
    impact: string;
    title: string;
    section: string;
    source_link: string;
    firm: string;
  };
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  filters?: {
    impact?: string[];
    protocol?: string[];
    firm?: string[];
  };
}

export class VectorSearchService {
  constructor(
    private embeddingService: OpenAIEmbeddingService
  ) {}

  /**
   * Semantic search trong audit findings
   */
  async search(
    query: string, 
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { 
      topK = 5, 
      minScore = 0.7,
      filters = {} 
    } = options;

    // 1. Generate embedding cho query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // 2. Build MongoDB aggregation pipeline
    const pipeline: any[] = [
      // Vector search stage (MongoDB Atlas Vector Search)
      {
        $vectorSearch: {
          index: 'audit_findings_vector_index',
          path: 'chunks.embedding',
          queryVector: queryEmbedding,
          numCandidates: topK * 10,
          limit: topK
        }
      },
      // Unwind chunks để có thể filter
      { $unwind: '$chunks' },
      // Score calculation
      {
        $addFields: {
          score: {
            $meta: 'vectorSearchScore'
          }
        }
      },
      // Filter by metadata
      ...(this.buildFilterStages(filters)),
      // Filter by minimum score
      {
        $match: {
          score: { $gte: minScore }
        }
      },
      // Sort by score
      { $sort: { score: -1 } },
      // Project fields we need
      {
        $project: {
          _id: 0,
          id: '$_id',
          text: '$chunks.text',
          score: 1,
          metadata: {
            protocol: '$protocol_name',
            impact: '$impact',
            title: '$title',
            section: '$chunks.metadata.section',
            source_link: '$source_link',
            firm: '$firm_name'
          }
        }
      },
      { $limit: topK }
    ];

    // 3. Execute search
    const results = await AuditFinding.aggregate(pipeline);
    
    return results;
  }

  /**
   * Hybrid search: Kết hợp vector search + keyword search
   */
  async hybridSearch(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { topK = 5 } = options;

    // 1. Vector search
    const vectorResults = await this.search(query, { 
      ...options, 
      topK: Math.ceil(topK * 1.5) 
    });

    // 2. Keyword search (MongoDB text search)
    const keywordResults = await this.keywordSearch(query, options);

    // 3. Merge và re-rank results
    return this.mergeAndRerankResults(
      vectorResults, 
      keywordResults, 
      topK
    );
  }

  /**
   * Keyword search sử dụng MongoDB text index
   */
  private async keywordSearch(
    query: string,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const { topK = 5, filters = {} } = options;

    const matchConditions: any = {
      $text: { $search: query }
    };

    // Apply filters
    if (filters.impact?.length) {
      matchConditions.impact = { $in: filters.impact };
    }
    if (filters.protocol?.length) {
      matchConditions.protocol_name = { $in: filters.protocol };
    }
    if (filters.firm?.length) {
      matchConditions.firm_name = { $in: filters.firm };
    }

    const results = await AuditFinding.aggregate([
      { $match: matchConditions },
      {
        $addFields: {
          score: { $meta: 'textScore' }
        }
      },
      { $sort: { score: -1 } },
      { $limit: topK },
      { $unwind: { path: '$chunks', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          id: '$_id',
          text: { 
            $ifNull: ['$chunks.text', '$summary'] 
          },
          score: { $divide: ['$score', 10] }, // Normalize score
          metadata: {
            protocol: '$protocol_name',
            impact: '$impact',
            title: '$title',
            section: { $ifNull: ['$chunks.metadata.section', 'summary'] },
            source_link: '$source_link',
            firm: '$firm_name'
          }
        }
      }
    ]);

    return results;
  }

  /**
   * Merge vector và keyword results, re-rank bằng Reciprocal Rank Fusion
   */
  private mergeAndRerankResults(
    vectorResults: SearchResult[],
    keywordResults: SearchResult[],
    topK: number
  ): SearchResult[] {
    const k = 60; // RRF constant
    const scoreMap = new Map<string, { result: SearchResult; rrfScore: number }>();

    // Calculate RRF scores
    vectorResults.forEach((result, rank) => {
      const id = result.id.toString();
      const rrfScore = 1 / (k + rank + 1);
      scoreMap.set(id, { result, rrfScore });
    });

    keywordResults.forEach((result, rank) => {
      const id = result.id.toString();
      const rrfScore = 1 / (k + rank + 1);
      
      if (scoreMap.has(id)) {
        const existing = scoreMap.get(id)!;
        existing.rrfScore += rrfScore;
      } else {
        scoreMap.set(id, { result, rrfScore });
      }
    });

    // Sort by RRF score và return top K
    const merged = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topK)
      .map(item => ({
        ...item.result,
        score: item.rrfScore
      }));

    return merged;
  }

  /**
   * Build filter stages cho aggregation pipeline
   */
  private buildFilterStages(filters: SearchOptions['filters']): any[] {
    const stages: any[] = [];

    if (!filters) return stages;

    const matchConditions: any = {};

    if (filters.impact?.length) {
      matchConditions.impact = { $in: filters.impact };
    }
    if (filters.protocol?.length) {
      matchConditions.protocol_name = { $in: filters.protocol };
    }
    if (filters.firm?.length) {
      matchConditions.firm_name = { $in: filters.firm };
    }

    if (Object.keys(matchConditions).length > 0) {
      stages.push({ $match: matchConditions });
    }

    return stages;
  }
}