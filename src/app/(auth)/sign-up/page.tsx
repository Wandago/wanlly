import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create your account · Wanlly" };

export default function SignUpPage() {
  return <SignUp routing="hash" signInUrl="/sign-in" fallbackRedirectUrl="/app" />;
}
