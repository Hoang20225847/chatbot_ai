import { FilterQuery } from 'mongoose';
import { IAuditFinding } from '../../models/audit-finding.model';

export interface QueryFilters {
  impact?: string[];
  protocol?: string[];
  firm?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  indexed?: boolean;
  kind?: string;
  hasEmbedding?: boolean;
  hasChunks?: boolean;
  minQualityScore?: number;
  searchText?: string;
}

export class AuditFindingQueryBuilder {
  private query: FilterQuery<IAuditFinding> = {};

  /**
   * Filter by impact levels
   */
  byImpact(impacts: string[]): this {
    if (impacts && impacts.length > 0) {
      this.query.impact = { $in: impacts };
    }
    return this;
  }

  /**
   * Filter by protocols
   */
  byProtocol(protocols: string[]): this {
    if (protocols && protocols.length > 0) {
      this.query.protocol_name = { $in: protocols };
    }
    return this;
  }

  /**
   * Filter by audit firms
   */
  byFirm(firms: string[]): this {
    if (firms && firms.length > 0) {
      this.query.firm_name = { $in: firms };
    }
    return this;
  }

  /**
   * Filter by date range
   */
  byDateRange(from?: Date, to?: Date): this {
    if (from || to) {
      this.query.report_date = {};
      if (from) {
        this.query.report_date.$gte = from;
      }
      if (to) {
        this.query.report_date.$lte = to;
      }
    }
    return this;
  }

  /**
   * Filter by indexed status
   */
  byIndexedStatus(indexed: boolean): this {
    if (indexed) {
      this.query.indexed_at = { $exists: true };
    } else {
      this.query.indexed_at = { $exists: false };
    }
    return this;
  }

  /**
   * Filter by kind
   */
  byKind(kind: string): this {
    if (kind) {
      this.query.kind = kind;
    }
    return this;
  }

  /**
   * Filter by embedding presence
   */
  hasEmbedding(has: boolean = true): this {
    if (has) {
      this.query.embedding = { $exists: true, $ne: [] };
    } else {
      this.query.$or = [
        { embedding: { $exists: false } },
        { embedding: [] }
      ];
    }
    return this;
  }

  /**
   * Filter by chunks presence
   */
  hasChunks(has: boolean = true): this {
    if (has) {
      this.query.chunks = { $exists: true, $ne: [] };
    } else {
      this.query.$or = [
        { chunks: { $exists: false } },
        { chunks: { $size: 0 } }
      ];
    }
    return this;
  }

  /**
   * Filter by minimum quality score
   */
  minQualityScore(score: number): this {
    if (score !== undefined) {
      this.query.quality_score = { $gte: score };
    }
    return this;
  }

  /**
   * Full text search
   */
  textSearch(searchText: string): this {
    if (searchText) {
      this.query.$text = { $search: searchText };
    }
    return this;
  }

  /**
   * Build and return the query
   */
  build(): FilterQuery<IAuditFinding> {
    return this.query;
  }

  /**
   * Build from filters object
   */
  static fromFilters(filters: QueryFilters): FilterQuery<IAuditFinding> {
    const builder = new AuditFindingQueryBuilder();

    if (filters.impact) builder.byImpact(filters.impact);
    if (filters.protocol) builder.byProtocol(filters.protocol);
    if (filters.firm) builder.byFirm(filters.firm);
    if (filters.dateFrom || filters.dateTo) {
      builder.byDateRange(filters.dateFrom, filters.dateTo);
    }
    if (filters.indexed !== undefined) builder.byIndexedStatus(filters.indexed);
    if (filters.kind) builder.byKind(filters.kind);
    if (filters.hasEmbedding !== undefined) builder.hasEmbedding(filters.hasEmbedding);
    if (filters.hasChunks !== undefined) builder.hasChunks(filters.hasChunks);
    if (filters.minQualityScore) builder.minQualityScore(filters.minQualityScore);
    if (filters.searchText) builder.textSearch(filters.searchText);

    return builder.build();
  }
}