/*
===============================================================================
SupportOps KPI Aggregations - MongoDB
===============================================================================

Purpose
-------
This file contains production-style MongoDB aggregation pipelines for a
Support Operations analytics project.

It is designed to compute business KPIs commonly used in support analytics:
- ticket inflow / outflow
- backlog and aging
- SLA breach rate
- queue-level performance
- agent-level productivity
- priority-wise trends
- CSAT trends
- reopen rate

Assumed Source Collection
-------------------------
db.tickets

Assumed Document Granularity
----------------------------
1 document = 1 support ticket

Example Document Shape
----------------------
{
  _id: ObjectId(...),
  ticket_id: "TCK-100245",
  issue_created: ISODate("2025-01-02T09:10:00Z"),
  first_response_at: ISODate("2025-01-02T09:25:00Z"),
  issue_resolution_date: ISODate("2025-01-03T14:30:00Z"),
  issue_status: "Resolved",             // Open, Pending, Resolved, Closed, Reopened
  issue_priority: "High",               // Low, Medium, High, Urgent
  queue_name: "Payments",
  category: "Refund",
  subcategory: "Refund delay",
  assigned_agent: "Aditi Sharma",
  customer_id: "CUST-0001",
  channel: "Email",                     // Email, Chat, Phone, Web
  first_response_sla_minutes: 30,
  resolution_sla_hours: 24,
  first_response_breached: false,
  resolution_sla_breached: true,
  resolution_time_minutes: 1760,
  first_response_time_minutes: 15,
  reopen_count: 1,
  csat_score: 4,                        // 1 to 5
  escalated_flag: true,
  deleted_flag: false
}

Notes
-----
1. If your schema differs, update field names in CONFIG below.
2. This file is intentionally verbose and documented for recruiter review.
3. Pipelines return analytics-ready outputs, not transactional records.
===============================================================================
*/

const CONFIG = {
  collectionName: "tickets",

  // Core timestamp fields
  createdAtField: "issue_created",
  resolvedAtField: "issue_resolution_date",
  firstResponseAtField: "first_response_at",

  // Ticket dimensions
  statusField: "issue_status",
  priorityField: "issue_priority",
  queueField: "queue_name",
  categoryField: "category",
  subcategoryField: "subcategory",
  agentField: "assigned_agent",
  channelField: "channel",

  // SLA / performance fields
  firstResponseSlaBreachedField: "first_response_breached",
  resolutionSlaBreachedField: "resolution_sla_breached",
  firstResponseMinutesField: "first_response_time_minutes",
  resolutionMinutesField: "resolution_time_minutes",
  reopenCountField: "reopen_count",
  csatField: "csat_score",
  escalatedField: "escalated_flag",

  // Optional hygiene flag
  deletedFlagField: "deleted_flag"
};

const tickets = db.getCollection(CONFIG.collectionName);

/*
===============================================================================
SECTION 1: INDEXES
Why this matters
----------------
Aggregations can become slow on moderate/large ticket collections.
These indexes are sensible defaults for support analytics workloads.
===============================================================================
*/

function createRecommendedIndexes() {
  print("\nCreating recommended indexes...\n");

  tickets.createIndex({ [CONFIG.createdAtField]: 1 }, { name: "idx_created_at" });
  tickets.createIndex({ [CONFIG.resolvedAtField]: 1 }, { name: "idx_resolved_at" });
  tickets.createIndex({ [CONFIG.statusField]: 1 }, { name: "idx_status" });
  tickets.createIndex({ [CONFIG.priorityField]: 1 }, { name: "idx_priority" });
  tickets.createIndex({ [CONFIG.queueField]: 1 }, { name: "idx_queue" });
  tickets.createIndex({ [CONFIG.agentField]: 1 }, { name: "idx_agent" });
  tickets.createIndex({ [CONFIG.channelField]: 1 }, { name: "idx_channel" });
  tickets.createIndex(
    {
      [CONFIG.createdAtField]: 1,
      [CONFIG.queueField]: 1,
      [CONFIG.priorityField]: 1
    },
    { name: "idx_created_queue_priority" }
  );

  print("Indexes created.\n");
}

/*
===============================================================================
SECTION 2: COMMON HELPERS
===============================================================================
*/

function getBaseMatch(startDate = null, endDate = null) {
  const match = {
    $and: [
      {
        $or: [
          { [CONFIG.deletedFlagField]: { $exists: false } },
          { [CONFIG.deletedFlagField]: false }
        ]
      }
    ]
  };

  if (startDate || endDate) {
    const createdRange = {};
    if (startDate) createdRange.$gte = new Date(startDate);
    if (endDate) createdRange.$lt = new Date(endDate);

    match.$and.push({
      [CONFIG.createdAtField]: createdRange
    });
  }

  return match;
}

function getDateFieldsProjection() {
  return {
    created_day: {
      $dateToString: {
        format: "%Y-%m-%d",
        date: `$${CONFIG.createdAtField}`
      }
    },
    created_month: {
      $dateToString: {
        format: "%Y-%m",
        date: `$${CONFIG.createdAtField}`
      }
    },
    resolved_day: {
      $cond: [
        { $ne: [`$${CONFIG.resolvedAtField}`, null] },
        {
          $dateToString: {
            format: "%Y-%m-%d",
            date: `$${CONFIG.resolvedAtField}`
          }
        },
        null
      ]
    ]
  };
}

function getOpenStatusCondition() {
  return {
    $in: [
      `$${CONFIG.statusField}`,
      ["Open", "Pending", "In Progress", "Reopened"]
    ]
  };
}

function getClosedStatusCondition() {
  return {
    $in: [
      `$${CONFIG.statusField}`,
      ["Resolved", "Closed"]
    ]
  };
}

/*
===============================================================================
SECTION 3: DAILY OPERATIONS DASHBOARD KPI
What problem this solves
------------------------
Gives a daily operational summary for the support team:
- tickets created
- tickets resolved
- net flow
- open backlog snapshot
- SLA breaches
- average response/resolution times
- reopen counts
- CSAT trend

Output Granularity
------------------
1 row = 1 day
===============================================================================
*/

function dailyKpiPipeline(startDate = null, endDate = null) {
  return [
    { $match: getBaseMatch(startDate, endDate) },

    {
      $addFields: {
        ...getDateFieldsProjection(),
        is_open: getOpenStatusCondition(),
        is_closed: getClosedStatusCondition(),
        first_response_breached_safe: {
          $cond: [
            { $eq: [`$${CONFIG.firstResponseSlaBreachedField}`, true] },
            1,
            0
          ]
        },
        resolution_breached_safe: {
          $cond: [
            { $eq: [`$${CONFIG.resolutionSlaBreachedField}`, true] },
            1,
            0
          ]
        },
        reopen_count_safe: {
          $ifNull: [`$${CONFIG.reopenCountField}`, 0]
        },
        csat_score_safe: {
          $cond: [
            {
              $and: [
                { $ne: [`$${CONFIG.csatField}`, null] },
                { $gte: [`$${CONFIG.csatField}`, 1] },
                { $lte: [`$${CONFIG.csatField}`, 5] }
              ]
            },
            `$${CONFIG.csatField}`,
            null
          ]
        }
      }
    },

    {
      $facet: {
        created_per_day: [
          {
            $group: {
              _id: "$created_day",
              tickets_created: { $sum: 1 },
              avg_first_response_minutes: {
                $avg: `$${CONFIG.firstResponseMinutesField}`
              },
              avg_resolution_minutes_for_created_tickets: {
                $avg: `$${CONFIG.resolutionMinutesField}`
              },
              first_response_sla_breaches: {
                $sum: "$first_response_breached_safe"
              },
              resolution_sla_breaches_on_created_tickets: {
                $sum: "$resolution_breached_safe"
              },
              total_reopens: {
                $sum: "$reopen_count_safe"
              },
              avg_csat: {
                $avg: "$csat_score_safe"
              }
            }
          },
          { $sort: { _id: 1 } }
        ],

        resolved_per_day: [
          { $match: { resolved_day: { $ne: null } } },
          {
            $group: {
              _id: "$resolved_day",
              tickets_resolved: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ],

        backlog_snapshot: [
          {
            $match: {
              $expr: getOpenStatusCondition()
            }
          },
          {
            $group: {
              _id: null,
              current_open_backlog: { $sum: 1 }
            }
          }
        ]
      }
    }
  ];
}

function runDailyKpis(startDate = null, endDate = null) {
  print("\n================ DAILY KPI OUTPUT ================\n");
  const result = tickets.aggregate(dailyKpiPipeline(startDate, endDate)).toArray();
  printjson(result);
}

/*
===============================================================================
SECTION 4: QUEUE-LEVEL KPI
What problem this solves
------------------------
Shows which support queues are overloaded or underperforming.

Output Granularity
------------------
1 row = 1 queue
===============================================================================
*/

function queuePerformancePipeline(startDate = null, endDate = null) {
  return [
    { $match: getBaseMatch(startDate, endDate) },

    {
      $addFields: {
        is_open: getOpenStatusCondition(),
        is_closed: getClosedStatusCondition(),
        first_response_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.firstResponseSlaBreachedField}`, true] }, 1, 0]
        },
        resolution_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.resolutionSlaBreachedField}`, true] }, 1, 0]
        },
        reopen_count_safe: { $ifNull: [`$${CONFIG.reopenCountField}`, 0] }
      }
    },

    {
      $group: {
        _id: `$${CONFIG.queueField}`,
        tickets_total: { $sum: 1 },
        tickets_open: {
          $sum: { $cond: ["$is_open", 1, 0] }
        },
        tickets_closed: {
          $sum: { $cond: ["$is_closed", 1, 0] }
        },
        first_response_sla_breaches: {
          $sum: "$first_response_breached_safe"
        },
        resolution_sla_breaches: {
          $sum: "$resolution_breached_safe"
        },
        avg_first_response_minutes: {
          $avg: `$${CONFIG.firstResponseMinutesField}`
        },
        avg_resolution_minutes: {
          $avg: `$${CONFIG.resolutionMinutesField}`
        },
        avg_reopens: {
          $avg: "$reopen_count_safe"
        },
        avg_csat: {
          $avg: `$${CONFIG.csatField}`
        }
      }
    },

    {
      $addFields: {
        first_response_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_total", 0] },
                    { $divide: ["$first_response_sla_breaches", "$tickets_total"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        },
        resolution_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_total", 0] },
                    { $divide: ["$resolution_sla_breaches", "$tickets_total"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        },
        closure_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_total", 0] },
                    { $divide: ["$tickets_closed", "$tickets_total"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        }
      }
    },

    { $sort: { tickets_total: -1, resolution_breach_rate_pct: -1 } }
  ];
}

function runQueuePerformance(startDate = null, endDate = null) {
  print("\n================ QUEUE PERFORMANCE ================\n");
  const result = tickets.aggregate(queuePerformancePipeline(startDate, endDate)).toArray();
  printjson(result);
}

/*
===============================================================================
SECTION 5: AGENT-LEVEL PERFORMANCE
What problem this solves
------------------------
Measures individual support agent throughput, SLA quality, and customer outcomes.

Output Granularity
------------------
1 row = 1 agent
===============================================================================
*/

function agentPerformancePipeline(startDate = null, endDate = null) {
  return [
    { $match: getBaseMatch(startDate, endDate) },

    {
      $addFields: {
        is_closed: getClosedStatusCondition(),
        first_response_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.firstResponseSlaBreachedField}`, true] }, 1, 0]
        },
        resolution_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.resolutionSlaBreachedField}`, true] }, 1, 0]
        },
        escalated_safe: {
          $cond: [{ $eq: [`$${CONFIG.escalatedField}`, true] }, 1, 0]
        },
        reopen_count_safe: { $ifNull: [`$${CONFIG.reopenCountField}`, 0] }
      }
    },

    {
      $group: {
        _id: `$${CONFIG.agentField}`,
        tickets_handled: { $sum: 1 },
        tickets_closed: {
          $sum: { $cond: ["$is_closed", 1, 0] }
        },
        avg_first_response_minutes: {
          $avg: `$${CONFIG.firstResponseMinutesField}`
        },
        avg_resolution_minutes: {
          $avg: `$${CONFIG.resolutionMinutesField}`
        },
        first_response_sla_breaches: {
          $sum: "$first_response_breached_safe"
        },
        resolution_sla_breaches: {
          $sum: "$resolution_breached_safe"
        },
        escalations: {
          $sum: "$escalated_safe"
        },
        total_reopens: {
          $sum: "$reopen_count_safe"
        },
        avg_csat: {
          $avg: `$${CONFIG.csatField}`
        }
      }
    },

    {
      $addFields: {
        closure_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_handled", 0] },
                    { $divide: ["$tickets_closed", "$tickets_handled"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        },
        first_response_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_handled", 0] },
                    { $divide: ["$first_response_sla_breaches", "$tickets_handled"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        },
        resolution_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_handled", 0] },
                    { $divide: ["$resolution_sla_breaches", "$tickets_handled"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        },
        escalation_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_handled", 0] },
                    { $divide: ["$escalations", "$tickets_handled"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        }
      }
    },

    {
      $sort: {
        tickets_handled: -1,
        avg_csat: -1
      }
    }
  ];
}

function runAgentPerformance(startDate = null, endDate = null) {
  print("\n================ AGENT PERFORMANCE ================\n");
  const result = tickets.aggregate(agentPerformancePipeline(startDate, endDate)).toArray();
  printjson(result);
}

/*
===============================================================================
SECTION 6: PRIORITY-WISE SLA HEALTH
What problem this solves
------------------------
Shows whether urgent and high-priority tickets are being served correctly.

Output Granularity
------------------
1 row = 1 priority
===============================================================================
*/

function prioritySlaPipeline(startDate = null, endDate = null) {
  return [
    { $match: getBaseMatch(startDate, endDate) },

    {
      $addFields: {
        first_response_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.firstResponseSlaBreachedField}`, true] }, 1, 0]
        },
        resolution_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.resolutionSlaBreachedField}`, true] }, 1, 0]
        }
      }
    },

    {
      $group: {
        _id: `$${CONFIG.priorityField}`,
        tickets_total: { $sum: 1 },
        avg_first_response_minutes: {
          $avg: `$${CONFIG.firstResponseMinutesField}`
        },
        avg_resolution_minutes: {
          $avg: `$${CONFIG.resolutionMinutesField}`
        },
        first_response_breaches: {
          $sum: "$first_response_breached_safe"
        },
        resolution_breaches: {
          $sum: "$resolution_breached_safe"
        }
      }
    },

    {
      $addFields: {
        first_response_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_total", 0] },
                    { $divide: ["$first_response_breaches", "$tickets_total"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        },
        resolution_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_total", 0] },
                    { $divide: ["$resolution_breaches", "$tickets_total"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        }
      }
    },

    { $sort: { tickets_total: -1 } }
  ];
}

function runPrioritySla(startDate = null, endDate = null) {
  print("\n================ PRIORITY SLA HEALTH ================\n");
  const result = tickets.aggregate(prioritySlaPipeline(startDate, endDate)).toArray();
  printjson(result);
}

/*
===============================================================================
SECTION 7: BACKLOG AGING
What problem this solves
------------------------
A queue may look healthy on total volume but still hide old unresolved tickets.
This pipeline buckets open tickets by age.

Output Granularity
------------------
1 row = 1 aging bucket
===============================================================================
*/

function backlogAgingPipeline() {
  return [
    {
      $match: {
        ...getBaseMatch(),
        $expr: getOpenStatusCondition()
      }
    },

    {
      $addFields: {
        age_in_days: {
          $dateDiff: {
            startDate: `$${CONFIG.createdAtField}`,
            endDate: "$$NOW",
            unit: "day"
          }
        }
      }
    },

    {
      $addFields: {
        aging_bucket: {
          $switch: {
            branches: [
              { case: { $lte: ["$age_in_days", 1] }, then: "0-1 days" },
              { case: { $and: [{ $gt: ["$age_in_days", 1] }, { $lte: ["$age_in_days", 3] }] }, then: "2-3 days" },
              { case: { $and: [{ $gt: ["$age_in_days", 3] }, { $lte: ["$age_in_days", 7] }] }, then: "4-7 days" },
              { case: { $and: [{ $gt: ["$age_in_days", 7] }, { $lte: ["$age_in_days", 14] }] }, then: "8-14 days" },
              { case: { $and: [{ $gt: ["$age_in_days", 14] }, { $lte: ["$age_in_days", 30] }] }, then: "15-30 days" }
            ],
            default: "30+ days"
          }
        }
      }
    },

    {
      $group: {
        _id: "$aging_bucket",
        open_tickets: { $sum: 1 }
      }
    },

    {
      $addFields: {
        bucket_order: {
          $switch: {
            branches: [
              { case: { $eq: ["$_id", "0-1 days"] }, then: 1 },
              { case: { $eq: ["$_id", "2-3 days"] }, then: 2 },
              { case: { $eq: ["$_id", "4-7 days"] }, then: 3 },
              { case: { $eq: ["$_id", "8-14 days"] }, then: 4 },
              { case: { $eq: ["$_id", "15-30 days"] }, then: 5 }
            ],
            default: 6
          }
        }
      }
    },

    { $sort: { bucket_order: 1 } },
    { $project: { bucket_order: 0 } }
  ];
}

function runBacklogAging() {
  print("\n================ BACKLOG AGING ================\n");
  const result = tickets.aggregate(backlogAgingPipeline()).toArray();
  printjson(result);
}

/*
===============================================================================
SECTION 8: CATEGORY / SUBCATEGORY PAIN POINTS
What problem this solves
------------------------
Identifies issue themes driving high volume or high SLA risk.

Output Granularity
------------------
1 row = 1 category + subcategory
===============================================================================
*/

function categoryPainPointsPipeline(startDate = null, endDate = null) {
  return [
    { $match: getBaseMatch(startDate, endDate) },

    {
      $addFields: {
        resolution_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.resolutionSlaBreachedField}`, true] }, 1, 0]
        },
        reopen_count_safe: { $ifNull: [`$${CONFIG.reopenCountField}`, 0] }
      }
    },

    {
      $group: {
        _id: {
          category: `$${CONFIG.categoryField}`,
          subcategory: `$${CONFIG.subcategoryField}`
        },
        tickets_total: { $sum: 1 },
        resolution_sla_breaches: { $sum: "$resolution_breached_safe" },
        avg_resolution_minutes: { $avg: `$${CONFIG.resolutionMinutesField}` },
        avg_reopens: { $avg: "$reopen_count_safe" },
        avg_csat: { $avg: `$${CONFIG.csatField}` }
      }
    },

    {
      $addFields: {
        resolution_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_total", 0] },
                    { $divide: ["$resolution_sla_breaches", "$tickets_total"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        }
      }
    },

    { $sort: { tickets_total: -1, resolution_breach_rate_pct: -1 } }
  ];
}

function runCategoryPainPoints(startDate = null, endDate = null) {
  print("\n================ CATEGORY PAIN POINTS ================\n");
  const result = tickets.aggregate(categoryPainPointsPipeline(startDate, endDate)).toArray();
  printjson(result);
}

/*
===============================================================================
SECTION 9: CHANNEL ANALYSIS
What problem this solves
------------------------
Compares Email / Chat / Phone / Web ticket quality and speed.

Output Granularity
------------------
1 row = 1 channel
===============================================================================
*/

function channelAnalysisPipeline(startDate = null, endDate = null) {
  return [
    { $match: getBaseMatch(startDate, endDate) },

    {
      $addFields: {
        first_response_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.firstResponseSlaBreachedField}`, true] }, 1, 0]
        },
        resolution_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.resolutionSlaBreachedField}`, true] }, 1, 0]
        }
      }
    },

    {
      $group: {
        _id: `$${CONFIG.channelField}`,
        tickets_total: { $sum: 1 },
        avg_first_response_minutes: { $avg: `$${CONFIG.firstResponseMinutesField}` },
        avg_resolution_minutes: { $avg: `$${CONFIG.resolutionMinutesField}` },
        first_response_breaches: { $sum: "$first_response_breached_safe" },
        resolution_breaches: { $sum: "$resolution_breached_safe" },
        avg_csat: { $avg: `$${CONFIG.csatField}` }
      }
    },

    {
      $addFields: {
        first_response_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_total", 0] },
                    { $divide: ["$first_response_breaches", "$tickets_total"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        },
        resolution_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_total", 0] },
                    { $divide: ["$resolution_breaches", "$tickets_total"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        }
      }
    },

    { $sort: { tickets_total: -1 } }
  ];
}

function runChannelAnalysis(startDate = null, endDate = null) {
  print("\n================ CHANNEL ANALYSIS ================\n");
  const result = tickets.aggregate(channelAnalysisPipeline(startDate, endDate)).toArray();
  printjson(result);
}

/*
===============================================================================
SECTION 10: EXECUTIVE SUMMARY CARDS
What problem this solves
------------------------
Creates one compact summary object for top-level dashboard cards:
- total created
- total resolved
- open backlog
- avg first response time
- avg resolution time
- SLA breach rates
- avg CSAT
- reopen rate

Output Granularity
------------------
1 row = total summary for selected date range
===============================================================================
*/

function executiveSummaryPipeline(startDate = null, endDate = null) {
  return [
    { $match: getBaseMatch(startDate, endDate) },

    {
      $addFields: {
        is_open: getOpenStatusCondition(),
        is_closed: getClosedStatusCondition(),
        first_response_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.firstResponseSlaBreachedField}`, true] }, 1, 0]
        },
        resolution_breached_safe: {
          $cond: [{ $eq: [`$${CONFIG.resolutionSlaBreachedField}`, true] }, 1, 0]
        },
        reopen_count_safe: { $ifNull: [`$${CONFIG.reopenCountField}`, 0] }
      }
    },

    {
      $group: {
        _id: null,
        tickets_created: { $sum: 1 },
        tickets_resolved: {
          $sum: { $cond: ["$is_closed", 1, 0] }
        },
        current_open_backlog_within_filtered_set: {
          $sum: { $cond: ["$is_open", 1, 0] }
        },
        avg_first_response_minutes: {
          $avg: `$${CONFIG.firstResponseMinutesField}`
        },
        avg_resolution_minutes: {
          $avg: `$${CONFIG.resolutionMinutesField}`
        },
        first_response_breaches: {
          $sum: "$first_response_breached_safe"
        },
        resolution_breaches: {
          $sum: "$resolution_breached_safe"
        },
        avg_csat: {
          $avg: `$${CONFIG.csatField}`
        },
        total_reopens: {
          $sum: "$reopen_count_safe"
        }
      }
    },

    {
      $addFields: {
        first_response_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_created", 0] },
                    { $divide: ["$first_response_breaches", "$tickets_created"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        },
        resolution_breach_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_created", 0] },
                    { $divide: ["$resolution_breaches", "$tickets_created"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        },
        reopen_rate_pct: {
          $round: [
            {
              $multiply: [
                {
                  $cond: [
                    { $gt: ["$tickets_created", 0] },
                    { $divide: ["$total_reopens", "$tickets_created"] },
                    0
                  ]
                },
                100
              ]
            },
            2
          ]
        }
      }
    }
  ];
}

function runExecutiveSummary(startDate = null, endDate = null) {
  print("\n================ EXECUTIVE SUMMARY ================\n");
  const result = tickets.aggregate(executiveSummaryPipeline(startDate, endDate)).toArray();
  printjson(result);
}

/*
===============================================================================
SECTION 11: DATA QUALITY CHECKS
What problem this solves
------------------------
Bad analytics often come from bad operational data.
These checks surface broken records before dashboarding.

Output Granularity
------------------
1 row = 1 DQ issue type
===============================================================================
*/

function dataQualityChecksPipeline() {
  return [
    {
      $facet: {
        missing_created_date: [
          {
            $match: {
              [CONFIG.createdAtField]: { $in: [null, undefined] }
            }
          },
          { $count: "cnt" }
        ],

        resolved_before_created: [
          {
            $match: {
              [CONFIG.createdAtField]: { $ne: null },
              [CONFIG.resolvedAtField]: { $ne: null },
              $expr: {
                $lt: [`$${CONFIG.resolvedAtField}`, `$${CONFIG.createdAtField}`]
              }
            }
          },
          { $count: "cnt" }
        ],

        missing_status: [
          {
            $match: {
              [CONFIG.statusField]: { $in: [null, ""] }
            }
          },
          { $count: "cnt" }
        ],

        missing_priority: [
          {
            $match: {
              [CONFIG.priorityField]: { $in: [null, ""] }
            }
          },
          { $count: "cnt" }
        ],

        missing_agent: [
          {
            $match: {
              [CONFIG.agentField]: { $in: [null, ""] }
            }
          },
          { $count: "cnt" }
        ],

        invalid_csat: [
          {
            $match: {
              [CONFIG.csatField]: { $ne: null },
              $expr: {
                $or: [
                  { $lt: [`$${CONFIG.csatField}`, 1] },
                  { $gt: [`$${CONFIG.csatField}`, 5] }
                ]
              }
            }
          },
          { $count: "cnt" }
        ]
      }
    }
  ];
}

function runDataQualityChecks() {
  print("\n================ DATA QUALITY CHECKS ================\n");
  const result = tickets.aggregate(dataQualityChecksPipeline()).toArray();
  printjson(result);
}

/*
===============================================================================
SECTION 12: MASTER RUNNER
What problem this solves
------------------------
Runs all pipelines in one place for recruiter demo or quick validation.
===============================================================================
*/

function runAllSupportOpsKpis(startDate = null, endDate = null) {
  print("\n====================================================");
  print("Running SupportOps MongoDB KPI Aggregations");
  print("Start Date:", startDate);
  print("End Date  :", endDate);
  print("====================================================\n");

  runExecutiveSummary(startDate, endDate);
  runDailyKpis(startDate, endDate);
  runQueuePerformance(startDate, endDate);
  runAgentPerformance(startDate, endDate);
  runPrioritySla(startDate, endDate);
  runChannelAnalysis(startDate, endDate);
  runCategoryPainPoints(startDate, endDate);
  runBacklogAging();
  runDataQualityChecks();

  print("\nAll KPI pipelines executed.\n");
}

/*
===============================================================================
SECTION 13: SAMPLE USAGE
===============================================================================

A) Create indexes once:
createRecommendedIndexes();

B) Run all KPIs for January 2025:
runAllSupportOpsKpis("2025-01-01T00:00:00Z", "2025-02-01T00:00:00Z");

C) Run only queue performance:
runQueuePerformance("2025-01-01T00:00:00Z", "2025-02-01T00:00:00Z");

D) Run DQ checks:
runDataQualityChecks();

===============================================================================
SECTION 14: INTERVIEW DEFENSE NOTES
===============================================================================

Why use MongoDB here?
- To show that the same support analytics problem can be solved on document data,
  not only in SQL warehouses.
- Useful when ticketing data lands in JSON/document-oriented systems.
- Aggregation framework supports grouped KPIs, faceting, bucketing, and DQ checks.

Safeguards built into this script
---------------------------------
- Excludes deleted records where possible
- Handles null reopen counts
- Avoids divide-by-zero when calculating rates
- Validates CSAT ranges
- Separates open vs closed ticket logic
- Flags impossible dates such as resolved_before_created

Failure mode if these safeguards were removed
---------------------------------------------
- Nulls would distort averages
- Invalid CSAT values would contaminate customer satisfaction metrics
- Zero-denominator calculations would fail or produce misleading rates
- Incorrect open/closed logic would overstate backlog or closure

One-sentence lock-in insight
----------------------------
This MongoDB file turns raw ticket documents into business-facing support KPIs
with the same rigor you would expect from a warehouse-backed analytics system.
===============================================================================
*/