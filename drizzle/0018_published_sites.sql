CREATE TABLE IF NOT EXISTS "published_sites" (
	"slug" text PRIMARY KEY NOT NULL,
	"project_id" bigint NOT NULL UNIQUE REFERENCES "projects"("id"),
	"owner_id" text NOT NULL REFERENCES "users"("id"),
	"html" text NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
