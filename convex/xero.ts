import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateRandomString(length: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  let str = "";
  for (const byte of bytes) {
    str += String.fromCharCode(byte);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ============================================
// QUERIES
// ============================================

// Get Xero connection status for organization
export const getConnectionStatus = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") return { connected: false };

    const org = await ctx.db.get(user.organizationId);
    if (!org?.settings?.xero) {
      return { connected: false };
    }

    const xero = org.settings.xero;
    const now = Date.now();

    // tokenExpiresAt of 0 means refresh token failed - needs full reconnection
    // tokenExpiresAt < now means access token expired but may auto-refresh
    const needsReconnection = xero.tokenExpiresAt === 0;
    const accessTokenExpired = !needsReconnection && xero.tokenExpiresAt < now;

    return {
      connected: true,
      tenantName: xero.tenantName,
      connectedAt: xero.connectedAt,
      lastSyncAt: xero.lastSyncAt,
      tokenExpired: needsReconnection || accessTokenExpired,
      needsReconnection, // Refresh token expired - must re-authenticate
      accessTokenExpired, // Access token expired - will auto-refresh on next API call
    };
  },
});

// Internal query to get OAuth session by state
export const getOAuthSession = internalQuery({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("xeroOAuthSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();
  },
});

// Public query to get OAuth session for callback route
export const getOAuthSessionPublic = query({
  args: { state: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("xeroOAuthSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();

    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;

    return {
      codeVerifier: session.codeVerifier,
      organizationId: session.organizationId,
    };
  },
});

// Internal query to get user
export const getUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// Internal query to get organization
export const getOrganization = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.organizationId);
  },
});

// Internal query to get builder
export const getBuilder = internalQuery({
  args: { builderId: v.id("builders") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.builderId);
  },
});

// Internal query to get builder contacts
export const getBuilderContacts = internalQuery({
  args: { builderId: v.id("builders") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("builderContacts")
      .withIndex("by_builder", (q) => q.eq("builderId", args.builderId))
      .collect();
  },
});

// Internal query to get invoice with details
export const getInvoiceDetails = internalQuery({
  args: { invoiceId: v.id("invoices") },
  handler: async (ctx, args) => {
    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return null;

    const job = await ctx.db.get(invoice.jobId);
    const builder = await ctx.db.get(invoice.builderId);

    return {
      ...invoice,
      job,
      builder,
    };
  },
});

// ============================================
// MUTATIONS
// ============================================

// Start OAuth flow - generate state and code verifier
export const initiateOAuth = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can connect integrations");
    }

    // Generate PKCE code verifier (64 chars) and state (32 chars)
    const codeVerifier = generateRandomString(64);
    const state = generateRandomString(32);

    // Store OAuth session (expires in 10 minutes)
    await ctx.db.insert("xeroOAuthSessions", {
      organizationId: user.organizationId,
      state,
      codeVerifier,
      createdAt: Date.now(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    // Generate code challenge
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Build authorization URL
    const clientId = process.env.XERO_CLIENT_ID;
    const redirectUri = process.env.XERO_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new Error("Xero credentials not configured");
    }

    const scopes = [
      "openid",
      "profile",
      "email",
      "offline_access",
      "accounting.transactions",
      "accounting.contacts",
      "accounting.settings.read",
    ].join(" ");

    const authUrl = new URL("https://login.xero.com/identity/connect/authorize");
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    return { authUrl: authUrl.toString() };
  },
});

// Store Xero tokens after successful OAuth
export const storeTokens = internalMutation({
  args: {
    state: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresIn: v.number(),
    tenantId: v.string(),
    tenantName: v.string(),
  },
  handler: async (ctx, args) => {
    // Find OAuth session by state
    const session = await ctx.db
      .query("xeroOAuthSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();

    if (!session) throw new Error("Invalid OAuth state");
    if (session.expiresAt < Date.now()) throw new Error("OAuth session expired");

    // Get organization
    const org = await ctx.db.get(session.organizationId);
    if (!org) throw new Error("Organization not found");

    // Update organization with Xero settings
    await ctx.db.patch(session.organizationId, {
      settings: {
        ...org.settings,
        xero: {
          tenantId: args.tenantId,
          tenantName: args.tenantName,
          accessToken: args.accessToken,
          refreshToken: args.refreshToken,
          tokenExpiresAt: Date.now() + args.expiresIn * 1000,
          connectedAt: Date.now(),
        },
      },
    });

    // Clean up OAuth session
    await ctx.db.delete(session._id);

    return { success: true, organizationId: session.organizationId };
  },
});

// Update tokens after refresh
export const updateTokens = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresIn: v.number(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org?.settings?.xero) throw new Error("Xero not connected");

    await ctx.db.patch(args.organizationId, {
      settings: {
        ...org.settings,
        xero: {
          ...org.settings.xero,
          accessToken: args.accessToken,
          refreshToken: args.refreshToken,
          tokenExpiresAt: Date.now() + args.expiresIn * 1000,
        },
      },
    });

    return { success: true };
  },
});

// Public mutation to store tokens (called from API route)
export const storeTokensPublic = mutation({
  args: {
    state: v.string(),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresIn: v.number(),
    tenantId: v.string(),
    tenantName: v.string(),
  },
  handler: async (ctx, args) => {
    // Find OAuth session by state
    const session = await ctx.db
      .query("xeroOAuthSessions")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first();

    if (!session) throw new Error("Invalid OAuth state");
    if (session.expiresAt < Date.now()) throw new Error("OAuth session expired");

    // Get organization
    const org = await ctx.db.get(session.organizationId);
    if (!org) throw new Error("Organization not found");

    // Update organization with Xero settings
    await ctx.db.patch(session.organizationId, {
      settings: {
        ...org.settings,
        xero: {
          tenantId: args.tenantId,
          tenantName: args.tenantName,
          accessToken: args.accessToken,
          refreshToken: args.refreshToken,
          tokenExpiresAt: Date.now() + args.expiresIn * 1000,
          connectedAt: Date.now(),
        },
      },
    });

    // Clean up OAuth session
    await ctx.db.delete(session._id);

    return { success: true, organizationId: session.organizationId };
  },
});

// Disconnect Xero
export const disconnect = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can disconnect integrations");
    }

    const org = await ctx.db.get(user.organizationId);
    if (!org) throw new Error("Organization not found");

    // Remove Xero settings but keep other settings
    const { xero, ...otherSettings } = org.settings || {};
    await ctx.db.patch(user.organizationId, {
      settings: Object.keys(otherSettings).length > 0 ? otherSettings : undefined,
    });

    return { success: true };
  },
});

// Update builder with Xero contact ID
export const updateBuilderXeroId = internalMutation({
  args: {
    builderId: v.id("builders"),
    xeroContactId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.builderId, {
      xeroContactId: args.xeroContactId,
      xeroContactSyncedAt: Date.now(),
    });
    return { success: true };
  },
});

// Update invoice with Xero invoice ID
export const updateInvoiceXeroId = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    xeroInvoiceId: v.string(),
    xeroInvoiceNumber: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.invoiceId, {
      xeroInvoiceId: args.xeroInvoiceId,
      xeroInvoiceNumber: args.xeroInvoiceNumber,
      xeroExportedAt: Date.now(),
    });
    return { success: true };
  },
});

// ============================================
// ACTIONS (External API calls)
// ============================================

// Helper to refresh token if needed
async function ensureValidToken(
  ctx: any,
  org: any
): Promise<{ accessToken: string; refreshed: boolean }> {
  const xero = org.settings?.xero;
  if (!xero) throw new Error("Xero not connected");

  // Check if token expires within 60 seconds
  if (xero.tokenExpiresAt > Date.now() + 60000) {
    return { accessToken: xero.accessToken, refreshed: false };
  }

  // Refresh the token
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Xero credentials not configured");
  }

  const response = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: xero.refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh Xero token: ${error}. Please reconnect to Xero.`);
  }

  const data = await response.json();

  // Store new tokens
  await ctx.runMutation(internal.xero.updateTokens, {
    organizationId: org._id,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  });

  return { accessToken: data.access_token, refreshed: true };
}

// Helper for Xero API requests
async function xeroApiRequest(
  url: string,
  method: string,
  accessToken: string,
  tenantId: string,
  body?: object
): Promise<any> {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": tenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Xero API error (${response.status})`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.Message || errorJson.Detail || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Sync builder to Xero contacts
export const syncContact = action({
  args: {
    userId: v.id("users"),
    builderId: v.id("builders"),
  },
  returns: v.object({
    success: v.boolean(),
    xeroContactId: v.string(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; xeroContactId: string }> => {
    // Get user and verify permissions
    const user = await ctx.runQuery(internal.xero.getUser, { userId: args.userId });
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can sync contacts");
    }

    // Get organization with Xero settings
    const org = await ctx.runQuery(internal.xero.getOrganization, {
      organizationId: user.organizationId,
    });
    if (!org?.settings?.xero) throw new Error("Xero not connected");

    // Ensure valid token
    const { accessToken } = await ensureValidToken(ctx, org);
    const tenantId = org.settings.xero.tenantId;

    // Get builder details
    const builder = await ctx.runQuery(internal.xero.getBuilder, {
      builderId: args.builderId,
    });
    if (!builder) throw new Error("Builder not found");

    // Get primary contact
    const contacts = await ctx.runQuery(internal.xero.getBuilderContacts, {
      builderId: args.builderId,
    });
    const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

    // Build Xero contact object
    const xeroContact: any = {
      Name: builder.companyName,
      TaxNumber: builder.abn,
      IsCustomer: true,
      PaymentTerms: {
        Sales: {
          Day: builder.paymentTerms,
          Type: "DAYSAFTERBILLDATE",
        },
      },
    };

    if (primaryContact) {
      const nameParts = primaryContact.name.split(" ");
      xeroContact.ContactPersons = [
        {
          FirstName: nameParts[0] || "",
          LastName: nameParts.slice(1).join(" ") || "",
          EmailAddress: primaryContact.email,
        },
      ];
    }

    let xeroContactId = builder.xeroContactId;

    if (xeroContactId) {
      // Update existing contact
      xeroContact.ContactID = xeroContactId;
      await xeroApiRequest(
        `https://api.xero.com/api.xro/2.0/Contacts/${xeroContactId}`,
        "POST",
        accessToken,
        tenantId,
        { Contacts: [xeroContact] }
      );
    } else {
      // Create new contact
      const response = await xeroApiRequest(
        "https://api.xero.com/api.xro/2.0/Contacts",
        "POST",
        accessToken,
        tenantId,
        { Contacts: [xeroContact] }
      );
      xeroContactId = response.Contacts[0].ContactID;
    }

    // At this point xeroContactId is always defined (either existing or newly created)
    if (!xeroContactId) {
      throw new Error("Failed to create or retrieve Xero contact ID");
    }

    // Update builder with Xero contact ID
    await ctx.runMutation(internal.xero.updateBuilderXeroId, {
      builderId: args.builderId,
      xeroContactId,
    });

    return { success: true, xeroContactId };
  },
});

// Internal version of syncContact for cross-action calls
export const syncContactInternal = internalAction({
  args: {
    userId: v.id("users"),
    builderId: v.id("builders"),
  },
  returns: v.object({
    success: v.boolean(),
    xeroContactId: v.string(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; xeroContactId: string }> => {
    // Get user and verify permissions
    const user = await ctx.runQuery(internal.xero.getUser, { userId: args.userId });
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can sync contacts");
    }

    // Get organization with Xero settings
    const org = await ctx.runQuery(internal.xero.getOrganization, {
      organizationId: user.organizationId,
    });
    if (!org?.settings?.xero) throw new Error("Xero not connected");

    // Ensure valid token
    const { accessToken } = await ensureValidToken(ctx, org);
    const tenantId = org.settings.xero.tenantId;

    // Get builder details
    const builder = await ctx.runQuery(internal.xero.getBuilder, {
      builderId: args.builderId,
    });
    if (!builder) throw new Error("Builder not found");

    // Get primary contact
    const contacts = await ctx.runQuery(internal.xero.getBuilderContacts, {
      builderId: args.builderId,
    });
    const primaryContact = contacts.find((c) => c.isPrimary) || contacts[0];

    // Build Xero contact object
    const xeroContact: Record<string, unknown> = {
      Name: builder.companyName,
      TaxNumber: builder.abn,
      IsCustomer: true,
      PaymentTerms: {
        Sales: {
          Day: builder.paymentTerms,
          Type: "DAYSAFTERBILLDATE",
        },
      },
    };

    if (primaryContact) {
      const nameParts = primaryContact.name.split(" ");
      xeroContact.ContactPersons = [
        {
          FirstName: nameParts[0] || "",
          LastName: nameParts.slice(1).join(" ") || "",
          EmailAddress: primaryContact.email,
        },
      ];
    }

    let xeroContactId = builder.xeroContactId;

    if (xeroContactId) {
      // Update existing contact
      xeroContact.ContactID = xeroContactId;
      await xeroApiRequest(
        `https://api.xero.com/api.xro/2.0/Contacts/${xeroContactId}`,
        "POST",
        accessToken,
        tenantId,
        { Contacts: [xeroContact] }
      );
    } else {
      // Create new contact
      const response = await xeroApiRequest(
        "https://api.xero.com/api.xro/2.0/Contacts",
        "POST",
        accessToken,
        tenantId,
        { Contacts: [xeroContact] }
      );
      xeroContactId = response.Contacts[0].ContactID;
    }

    // At this point xeroContactId is always defined
    if (!xeroContactId) {
      throw new Error("Failed to create or retrieve Xero contact ID");
    }

    // Update builder with Xero contact ID
    await ctx.runMutation(internal.xero.updateBuilderXeroId, {
      builderId: args.builderId,
      xeroContactId,
    });

    return { success: true, xeroContactId };
  },
});

// Export invoice to Xero
export const exportInvoice = action({
  args: {
    userId: v.id("users"),
    invoiceId: v.id("invoices"),
  },
  returns: v.object({
    success: v.boolean(),
    xeroInvoiceId: v.string(),
    xeroInvoiceNumber: v.string(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; xeroInvoiceId: string; xeroInvoiceNumber: string }> => {
    // Get user and verify permissions
    const user = await ctx.runQuery(internal.xero.getUser, { userId: args.userId });
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can export invoices");
    }

    // Get organization with Xero settings
    const org = await ctx.runQuery(internal.xero.getOrganization, {
      organizationId: user.organizationId,
    });
    if (!org?.settings?.xero) throw new Error("Xero not connected");

    // Ensure valid token
    const { accessToken } = await ensureValidToken(ctx, org);
    const tenantId = org.settings.xero.tenantId;

    // Get invoice with details
    const invoice = await ctx.runQuery(internal.xero.getInvoiceDetails, {
      invoiceId: args.invoiceId,
    });
    if (!invoice) throw new Error("Invoice not found");
    if (invoice.xeroInvoiceId) throw new Error("Invoice already exported to Xero");

    // Ensure builder has Xero contact
    let xeroContactId = invoice.builder?.xeroContactId;
    if (!xeroContactId) {
      // Auto-sync contact first
      const contactResult = await ctx.runAction(internal.xero.syncContactInternal, {
        userId: args.userId,
        builderId: invoice.builderId,
      });
      xeroContactId = contactResult.xeroContactId;
    }

    // Get account code based on job type
    const accountCodes = org.settings.xero.accountCodes;
    const accountCode =
      invoice.job?.jobType === "labourHire"
        ? accountCodes?.labourAccount || "200"
        : accountCodes?.contractAccount || "200";

    // Format due date
    const dueDate = new Date(invoice.dueDate).toISOString().split("T")[0];

    // Build Xero invoice
    const xeroInvoice = {
      Type: "ACCREC",
      Contact: { ContactID: xeroContactId },
      DueDate: dueDate,
      Reference: invoice.invoiceNumber,
      Status: "DRAFT",
      LineItems: [
        {
          Description: invoice.job
            ? `${invoice.job.name} - ${invoice.job.siteAddress}`
            : "Services",
          Quantity: 1,
          UnitAmount: invoice.amount,
          AccountCode: accountCode,
        },
      ],
    };

    // Create invoice in Xero
    const response = await xeroApiRequest(
      "https://api.xero.com/api.xro/2.0/Invoices",
      "POST",
      accessToken,
      tenantId,
      { Invoices: [xeroInvoice] }
    );

    const createdInvoice = response.Invoices[0];

    // Update CarpTrack invoice with Xero details
    await ctx.runMutation(internal.xero.updateInvoiceXeroId, {
      invoiceId: args.invoiceId,
      xeroInvoiceId: createdInvoice.InvoiceID,
      xeroInvoiceNumber: createdInvoice.InvoiceNumber,
    });

    return {
      success: true,
      xeroInvoiceId: createdInvoice.InvoiceID,
      xeroInvoiceNumber: createdInvoice.InvoiceNumber,
    };
  },
});

// ============================================
// SYNC FROM XERO
// ============================================

// Internal mutation to update invoice status from Xero
export const updateInvoiceFromXero = internalMutation({
  args: {
    invoiceId: v.id("invoices"),
    xeroStatus: v.string(),
    amountPaid: v.optional(v.number()),
    amountDue: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Map Xero status to CarpTrack status
    let status: "draft" | "sent" | "paid" | "overdue" = "draft";

    switch (args.xeroStatus) {
      case "DRAFT":
        status = "draft";
        break;
      case "SUBMITTED":
      case "AUTHORISED":
        status = "sent";
        break;
      case "PAID":
        status = "paid";
        break;
      case "VOIDED":
      case "DELETED":
        // Keep current status for voided/deleted
        return { updated: false, reason: "Invoice voided or deleted in Xero" };
      default:
        status = "sent";
    }

    const invoice = await ctx.db.get(args.invoiceId);
    if (!invoice) return { updated: false, reason: "Invoice not found" };

    // Update if status changed
    const updates: Record<string, unknown> = {};

    if (invoice.status !== status) {
      updates.status = status;

      if (status === "paid" && !invoice.paidAt) {
        updates.paidAt = Date.now();
      }
      if (status === "sent" && !invoice.sentAt) {
        updates.sentAt = Date.now();
      }
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.invoiceId, updates);
      return { updated: true, newStatus: status };
    }

    return { updated: false, reason: "No changes" };
  },
});

// Sync single invoice status from Xero
export const syncInvoiceStatus = action({
  args: {
    userId: v.id("users"),
    invoiceId: v.id("invoices"),
  },
  returns: v.object({
    success: v.boolean(),
    status: v.optional(v.string()),
    message: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; status?: string; message?: string }> => {
    // Get user and verify permissions
    const user = await ctx.runQuery(internal.xero.getUser, { userId: args.userId });
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can sync invoices");
    }

    // Get organization with Xero settings
    const org = await ctx.runQuery(internal.xero.getOrganization, {
      organizationId: user.organizationId,
    });
    if (!org?.settings?.xero) throw new Error("Xero not connected");

    // Get invoice details
    const invoice = await ctx.runQuery(internal.xero.getInvoiceDetails, {
      invoiceId: args.invoiceId,
    });
    if (!invoice) throw new Error("Invoice not found");
    if (!invoice.xeroInvoiceId) {
      return { success: false, message: "Invoice not exported to Xero yet" };
    }

    // Ensure valid token
    const { accessToken } = await ensureValidToken(ctx, org);
    const tenantId = org.settings.xero.tenantId;

    // Fetch invoice from Xero
    const response = await xeroApiRequest(
      `https://api.xero.com/api.xro/2.0/Invoices/${invoice.xeroInvoiceId}`,
      "GET",
      accessToken,
      tenantId
    );

    if (!response.Invoices || response.Invoices.length === 0) {
      return { success: false, message: "Invoice not found in Xero" };
    }

    const xeroInvoice = response.Invoices[0];

    // Update local invoice status
    const result = await ctx.runMutation(internal.xero.updateInvoiceFromXero, {
      invoiceId: args.invoiceId,
      xeroStatus: xeroInvoice.Status,
      amountPaid: xeroInvoice.AmountPaid,
      amountDue: xeroInvoice.AmountDue,
    });

    return {
      success: true,
      status: xeroInvoice.Status,
      message: result.updated ? `Status updated to ${result.newStatus}` : "No changes needed",
    };
  },
});

// Sync all invoices for organization from Xero
export const syncAllInvoices = action({
  args: {
    userId: v.id("users"),
  },
  returns: v.object({
    success: v.boolean(),
    synced: v.number(),
    updated: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; synced: number; updated: number; errors: number }> => {
    // Get user and verify permissions
    const user = await ctx.runQuery(internal.xero.getUser, { userId: args.userId });
    if (!user || user.role !== "owner") {
      throw new Error("Only owners can sync invoices");
    }

    // Get organization with Xero settings
    const org = await ctx.runQuery(internal.xero.getOrganization, {
      organizationId: user.organizationId,
    });
    if (!org?.settings?.xero) {
      return { success: false, synced: 0, updated: 0, errors: 0 };
    }

    // Get all invoices with Xero IDs
    const invoices = await ctx.runQuery(internal.xero.getInvoicesWithXeroId, {
      organizationId: user.organizationId,
    });

    if (invoices.length === 0) {
      return { success: true, synced: 0, updated: 0, errors: 0 };
    }

    // Ensure valid token
    const { accessToken } = await ensureValidToken(ctx, org);
    const tenantId = org.settings.xero.tenantId;

    // Build comma-separated list of Xero invoice IDs
    const xeroIds = invoices.map(inv => inv.xeroInvoiceId).join(",");

    // Fetch all invoices from Xero in one request
    const response = await xeroApiRequest(
      `https://api.xero.com/api.xro/2.0/Invoices?IDs=${xeroIds}`,
      "GET",
      accessToken,
      tenantId
    );

    let updated = 0;
    let errors = 0;

    // Create a map for quick lookup
    const xeroInvoiceMap = new Map<string, { Status: string; AmountPaid: number; AmountDue: number }>();
    for (const xeroInv of response.Invoices || []) {
      xeroInvoiceMap.set(xeroInv.InvoiceID, xeroInv);
    }

    // Update each invoice
    for (const invoice of invoices) {
      const xeroInvoice = xeroInvoiceMap.get(invoice.xeroInvoiceId!);
      if (!xeroInvoice) {
        errors++;
        continue;
      }

      try {
        const result = await ctx.runMutation(internal.xero.updateInvoiceFromXero, {
          invoiceId: invoice._id,
          xeroStatus: xeroInvoice.Status,
          amountPaid: xeroInvoice.AmountPaid,
          amountDue: xeroInvoice.AmountDue,
        });

        if (result.updated) {
          updated++;
        }
      } catch {
        errors++;
      }
    }

    return {
      success: true,
      synced: invoices.length,
      updated,
      errors,
    };
  },
});

// Internal query to get all invoices with Xero IDs for an organization
export const getInvoicesWithXeroId = internalQuery({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const invoices = await ctx.db
      .query("invoices")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    // Filter to only invoices with Xero IDs
    return invoices.filter(inv => inv.xeroInvoiceId);
  },
});

// ============================================
// PROACTIVE TOKEN REFRESH (for cron jobs)
// ============================================

// Internal query to get all organizations with Xero connections
export const getAllXeroConnectedOrgs = internalQuery({
  args: {},
  handler: async (ctx) => {
    const organizations = await ctx.db.query("organizations").collect();

    // Filter to only orgs with Xero settings
    return organizations
      .filter((org) => org.settings?.xero?.refreshToken)
      .map((org) => ({
        _id: org._id,
        name: org.name,
        tokenExpiresAt: org.settings?.xero?.tokenExpiresAt || 0,
        refreshToken: org.settings?.xero?.refreshToken || "",
        tenantName: org.settings?.xero?.tenantName || "",
      }));
  },
});

// Internal mutation to mark Xero connection as requiring reconnection
export const markTokenExpired = internalMutation({
  args: { organizationId: v.id("organizations") },
  handler: async (ctx, args) => {
    const org = await ctx.db.get(args.organizationId);
    if (!org?.settings?.xero) return { success: false };

    // Set tokenExpiresAt to 0 to indicate expired/requires reconnection
    await ctx.db.patch(args.organizationId, {
      settings: {
        ...org.settings,
        xero: {
          ...org.settings.xero,
          tokenExpiresAt: 0,
        },
      },
    });

    return { success: true };
  },
});

// Internal action to refresh token for a single organization (used by cron)
// Only refreshes if token expires within 25 minutes to avoid unnecessary API calls
const REFRESH_THRESHOLD_MS = 25 * 60 * 1000; // 25 minutes

export const refreshTokenForOrg = internalAction({
  args: { organizationId: v.id("organizations") },
  returns: v.object({
    success: v.boolean(),
    skipped: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; skipped?: boolean; error?: string }> => {
    const org = await ctx.runQuery(internal.xero.getOrganization, {
      organizationId: args.organizationId,
    });

    if (!org?.settings?.xero?.refreshToken) {
      return { success: false, error: "No Xero connection" };
    }

    const xero = org.settings.xero;

    // Skip refresh if token still has plenty of time (more than 25 minutes)
    if (xero.tokenExpiresAt > Date.now() + REFRESH_THRESHOLD_MS) {
      return { success: true, skipped: true };
    }

    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return { success: false, error: "Xero credentials not configured" };
    }

    try {
      const response = await fetch("https://identity.xero.com/connect/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: xero.refreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Xero token refresh failed for org ${args.organizationId}: ${errorText}`);

        // Mark the token as expired so UI shows reconnect prompt
        await ctx.runMutation(internal.xero.markTokenExpired, {
          organizationId: args.organizationId,
        });

        return { success: false, error: `Token refresh failed: ${errorText}` };
      }

      const data = await response.json();

      // Store new tokens
      await ctx.runMutation(internal.xero.updateTokens, {
        organizationId: args.organizationId,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      });

      console.log(`Xero token refreshed for org ${args.organizationId}`);
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Xero token refresh error for org ${args.organizationId}: ${message}`);
      return { success: false, error: message };
    }
  },
});

// Internal action to refresh all Xero tokens (called by cron job)
export const refreshAllXeroTokens = internalAction({
  args: {},
  returns: v.object({
    processed: v.number(),
    refreshed: v.number(),
    skipped: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx): Promise<{ processed: number; refreshed: number; skipped: number; failed: number }> => {
    const connectedOrgs = await ctx.runQuery(internal.xero.getAllXeroConnectedOrgs, {});

    if (connectedOrgs.length === 0) {
      return { processed: 0, refreshed: 0, skipped: 0, failed: 0 };
    }

    let refreshed = 0;
    let skipped = 0;
    let failed = 0;

    for (const org of connectedOrgs) {
      const result = await ctx.runAction(internal.xero.refreshTokenForOrg, {
        organizationId: org._id,
      });

      if (result.success) {
        if (result.skipped) {
          skipped++;
        } else {
          refreshed++;
        }
      } else {
        failed++;
        console.error(`Failed to refresh token for org ${org._id} (${org.tenantName}): ${result.error}`);
      }
    }

    // Only log if something interesting happened
    if (refreshed > 0 || failed > 0) {
      console.log(`Xero token refresh: ${refreshed} refreshed, ${skipped} skipped, ${failed} failed`);
    }

    return { processed: connectedOrgs.length, refreshed, skipped, failed };
  },
});
