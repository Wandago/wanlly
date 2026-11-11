export type Env = {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_URL: string;
  MAIL_FROM: string;
  RESEND_API_KEY?: string;
  DEV_SHOW_LINKS?: string;
};
export type User = { id: number; email: string; name: string };
export type Business = {
  id: number; slug: string; name: string; industry: string; tagline: string; about: string; address: string;
  phone: string; whatsapp: string; contact_email: string; currency: string; timezone: string; brand: string;
  slot_minutes: number; notice_hours: number;
};
export type Service = { id: number; business_id: number; name: string; group_name: string; duration_min: number; price: string; description: string; active: number; sort: number };
export type PayMethod = { id: number; kind: string; label: string; details: string; instructions: string };
export type Vars = { user: User | null };
