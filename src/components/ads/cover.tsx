import type { CoverKind, Sponsor } from "@/lib/catalog";

/* Stand-in cover art for sponsor cards. In production each sponsor uploads its own cover image
   (16:9, at least 640×360), and this frame shows it the same way: full bleed, rounded by the card. */

const W = "rgb(255 255 255 / 0.92)";
const SOFT = "rgb(255 255 255 / 0.22)";
const FAINT = "rgb(255 255 255 / 0.12)";

function Art({ kind, color }: { kind: CoverKind; color: string }) {
  switch (kind) {
    case "db":
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(196 ${48 + i * 30})`}>
              <rect x="0" y="0" width="84" height="26" fill={i === 0 ? W : SOFT} />
              <ellipse cx="42" cy="26" rx="42" ry="10" fill={i === 0 ? W : SOFT} />
              <ellipse cx="42" cy="0" rx="42" ry="10" fill={i === 0 ? "rgb(255 255 255)" : "rgb(255 255 255 / 0.32)"} />
            </g>
          ))}
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x="40" y={62 + i * 18} width={[96, 70, 110, 54][i]} height="7" rx="3.5" fill={i === 0 ? W : SOFT} />
          ))}
        </g>
      );
    case "deploy":
      return (
        <g>
          <rect x="70" y="36" width="180" height="116" rx="12" fill={W} />
          <rect x="70" y="36" width="180" height="22" rx="12" fill="rgb(255 255 255)" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={84 + i * 10} cy="47" r="3" fill={color} opacity={0.35} />
          ))}
          <rect x="118" y="43" width="96" height="8" rx="4" fill={color} opacity={0.18} />
          <rect x="86" y="72" width="88" height="10" rx="5" fill={color} opacity={0.3} />
          <rect x="86" y="90" width="148" height="7" rx="3.5" fill={color} opacity={0.14} />
          <rect x="86" y="104" width="120" height="7" rx="3.5" fill={color} opacity={0.14} />
          <rect x="86" y="124" width="60" height="16" rx="8" fill={color} />
          <circle cx="246" cy="142" r="20" fill="#16a34a" stroke="rgb(255 255 255)" strokeWidth="4" />
          <path d="m237 142 6 6 12-12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "type":
      return (
        <g>
          <text x="54" y="138" fontFamily="var(--font-display)" fontWeight="700" fontSize="112" fill={W} letterSpacing="-6">
            Aa
          </text>
          <rect x="210" y="58" width="64" height="7" rx="3.5" fill={SOFT} />
          <rect x="210" y="74" width="48" height="7" rx="3.5" fill={SOFT} />
          <rect x="210" y="90" width="58" height="7" rx="3.5" fill={SOFT} />
          <path d="M206 124h72" stroke={W} strokeWidth="3" strokeLinecap="round" />
        </g>
      );
    case "print":
      return (
        <g>
          <rect x="62" y="30" width="96" height="126" rx="6" fill={W} transform="rotate(-6 110 93)" />
          <rect x="74" y="44" width="72" height="72" rx="4" fill={color} opacity={0.35} transform="rotate(-6 110 93)" />
          <rect x="182" y="78" width="66" height="74" rx="10" fill={W} />
          <path d="M248 92h10a14 14 0 0 1 0 28h-10" fill="none" stroke={W} strokeWidth="8" />
          <ellipse cx="215" cy="78" rx="33" ry="7" fill="rgb(255 255 255)" />
        </g>
      );
    case "notes":
      return (
        <g>
          <rect x="96" y="50" width="150" height="100" rx="12" fill={SOFT} transform="rotate(6 171 100)" />
          <rect x="80" y="40" width="150" height="104" rx="12" fill={W} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x="96" y={58 + i * 26} width="14" height="14" rx="4" fill={i < 2 ? color : "none"} stroke={color} strokeWidth="2" opacity={0.85} />
              <rect x="118" y={61 + i * 26} width={[88, 64, 76][i]} height="8" rx="4" fill={color} opacity={0.22} />
            </g>
          ))}
        </g>
      );
    case "laptop":
      return (
        <g>
          <rect x="82" y="34" width="156" height="98" rx="10" fill={W} />
          <rect x="90" y="42" width="140" height="82" rx="5" fill={color} opacity={0.5} />
          <circle cx="160" cy="83" r="20" fill="rgb(255 255 255 / 0.55)" />
          <path d="M60 140h200a8 8 0 0 1-8 10H68a8 8 0 0 1-8-10z" fill={W} />
          <rect x="226" y="30" width="56" height="22" rx="11" fill="rgb(255 255 255)" />
          <text x="254" y="45" textAnchor="middle" fontSize="11" fontWeight="700" fill={color} fontFamily="var(--font-sans)">
            −20%
          </text>
        </g>
      );
    case "course":
      return (
        <g>
          <path d="M56 140 C110 140 110 90 160 90 S210 44 262 44" fill="none" stroke={SOFT} strokeWidth="6" strokeLinecap="round" />
          <path d="M56 140 C110 140 110 90 160 90" fill="none" stroke={W} strokeWidth="6" strokeLinecap="round" />
          {[
            [56, 140, true],
            [108, 116, true],
            [160, 90, true],
            [212, 62, false],
            [262, 44, false],
          ].map(([x, y, done], i) => (
            <circle key={i} cx={x as number} cy={y as number} r="9" fill={done ? "rgb(255 255 255)" : color} stroke="rgb(255 255 255)" strokeWidth="3" />
          ))}
          <rect x="170" y="112" width="84" height="26" rx="13" fill="rgb(255 255 255)" />
          <text x="212" y="129" textAnchor="middle" fontSize="12" fontWeight="700" fill={color} fontFamily="var(--font-sans)">
            Day 12 of 30
          </text>
        </g>
      );
    case "jobs":
      return (
        <g>
          {[0, 1].map((i) => (
            <g key={i} transform={`translate(${66 + i * 22} ${40 + i * 30})`} opacity={i === 0 ? 0.5 : 1}>
              <rect width="168" height="74" rx="12" fill={i === 0 ? SOFT : W} />
              <circle cx="28" cy="28" r="14" fill={color} opacity={0.4} />
              <rect x="52" y="20" width="80" height="8" rx="4" fill={color} opacity={0.35} />
              <rect x="52" y="34" width="54" height="7" rx="3.5" fill={color} opacity={0.18} />
              <rect x="16" y="52" width="44" height="14" rx="7" fill={color} opacity={0.85} />
            </g>
          ))}
        </g>
      );
  }
}

/** Full-bleed 16:9 cover for a sponsor card. The parent sets the rounding and clips it. */
export function Cover({ sponsor, className = "" }: { sponsor: Sponsor; className?: string }) {
  const c = sponsor.color;
  const id = `cv-${sponsor.name.replace(/\W/g, "")}`;
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" className={`block aspect-video w-full ${className}`} role="img" aria-label={`${sponsor.name} cover image`}>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${c} 78%, #fff)` }} />
          <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${c} 70%, #000)` }} />
        </linearGradient>
        <radialGradient id={`${id}-r`} cx="0.85" cy="0.1" r="0.7">
          <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="320" height="180" fill={`url(#${id}-g)`} />
      <rect width="320" height="180" fill={`url(#${id}-r)`} />
      <circle cx="30" cy="190" r="90" fill={FAINT} />
      <Art kind={sponsor.cover ?? "notes"} color={c} />
    </svg>
  );
}
