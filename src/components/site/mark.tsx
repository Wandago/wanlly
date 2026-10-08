/** The Wanlly app icon, drawn inline so it follows the theme. `id` keeps the mask unique per page. */
export function Mark({ size = 26, id = "mark", inverted = false }: { size?: number; id?: string; inverted?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <rect width="64" height="64" fill="#fff" />
          <circle cx="32" cy="26" r="8.8" fill="#000" />
        </mask>
      </defs>
      <rect width="64" height="64" rx="16" className={inverted ? "fill-white" : "fill-fg"} />
      <path
        d="M11 21 L21 44 L32 26 L43 44 L53 21"
        mask={`url(#${id})`}
        fill="none"
        strokeWidth={6.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={inverted ? "stroke-[#0b0c10]" : "stroke-bg"}
      />
      <circle cx="32" cy="26" r="6.2" className="fill-accent" />
    </svg>
  );
}
