import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Helper to calculate hours from time strings
function calculateHours(
  startTime: string,
  endTime: string,
  breakMinutes: number
): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const totalMinutes = endMinutes - startMinutes - breakMinutes;
  return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimals
}

// Submit a new timesheet
export const submit = mutation({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
    date: v.number(),
    startTime: v.string(),
    endTime: v.string(),
    breakMinutes: v.number(),
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
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "worker") throw new Error("Only workers can submit timesheets");

    const worker = user.workerId ? await ctx.db.get(user.workerId) : null;
    if (!worker) throw new Error("Worker profile not found");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.organizationId !== user.organizationId) throw new Error("Unauthorized");

    const totalHours = calculateHours(args.startTime, args.endTime, args.breakMinutes);

    const timesheetId = await ctx.db.insert("timesheets", {
      organizationId: user.organizationId,
      jobId: args.jobId,
      workerId: worker._id,
      date: args.date,
      startTime: args.startTime,
      endTime: args.endTime,
      breakMinutes: args.breakMinutes,
      totalHours,
      notes: args.notes,
      signatureUrl: args.signatureUrl,
      photoUrl: args.photoUrl,
      signatoryName: args.signatoryName,
      signatoryCompany: args.signatoryCompany,
      gpsCoords: args.gpsCoords,
      status: "submitted",
      submittedAt: Date.now(),
    });

    return timesheetId;
  },
});

// List timesheets with filters
export const list = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.string()),
    jobId: v.optional(v.id("jobs")),
    workerId: v.optional(v.id("workers")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    let timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    // Filter by status
    if (args.status) {
      timesheets = timesheets.filter((t) => t.status === args.status);
    }

    // Filter by job
    if (args.jobId) {
      timesheets = timesheets.filter((t) => t.jobId === args.jobId);
    }

    // Filter by worker (or own timesheets if worker role)
    if (args.workerId) {
      timesheets = timesheets.filter((t) => t.workerId === args.workerId);
    } else if (user.role === "worker" && user.workerId) {
      timesheets = timesheets.filter((t) => t.workerId === user.workerId);
    }

    // Sort by date descending
    timesheets.sort((a, b) => b.date - a.date);

    // Limit results
    if (args.limit) {
      timesheets = timesheets.slice(0, args.limit);
    }

    // Enrich with job and worker details
    const enriched = await Promise.all(
      timesheets.map(async (t) => {
        const job = await ctx.db.get(t.jobId);
        const worker = await ctx.db.get(t.workerId);
        return { ...t, job, worker };
      })
    );

    return enriched;
  },
});

// Get single timesheet with details
export const get = query({
  args: {
    userId: v.id("users"),
    timesheetId: v.id("timesheets"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet) throw new Error("Timesheet not found");
    if (timesheet.organizationId !== user.organizationId)
      throw new Error("Unauthorized");

    const job = await ctx.db.get(timesheet.jobId);
    const worker = await ctx.db.get(timesheet.workerId);

    return { ...timesheet, job, worker };
  },
});

// Approve timesheet (owner only)
export const approve = mutation({
  args: {
    userId: v.id("users"),
    timesheetId: v.id("timesheets"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can approve timesheets");

    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet) throw new Error("Timesheet not found");
    if (timesheet.organizationId !== user.organizationId)
      throw new Error("Unauthorized");

    await ctx.db.patch(args.timesheetId, {
      status: "approved",
      approvedAt: Date.now(),
      approvedBy: args.userId,
    });

    return { success: true };
  },
});

// Query timesheet (request changes) - owner only
export const queryTimesheet = mutation({
  args: {
    userId: v.id("users"),
    timesheetId: v.id("timesheets"),
    queryNote: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can query timesheets");

    const timesheet = await ctx.db.get(args.timesheetId);
    if (!timesheet) throw new Error("Timesheet not found");
    if (timesheet.organizationId !== user.organizationId)
      throw new Error("Unauthorized");

    await ctx.db.patch(args.timesheetId, {
      status: "queried",
      queryNote: args.queryNote,
    });

    return { success: true };
  },
});

// Get pending timesheets count for dashboard
export const getPendingCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return 0;

    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    return timesheets.filter((t) => t.status === "submitted").length;
  },
});

// Generate upload URL for signature/photo
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Get storage URL from storage ID
export const getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Extract timesheet data from photo using Gemini
export const extractFromPhoto = mutation({
  args: {
    userId: v.id("users"),
    photoStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get photo URL
    const photoUrl = await ctx.storage.getUrl(args.photoStorageId as any);
    if (!photoUrl) throw new Error("Photo not found");

    // Call Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error("Gemini API key not configured");

    // Fetch image and convert to base64
    const imageResponse = await fetch(photoUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract timesheet data from this image. Return a JSON object with these fields:
                - date (YYYY-MM-DD format)
                - startTime (HH:MM format, 24hr)
                - endTime (HH:MM format, 24hr)
                - breakMinutes (number)
                - signatoryName (person who signed)
                - signatoryCompany (company name if visible)
                - notes (any work description)

                If a field is not visible, use null. Return ONLY valid JSON, no markdown.`,
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    try {
      // Parse JSON from response (strip markdown if present)
      const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
      const extracted = JSON.parse(cleanText);
      return {
        success: true,
        data: extracted,
        photoStorageId: args.photoStorageId,
      };
    } catch {
      return {
        success: false,
        error: "Could not parse extracted data",
        raw: text,
        photoStorageId: args.photoStorageId,
      };
    }
  },
});

// ========================================
// WEEKLY TIMESHEET FUNCTIONS
// ========================================

// Extract weekly timesheet data from photo using Gemini
export const extractWeeklyFromPhoto = mutation({
  args: {
    userId: v.id("users"),
    photoStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Get photo URL
    const photoUrl = await ctx.storage.getUrl(args.photoStorageId as any);
    if (!photoUrl) throw new Error("Photo not found");

    // Call Gemini API
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) throw new Error("Gemini API key not configured");

    // Fetch image and convert to base64
    const imageResponse = await fetch(photoUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString("base64");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Extract ALL timesheet entries from this weekly timesheet image.

Return a JSON object with this exact structure:
{
  "entries": [
    {
      "dayOfWeek": "Monday",
      "date": "2025-01-13",
      "startTime": "06:30",
      "endTime": "15:30",
      "breakMinutes": 30
    }
  ],
  "signatoryName": "Name of person who signed",
  "signatoryCompany": "Company name if visible",
  "totalHours": 60,
  "siteName": "Site/job name if visible",
  "workerName": "Worker name if visible"
}

Rules:
- Extract ALL rows that have times filled in (typically Mon-Sun)
- Skip any rows with no times (days not worked)
- Times must be in 24hr HH:MM format (e.g., 06:30, 15:30)
- Dates must be in YYYY-MM-DD format
- If break time is not visible, assume 30 minutes for full days, 0 for short days
- Extract the signature/site manager name if visible
- Return ONLY valid JSON, no markdown code blocks`,
                },
                {
                  inline_data: {
                    mime_type: "image/jpeg",
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

    try {
      // Parse JSON from response (strip markdown if present)
      const cleanText = text.replace(/```json\n?|\n?```/g, "").trim();
      const extracted = JSON.parse(cleanText);
      return {
        success: true,
        data: extracted,
        photoStorageId: args.photoStorageId,
      };
    } catch {
      return {
        success: false,
        error: "Could not parse extracted data",
        raw: text,
        photoStorageId: args.photoStorageId,
      };
    }
  },
});

// Submit a weekly timesheet (creates batch + daily entries)
export const submitWeeklyTimesheet = mutation({
  args: {
    userId: v.id("users"),
    jobId: v.id("jobs"),
    weekStartDate: v.number(), // Monday timestamp
    entries: v.array(
      v.object({
        date: v.number(),
        startTime: v.string(),
        endTime: v.string(),
        breakMinutes: v.number(),
      })
    ),
    photoUrl: v.optional(v.string()),
    signatureUrl: v.optional(v.string()),
    signatoryName: v.optional(v.string()),
    signatoryCompany: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "worker") throw new Error("Only workers can submit timesheets");

    const worker = user.workerId ? await ctx.db.get(user.workerId) : null;
    if (!worker) throw new Error("Worker profile not found");

    const job = await ctx.db.get(args.jobId);
    if (!job) throw new Error("Job not found");
    if (job.organizationId !== user.organizationId) throw new Error("Unauthorized");

    // Calculate total hours for all entries
    let totalHours = 0;
    const entriesWithHours = args.entries.map((entry) => {
      const hours = calculateHours(entry.startTime, entry.endTime, entry.breakMinutes);
      totalHours += hours;
      return { ...entry, totalHours: hours };
    });

    // Create the batch record
    const batchId = await ctx.db.insert("timesheetBatches", {
      organizationId: user.organizationId,
      workerId: worker._id,
      jobId: args.jobId,
      weekStartDate: args.weekStartDate,
      photoUrl: args.photoUrl,
      signatureUrl: args.signatureUrl,
      signatoryName: args.signatoryName,
      signatoryCompany: args.signatoryCompany,
      totalHours: Math.round(totalHours * 100) / 100,
      status: "submitted",
      submittedAt: Date.now(),
    });

    // Create individual timesheet entries for each day
    const timesheetIds = [];
    for (const entry of entriesWithHours) {
      const timesheetId = await ctx.db.insert("timesheets", {
        organizationId: user.organizationId,
        jobId: args.jobId,
        workerId: worker._id,
        batchId,
        date: entry.date,
        startTime: entry.startTime,
        endTime: entry.endTime,
        breakMinutes: entry.breakMinutes,
        totalHours: entry.totalHours,
        notes: args.notes,
        signatoryName: args.signatoryName,
        signatoryCompany: args.signatoryCompany,
        status: "submitted",
        submittedAt: Date.now(),
      });
      timesheetIds.push(timesheetId);
    }

    return { batchId, timesheetIds, totalHours };
  },
});

// Approve a weekly batch (owner only)
export const approveWeeklyBatch = mutation({
  args: {
    userId: v.id("users"),
    batchId: v.id("timesheetBatches"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can approve timesheets");

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.organizationId !== user.organizationId) throw new Error("Unauthorized");

    // Update batch status
    await ctx.db.patch(args.batchId, {
      status: "approved",
      approvedAt: Date.now(),
      approvedBy: args.userId,
    });

    // Update all linked timesheets
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .collect();

    for (const timesheet of timesheets) {
      await ctx.db.patch(timesheet._id, {
        status: "approved",
        approvedAt: Date.now(),
        approvedBy: args.userId,
      });
    }

    return { success: true, count: timesheets.length };
  },
});

// Query a weekly batch (request changes) - owner only
export const queryWeeklyBatch = mutation({
  args: {
    userId: v.id("users"),
    batchId: v.id("timesheetBatches"),
    queryNote: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");
    if (user.role !== "owner") throw new Error("Only owners can query timesheets");

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.organizationId !== user.organizationId) throw new Error("Unauthorized");

    // Update batch status
    await ctx.db.patch(args.batchId, {
      status: "queried",
      queryNote: args.queryNote,
    });

    // Update all linked timesheets
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .collect();

    for (const timesheet of timesheets) {
      await ctx.db.patch(timesheet._id, {
        status: "queried",
        queryNote: args.queryNote,
      });
    }

    return { success: true, count: timesheets.length };
  },
});

// List weekly batches (for owner approval view)
export const listWeeklyBatches = query({
  args: {
    userId: v.id("users"),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    let batches = await ctx.db
      .query("timesheetBatches")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    // Filter by status
    if (args.status) {
      batches = batches.filter((b) => b.status === args.status);
    }

    // Sort by submission date descending
    batches.sort((a, b) => b.submittedAt - a.submittedAt);

    // Limit results
    if (args.limit) {
      batches = batches.slice(0, args.limit);
    }

    // Enrich with worker and job details
    const enriched = await Promise.all(
      batches.map(async (batch) => {
        const worker = await ctx.db.get(batch.workerId);
        const job = await ctx.db.get(batch.jobId);

        // Get linked timesheets for this batch
        const timesheets = await ctx.db
          .query("timesheets")
          .withIndex("by_batch", (q) => q.eq("batchId", batch._id))
          .collect();

        return { ...batch, worker, job, timesheets };
      })
    );

    return enriched;
  },
});

// Get weekly batches for a specific worker (history view)
export const getWorkerWeeklyBatches = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    // Workers see their own batches, owners see all
    let batches;
    if (user.role === "worker" && user.workerId) {
      batches = await ctx.db
        .query("timesheetBatches")
        .withIndex("by_worker", (q) => q.eq("workerId", user.workerId!))
        .collect();
    } else {
      batches = await ctx.db
        .query("timesheetBatches")
        .withIndex("by_organization", (q) =>
          q.eq("organizationId", user.organizationId)
        )
        .collect();
    }

    // Sort by week date descending
    batches.sort((a, b) => b.weekStartDate - a.weekStartDate);

    // Limit results
    if (args.limit) {
      batches = batches.slice(0, args.limit);
    }

    // Enrich with worker and job details
    const enriched = await Promise.all(
      batches.map(async (batch) => {
        const worker = await ctx.db.get(batch.workerId);
        const job = await ctx.db.get(batch.jobId);

        // Get linked timesheets
        const timesheets = await ctx.db
          .query("timesheets")
          .withIndex("by_batch", (q) => q.eq("batchId", batch._id))
          .collect();

        return { ...batch, worker, job, timesheets };
      })
    );

    return enriched;
  },
});

// Get pending batch count for dashboard
export const getPendingBatchCount = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return 0;

    const batches = await ctx.db
      .query("timesheetBatches")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", user.organizationId)
      )
      .collect();

    return batches.filter((b) => b.status === "submitted").length;
  },
});

// Get single weekly batch with all details
export const getWeeklyBatch = query({
  args: {
    userId: v.id("users"),
    batchId: v.id("timesheetBatches"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
    if (batch.organizationId !== user.organizationId) throw new Error("Unauthorized");

    const worker = await ctx.db.get(batch.workerId);
    const job = await ctx.db.get(batch.jobId);

    // Get linked timesheets
    const timesheets = await ctx.db
      .query("timesheets")
      .withIndex("by_batch", (q) => q.eq("batchId", batch._id))
      .collect();

    // Sort timesheets by date
    timesheets.sort((a, b) => a.date - b.date);

    return { ...batch, worker, job, timesheets };
  },
});
