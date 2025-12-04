// rag/src/pipeline/rag-pipeline.ts
import { VectorSearchService, SearchOptions, SearchResult } from '../retrieval/vector-search';
import { OpenAIChatService } from '../../../integrations/src/openai/chat.service';

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
    private chatService: OpenAIChatService
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

    // 3. GENERATION: Generate answer với LLM
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
   * Build context string từ search results
   */
  private buildContext(results: SearchResult[]): string {
    if (results.length === 0) {
      return 'No relevant security audit findings found.';
    }

    const contextParts = results.map((result, idx) => {
      return [
        `[Source ${idx + 1}]`,
        `Protocol: ${result.metadata.protocol}`,
        `Issue: ${result.metadata.title}`,
        `Impact: ${result.metadata.impact}`,
        `Relevance Score: ${result.score.toFixed(3)}`,
        `\n${result.text}`,
        `\nReference: ${result.metadata.source_link}`,
        `---`
      ].join('\n');
    });

    return contextParts.join('\n\n');
  }

  /**
   * Generate answer using LLM with retrieved context
   */
  private async generateAnswer(
    query: string,
    context: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    customSystemPrompt?: string
  ): Promise<string> {
    const systemPrompt = customSystemPrompt || this.getDefaultSystemPrompt();

    const messages: Array<{ role: string; content: string }> = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history nếu có
    if (conversationHistory && conversationHistory.length > 0) {
      messages.push(...conversationHistory);
    }

    // Add current query với context
    const userMessage = this.buildUserMessage(query, context);
    messages.push({ role: 'user', content: userMessage });

    // Call LLM
    const response = await this.chatService.chat(messages, {
      temperature: 0.3, // Lower temperature cho factual responses
      maxTokens: 1000
    });

    return response;
  }

  /**
   * Default system prompt cho security audit RAG
   */
  private getDefaultSystemPrompt(): string {
    return `You are a specialized assistant for smart contract security audits and blockchain security.

Your role is to help developers understand security vulnerabilities, audit findings, and best practices based on real audit reports.

Guidelines:
1. Answer questions using the provided audit findings as context
2. Always cite sources by mentioning the protocol name and audit firm
3. If the context doesn't contain relevant information, clearly state that
4. Provide actionable recommendations when discussing vulnerabilities
5. Use technical terminology appropriately but explain complex concepts
6. Highlight the severity (impact level) of issues when relevant
7. If multiple findings are related, synthesize them into a coherent answer

When a question is outside the scope of the provided audit findings, acknowledge this limitation and suggest what information would be needed.`;
  }

  /**
   * Build user message với context
   */
  private buildUserMessage(query: string, context: string): string {
    return `Based on the following smart contract security audit findings, please answer the question.

AUDIT FINDINGS CONTEXT:
${context}

QUESTION:
${query}

Please provide a comprehensive answer based on the audit findings above. If the findings don't fully address the question, mention what additional information might be needed.`;
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
    const query = `Compare ${aspect} across ${protocols.join(', ')} protocols`;
    
    return this.query({
      query,
      searchOptions: {
        filters: { protocol: protocols },
        topK: 10
      },
      systemPrompt: this.getComparativeSystemPrompt()
    });
  }

  private getComparativeSystemPrompt(): string {
    return `You are analyzing and comparing security findings across multiple protocols.

Provide a structured comparison that:
1. Identifies common vulnerabilities or patterns
2. Highlights unique issues for each protocol
3. Compares severity and impact levels
4. Summarizes key differences in security posture
5. Provides comparative recommendations

Present your analysis in a clear, organized format.`;
  }
}