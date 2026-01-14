# CarpTrack - Project Context

## Branding

- **Logo**: https://ryoxcarpentry.wordifysites.com/wp-content/uploads/2015/04/33333.png
- **Company**: Ryox Carpentry and Building Solutions

---

## Landing Page Design

### Requirements
- **Theme**: Dark theme (dark background, light text)
- **Style**: Clean, minimal, professional - no marketing fluff
- **Primary Elements**:
  - Ryox Carpentry logo (centered, prominent)
  - Login button
  - Simple tagline (optional)

### Design Specifications

```
┌─────────────────────────────────────────────────────────────┐
│                    LANDING PAGE                             │
├─────────────────────────────────────────────────────────────┤
│  Background: Dark (#0a0a0a or similar dark gray)            │
│  Accent: Subtle gold/amber to match carpentry theme         │
│                                                             │
│  Layout:                                                    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                                                     │    │
│  │              [RYOX LOGO - Large]                    │    │
│  │                                                     │    │
│  │           "Carpentry Business Management"          │    │
│  │                  (subtle tagline)                   │    │
│  │                                                     │    │
│  │              ┌──────────────────┐                   │    │
│  │              │     Sign In      │                   │    │
│  │              └──────────────────┘                   │    │
│  │                                                     │    │
│  │              ┌──────────────────┐                   │    │
│  │              │   Get Started    │                   │    │
│  │              └──────────────────┘                   │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Footer: Minimal - © 2024 Ryox Carpentry                    │
└─────────────────────────────────────────────────────────────┘
```

### Color Palette (Dark Theme)
```css
:root {
  --background: #0a0a0a;
  --foreground: #fafafa;
  --card: #18181b;
  --card-foreground: #fafafa;
  --primary: #d4a574;      /* Warm wood/amber accent */
  --primary-foreground: #0a0a0a;
  --secondary: #27272a;
  --muted: #27272a;
  --muted-foreground: #a1a1aa;
  --border: #27272a;
}
```

### Routes
- `/` - Landing page with logo and login
- `/sign-in` - Sign in page
- `/sign-up` - Sign up page (create organization)
- `/invite/[token]` - Worker invite acceptance page
- `/dashboard` - Main app (authenticated)

## Overview

CarpTrack is a comprehensive business management platform for carpentry businesses operating in Sydney, Australia. The platform manages two revenue models:

1. **Contract/Fixed Price Work** - Jobs quoted at a fixed price; profitability depends on actual labour hours and material costs vs quoted amount
2. **Labour Hire** - Carpenters hired out to builders at hourly rates; business earns margin between worker pay and client charge

## Tech Stack

- **Frontend**: Next.js 14+ (App Router) with TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Convex (real-time database, serverless functions, file storage)
- **Authentication**: Convex Auth (or Clerk integration)
- **AI Services**:
  - Gemini Flash API for timesheet OCR/photo extraction
  - Convex vector search for knowledge base
  - Claude API for knowledge base queries
- **Hosting**: Vercel (frontend), Convex Cloud (backend)
- **Build Process**: Ralph Loop for iterative development

## User Roles & Multi-Tenancy

### Organization Structure
The platform supports **multiple business owners**, each with their own organization:

```
Organization (Business)
├── Owners (multiple admins per org)
├── Workers (belong to one org)
├── Builders (clients of one org)
└── Jobs (owned by one org)
```

### User Roles

| Role | Access Level |
|------|--------------|
| **Owner/Admin** | Full access to org data, financials, settings, user management. Can invite other owners. |
| **Worker** | Mobile access for timesheets, chat, job info, AI knowledge base. Sees only assigned jobs. |
| **Site Supervisor** | Timesheet approval and signing capability (often a builder contact). |

---

## Complete Application Flow

### 1. Onboarding Flow

```
New User Signs Up
       ↓
Create Organization (business name, ABN)
       ↓
User becomes Owner of Organization
       ↓
[Optional] Invite Additional Owners
       ↓
Dashboard (empty state with setup prompts)
```

### 1a. Worker Invite Flow

Owners can invite workers via a secure invite link system:

```
┌─────────────────────────────────────────────────────────────┐
│                 OWNER INVITES WORKER                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Owner goes to Workers → "Invite Worker" button             │
│                                                             │
│  Owner enters:                                              │
│  • Worker's email (optional, for tracking)                  │
│  • Pay rate                                                 │
│  • Charge-out rate                                          │
│  • Trade classification                                     │
│  • Employment type                                          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  System generates unique invite link:                       │
│  https://app.carptrack.com/invite/abc123xyz                 │
│                                                             │
│  • Link contains encrypted invite token                     │
│  • Token expires after 7 days                               │
│  • Owner can copy link or send via email                    │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Worker clicks invite link                                  │
│                                                             │
│  Worker sees pre-filled invite page showing:                │
│  • Organization name                                        │
│  • Their role (Worker)                                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Worker completes their profile:                            │
│                                                             │
│  • Full name                                                │
│  • Phone number                                             │
│  • Email address                                            │
│  • Emergency contact                                        │
│  • Password (create account)                                │
│  • Upload certifications (white card, etc.)                 │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Account created & linked to organization                   │
│                                                             │
│  • Worker profile created with owner-set rates              │
│  • User account linked to worker profile                    │
│  • Worker added to company chat channel                     │
│  • Worker redirected to their dashboard                     │
└─────────────────────────────────────────────────────────────┘
```

**Invite Token Schema:**
```typescript
// Worker Invites
workerInvites: defineTable({
  organizationId: v.id("organizations"),
  token: v.string(), // unique invite token
  email: v.optional(v.string()), // optional pre-filled email
  payRate: v.number(),
  chargeOutRate: v.number(),
  employmentType: v.union(v.literal("employee"), v.literal("subcontractor")),
  tradeClassification: v.string(),
  status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("expired")),
  createdBy: v.id("users"),
  createdAt: v.number(),
  expiresAt: v.number(),
  acceptedAt: v.optional(v.number()),
  acceptedBy: v.optional(v.id("users")),
}).index("by_token", ["token"])
  .index("by_organization", ["organizationId"])
```

### 2. Setup Flow (First-Time Configuration)

```
┌─────────────────────────────────────────────────────────────┐
│                    INITIAL SETUP                            │
├─────────────────────────────────────────────────────────────┤
│  1. Add Workers → Enter profiles, rates, certifications     │
│  2. Add Builders → Client companies with contacts           │
│  3. Configure Overheads → Fixed business costs              │
│  4. [Optional] Upload Knowledge Base docs                   │
└─────────────────────────────────────────────────────────────┘
```

### 3. Core Operational Flow

```
                    ┌──────────────┐
                    │   BUILDER    │
                    │  (Client)    │
                    └──────┬───────┘
                           │ requests work
                           ▼
                    ┌──────────────┐
                    │  CREATE JOB  │
                    │              │
                    │ • Contract   │
                    │   OR         │
                    │ • Labour Hire│
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │  ALLOCATE  │  │   CREATE   │  │  SET UP    │
    │  WORKERS   │  │ JOB CHAT   │  │  BUDGET    │
    │            │  │  CHANNEL   │  │ (contract) │
    └─────┬──────┘  └─────┬──────┘  └────────────┘
          │               │
          │    ┌──────────┴──────────┐
          │    ▼                     ▼
          │  Workers              Owner
          │  notified             monitors
          │    │                     │
          ▼    ▼                     │
    ┌──────────────┐                 │
    │  DAILY WORK  │                 │
    │              │                 │
    │ Workers on   │                 │
    │ site doing   │◄────────────────┘
    │ carpentry    │   (communication via chat)
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   TIMESHEET  │
    │   SUBMISSION │
    │              │
    │ • Digital +  │
    │   signature  │
    │ • Photo +    │
    │   AI extract │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   TIMESHEET  │
    │   APPROVAL   │
    │              │
    │ Owner reviews│
    │ and approves │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   JOB        │
    │   COMPLETION │
    │              │
    │ Mark complete│
    │ Final costs  │
    │ calculated   │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │   INVOICING  │
    │              │
    │ Generate     │
    │ invoice from │
    │ approved     │
    │ timesheets   │
    └──────┬───────┘
           │
           ▼
    ┌──────────────┐
    │ PROFITABILITY│
    │   ANALYSIS   │
    │              │
    │ Gross profit │
    │ - Overhead   │
    │ = Net profit │
    └──────────────┘
```

### 4. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CONVEX DATABASE                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  organizations ──┬── owners (users)                                 │
│                  │                                                  │
│                  ├── workers ──── certifications                    │
│                  │      │                                           │
│                  │      └── allocations ◄──┐                        │
│                  │                         │                        │
│                  ├── builders ─── builder_contacts                  │
│                  │      │                                           │
│                  │      └── jobs ──────────┴── timesheets           │
│                  │            │                    │                │
│                  │            ├── expenses         │                │
│                  │            │                    │                │
│                  │            └── chat_channels ───┼── chat_messages│
│                  │                                 │                │
│                  ├── overheads                     │                │
│                  │                                 │                │
│                  └── invoices ◄────────────────────┘                │
│                                                                     │
│  knowledge_docs ──── knowledge_chunks (vector embeddings)           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5. Worker Mobile Flow

```
Worker Opens App
       ↓
┌──────────────────────────────────────┐
│           WORKER HOME                │
├──────────┬──────────┬────────────────┤
│ My Jobs  │ Timesheet│ Chat  │ AI Help│
└────┬─────┴────┬─────┴───┬───┴────┬───┘
     │          │         │        │
     ▼          ▼         ▼        ▼
┌─────────┐ ┌────────┐ ┌──────┐ ┌──────┐
│See today│ │Submit  │ │Team  │ │Ask   │
│& upcoming│ │hours + │ │chat &│ │building│
│jobs with│ │signature│ │DMs   │ │code  │
│addresses│ │or photo│ │      │ │questions│
└─────────┘ └────────┘ └──────┘ └──────┘
```

### 6. Timesheet Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│                   TIMESHEET SUBMISSION                      │
└─────────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           ▼                               ▼
    ┌─────────────┐                 ┌─────────────┐
    │   DIGITAL   │                 │   PHOTO     │
    │   ENTRY     │                 │   UPLOAD    │
    │             │                 │             │
    │ • Select job│                 │ • Take photo│
    │ • Enter time│                 │   of signed │
    │ • Get client│                 │   timesheet │
    │   signature │                 └──────┬──────┘
    │   on screen │                        │
    └──────┬──────┘                        ▼
           │                        ┌─────────────┐
           │                        │  GEMINI AI  │
           │                        │  EXTRACTION │
           │                        │             │
           │                        │ Extract:    │
           │                        │ • Date      │
           │                        │ • Hours     │
           │                        │ • Worker    │
           │                        │ • Client    │
           │                        │ • Notes     │
           │                        └──────┬──────┘
           │                               │
           │                               ▼
           │                        ┌─────────────┐
           │                        │   WORKER    │
           │                        │   REVIEWS   │
           │                        │   & CONFIRMS│
           │                        └──────┬──────┘
           │                               │
           └───────────────┬───────────────┘
                           ▼
                    ┌─────────────┐
                    │  SUBMITTED  │
                    │  (pending)  │
                    └──────┬──────┘
                           ▼
                    ┌─────────────┐
                    │   OWNER     │
                    │   REVIEWS   │
                    └──────┬──────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  APPROVED   │ │   QUERIED   │ │  REJECTED   │
    │             │ │             │ │             │
    │ Ready for   │ │ Sent back   │ │ Worker must │
    │ invoicing   │ │ for fixes   │ │ resubmit    │
    └─────────────┘ └─────────────┘ └─────────────┘
```

### 7. Profitability Calculation Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  CONTRACT JOB                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Quoted Price: $15,000                                     │
│                                                             │
│   MINUS Direct Costs:                                       │
│   ├── Labour (hours × pay rates)     -$8,500               │
│   ├── Materials                       -$2,200               │
│   └── Other expenses                    -$300               │
│   ────────────────────────────────────────────              │
│   = GROSS PROFIT                       $4,000 (26.7%)       │
│                                                             │
│   MINUS Allocated Overhead:                                 │
│   └── (Hours worked × overhead/hour)  -$1,200               │
│   ────────────────────────────────────────────              │
│   = NET PROFIT                         $2,800 (18.7%)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                  LABOUR HIRE JOB                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Worker: John (40 hours)                                   │
│   ├── Charge-out rate: $85/hr → Revenue: $3,400            │
│   └── Pay rate: $55/hr        → Cost:    $2,200            │
│                                                             │
│   = GROSS MARGIN per worker              $1,200 (35.3%)     │
│                                                             │
│   MINUS Allocated Overhead:              -$480              │
│   ────────────────────────────────────────────              │
│   = NET MARGIN                            $720 (21.2%)      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Modules

### 1. Organizations & Multi-Owner
- Each business is an organization with unique ABN
- Multiple owners can be invited to manage the same organization
- All data scoped to organization ID
- Owners can manage other owners (invite, remove)

### 2. Worker Database
Worker profiles with pay rates, charge-out rates, certifications, and employment details. Tracks certification expiry with alerts at 30/14/7 days.

### 3. Builder/Client Management
Builder profiles with multiple contacts, payment terms, negotiated rates. Tracks relationship metrics and payment history.

### 4. Job Management
Jobs belong to builders, classified as contract or labour hire. Real-time profit tracking.

**Job Statuses**: `pending` → `active` → `on_hold` → `completed` → `invoiced`

### 5. Timesheet System
- Digital entry with on-screen signature capture
- Photo upload with Gemini Flash AI extraction
- GPS location capture (optional)
- Approval workflow

**Timesheet Statuses**: `submitted` → `approved`/`queried` → `invoiced`

### 6. Resource Allocation & Scheduling
Worker-to-job assignments with real-time availability dashboard, timeline view, and conflict detection.

### 7. Overhead Tracking
Fixed costs (vehicles, insurance, comms, premises, equipment, admin) normalized to weekly figures.

### 8. Team Chat
Real-time chat powered by Convex subscriptions:
- Company-wide announcements
- Auto-created job channels
- Direct messages

### 9. AI Knowledge Base
RAG architecture using Convex vector search for Australian building standards (NCC, AS 1684, AS 4440).

---

## Database Schema (Convex)

```typescript
// convex/schema.ts

// Organizations (multi-tenant)
organizations: defineTable({
  name: v.string(),
  abn: v.string(),
  logoUrl: v.optional(v.string()),
  settings: v.optional(v.object({...})),
  createdAt: v.number(),
})

// Users (owners and workers)
users: defineTable({
  clerkId: v.string(),
  email: v.string(),
  name: v.string(),
  role: v.union(v.literal("owner"), v.literal("worker")),
  organizationId: v.id("organizations"),
  workerId: v.optional(v.id("workers")), // linked if role=worker
  createdAt: v.number(),
})

// Workers
workers: defineTable({
  organizationId: v.id("organizations"),
  name: v.string(),
  phone: v.string(),
  email: v.string(),
  emergencyContact: v.object({...}),
  employmentType: v.union(v.literal("employee"), v.literal("subcontractor")),
  tradeClassification: v.union(...),
  payRate: v.number(),
  chargeOutRate: v.number(),
  startDate: v.number(),
  status: v.union(v.literal("active"), v.literal("inactive")),
})

// Certifications
certifications: defineTable({
  workerId: v.id("workers"),
  name: v.string(),
  expiryDate: v.number(),
  documentUrl: v.optional(v.string()),
})

// Builders (clients)
builders: defineTable({
  organizationId: v.id("organizations"),
  companyName: v.string(),
  abn: v.string(),
  paymentTerms: v.number(), // days
  negotiatedRates: v.optional(v.object({...})),
  status: v.union(v.literal("active"), v.literal("inactive")),
})

// Builder Contacts
builderContacts: defineTable({
  builderId: v.id("builders"),
  name: v.string(),
  phone: v.string(),
  email: v.string(),
  role: v.string(),
})

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
  status: v.union(v.literal("pending"), v.literal("active"),
                  v.literal("onHold"), v.literal("completed"),
                  v.literal("invoiced")),
})

// Allocations
allocations: defineTable({
  jobId: v.id("jobs"),
  workerId: v.id("workers"),
  startDate: v.number(),
  endDate: v.optional(v.number()),
  allocationType: v.union(v.literal("fullTime"), v.literal("partial")),
})

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
  gpsCoords: v.optional(v.object({...})),
  status: v.union(v.literal("submitted"), v.literal("approved"),
                  v.literal("queried"), v.literal("invoiced")),
  submittedAt: v.number(),
})

// Expenses
expenses: defineTable({
  jobId: v.id("jobs"),
  description: v.string(),
  amount: v.number(),
  category: v.string(),
  receiptUrl: v.optional(v.string()),
  date: v.number(),
})

// Overheads
overheads: defineTable({
  organizationId: v.id("organizations"),
  name: v.string(),
  category: v.string(),
  amount: v.number(),
  frequency: v.union(v.literal("weekly"), v.literal("fortnightly"),
                     v.literal("monthly"), v.literal("quarterly"),
                     v.literal("annually")),
  effectiveFrom: v.number(),
  effectiveTo: v.optional(v.number()),
})

// Invoices
invoices: defineTable({
  organizationId: v.id("organizations"),
  jobId: v.id("jobs"),
  builderId: v.id("builders"),
  amount: v.number(),
  status: v.union(v.literal("draft"), v.literal("sent"),
                  v.literal("paid"), v.literal("overdue")),
  dueDate: v.number(),
  sentAt: v.optional(v.number()),
  paidAt: v.optional(v.number()),
})

// Chat Channels
chatChannels: defineTable({
  organizationId: v.id("organizations"),
  type: v.union(v.literal("company"), v.literal("job"), v.literal("dm")),
  jobId: v.optional(v.id("jobs")),
  participants: v.array(v.id("users")),
  createdAt: v.number(),
})

// Chat Messages
chatMessages: defineTable({
  channelId: v.id("chatChannels"),
  senderId: v.id("users"),
  content: v.string(),
  attachmentUrl: v.optional(v.string()),
  createdAt: v.number(),
})

// Knowledge Docs
knowledgeDocs: defineTable({
  organizationId: v.optional(v.id("organizations")), // null = global
  title: v.string(),
  sourceUrl: v.optional(v.string()),
  uploadedAt: v.number(),
})

// Knowledge Chunks (for vector search)
knowledgeChunks: defineTable({
  docId: v.id("knowledgeDocs"),
  content: v.string(),
  embedding: v.array(v.float64()),
  chunkIndex: v.number(),
}).vectorIndex("by_embedding", {
  vectorField: "embedding",
  dimensions: 1536,
})

// Worker Invites (for invite link system)
workerInvites: defineTable({
  organizationId: v.id("organizations"),
  token: v.string(),
  email: v.optional(v.string()),
  payRate: v.number(),
  chargeOutRate: v.number(),
  employmentType: v.union(v.literal("employee"), v.literal("subcontractor")),
  tradeClassification: v.string(),
  status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("expired")),
  createdBy: v.id("users"),
  createdAt: v.number(),
  expiresAt: v.number(),
  acceptedAt: v.optional(v.number()),
  acceptedBy: v.optional(v.id("users")),
}).index("by_token", ["token"])
  .index("by_organization", ["organizationId"])
```

---

## Key Business Logic

### Profitability Calculation
- **Gross Profit** = Revenue - Direct Costs (labour, materials)
- **Net Profit** = Gross Profit - Allocated Overhead
- **Overhead per hour** = Total weekly overhead / Team billable capacity

### Worker Rates
- **Pay Rate**: What the business pays the worker
- **Charge-out Rate**: What clients are billed
- Builder-specific negotiated rates override defaults

### Certification Management
- Alerts at 30, 14, 7 days before expiry
- Block allocation of workers with expired mandatory certs

---

## Development Guidelines

### Convex Patterns
- Use `ctx.db.query()` with filters for reads
- Use `ctx.db.insert()`, `ctx.db.patch()`, `ctx.db.delete()` for writes
- Real-time updates via `useQuery()` hooks
- File uploads via `ctx.storage.store()`
- Use indexes for common query patterns

### Security
- Organization-scoped queries (always filter by `organizationId`)
- Role-based access in Convex functions
- Validate user belongs to organization before any operation

### Mobile-First
- PWA with offline capability
- Camera access for timesheet photos
- GPS for location verification

---

## Glossary

| Term | Definition |
|------|------------|
| Contract Job | Work quoted at a fixed price regardless of actual hours |
| Labour Hire | Workers hired out at an hourly rate to clients |
| Charge-out Rate | Hourly rate billed to clients for a worker |
| Pay Rate | Hourly rate paid to the worker |
| Gross Profit | Revenue minus direct costs |
| Net Profit | Gross profit minus allocated overhead |
| Overhead | Fixed business costs not tied to specific jobs |
| Utilisation | Percentage of available hours that are billable |
| RAG | Retrieval Augmented Generation - AI technique for knowledge base |
| NCC | National Construction Code - Australian building regulations |

---

## Implementation Phases

1. **Phase 1**: Core Foundation - Auth, orgs, workers, builders, jobs, basic timesheets
2. **Phase 2**: Enhanced Timesheets & Allocation - Photo AI extraction, scheduling
3. **Phase 3**: Financial & Communication - Overhead tracking, real-time chat
4. **Phase 4**: AI Knowledge Base - Document ingestion, vector search
5. **Phase 5**: Reporting & Polish - Analytics, invoicing, PWA optimization
