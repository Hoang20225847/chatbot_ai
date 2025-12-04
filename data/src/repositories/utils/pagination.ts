export interface PaginationOptions {
  page?: number;
  limit?: number;
  sort?: { [key: string]: 1 | -1 };
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class PaginationHelper {
  /**
   * Calculate skip value from page number
   */
  static getSkip(page: number = 1, limit: number = 10): number {
    return (page - 1) * limit;
  }

  /**
   * Build pagination result
   */
  static buildResult<T>(
    data: T[],
    total: number,
    page: number = 1,
    limit: number = 10
  ): PaginationResult<T> {
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Validate pagination options
   */
  static validateOptions(options: PaginationOptions): PaginationOptions {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));

    return {
      page,
      limit,
      sort: options.sort || { report_date: -1 }
    };
  }
}