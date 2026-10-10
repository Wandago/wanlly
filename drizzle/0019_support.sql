CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL REFERENCES "users"("id"),
	"email" text,
	"subject" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"page" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "support_tickets_user" ON "support_tickets" ("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "support_tickets_status" ON "support_tickets" ("status", "updated_at");
CREATE TABLE IF NOT EXISTS "support_messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ticket_id" bigint NOT NULL REFERENCES "support_tickets"("id"),
	"from_staff" boolean DEFAULT false NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "support_messages_ticket" ON "support_messages" ("ticket_id", "created_at");
