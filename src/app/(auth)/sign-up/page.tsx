import type { Metadata } from "next";
import { SignUpGate } from "@/components/auth/sign-up-gate";

export const metadata: Metadata = { title: "Create your account · Wanlly" };

export default function SignUpPage() {
  return <SignUpGate />;
}
