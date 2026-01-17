import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Refresh Xero tokens every 20 minutes to keep them fresh
// Xero access tokens expire after ~30 minutes
// Proactive refresh prevents race conditions when multiple API calls
// happen simultaneously with an expired token
crons.interval(
  "refresh xero tokens",
  { minutes: 20 },
  internal.xero.refreshAllXeroTokens
);

// Clean up expired conversation memory entries every hour
// Conversations older than 24 hours are removed to keep storage lean
crons.interval(
  "cleanup expired conversations",
  { hours: 1 },
  internal.knowledge.cleanupExpiredConversations
);

export default crons;
