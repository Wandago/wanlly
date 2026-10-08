import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in · Wanlly" };

export default function SignInPage() {
  return <SignIn routing="hash" signUpUrl="/sign-up" fallbackRedirectUrl="/" />;
}
