CREATE TABLE "advertiser_applications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"company" text NOT NULL,
	"contact_name" text NOT NULL,
	"email" text NOT NULL,
	"website" text,
	"country" text,
	"category" text NOT NULL,
	"budget" text,
	"formats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"network_country" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"application_id" integer,
	"advertiser" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"headline" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"cta" text DEFAULT 'Learn more' NOT NULL,
	"url" text NOT NULL,
	"color" text DEFAULT '#2a78d6' NOT NULL,
	"cover" text,
	"image" text,
	"placements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"max_impressions" integer,
	"cpm_cents" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_application_id_advertiser_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."advertiser_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "campaigns_status" ON "campaigns" USING btree ("status");