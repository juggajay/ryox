import { redirect } from "next/navigation";

// Sign-up is invite-only - redirect to sign-in
export default function SignUpPage() {
  redirect("/sign-in");
}
