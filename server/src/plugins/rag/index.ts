// server/src/plugins/rag/index.ts
import {
  Router,
  type Application,
  type RequestHandler,
  type ErrorRequestHandler,
} from "express";
import { requireLogin } from "../auth/helpers";
import { RAGPipeline } from "../../../../rag/src/pipeline/rag-pipeline";
import { VectorSearchService } from "../../../../rag/src/retrieval/vector-search";
import { GeminiEmbeddingService } from "../../../../integrations/src/gemini";
import { GeminiChatService } from "../../../../integrations/src/gemini";
import { AuditFinding } from "@data";

export class RAGPlugin {
  private ragPipeline: RAGPipeline;
  private vectorSearch: VectorSearchService;

  constructor(app: Application) {
    // Initialize services
    const embeddingService = new GeminiEmbeddingService(process.env.GEMINI_API_KEY!);
    const chatService = new GeminiChatService(process.env.GEMINI_API_KEY!);
    this.vectorSearch = new VectorSearchService(embeddingService);
    this.ragPipeline = new RAGPipeline(this.vectorSearch, chatService);

    const router = Router();
    
    // Public routes (no auth required for testing)
    router.get("/health", this.healthCheck);
    router.get("/filters", this.getFilters);
    router.get("/stats", this.getStats);
    
    // Protected routes
    router.use(requireLogin);
    router.post("/query", this.query);
    router.post("/query-stream", this.queryStream);
    router.post("/search", this.search);
    router.post("/compare-protocols", this.compareProtocols);
    router.get("/similar/:findingId", this.findSimilar);
    
    router.use(this.handleError);

    app.use("/api/rag", router);

    console.log("RAG plugin registered");
  }

  healthCheck: RequestHandler = async (req, res) => {
    try {
      const stats = await AuditFinding.countDocuments();
      res.json({
        status: "ok",
        totalFindings: stats,
        geminiConfigured: !!process.env.GEMINI_API_KEY
      });
    } catch (err) {
      res.status(500).json({ status: "error", message: "Failed to check health" });
    }
  };

  /**
   * GET /api/rag/filters
   * Get available filter options
   */
  getFilters: RequestHandler = async (req, res, next) => {
    try {
      const [protocols, firms, impacts] = await Promise.all([
        AuditFinding.distinct('protocol_name'),
        AuditFinding.distinct('firm_name'),
        AuditFinding.distinct('impact')
      ]);

      res.json({
        data: {
          protocols: protocols.filter(Boolean).sort(),
          firms: firms.filter(Boolean).sort(),
          impacts: impacts.filter(Boolean).sort()
        }
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/rag/stats
   * Get database statistics
   */
  getStats: RequestHandler = async (req, res, next) => {
    try {
      const [total, indexed, byImpact, byProtocol] = await Promise.all([
        AuditFinding.countDocuments(),
        AuditFinding.countDocuments({ indexed_at: { $exists: true } }),
        AuditFinding.aggregate([
          {
            $group: {
              _id: '$impact',
              count: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ]),
        AuditFinding.aggregate([
          {
            $group: {
              _id: '$protocol_name',
              count: { $sum: 1 }
            }
          },
          { $sort: { count: -1 } },
          { $limit: 10 }
        ])
      ]);

      res.json({
        data: {
          total,
          indexed,
          indexedPercentage: ((indexed / total) * 100).toFixed(2) + '%',
          byImpact,
          topProtocols: byProtocol
        }
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/rag/query
   * Main RAG query endpoint
   */
  query: RequestHandler = async (req, res, next) => {
    try {
      const { query, topK = 5, minScore = 0.7, filters, conversationHistory } = req.body;

      if (!query) {
        throw { status: 400, message: "Query is required" };
      }

      const result = await this.ragPipeline.query({
        query,
        searchOptions: { topK, minScore, filters },
        conversationHistory
      });

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/rag/query-stream
   * Streaming RAG query
   */
  queryStream: RequestHandler = async (req, res, next) => {
    try {
      const { query, topK = 5, minScore = 0.7, filters } = req.body;

      if (!query) {
        throw { status: 400, message: "Query is required" };
      }

      // Set headers for SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = this.ragPipeline.queryStream({
        query,
        searchOptions: { topK, minScore, filters }
      });

      for await (const chunk of stream) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }

      res.end();
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/rag/search
   * Search only (no generation)
   */
  search: RequestHandler = async (req, res, next) => {
    try {
      const { query, topK = 5, minScore = 0.7, filters } = req.body;

      if (!query) {
        throw { status: 400, message: "Query is required" };
      }

      const results = await this.vectorSearch.hybridSearch(query, {
        topK,
        minScore,
        filters
      });

      res.json({
        data: {
          results,
          count: results.length
        }
      });
    } catch (err) {
      next(err);
    }
  };

  /**
   * POST /api/rag/compare-protocols
   * Compare security findings across protocols
   */
  compareProtocols: RequestHandler = async (req, res, next) => {
    try {
      const { protocols, aspect } = req.body;

      if (!protocols || !Array.isArray(protocols) || protocols.length < 2) {
        throw { status: 400, message: "At least 2 protocols are required" };
      }

      if (!aspect) {
        throw { status: 400, message: "Aspect is required" };
      }

      const result = await this.ragPipeline.compareProtocols(protocols, aspect);

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  /**
   * GET /api/rag/similar/:findingId
   * Find similar findings
   */
  findSimilar: RequestHandler = async (req, res, next) => {
    try {
      const { findingId } = req.params;
      const { topK = 5 } = req.query;

      const results = await this.vectorSearch.findSimilar(
        parseInt(findingId),
        parseInt(topK as string)
      );

      res.json({
        data: {
          results,
          count: results.length
        }
      });
    } catch (err) {
      next(err);
    }
  };

  handleError: ErrorRequestHandler = (err, req, res, next) => {
    console.error("RAG_ERROR", {
      endpoint: req.path,
      method: req.method,
      body: req.body,
      error: err.message || err
    });

    res.status(err.status || 500).json({
      error: err.message || "Internal server error",
      details: process.env.NODE_ENV === 'development' ? err : undefined
    });
  };
}

