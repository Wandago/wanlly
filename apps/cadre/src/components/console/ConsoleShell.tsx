import { CadreLockup } from "@/components/CadreMark";
import { ConsoleNav } from "./ConsoleNav";

/** Sidebar and main column. account is the signed-in person's menu (Clerk's, or a stand-in in previews). */
export function ConsoleShell({
  shopName,
  account,
  base,
  children,
}: {
  shopName: string;
  account: React.ReactNode;
  base?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <nav
        aria-label="Console"
        className="flex flex-[1_1_240px] flex-col gap-1 border-r border-line bg-sidebar px-3.5 py-5"
      >
        <div className="px-2 pb-5">
          <CadreLockup />
        </div>
        <ConsoleNav base={base} />
        <div className="mt-auto flex items-center gap-2.5 px-1.5 pt-6">
          {account}
          <div className="flex min-w-0 flex-col text-sm leading-tight">
            <span className="truncate">{shopName}</span>
            <span className="text-xs text-muted">Your shop</span>
          </div>
        </div>
      </nav>
      <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-7 px-4 pb-10 pt-7 sm:px-8">{children}</main>
    </div>
  );
}
