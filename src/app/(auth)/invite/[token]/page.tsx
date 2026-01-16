import InvitePageClient from "./client";

// Required for static export - dynamic routes loaded at runtime via Convex
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams(): Promise<{ token: string }[]> {
  // Return at least one placeholder for static export - actual tokens are dynamic
  return [{ token: "placeholder" }];
}

export default function InvitePage() {
  return <InvitePageClient />;
}
