// rag/src/pipeline/rag-pipeline.ts
import { VectorSearchService, SearchOptions, SearchResult } from '../retrieval/vector-search';
import { GeminiChatService } from '../../../integrations/src/gemini';

export interface RAGRequest {
  query: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  searchOptions?: SearchOptions;
  systemPrompt?: string;
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  metadata: {
    retrievalTime: number;
    generationTime: number;
    chunksUsed: number;
  };
}

export class RAGPipeline {
  constructor(
    private vectorSearch: VectorSearchService,
    private chatService: GeminiChatService
  ) {}

  /**
   * Main RAG pipeline: Retrieve → Generate
   */
  async query(request: RAGRequest): Promise<RAGResponse> {
    const startTime = Date.now();

    // 1. RETRIEVAL: Tìm relevant chunks
    const retrievalStart = Date.now();
    const searchResults = await this.vectorSearch.hybridSearch(
      request.query,
      request.searchOptions
    );
    const retrievalTime = Date.now() - retrievalStart;

    // 2. CONTEXT BUILDING: Build context từ retrieved chunks
    const context = this.buildContext(searchResults);

    // 3. GENERATION: Generate answer với Gemini
    const generationStart = Date.now();
    const answer = await this.generateAnswer(
      request.query,
      context,
      request.conversationHistory,
      request.systemPrompt
    );
    const generationTime = Date.now() - generationStart;

    return {
      answer,
      sources: searchResults,
      metadata: {
        retrievalTime,
        generationTime,
        chunksUsed: searchResults.length
      }
    };
  }

  /**
   * Stream RAG response
   */
  async *queryStream(request: RAGRequest): AsyncGenerator<{
    type: 'sources' | 'chunk' | 'done';
    data?: any;
  }> {
    // 1. RETRIEVAL
    const searchResults = await this.vectorSearch.hybridSearch(
      request.query,
      request.searchOptions
    );

    // Yield sources first
    yield {
      type: 'sources',
      data: searchResults
    };

    // 2. BUILD CONTEXT
    const context = this.buildContext(searchResults);

    // 3. STREAM GENERATION
    const messages = this.prepareMessages(
      request.query,
      context,
      request.conversationHistory,
      request.systemPrompt
    );

    for await (const chunk of this.chatService.streamChat(messages)) {
      yield {
        type: 'chunk',
        data: chunk
      };
    }

    yield { type: 'done' };
  }

  /**
   * Build context string từ search results
   */
  private buildContext(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No relevant security audit findings found in the database.';
    }

    const contextParts = results.map((result, idx) => {
      return [
        `[Source ${idx + 1}]`,
        `Protocol: ${result.metadata.protocol}`,
        `Issue: ${result.metadata.title}`,
        `Impact: ${result.metadata.impact}`,
        `Audit Firm: ${result.metadata.firm}`,
        `Relevance Score: ${result.score.toFixed(3)}`,
        `\nContent:\n${result.text}`,
        `\nReference: ${result.metadata.source_link}`,
        `---`
      ].join('\n');
    });

    return contextParts.join('\n\n');
  }

  /**
   * Prepare messages for chat
   */
  private prepareMessages(
    query: string,
    context: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    customSystemPrompt?: string
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    const systemPrompt = customSystemPrompt || this.getDefaultSystemPrompt();
    const userMessage = this.buildUserMessage(query, context, systemPrompt);

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add conversation history if provided
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // Add current query with context
    messages.push({ role: 'user', content: userMessage });

    return messages;
  }

  /**
   * Generate answer using Gemini with retrieved context
   */
  private async generateAnswer(
    query: string,
    context: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    customSystemPrompt?: string
  ): Promise<string> {
    const messages = this.prepareMessages(query, context, conversationHistory, customSystemPrompt);

    const response = await this.chatService.chat(messages, {
      temperature: 0.3, // Lower temperature cho factual responses
      maxTokens: 2048
    });

    return response;
  }

  /**
   * Default system prompt cho security audit RAG
   */
  private getDefaultSystemPrompt(): string {
    return `You are a specialized assistant for smart contract security audits and blockchain security.

Your role is to help developers understand security vulnerabilities, audit findings, and best practices based on real audit reports from the database.

Guidelines:
1. Answer questions using ONLY the provided audit findings as context
2. Always cite sources by mentioning the protocol name, audit firm, and impact level
3. If the context doesn't contain relevant information, clearly state "I don't have information about this in the audit database"
4. Provide actionable recommendations when discussing vulnerabilities
5. Use technical terminology appropriately but explain complex concepts clearly
6. Highlight the severity (impact level: LOW/MEDIUM/HIGH/CRITICAL) of issues
7. If multiple findings are related, synthesize them into a coherent answer
8. When discussing vulnerabilities, mention both the issue and the recommendation if available

Important: Do NOT make up information. Only use what's provided in the audit findings context.`;
  }

  /**
   * Build user message với context
   */
  private buildUserMessage(query: string, context: string, systemPrompt: string): string {
    return `${systemPrompt}

AUDIT FINDINGS CONTEXT:
${context}

USER QUESTION:
${query}

Please provide a comprehensive answer based strictly on the audit findings above. If the findings don't address the question, clearly state what information is missing.`;
  }

  /**
   * Query với filter theo impact level
   */
  async queryByImpact(
    query: string,
    impacts: string[]
  ): Promise<RAGResponse> {
    return this.query({
      query,
      searchOptions: {
        filters: { impact: impacts },
        topK: 5
      }
    });
  }

  /**
   * Query về specific protocol
   */
  async queryByProtocol(
    query: string,
    protocols: string[]
  ): Promise<RAGResponse> {
    return this.query({
      query,
      searchOptions: {
        filters: { protocol: protocols },
        topK: 5
      }
    });
  }

  /**
   * Comparative analysis giữa các protocols
   */
  async compareProtocols(
    protocols: string[],
    aspect: string
  ): Promise<RAGResponse> {
    const query = `Compare ${aspect} across ${protocols.join(', ')} protocols based on their security audit findings`;
    
    return this.query({
      query,
      searchOptions: {
        filters: { protocol: protocols },
        topK: 10
      },
      systemPrompt: this.getComparativeSystemPrompt()
    });
  }

  /**
   * Get vulnerability patterns
   */
  async getVulnerabilityPatterns(
    vulnerabilityType: string
  ): Promise<RAGResponse> {
    const query = `What are common patterns and examples of ${vulnerabilityType} vulnerabilities in smart contracts?`;
    
    return this.query({
      query,
      searchOptions: {
        topK: 8
      }
    });
  }

  private getComparativeSystemPrompt(): string {
    return `You are analyzing and comparing security findings across multiple protocols based on real audit reports.

Provide a structured comparison that:
1. Identifies common vulnerabilities or patterns across protocols
2. Highlights unique issues for each protocol
3. Compares severity and impact levels
4. Notes which audit firms conducted the audits
5. Summarizes key differences in security posture
6. Provides comparative recommendations

Present your analysis in a clear, organized format with proper citations.`;
  }
}