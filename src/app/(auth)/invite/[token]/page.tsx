import InvitePageClient from "./client";

// Required for static export - returns empty array since invite pages
// are accessed via dynamic links (opened in browser), not pre-rendered
export function generateStaticParams() {
  return [];
}

export default function InvitePage() {
  return <InvitePageClient />;
}
