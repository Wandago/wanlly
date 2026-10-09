"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "../icon";
import { Mark } from "./mark";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how", label: "How it's free" },
  { href: "/about", label: "About" },
  { href: "/advertise", label: "Advertise" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-[1180px] items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Wanlly home">
          <Mark size={24} id="hdr-mark" />
          <b className="font-display text-[17px] font-semibold tracking-[-0.02em]">Wanlly</b>
        </Link>
        <nav aria-label="Site" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-[13px] hover:bg-hover hover:text-fg ${path === l.href ? "text-fg" : "text-muted"}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/sign-in" className="hidden rounded-lg px-3 py-1.5 text-[13px] text-muted hover:bg-hover hover:text-fg sm:block">
            Sign in
          </Link>
          <Link href="/beta" className="rounded-full bg-fg px-3.5 py-1.5 text-[13px] font-semibold text-bg hover:opacity-90">
            Join the beta
          </Link>
          <button type="button" aria-label="Menu" aria-expanded={open} onClick={() => setOpen(!open)} className="grid rounded-lg p-1.5 hover:bg-hover md:hidden">
            <Icon name={open ? "x" : "menu"} />
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Site" className="flex flex-col border-t border-line px-4 py-2 md:hidden">
          {[...LINKS, { href: "/sign-in", label: "Sign in" }].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-lg px-2 py-2.5 text-sm text-muted hover:bg-hover hover:text-fg">
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
