// data/src/repositories/AuditFindingRepo.ts
import { AuditFinding, IAuditFinding } from '../models/audit-finding.model';
import { FilterQuery } from 'mongoose';

export interface IAuditFindingRepo {
  create: (data: IAuditFinding) => Promise<IAuditFinding>;
  findById: (id: number) => Promise<IAuditFinding | null>;
  findBySlug: (slug: string) => Promise<IAuditFinding | null>;
  findAll: (options?: FindAllOptions) => Promise<IAuditFinding[]>;
  update: (id: number, data: Partial<IAuditFinding>) => Promise<IAuditFinding | null>;
  upsert: (data: IAuditFinding) => Promise<IAuditFinding>;
  deleteById: (id: number) => Promise<boolean>;
  count: (filters?: FilterQuery<IAuditFinding>) => Promise<number>;
  search: (query: string, options?: SearchOptions) => Promise<IAuditFinding[]>;
  getDistinctValues: (field: string) => Promise<string[]>;
  getByImpact: (impact: string[], options?: FindAllOptions) => Promise<IAuditFinding[]>;
  getByProtocol: (protocols: string[], options?: FindAllOptions) => Promise<IAuditFinding[]>;
  getByFirm: (firms: string[], options?: FindAllOptions) => Promise<IAuditFinding[]>;
  getIndexedFindings: (options?: FindAllOptions) => Promise<IAuditFinding[]>;
  bulkUpsert: (findings: IAuditFinding[]) => Promise<{ upserted: number; modified: number }>;
}

export interface FindAllOptions {
  skip?: number;
  limit?: number;
  sort?: { [key: string]: 1 | -1 };
  filters?: {
    impact?: string[];
    protocol?: string[];
    firm?: string[];
    dateFrom?: Date;
    dateTo?: Date;
    indexed?: boolean;
    kind?: string;
  };
  select?: string | string[];
}

export interface SearchOptions {
  skip?: number;
  limit?: number;
  filters?: FindAllOptions['filters'];
  minScore?: number;
}

export class AuditFindingRepo implements IAuditFindingRepo {
  /**
   * Create new audit finding
   */
  async create(data: IAuditFinding): Promise<IAuditFinding> {
    return await AuditFinding.create(data);
  }

  /**
   * Find by ID
   */
  async findById(id: number): Promise<IAuditFinding | null> {
    return await AuditFinding.findOne({ id }).exec();
  }

  /**
   * Find by slug
   */
  async findBySlug(slug: string): Promise<IAuditFinding | null> {
    return await AuditFinding.findOne({ slug }).exec();
  }

  /**
   * Find all with options
   */
  async findAll(options: FindAllOptions = {}): Promise<IAuditFinding[]> {
    const {
      skip = 0,
      limit = 100,
      sort = { report_date: -1 },
      filters = {},
      select
    } = options;

    const query = this.buildFilterQuery(filters);

    let queryBuilder = AuditFinding.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit);

    if (select) {
      queryBuilder = queryBuilder.select(select);
    }

    return await queryBuilder.exec();
  }

  /**
   * Update audit finding
   */
  async update(
    id: number,
    data: Partial<IAuditFinding>
  ): Promise<IAuditFinding | null> {
    return await AuditFinding.findOneAndUpdate(
      { id },
      data,
      { new: true }
    ).exec();
  }

  /**
   * Upsert (insert or update)
   */
  async upsert(data: IAuditFinding): Promise<IAuditFinding> {
    return await AuditFinding.findOneAndUpdate(
      { id: data.id },
      data,
      { new: true, upsert: true }
    ).exec() as IAuditFinding;
  }

  /**
   * Delete by ID
   */
  async deleteById(id: number): Promise<boolean> {
    const result = await AuditFinding.deleteOne({ id });
    return result.deletedCount > 0;
  }

  /**
   * Count documents
   */
  async count(filters: FilterQuery<IAuditFinding> = {}): Promise<number> {
    return await AuditFinding.countDocuments(filters);
  }

  /**
   * Text search
   */
  async search(query: string, options: SearchOptions = {}): Promise<IAuditFinding[]> {
    const { 
      skip = 0, 
      limit = 20, 
      filters = {},
      minScore = 0.5
    } = options;

    const matchConditions: any = {
      $text: { $search: query }
    };

    // Apply filters
    const filterQuery = this.buildFilterQuery(filters);
    Object.assign(matchConditions, filterQuery);

    const results = await AuditFinding.aggregate([
      { $match: matchConditions },
      {
        $addFields: {
          textScore: { $meta: 'textScore' }
        }
      },
      {
        $match: {
          textScore: { $gte: minScore }
        }
      },
      { $sort: { textScore: -1 } },
      { $skip: skip },
      { $limit: limit }
    ]);

    return results;
  }

  /**
   * Get distinct values for a field
   */
  async getDistinctValues(field: string): Promise<string[]> {
    return await AuditFinding.distinct(field);
  }

  /**
   * Get findings by impact level
   */
  async getByImpact(
    impact: string[], 
    options: FindAllOptions = {}
  ): Promise<IAuditFinding[]> {
    return this.findAll({
      ...options,
      filters: {
        ...options.filters,
        impact
      }
    });
  }

  /**
   * Get findings by protocol
   */
  async getByProtocol(
    protocols: string[], 
    options: FindAllOptions = {}
  ): Promise<IAuditFinding[]> {
    return this.findAll({
      ...options,
      filters: {
        ...options.filters,
        protocol: protocols
      }
    });
  }

  /**
   * Get findings by audit firm
   */
  async getByFirm(
    firms: string[], 
    options: FindAllOptions = {}
  ): Promise<IAuditFinding[]> {
    return this.findAll({
      ...options,
      filters: {
        ...options.filters,
        firm: firms
      }
    });
  }

  /**
   * Get indexed findings (có embeddings)
   */
  async getIndexedFindings(options: FindAllOptions = {}): Promise<IAuditFinding[]> {
    return this.findAll({
      ...options,
      filters: {
        ...options.filters,
        indexed: true
      }
    });
  }

  /**
   * Bulk upsert findings
   */
  async bulkUpsert(findings: IAuditFinding[]): Promise<{ upserted: number; modified: number }> {
    const bulkOps = findings.map(finding => ({
      updateOne: {
        filter: { id: finding.id },
        update: { $set: finding },
        upsert: true
      }
    }));

    const result = await AuditFinding.bulkWrite(bulkOps);

    return {
      upserted: result.upsertedCount,
      modified: result.modifiedCount
    };
  }

  /**
   * Get statistics
   */
  async getStatistics(): Promise<{
    total: number;
    indexed: number;
    byImpact: Array<{ impact: string; count: number }>;
    byProtocol: Array<{ protocol: string; count: number }>;
    byFirm: Array<{ firm: string; count: number }>;
  }> {
    const [total, indexed, byImpact, byProtocol, byFirm] = await Promise.all([
      this.count(),
      this.count({ indexed_at: { $exists: true } }),
      AuditFinding.aggregate([
        {
          $group: {
            _id: '$impact',
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: 1 } },
        {
          $project: {
            _id: 0,
            impact: '$_id',
            count: 1
          }
        }
      ]),
      AuditFinding.aggregate([
        {
          $group: {
            _id: '$protocol_name',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            protocol: '$_id',
            count: 1
          }
        }
      ]),
      AuditFinding.aggregate([
        {
          $group: {
            _id: '$firm_name',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        {
          $project: {
            _id: 0,
            firm: '$_id',
            count: 1
          }
        }
      ])
    ]);

    return {
      total,
      indexed,
      byImpact,
      byProtocol,
      byFirm
    };
  }

  /**
   * Get findings by date range
   */
  async getByDateRange(
    startDate: Date,
    endDate: Date,
    options: FindAllOptions = {}
  ): Promise<IAuditFinding[]> {
    return this.findAll({
      ...options,
      filters: {
        ...options.filters,
        dateFrom: startDate,
        dateTo: endDate
      }
    });
  }

  /**
   * Get recent findings
   */
  async getRecent(limit: number = 10): Promise<IAuditFinding[]> {
    return this.findAll({
      limit,
      sort: { report_date: -1 }
    });
  }

  /**
   * Get high severity findings
   */
  async getHighSeverity(limit: number = 20): Promise<IAuditFinding[]> {
    return this.getByImpact(['HIGH', 'CRITICAL'], { limit });
  }

  /**
   * Check if finding exists
   */
  async exists(id: number): Promise<boolean> {
    const count = await AuditFinding.countDocuments({ id });
    return count > 0;
  }

  /**
   * Get findings without embeddings
   */
  async getUnindexedFindings(limit: number = 100): Promise<IAuditFinding[]> {
    return await AuditFinding.find({
      $or: [
        { indexed_at: { $exists: false } },
        { embedding: { $exists: false } },
        { chunks: { $size: 0 } }
      ]
    })
      .limit(limit)
      .exec();
  }

  /**
   * Delete old findings
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await AuditFinding.deleteMany({
      report_date: { $lt: date }
    });
    return result.deletedCount;
  }

  /**
   * Get findings with missing data
   */
  async getFindingsWithMissingData(): Promise<IAuditFinding[]> {
    return await AuditFinding.find({
      $or: [
        { title: { $in: [null, ''] } },
        { content: { $in: [null, ''] } },
        { summary: { $in: [null, ''] } },
        { protocol_name: { $in: [null, ''] } }
      ]
    }).exec();
  }

  /**
   * Build filter query from options
   */
  private buildFilterQuery(filters: FindAllOptions['filters'] = {}): FilterQuery<IAuditFinding> {
    const query: any = {};

    if (filters.impact?.length) {
      query.impact = { $in: filters.impact };
    }

    if (filters.protocol?.length) {
      query.protocol_name = { $in: filters.protocol };
    }

    if (filters.firm?.length) {
      query.firm_name = { $in: filters.firm };
    }

    if (filters.kind) {
      query.kind = filters.kind;
    }

    if (filters.dateFrom || filters.dateTo) {
      query.report_date = {};
      if (filters.dateFrom) {
        query.report_date.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        query.report_date.$lte = filters.dateTo;
      }
    }

    if (filters.indexed !== undefined) {
      if (filters.indexed) {
        query.indexed_at = { $exists: true };
      } else {
        query.indexed_at = { $exists: false };
      }
    }

    return query;
  }

  /**
   * Aggregate by field
   */
  async aggregateByField(
    field: string,
    limit: number = 10
  ): Promise<Array<{ value: string; count: number }>> {
    const results = await AuditFinding.aggregate([
      {
        $group: {
          _id: `$${field}`,
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          value: '$_id',
          count: 1
        }
      }
    ]);

    return results;
  }

  /**
   * Get findings with quality score above threshold
   */
  async getHighQualityFindings(
    minScore: number = 7,
    options: FindAllOptions = {}
  ): Promise<IAuditFinding[]> {
    const query: any = {
      quality_score: { $gte: minScore }
    };

    const filterQuery = this.buildFilterQuery(options.filters);
    Object.assign(query, filterQuery);

    return await AuditFinding.find(query)
      .sort(options.sort || { quality_score: -1 })
      .skip(options.skip || 0)
      .limit(options.limit || 50)
      .exec();
  }

  /**
   * Update indexed_at timestamp
   */
  async markAsIndexed(id: number): Promise<boolean> {
    const result = await AuditFinding.updateOne(
      { id },
      { $set: { indexed_at: new Date() } }
    );
    return result.modifiedCount > 0;
  }

  /**
   * Batch update indexed_at
   */
  async markManyAsIndexed(ids: number[]): Promise<number> {
    const result = await AuditFinding.updateMany(
      { id: { $in: ids } },
      { $set: { indexed_at: new Date() } }
    );
    return result.modifiedCount;
  }
}

// Export default instance
export default new AuditFindingRepo();