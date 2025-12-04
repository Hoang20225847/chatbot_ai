export class AggregationPipelines {
  /**
   * Group by impact with counts
   */
  static byImpact() {
    return [
      {
        $group: {
          _id: '$impact',
          count: { $sum: 1 },
          protocols: { $addToSet: '$protocol_name' },
          avgQualityScore: { $avg: '$quality_score' }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          _id: 0,
          impact: '$_id',
          count: 1,
          protocolCount: { $size: '$protocols' },
          avgQualityScore: { $round: ['$avgQualityScore', 2] }
        }
      }
    ];
  }

  /**
   * Group by protocol with statistics
   */
  static byProtocol(limit: number = 10) {
    return [
      {
        $group: {
          _id: '$protocol_name',
          count: { $sum: 1 },
          highSeverity: {
            $sum: {
              $cond: [
                { $in: ['$impact', ['HIGH', 'CRITICAL']] },
                1,
                0
              ]
            }
          },
          firms: { $addToSet: '$firm_name' },
          latestReport: { $max: '$report_date' }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: 0,
          protocol: '$_id',
          totalFindings: '$count',
          highSeverityCount: '$highSeverity',
          auditFirms: '$firms',
          latestReport: 1
        }
      }
    ];
  }

  /**
   * Group by firm with statistics
   */
  static byFirm() {
    return [
      {
        $group: {
          _id: '$firm_name',
          count: { $sum: 1 },
          protocols: { $addToSet: '$protocol_name' },
          impactDistribution: {
            $push: '$impact'
          }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $project: {
          _id: 0,
          firm: '$_id',
          totalFindings: '$count',
          protocolsAudited: { $size: '$protocols' },
          impactDistribution: 1
        }
      }
    ];
  }

  /**
   * Trending vulnerabilities (by title similarity)
   */
  static trendingVulnerabilities(limit: number = 20) {
    return [
      {
        $group: {
          _id: {
            $substr: ['$title', 0, 50] // Group by first 50 chars of title
          },
          count: { $sum: 1 },
          examples: { $push: { id: '$id', title: '$title', protocol: '$protocol_name' } },
          avgImpact: { $avg: { $cond: [
            { $eq: ['$impact', 'CRITICAL'] }, 4,
            { $cond: [
              { $eq: ['$impact', 'HIGH'] }, 3,
              { $cond: [
                { $eq: ['$impact', 'MEDIUM'] }, 2,
                1
              ]}
            ]}
          ]}}
        }
      },
      {
        $match: { count: { $gte: 2 } } // At least 2 similar findings
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: limit
      },
      {
        $project: {
          _id: 0,
          pattern: '$_id',
          occurrences: '$count',
          examples: { $slice: ['$examples', 3] },
          avgImpactScore: { $round: ['$avgImpact', 2] }
        }
      }
    ];
  }

  /**
   * Timeline of findings
   */
  static timeline(interval: 'day' | 'week' | 'month' = 'month') {
    const dateFormat = {
      day: '%Y-%m-%d',
      week: '%Y-W%V',
      month: '%Y-%m'
    }[interval];

    return [
      {
        $group: {
          _id: {
            $dateToString: {
              format: dateFormat,
              date: '$report_date'
            }
          },
          count: { $sum: 1 },
          highSeverity: {
            $sum: {
              $cond: [
                { $in: ['$impact', ['HIGH', 'CRITICAL']] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $sort: { _id: 1 }
      },
      {
        $project: {
          _id: 0,
          period: '$_id',
          totalFindings: '$count',
          highSeverityCount: '$highSeverity'
        }
      }
    ];
  }
}

// Export all utilities
export * from './query-builder';
export * from './pagination';
export * from './sort-builder';
export * from './aggregation-pipelines';