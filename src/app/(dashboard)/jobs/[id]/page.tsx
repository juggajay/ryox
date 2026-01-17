import JobDetailPageClient from "./client";

// Allow dynamic params at runtime - job IDs come from Convex
export const dynamicParams = true;

export default function JobDetailPage() {
  return <JobDetailPageClient />;
}
