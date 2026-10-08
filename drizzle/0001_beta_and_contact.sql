CREATE TABLE "beta_applications" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"country" text,
	"build" text NOT NULL,
	"source" text,
	"referral_code" text,
	"invite_code" text NOT NULL,
	"network_country" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"network_country" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "beta_email" ON "beta_applications" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "beta_invite_code" ON "beta_applications" USING btree ("invite_code");