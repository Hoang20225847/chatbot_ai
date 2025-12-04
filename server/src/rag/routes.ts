// server/src/plugins/rag/routes.ts
import { FastifyInstance } from 'fastify';
import { RAGPipeline } from '../../../../rag/src/pipeline/rag-pipeline';
import { VectorSearchService } from '../../../../rag/src/retrieval/vector-search';
import { OpenAIEmbeddingService } from '../../../../integrations/src/openai/embeddings.service';
import { OpenAIChatService } from '../../../../integrations/src/openai/chat.service';

export async function ragRoutes(fastify: FastifyInstance) {
  // Initialize services
  const embeddingService = new OpenAIEmbeddingService(process.env.OPENAI_API_KEY!);
  const chatService = new OpenAIChatService(process.env.OPENAI_API_KEY!);
  const vectorSearch = new VectorSearchService(embeddingService);
  const ragPipeline = new RAGPipeline(vectorSearch, chatService);

  /**
   * POST /api/rag/query
   * Main RAG query endpoint
   */
  fastify.post('/api/rag/query', {
    schema: {
      body: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          topK: { type: 'number', default: 5 },
          minScore: { type: 'number', default: 0.7 },
          filters: {
            type: 'object',
            properties: {
              impact: { type: 'array', items: { type: 'string' } },
              protocol: { type: 'array', items: { type: 'string' } },
              firm: { type: 'array', items: { type: 'string' } }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { query, topK, minScore, filters } = request.body as any;

      const result = await ragPipeline.query({
        query,
        searchOptions: { topK, minScore, filters }
      });

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to process RAG query'
      });
    }
  });

  /**
   * POST /api/rag/search
   * Search only (no generation)
   */
  fastify.post('/api/rag/search', async (request, reply) => {
    try {
      const { query, topK = 5, minScore = 0.7, filters } = request.body as any;

      const results = await vectorSearch.hybridSearch(query, {
        topK,
        minScore,
        filters
      });

      return reply.send({
        success: true,
        data: {
          results,
          count: results.length
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Search failed'
      });
    }
  });

  /**
   * POST /api/rag/compare-protocols
   * Compare security findings across protocols
   */
  fastify.post('/api/rag/compare-protocols', {
    schema: {
      body: {
        type: 'object',
        required: ['protocols', 'aspect'],
        properties: {
          protocols: { 
            type: 'array', 
            items: { type: 'string' },
            minItems: 2 
          },
          aspect: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { protocols, aspect } = request.body as any;

      const result = await ragPipeline.compareProtocols(protocols, aspect);

      return reply.send({
        success: true,
        data: result
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Comparison failed'
      });
    }
  });

  /**
   * GET /api/rag/filters
   * Get available filter options
   */
  fastify.get('/api/rag/filters', async (request, reply) => {
    try {
      const AuditFinding = (await import('../../../../data/src/models/audit-finding.model')).AuditFinding;
      
      const [protocols, firms, impacts] = await Promise.all([
        AuditFinding.distinct('protocol_name'),
        AuditFinding.distinct('firm_name'),
        AuditFinding.distinct('impact')
      ]);

      return reply.send({
        success: true,
        data: {
          protocols: protocols.sort(),
          firms: firms.sort(),
          impacts: impacts.sort()
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch filters'
      });
    }
  });
}

// server/src/plugins/conversations/handlers.ts - Integration example
export async function enhancedChatHandler(request: any, reply: any) {
  const { message, conversationId, useRAG } = request.body;

  // If RAG is enabled, enhance with context
  if (useRAG) {
    const ragPipeline = request.server.ragPipeline; // Injected dependency
    
    // Get conversation history
    const history = await getConversationHistory(conversationId);
    
    // Query RAG
    const ragResult = await ragPipeline.query({
      query: message,
      conversationHistory: history,
      searchOptions: { topK: 3 }
    });

    // Return enhanced response
    return reply.send({
      success: true,
      message: ragResult.answer,
      sources: ragResult.sources,
      metadata: ragResult.metadata
    });
  }

  // Normal chat without RAG
  // ... existing logic
}