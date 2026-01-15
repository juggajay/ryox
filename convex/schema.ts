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
    quotedPrice: v.optional(v.number()),
    estimatedHours: v.optional(v.number()),
    materialsBudget: v.optional(v.number()),
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

  // Timesheets
  timesheets: defineTable({
    organizationId: v.id("organizations"),
    jobId: v.id("jobs"),
    workerId: v.id("workers"),
    date: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    breakMinutes: v.number(),
    totalHours: v.number(),
    notes: v.optional(v.string()),
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
    .index("by_status", ["status"]),

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
    // Xero invoice tracking
    xeroInvoiceId: v.optional(v.string()),
    xeroInvoiceNumber: v.optional(v.string()),
    xeroExportedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_organization", ["organizationId"])
    .index("by_job", ["jobId"])
    .index("by_builder", ["builderId"]),

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
    attachmentUrl: v.optional(v.string()),
    readBy: v.array(v.id("users")),
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
