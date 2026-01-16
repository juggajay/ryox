import JobDetailPageClient from "./client";

// Required for static export - dynamic routes loaded at runtime
export function generateStaticParams() {
  return [];
}

export default function JobDetailPage() {
  return <JobDetailPageClient />;
}
