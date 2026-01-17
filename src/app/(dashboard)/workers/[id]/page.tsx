import WorkerDetailPageClient from "./client";

// Allow dynamic params at runtime - worker IDs come from Convex
export const dynamicParams = true;

export default function WorkerDetailPage() {
  return <WorkerDetailPageClient />;
}
