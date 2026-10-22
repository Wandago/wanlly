// Line icons on a 24px grid, 1.7px stroke, as the Wanlly design system asks.
const PATHS = {
  overview: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  connections: "M9 7V3M15 7V3M7 7h10v4a5 5 0 0 1-10 0zM12 16v5",
  cadre: "M12 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM5 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm7 2a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM6 8l4.5 6.5M12 6v8M18 8l-4.5 6.5",
  activity: "M5 4h10l4 4v12H5zM9 12h6M9 16h4",
  settings: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.4-1.4M5.6 18.4 7 17M17 17l1.4 1.4M5.6 5.6 7 7",
  check: "M20 6 9 17l-5-5",
  circle: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z",
  lock: "M5 11h14v9H5zM8 11V8a4 4 0 0 1 8 0v3",
  whatsapp: "M4 5h16v11H9l-5 4z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, label }: { name: IconName; size?: number; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "check" ? 2.2 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
