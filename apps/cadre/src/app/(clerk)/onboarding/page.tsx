import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { OrganizationList } from "@clerk/nextjs";
import { CadreLockup } from "@/components/CadreMark";

export const metadata = { title: "Set up your shop" };

export default async function OnboardingPage() {
  const { orgId } = await auth();
  if (orgId) redirect("/console");
  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col gap-8 px-4 py-12">
      <CadreLockup />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[32px] font-semibold leading-9 tracking-[-0.025em]">Set up your shop</h1>
        <p className="text-muted">
          Create your shop, or pick one you&apos;ve been invited to. You can add staff later.
        </p>
      </div>
      <OrganizationList hidePersonal afterCreateOrganizationUrl="/console" afterSelectOrganizationUrl="/console" />
    </main>
  );
}
