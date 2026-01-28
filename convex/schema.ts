import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Organizations (multi-tenant)
  organizations: defineTable({
    name: v.string(),
    abn: v.string(),
    logoUrl: v.optional(v.string()),
    settings: v.optional(
      v.object({
        defaultPaymentTerms: v.optional(v.number()),
        timezone: v.optional(v.string()),
        // Xero integration settings
        xero: v.optional(
          v.object({
            tenantId: v.string(),
            tenantName: v.string(),
            accessToken: v.string(),
            refreshToken: v.string(),
            tokenExpiresAt: v.number(),
            connectedAt: v.number(),
            lastSyncAt: v.optional(v.number()),
            accountCodes: v.optional(
              v.object({
                salesAccount: v.optional(v.string()),
                labourAccount: v.optional(v.string()),
                contractAccount: v.optional(v.string()),
              })
            ),
          })
        ),
      })
    ),
    createdAt: v.number(),
  }),

  // Users (owners and workers)
  users: defineTable({
    clerkId: v.optional(v.string()),
    email: v.string(),
    name: v.string(),
    passwordHash: v.optional(v.string()), // For native auth
    role: v.union(v.literal("owner"), v.literal("worker")),
    organizationId: v.id("organizations"),
    workerId: v.optional(v.id("workers")),
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
    onboardingCompletedAt: v.optional(v.number()), // When worker completed onboarding
  })
    .index("by_email", ["email"])
    .index("by_organization", ["organizationId"])
    .index("by_clerk_id", ["clerkId"]),

  // Workers
  workers: defineTable({
    organizationId: v.id("organizations"),
    userId: v.optional(v.id("users")), // Linked when worker creates account
    name: v.string(),
    phone: v.string(),
    email: v.string(),
    emergencyContact: v.object({
      name: v.string(),
      phone: v.string(),
      relationship: v.string(),
    }),
    employmentType: v.union(v.literal("employee"), v.literal("subcontractor")),
    tradeClassification: v.union(
      v.literal("apprentice"),
      v.literal("qualified"),
      v.literal("leadingHand"),
      v.literal("foreman")
    ),
    // Default rates (optional) - actual rates set per job allocation
    payRate: v.optional(v.number()),
    chargeOutRate: v.optional(v.number()),
    startDate: v.number(),
    status: v.union(v.literal("active"), v.literal("inactive")),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_email", ["email"])
    .index("by_user", ["userId"]),

  // Worker Certifications
  certifications: defineTable({
    workerId: v.id("workers"),
    name: v.string(),
    expiryDate: v.number(),
    documentUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_worker", ["workerId"]),

  // Invites (for invite link system - workers and owners)
  workerInvites: defineTable({
    organizationId: v.id("organizations"),
    token: v.string(),
    email: v.optional(v.string()),
    // Role defaults to "worker" for backwards compatibility with existing invites
    role: v.optional(v.union(v.literal("worker"), v.literal("owner"))),
    // Worker-specific fields (optional, only for worker invites)
    employmentType: v.optional(v.union(v.literal("employee"), v.literal("subcontractor"))),
    tradeClassification: v.optional(v.union(
      v.literal("apprentice"),
      v.literal("qualified"),
      v.literal("leadingHand"),
      v.literal("foreman")
    )),
    // Legacy fields for backwards compatibility (rates now on allocations)
    payRate: v.optional(v.number()),
    chargeOutRate: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("expired")
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.id("users")),
  })
    .index("by_token", ["token"])
    .index("by_organization", ["organizationId"]),

  // Builders (clients)
  builders: defineTable({
    organizationId: v.id("organizations"),
    companyName: v.string(),
    abn: v.string(),
    paymentTerms: v.number(), // days
    negotiatedRates: v.optional(
      v.object({
        defaultChargeOutRate: v.optional(v.number()),
      })
    ),
    notes: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive")),
    // Xero contact reference
    xeroContactId: v.optional(v.string()),
    xeroContactSyncedAt: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  // Builder Contacts
  builderContacts: defineTable({
    builderId: v.id("builders"),
    name: v.string(),
    phone: v.string(),
    email: v.string(),
    role: v.string(), // e.g., "Project Manager", "Site Supervisor", "Accounts"
    isPrimary: v.boolean(),
    createdAt: v.number(),
  }).index("by_builder", ["builderId"]),

  // Jobs
  jobs: defineTable({
    organizationId: v.id("organizations"),
    builderId: v.id("builders"),
    name: v.string(),
    siteAddress: v.string(),
    jobType: v.union(v.literal("contract"), v.literal("labourHire")),
    supervisorId: v.optional(v.id("builderContacts")),
    // Site manager name (free text - for labour hire jobs created by workers)
    siteManager: v.optional(v.string()),
    quotedPrice: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    materialsBudget: v.optional(v.number()),
    // Track cumulative invoiced amount for contract jobs (progress claims)
    totalInvoicedAmount: v.optional(v.number()),
    totalInvoicedPercentage: v.optional(v.number()),
    startDate: v.number(),
    expectedEndDate: v.optional(v.number()),
    actualEndDate: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("active"),
      v.literal("onHold"),
      v.literal("completed"),
      v.literal("invoiced")
    ),
    notes: v.optional(v.string()),
    // Track who created the job and if it was worker-created
    createdByUserId: v.optional(v.id("users")),
    isWorkerCreated: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_builder", ["builderId"])
    .index("by_status", ["status"]),

  // Allocations (worker-to-job assignments)
  allocations: defineTable({
    jobId: v.id("jobs"),
    workerId: v.id("workers"),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    allocationType: v.union(v.literal("fullTime"), v.literal("partial")),
    // Rates are set per job allocation
    payRate: v.number(),
    chargeOutRate: v.number(),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_worker", ["workerId"]),

  // Week Submissions (unified week container - links multiple batches)
  weekSubmissions: defineTable({
    organizationId: v.id("organizations"),
    workerId: v.id("workers"),
    weekStartDate: v.number(), // Monday 00:00:00 timestamp
    // Unified signature for the whole week
    signatureUrl: v.optional(v.string()),
    signatoryName: v.optional(v.string()),
    // Photo URLs from uploaded timesheets (can have multiple)
    photoUrls: v.optional(v.array(v.object({
      url: v.string(),
      jobId: v.id("jobs"),
      daysExtracted: v.array(v.string()), // e.g., ["Monday", "Tuesday", "Wednesday"]
    }))),
    totalHours: v.number(),
    totalDays: v.number(),
    jobCount: v.number(), // Number of different jobs in this week
    status: v.union(
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("partial"), // Some batches approved, some pending
      v.literal("queried")
    ),
    queryNote: v.optional(v.string()),
    submittedAt: v.number(),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_worker", ["workerId"])
    .index("by_worker_week", ["workerId", "weekStartDate"])
    .index("by_status", ["status"]),

  // Timesheet Batches (weekly submissions per job - linked to week submission)
  timesheetBatches: defineTable({
    organizationId: v.id("organizations"),
    workerId: v.id("workers"),
    jobId: v.id("jobs"),
    weekSubmissionId: v.optional(v.id("weekSubmissions")), // Links to unified week
    weekStartDate: v.number(), // Monday 00:00:00 timestamp
    photoUrl: v.optional(v.string()), // Storage ID of uploaded timesheet photo
    signatureUrl: v.optional(v.string()), // Storage ID of signature
    signatoryName: v.optional(v.string()),
    signatoryCompany: v.optional(v.string()),
    totalHours: v.number(),
    status: v.union(
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("queried")
    ),
    queryNote: v.optional(v.string()),
    submittedAt: v.number(),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_worker", ["workerId"])
    .index("by_status", ["status"])
    .index("by_week_submission", ["weekSubmissionId"]),

  // Timesheets (individual daily entries)
  timesheets: defineTable({
    organizationId: v.id("organizations"),
    jobId: v.id("jobs"),
    workerId: v.id("workers"),
    batchId: v.optional(v.id("timesheetBatches")), // Links to weekly batch
    date: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    breakMinutes: v.number(),
    totalHours: v.number(),
    notes: v.optional(v.string()),
    // Track entry source for UI indicators
    entrySource: v.optional(v.union(v.literal("photo"), v.literal("manual"))),
    signatureUrl: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    signatoryName: v.optional(v.string()),
    signatoryCompany: v.optional(v.string()),
    gpsCoords: v.optional(
      v.object({
        latitude: v.number(),
        longitude: v.number(),
      })
    ),
    status: v.union(
      v.literal("submitted"),
      v.literal("approved"),
      v.literal("queried"),
      v.literal("invoiced")
    ),
    queryNote: v.optional(v.string()), // Note when owner queries a timesheet
    submittedAt: v.number(),
    approvedAt: v.optional(v.number()),
    approvedBy: v.optional(v.id("users")),
  })
    .index("by_organization", ["organizationId"])
    .index("by_job", ["jobId"])
    .index("by_worker", ["workerId"])
    .index("by_status", ["status"])
    .index("by_batch", ["batchId"]),

  // Expenses
  expenses: defineTable({
    jobId: v.id("jobs"),
    description: v.string(),
    amount: v.number(),
    category: v.union(
      v.literal("materials"),
      v.literal("equipment"),
      v.literal("transport"),
      v.literal("other")
    ),
    receiptUrl: v.optional(v.string()),
    date: v.number(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }).index("by_job", ["jobId"]),

  // Overheads
  overheads: defineTable({
    organizationId: v.id("organizations"),
    name: v.string(),
    category: v.union(
      v.literal("vehicles"),
      v.literal("insurance"),
      v.literal("communications"),
      v.literal("premises"),
      v.literal("equipment"),
      v.literal("admin"),
      v.literal("other")
    ),
    amount: v.number(),
    frequency: v.union(
      v.literal("weekly"),
      v.literal("fortnightly"),
      v.literal("monthly"),
      v.literal("quarterly"),
      v.literal("annually")
    ),
    effectiveFrom: v.number(),
    effectiveTo: v.optional(v.number()),
    createdAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  // Invoices
  invoices: defineTable({
    organizationId: v.id("organizations"),
    jobId: v.id("jobs"),
    builderId: v.id("builders"),
    invoiceNumber: v.string(),
    amount: v.number(),
    status: v.union(
      v.literal("draft"),
      v.literal("sent"),
      v.literal("paid"),
      v.literal("overdue")
    ),
    dueDate: v.number(),
    sentAt: v.optional(v.number()),
    paidAt: v.optional(v.number()),
    // Contract job progress claim fields
    completionPercentage: v.optional(v.number()), // e.g., 60 for 60% complete
    // Labour hire weekly invoice fields
    weekStart: v.optional(v.number()), // Monday timestamp
    weekEnd: v.optional(v.number()), // Friday timestamp
    lineItems: v.optional(v.array(v.object({
      workerId: v.id("workers"),
      workerName: v.string(),
      hours: v.number(),
      rate: v.number(),
      total: v.number(),
    }))),
    // Xero invoice tracking
    xeroInvoiceId: v.optional(v.string()),
    xeroInvoiceNumber: v.optional(v.string()),
    xeroExportedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_job", ["jobId"])
    .index("by_builder", ["builderId"])
    .index("by_job_week", ["jobId", "weekStart"]),

  // Chat Channels
  chatChannels: defineTable({
    organizationId: v.id("organizations"),
    type: v.union(v.literal("company"), v.literal("job"), v.literal("dm")),
    name: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    participants: v.array(v.id("users")),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_job", ["jobId"]),

  // Chat Messages
  chatMessages: defineTable({
    channelId: v.id("chatChannels"),
    senderId: v.id("users"),
    content: v.string(),
    // Attachments - now supports multiple files
    attachments: v.optional(v.array(v.object({
      url: v.string(),
      type: v.union(v.literal("image"), v.literal("file")),
      name: v.string(),
      size: v.number(),
    }))),
    // Legacy single attachment (keep for backwards compatibility)
    attachmentUrl: v.optional(v.string()),
    readBy: v.array(v.id("users")),
    // Reactions
    reactions: v.optional(v.array(v.object({
      emoji: v.string(),
      userId: v.id("users"),
    }))),
    // Mentions
    mentions: v.optional(v.array(v.id("users"))),
    // Edit/Delete
    editedAt: v.optional(v.number()),
    isDeleted: v.optional(v.boolean()),
    createdAt: v.number(),
  }).index("by_channel", ["channelId"]),

  // Knowledge Docs
  knowledgeDocs: defineTable({
    organizationId: v.optional(v.id("organizations")), // null = global
    title: v.string(),
    sourceUrl: v.optional(v.string()),
    uploadedAt: v.number(),
  }).index("by_organization", ["organizationId"]),

  // Knowledge Chunks (for vector search)
  knowledgeChunks: defineTable({
    docId: v.id("knowledgeDocs"),
    content: v.string(),
    embedding: v.array(v.float64()),
    chunkIndex: v.number(),
  })
    .index("by_doc", ["docId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
    }),

  // Knowledge Query Cache - speeds up repeated questions
  knowledgeCache: defineTable({
    queryHash: v.string(), // MD5/simple hash of normalized query
    normalizedQuery: v.string(), // Lowercased, trimmed query
    answer: v.string(),
    sources: v.array(v.object({
      title: v.string(),
      url: v.optional(v.string()),
    })),
    createdAt: v.number(),
    hitCount: v.number(), // Track popularity
    lastHitAt: v.number(),
  })
    .index("by_query_hash", ["queryHash"])
    .index("by_created_at", ["createdAt"]),

  // Knowledge Conversation Memory - stores recent exchanges for context
  knowledgeConversations: defineTable({
    userId: v.id("users"),
    question: v.string(),
    answerSummary: v.string(), // Compressed version of answer for token efficiency
    parsedContext: v.optional(v.object({
      memberType: v.optional(v.string()),
      timberType: v.optional(v.string()),
      species: v.optional(v.string()),
      size: v.optional(v.string()),
      span: v.optional(v.number()),
      spacing: v.optional(v.number()),
      loadType: v.optional(v.string()),
    })),
    createdAt: v.number(),
    expiresAt: v.number(), // createdAt + 24hrs
  })
    .index("by_user", ["userId"])
    .index("by_expires", ["expiresAt"]),

  // ============================================
  // STRUCTURED KNOWLEDGE BASE (Span Tables etc)
  // ============================================

  // Span table entries - precise lookup data
  spanTables: defineTable({
    memberType: v.union(
      v.literal("bearer"),
      v.literal("joist"),
      v.literal("rafter"),
      v.literal("lintel"),
      v.literal("stud"),
      v.literal("decking_joist"),
      v.literal("ceiling_joist"),
      v.literal("roof_beam")
    ),
    timberType: v.union(
      v.literal("LVL"),
      v.literal("MGP10"),
      v.literal("MGP12"),
      v.literal("MGP15"),
      v.literal("hardwood"),
      v.literal("glulam")
    ),
    species: v.optional(v.string()), // "spotted_gum", "blackbutt", etc.
    stressGrade: v.optional(v.string()), // "F14", "F17", "F27", "E14"
    size: v.string(), // "90x45", "140x45", "190x45"
    width: v.number(), // mm
    depth: v.number(), // mm
    loadType: v.union(
      v.literal("floor"),
      v.literal("roof"),
      v.literal("deck"),
      v.literal("balcony"),
      v.literal("ceiling")
    ),
    spacing: v.number(), // 450, 600, 900 mm
    maxSpan: v.number(), // mm - THE ANSWER
    continuous: v.boolean(), // single vs continuous span
    loadWidth: v.optional(v.number()), // for bearers - floor load width in mm
    roofLoad: v.optional(v.string()), // "sheet", "tile" for roof members
    source: v.string(), // "Wesbeam E14 Guide", "Boral Hardwood Tables"
    sourcePage: v.optional(v.string()),
  })
    .index("by_member_type", ["memberType"])
    .index("by_timber_type", ["timberType"])
    .index("by_species", ["species"])
    .index("by_size", ["size"])
    .index("by_load_type", ["loadType"]),

  // Fastener/connection requirements
  fasteners: defineTable({
    connection: v.string(), // "joist_to_bearer", "bearer_to_post", "rafter_to_plate"
    memberType: v.optional(v.string()), // what's being connected
    method: v.string(), // "skew_nail", "joist_hanger", "bolted", "coach_screw"
    fastenerSpec: v.string(), // "2x 75mm nails", "M12 bolt", "10g x 50mm screws"
    quantity: v.optional(v.number()),
    timberType: v.optional(v.string()), // specific requirements for hardwood
    notes: v.optional(v.string()), // "Pre-drill for hardwood"
    source: v.string(),
  })
    .index("by_connection", ["connection"]),

  // Timber grades and species reference
  timberGrades: defineTable({
    grade: v.string(), // "MGP10", "F17", "LVL-E14"
    species: v.optional(v.string()), // "spotted_gum", "blackbutt"
    stressGrade: v.string(), // "F5", "F8", "F14", "F17", "F27"
    bendingStrength: v.optional(v.number()), // MPa
    durabilityClass: v.optional(v.number()), // 1-4
    commonUses: v.array(v.string()), // ["decking", "bearers", "framing"]
    treatmentRequired: v.string(), // "none", "H2", "H3", "H4"
    inGroundOk: v.boolean(),
    density: v.optional(v.number()), // kg/m3
    source: v.string(),
  })
    .index("by_grade", ["grade"])
    .index("by_species", ["species"]),

  // Xero OAuth Sessions (temporary, for PKCE flow)
  xeroOAuthSessions: defineTable({
    organizationId: v.id("organizations"),
    state: v.string(),
    codeVerifier: v.string(),
    createdAt: v.number(),
    expiresAt: v.number(),
  })
    .index("by_state", ["state"])
    .index("by_organization", ["organizationId"]),
});
