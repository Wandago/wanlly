CREATE TABLE "app_flags" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"utm_source" text,
	"country" text,
	"device" text NOT NULL,
	"visitor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_devices" (
	"user_id" text NOT NULL,
	"visitor" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_events" ADD COLUMN "creative" text;--> statement-breakpoint
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "page_views_time" ON "page_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "page_views_visitor" ON "page_views" USING btree ("visitor");--> statement-breakpoint
CREATE UNIQUE INDEX "user_devices_pair" ON "user_devices" USING btree ("user_id","visitor");--> statement-breakpoint
CREATE INDEX "user_devices_visitor" ON "user_devices" USING btree ("visitor");