export type SortDirection = 'asc' | 'desc' | 1 | -1;

export interface SortOptions {
  field: string;
  direction: SortDirection;
}

export class SortBuilder {
  /**
   * Common sort presets
   */
  static readonly PRESETS = {
    NEWEST_FIRST: { report_date: -1 },
    OLDEST_FIRST: { report_date: 1 },
    HIGHEST_IMPACT: { impact: -1, report_date: -1 },
    HIGHEST_QUALITY: { quality_score: -1, report_date: -1 },
    ALPHABETICAL: { title: 1 },
    PROTOCOL_NAME: { protocol_name: 1, report_date: -1 }
  }as const;

  /**
   * Build sort object from options
   */
  static build(options: SortOptions | SortOptions[]): { [key: string]: 1 | -1 } {
    if (Array.isArray(options)) {
      return options.reduce((acc, opt) => {
        acc[opt.field] = this.normalizeDirection(opt.direction);
        return acc;
      }, {} as { [key: string]: 1 | -1 });
    }

    return {
      [options.field]: this.normalizeDirection(options.direction)
    };
  }

  /**
   * Normalize sort direction
   */
  private static normalizeDirection(direction: SortDirection): 1 | -1 {
    if (direction === 'asc' || direction === 1) return 1;
    if (direction === 'desc' || direction === -1) return -1;
    return -1; // default to descending
  }

  /**
   * Get preset by name
   */
  static getPreset(name: keyof typeof SortBuilder.PRESETS): { [key: string]: 1 | -1 } {
    return this.PRESETS[name];
  }
}