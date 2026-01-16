import BuilderDetailPageClient from "./client";

// Required for static export - dynamic routes loaded at runtime via Convex
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ id: string }[]> {
  // Return at least one placeholder for static export - actual IDs are dynamic
  return [{ id: "placeholder" }];
}

export default function BuilderDetailPage() {
  return <BuilderDetailPageClient />;
}
