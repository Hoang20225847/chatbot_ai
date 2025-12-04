// rag/src/indexing/document-processor.ts
import { IAuditFinding } from '../../../data/src/models/audit-finding.model';

export interface ProcessedChunk {
  text: string;
  chunk_index: number;
  metadata: {
    section: string;
    impact: string;
    protocol: string;
    firm: string;
    title: string;
    source_link: string;
  };
}

export class DocumentProcessor {
  private readonly maxChunkSize: number = 512; // tokens
  private readonly chunkOverlap: number = 50;

  /**
   * Xử lý audit finding thành các chunks để embedding
   */
  processAuditFinding(finding: IAuditFinding): ProcessedChunk[] {
    const chunks: ProcessedChunk[] = [];
    
    // 1. Extract sections từ content
    const sections = this.extractSections(finding.content);
    
    // 2. Chunk mỗi section
    sections.forEach(section => {
      const sectionChunks = this.chunkText(section.content);
      
      sectionChunks.forEach((chunk, idx) => {
        chunks.push({
          text: this.enrichChunkContext(chunk, finding, section.name),
          chunk_index: chunks.length,
          metadata: {
            section: section.name,
            impact: finding.impact,
            protocol: finding.protocol_name,
            firm: finding.firm_name,
            title: finding.title,
            source_link: finding.source_link
          }
        });
      });
    });
    
    return chunks;
  }

  /**
   * Extract các sections từ markdown content
   */
  private extractSections(content: string): Array<{ name: string; content: string }> {
    const sections: Array<{ name: string; content: string }> = [];
    
    // Regex để tìm markdown headers
    const headerRegex = /\*\*([^*]+)\*\*/g;
    const parts = content.split(headerRegex);
    
    for (let i = 1; i < parts.length; i += 2) {
      const sectionName = parts[i].trim();
      const sectionContent = parts[i + 1]?.trim() || '';
      
      if (sectionContent) {
        sections.push({
          name: sectionName,
          content: sectionContent
        });
      }
    }
    
    // Nếu không tìm thấy sections, coi toàn bộ content là 1 section
    if (sections.length === 0) {
      sections.push({
        name: 'content',
        content: content
      });
    }
    
    return sections;
  }

  /**
   * Chia text thành các chunks với overlap
   */
  private chunkText(text: string): string[] {
    const sentences = this.splitIntoSentences(text);
    const chunks: string[] = [];
    let currentChunk: string[] = [];
    let currentSize = 0;
    
    for (const sentence of sentences) {
      const sentenceSize = this.estimateTokens(sentence);
      
      if (currentSize + sentenceSize > this.maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
        
        // Overlap: giữ lại một số câu cuối
        const overlapSentences = this.getOverlapSentences(currentChunk);
        currentChunk = overlapSentences;
        currentSize = this.estimateTokens(currentChunk.join(' '));
      }
      
      currentChunk.push(sentence);
      currentSize += sentenceSize;
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
    }
    
    return chunks;
  }

  /**
   * Thêm context metadata vào chunk để improve retrieval
   */
  private enrichChunkContext(
    chunk: string, 
    finding: IAuditFinding, 
    section: string
  ): string {
    const prefix = [
      `Protocol: ${finding.protocol_name}`,
      `Issue: ${finding.title}`,
      `Impact: ${finding.impact}`,
      `Section: ${section}`,
      `Audit Firm: ${finding.firm_name}`,
      ''
    ].join('\n');
    
    return prefix + chunk;
  }

  /**
   * Split text thành sentences
   */
  private splitIntoSentences(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Estimate số tokens (rough approximation)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.split(/\s+/).length * 1.3);
  }

  /**
   * Lấy các câu overlap từ chunk hiện tại
   */
  private getOverlapSentences(sentences: string[]): string[] {
    let overlapSize = 0;
    const overlap: string[] = [];
    
    for (let i = sentences.length - 1; i >= 0; i--) {
      const sentenceSize = this.estimateTokens(sentences[i]);
      if (overlapSize + sentenceSize > this.chunkOverlap) break;
      
      overlap.unshift(sentences[i]);
      overlapSize += sentenceSize;
    }
    
    return overlap;
  }
}