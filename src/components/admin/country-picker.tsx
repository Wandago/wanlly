"use client";

import { useState } from "react";
import { Icon } from "../icon";

/* Pick countries by name, with quick groups for the regions Wanlly sells most. Stores ISO codes. */

const CODES =
  "AD AE AF AG AI AL AM AO AR AS AT AU AW AZ BA BB BD BE BF BG BH BI BJ BM BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CK CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GU GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VC VE VN VU WS YE ZA ZM ZW".split(" ");

const GROUPS: [string, string[]][] = [
  ["East Africa", ["KE", "UG", "TZ", "RW", "BI", "ET", "SS", "SO", "DJ"]],
  ["West Africa", ["NG", "GH", "CI", "SN", "CM", "BJ", "TG", "BF", "ML", "NE", "SL", "LR", "GM", "GN"]],
  ["Southern Africa", ["ZA", "ZM", "ZW", "BW", "NA", "MW", "MZ", "LS", "SZ"]],
  ["North Africa", ["EG", "MA", "DZ", "TN", "LY", "SD"]],
  ["South Asia", ["IN", "PK", "BD", "LK", "NP"]],
];

const names = (() => {
  try {
    const d = new Intl.DisplayNames(["en"], { type: "region" });
    return Object.fromEntries(CODES.map((c) => [c, d.of(c) ?? c]));
  } catch {
    return Object.fromEntries(CODES.map((c) => [c, c]));
  }
})();

export function CountryPicker({ value, onChange, input }: { value: string[]; onChange: (codes: string[]) => void; input: string }) {
  const [q, setQ] = useState("");
  const chosen = new Set(value);
  const t = q.trim().toLowerCase();
  const matches = t ? CODES.filter((c) => !chosen.has(c) && (names[c].toLowerCase().includes(t) || c.toLowerCase() === t)).slice(0, 8) : [];
  const add = (codes: string[]) => onChange([...new Set([...value, ...codes])]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {value.length === 0 && <span className="text-xs text-faint">Everywhere</span>}
        {value.map((c) => (
          <span key={c} className="inline-flex items-center gap-1 rounded-full border border-line bg-bg py-0.5 pr-1 pl-2 text-xs">
            {names[c] ?? c}
            <button type="button" aria-label={`Remove ${names[c] ?? c}`} onClick={() => onChange(value.filter((x) => x !== c))} className="grid size-4 place-items-center rounded-full text-muted hover:bg-hover hover:text-fg">
              <Icon name="x" size={10} />
            </button>
          </span>
        ))}
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-xs text-muted underline-offset-2 hover:underline">
            Clear
          </button>
        )}
      </div>
      <div className="relative">
        <input
          className={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches[0]) {
              e.preventDefault();
              add([matches[0]]);
              setQ("");
            }
          }}
          placeholder="Type a country, e.g. Kenya"
          aria-label="Add a country"
        />
        {matches.length > 0 && (
          <ul className="absolute top-full right-0 left-0 z-10 mt-1 overflow-hidden rounded-lg border border-line bg-surface shadow-soft">
            {matches.map((c) => (
              <li key={c}>
                <button
                  type="button"
                  onClick={() => {
                    add([c]);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-[13px] hover:bg-hover"
                >
                  {names[c]}
                  <span className="font-mono text-[11px] text-faint">{c}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {GROUPS.map(([label, codes]) => (
          <button key={label} type="button" onClick={() => add(codes)} className="rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-muted hover:border-faint hover:text-fg">
            + {label}
          </button>
        ))}
      </div>
    </div>
  );
}
