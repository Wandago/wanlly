CREATE TABLE "admin_actions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" text NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "beta_applications" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "beta_applications" ADD COLUMN "reviewed_by" text;--> statement-breakpoint
ALTER TABLE "contact_messages" ADD COLUMN "handled_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "admin_actions_time" ON "admin_actions" USING btree ("created_at");