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

export default crons;
