/** The Cadre mark: three members of the team joined to one tangerine node. */
export function CadreMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true" className="shrink-0">
      <rect width="30" height="30" rx="8" fill="var(--ink)" />
      <path d="M8 9 L15 19 M15 7 L15 19 M22 9 L15 19" stroke="var(--paper)" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="8" cy="9" r="2" fill="var(--paper)" />
      <circle cx="15" cy="7" r="2" fill="var(--paper)" />
      <circle cx="22" cy="9" r="2" fill="var(--paper)" />
      <circle cx="15" cy="20" r="3.6" fill="var(--tangerine)" />
    </svg>
  );
}

export function CadreLockup() {
  return (
    <div className="flex items-center gap-2.5">
      <CadreMark />
      <div className="flex flex-col leading-tight">
        <span className="font-display text-[21px] font-semibold tracking-[-0.02em]">Cadre</span>
        <span className="text-xs text-muted">by Wanlly</span>
      </div>
    </div>
  );
}
