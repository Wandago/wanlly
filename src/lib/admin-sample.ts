/* SAMPLE DATA for the admin dashboard design. Every number here is made up and deterministic.
   It is replaced by real queries (our own events tables, PostHog, ad network reports) in later steps. */

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export type Day = { date: string; revenue: number; aiCost: number; activeUsers: number; signups: number };

export function sampleDays(n: number): Day[] {
  const r = rng(7);
  const out: Day[] = [];
  const end = Date.UTC(2026, 9, 7);
  for (let i = n - 1; i >= 0; i--) {
    const t = (n - 1 - i) / Math.max(1, n - 1);
    const users = Math.round(180 + 820 * t + r() * 60);
    const revenue = +(users * (0.034 + r() * 0.008)).toFixed(2);
    const aiCost = +(revenue * (0.62 + r() * 0.1)).toFixed(2);
    const d = new Date(end - i * 86400000);
    out.push({ date: d.toISOString().slice(5, 10), revenue, aiCost, activeUsers: users, signups: Math.round(20 + 60 * t + r() * 25) });
  }
  return out;
}

export const AD_FORMATS = [
  { name: "Video spot (rewarded)", impressions: 21840, clicks: 410, fill: 0.71, ecpm: 6.1 },
  { name: "Working card, native", impressions: 64210, clicks: 1095, fill: 0.88, ecpm: 1.4 },
  { name: "Working card, 336×280 / 300×250", impressions: 38900, clicks: 352, fill: 0.81, ecpm: 1.1 },
  { name: "Result line / 320×50", impressions: 71320, clicks: 498, fill: 0.9, ecpm: 0.45 },
  { name: "Side panel 300×600", impressions: 52480, clicks: 203, fill: 0.64, ecpm: 0.9 },
  { name: "Phone bottom banner", impressions: 46110, clicks: 287, fill: 0.86, ecpm: 0.35 },
];

export const NETWORKS = [
  { name: "Google Ad Manager", requests: 182400, bids: 151300, wins: 98200, avgBid: 1.32, timeouts: 0.021 },
  { name: "Network B (video)", requests: 61200, bids: 40100, wins: 18400, avgBid: 4.8, timeouts: 0.044 },
  { name: "Network C (display)", requests: 140300, bids: 88400, wins: 41900, avgBid: 0.74, timeouts: 0.038 },
  { name: "Direct and house ads", requests: 30100, bids: 30100, wins: 21300, avgBid: 0.6, timeouts: 0 },
];

export const COUNTRIES = [
  { name: "Kenya", users: 3120, revPerUser: 0.21, costPerUser: 0.15 },
  { name: "Nigeria", users: 2410, revPerUser: 0.18, costPerUser: 0.13 },
  { name: "India", users: 1980, revPerUser: 0.2, costPerUser: 0.14 },
  { name: "United States", users: 410, revPerUser: 2.3, costPerUser: 1.6 },
  { name: "Ghana", users: 760, revPerUser: 0.17, costPerUser: 0.12 },
  { name: "South Africa", users: 690, revPerUser: 0.42, costPerUser: 0.29 },
  { name: "Philippines", users: 520, revPerUser: 0.26, costPerUser: 0.19 },
  { name: "United Kingdom", users: 240, revPerUser: 1.7, costPerUser: 1.2 },
  { name: "Uganda", users: 610, revPerUser: 0.12, costPerUser: 0.11 },
  { name: "Brazil", users: 330, revPerUser: 0.44, costPerUser: 0.47 },
];

export const SOURCES = [
  { name: "TikTok", visits: 18400, applications: 1210 },
  { name: "X", visits: 9100, applications: 820 },
  { name: "WhatsApp shares", visits: 6200, applications: 940 },
  { name: "Referral links", visits: 4100, applications: 1130 },
  { name: "LinkedIn", visits: 3900, applications: 410 },
  { name: "Direct", visits: 3300, applications: 260 },
  { name: "Product Hunt", visits: 2600, applications: 190 },
  { name: "Search", visits: 1200, applications: 70 },
];

export const FUNNEL = [
  { step: "Visited the beta page", n: 48800 },
  { step: "Applied", n: 5030 },
  { step: "Approved", n: 1200 },
  { step: "Watched a first video", n: 930 },
  { step: "Came back in week 1", n: 610 },
];

export const TOP_CLICKED = [
  { creative: "Railhouse · Deploy preview", format: "Working card, native", tool: "Code", clicks: 312, ctr: 0.031 },
  { creative: "Northbeam DB · Learn more", format: "Working card, native", tool: "Chat", clicks: 244, ctr: 0.019 },
  { creative: "Fieldnote · Notes that organize themselves", format: "Video spot", tool: "Chat", clicks: 198, ctr: 0.012 },
  { creative: "Printwell · See prints", format: "336×280", tool: "Images", clicks: 176, ctr: 0.024 },
  { creative: "Typecase · Get the font", format: "Result line", tool: "Design", clicks: 102, ctr: 0.009 },
];

export const MODELS_USAGE = [
  { name: "Haiku 5.5", requests: 182300, cost: 214.1 },
  { name: "Sonnet 5.5", requests: 31800, cost: 402.7 },
  { name: "Opus 5.5", requests: 4100, cost: 118.3 },
  { name: "Fable 5.1", requests: 620, cost: 39.8 },
];

export type Applicant = { id: string; name: string; country: string; source: string; building: string; referrals: number; risk: "low" | "medium" | "high" };

export const QUEUE: Applicant[] = [
  { id: "a1", name: "Amina W.", country: "Kenya", source: "Referral", building: "A booking app for matatu saccos", referrals: 6, risk: "low" },
  { id: "a2", name: "Tunde A.", country: "Nigeria", source: "X", building: "Invoice generator for small shops", referrals: 2, risk: "low" },
  { id: "a3", name: "Priya S.", country: "India", source: "TikTok", building: "Study planner for exams", referrals: 0, risk: "low" },
  { id: "a4", name: "user_88213", country: "United States", source: "Direct", building: "api", referrals: 0, risk: "high" },
  { id: "a5", name: "Kofi M.", country: "Ghana", source: "WhatsApp", building: "Farm price tracker", referrals: 3, risk: "low" },
  { id: "a6", name: "Leah K.", country: "Kenya", source: "LinkedIn", building: "Portfolio site and blog", referrals: 1, risk: "medium" },
];

export const FLAGGED = [
  { account: "user_88213", signal: "9 accounts on one device", score: 92, action: "Frozen" },
  { account: "kev_dev", signal: "Video completions every 20.0 s exactly", score: 78, action: "Challenged" },
  { account: "promptshop", signal: "Prompts look like another app's requests", score: 71, action: "Slowed down" },
  { account: "nomad_sam", signal: "Network country ≠ phone country", score: 44, action: "Watching" },
];

/** Community pool: funded from revenue already received, spent as a daily floor for everyone. */
export const POOL = {
  balance: 1840,
  spentToday: 84,
  floorUsd: 0.083,
  floorLabel: "10 min of Sonnet · about 1 h of Haiku",
  floorChange: "No change this week (max drop 10% a week)",
  reachedToday: 6120,
  countries: 61,
  sources: [
    { name: "House share (15% of last month's ads)", note: "Paid in", amount: 1520 },
    { name: "Sponsor slice", note: "2 campaigns", amount: 240 },
    { name: "Watch to fund a creator", note: "3,820 videos", amount: 80 },
  ],
  regions: [
    { name: "Africa", onFloor: 0.86, spent: 690 },
    { name: "South Asia", onFloor: 0.81, spent: 540 },
    { name: "Southeast Asia", onFloor: 0.64, spent: 260 },
    { name: "Latin America", onFloor: 0.41, spent: 150 },
    { name: "Europe and North America", onFloor: 0.05, spent: 20 },
  ],
};
