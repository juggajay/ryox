import BuilderDetailPageClient from "./client";

// Required for static export - dynamic routes loaded at runtime
export function generateStaticParams() {
  return [];
}

export default function BuilderDetailPage() {
  return <BuilderDetailPageClient />;
}
