ALTER TABLE "beta_applications" ADD COLUMN IF NOT EXISTS "first_touch" jsonb;--> statement-breakpoint
ALTER TABLE "beta_applications" ADD COLUMN IF NOT EXISTS "channel" text;