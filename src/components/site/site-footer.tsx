import Link from "next/link";
import { Mark } from "./mark";

const COLUMNS = [
  { title: "Product", links: [["Chat", "/#product"], ["Code", "/#product"], ["Design", "/#product"], ["How it's free", "/#how"]] },
  { title: "Company", links: [["About", "/about"], ["Contact", "/contact"], ["Join the beta", "/beta"], ["Advertise", "/contact#advertise"]] },
  { title: "Legal", links: [["Privacy", "/privacy"], ["Terms", "/terms"]] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Mark size={22} id="ftr-mark" />
            <b className="font-display text-base font-semibold tracking-[-0.02em]">Wanlly</b>
          </Link>
          <p className="max-w-[34ch] text-[13px] text-muted">Frontier AI for students and creators everywhere, paid for by sponsors you choose to see.</p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title} className="flex flex-col gap-2.5">
            <span className="text-[11px] font-medium tracking-[0.08em] text-faint uppercase">{c.title}</span>
            {c.links.map(([label, href]) => (
              <Link key={label} href={href} className="text-[13px] text-muted hover:text-fg">
                {label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1180px] flex-wrap gap-3 border-t border-line px-4 py-5 text-xs text-faint sm:px-6">
        <span>© {new Date().getFullYear()} Wanlly. Made in Nairobi.</span>
        <span className="ml-auto">Claude is a trademark of Anthropic. Gemini is a trademark of Google.</span>
      </div>
    </footer>
  );
}
