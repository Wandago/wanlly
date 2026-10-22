"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/Icon";

const LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: "/console", label: "Overview", icon: "overview" },
  { href: "/console#connections", label: "Connections", icon: "connections" },
  { href: "/console#cadre", label: "Your cadre", icon: "cadre" },
  { href: "/console/activity", label: "Activity", icon: "activity" },
  { href: "/console/settings", label: "Settings", icon: "settings" },
];

export function ConsoleNav({ base = "/console" }: { base?: string }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {LINKS.map((l) => {
        const href = l.href.replace("/console", base);
        const current = !href.includes("#") && pathname === href;
        return (
          <li key={l.href}>
            <Link
              href={href}
              aria-current={current ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-sm px-2.5 py-2 ${
                current ? "bg-hover font-medium text-ink" : "text-muted hover:bg-hover hover:text-ink"
              }`}
            >
              <Icon name={l.icon} />
              {l.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
