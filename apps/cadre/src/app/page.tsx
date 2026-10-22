import Link from "next/link";
import { CadreLockup } from "@/components/CadreMark";

const POINTS = [
  { title: "Every shilling logged", body: "Paybill, Till, personal line or Pochi. Cadre reads every M-Pesa payment and matches it." },
  { title: "One useful message a morning", body: "What came in, who owes you, and the few things that need your call." },
  { title: "Nothing moves without you", body: "Your cadre asks before it speaks for your shop, and always before money leaves." },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-[1040px] flex-col gap-16 px-4 py-8 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <CadreLockup />
        <Link href="/sign-in" className="rounded-sm px-3 py-2 text-sm font-medium text-muted hover:bg-hover hover:text-ink">
          Sign in
        </Link>
      </header>

      <section className="flex max-w-[720px] flex-col gap-5">
        <span className="eyebrow">For shops in Kenya</span>
        <h1 className="font-display text-[40px] font-semibold leading-[1.05] tracking-[-0.03em] sm:text-[56px]">
          A team that keeps your shop moving. <span className="text-tangerine">On WhatsApp.</span>
        </h1>
        <p className="max-w-[560px] text-[17px] text-muted">
          Set Cadre up once here. After that it texts you your money, your debts and your reports, and you reply with a
          tap.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/sign-up" className="rounded-sm bg-tangerine px-5 py-3 text-sm font-semibold text-on-tangerine">
            Get started
          </Link>
          <Link href="/sign-in" className="rounded-sm border border-line px-5 py-3 text-sm font-medium hover:bg-hover">
            I have an account
          </Link>
        </div>
      </section>

      <ul className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
        {POINTS.map((p) => (
          <li key={p.title} className="flex flex-col gap-1.5 rounded-md border border-line bg-surface p-5">
            <span className="font-semibold">{p.title}</span>
            <span className="text-sm text-muted">{p.body}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
