import { SignUp } from "@clerk/nextjs";
import { CadreLockup } from "@/components/CadreMark";

export const metadata = { title: "Get started" };

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12">
      <CadreLockup />
      <SignUp />
    </main>
  );
}
