import { SignIn } from "@clerk/nextjs";
import { CadreLockup } from "@/components/CadreMark";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <CadreLockup />
      <SignIn />
    </main>
  );
}
