CREATE TABLE IF NOT EXISTS "phone_links" (
	"phone_hash" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "phone_links_user_id_unique" UNIQUE("user_id")
);
CREATE TABLE IF NOT EXISTS "whatsapp_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
