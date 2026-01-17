import BuilderDetailPageClient from "./client";

// Allow dynamic params at runtime - builder IDs come from Convex
export const dynamicParams = true;

export default function BuilderDetailPage() {
  return <BuilderDetailPageClient />;
}
