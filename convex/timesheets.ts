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
