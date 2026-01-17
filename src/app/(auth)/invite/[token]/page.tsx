import InvitePageClient from "./client";

// Allow dynamic params at runtime - invite tokens come from Convex
export const dynamicParams = true;

export default function InvitePage() {
  return <InvitePageClient />;
}
