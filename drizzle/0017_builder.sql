CREATE TABLE IF NOT EXISTS "build_files" (
	"project_id" bigint NOT NULL REFERENCES "projects"("id"),
	"path" text NOT NULL,
	"content" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "build_files_pk" PRIMARY KEY ("project_id", "path")
);
CREATE TABLE IF NOT EXISTS "build_steps" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" bigint NOT NULL REFERENCES "projects"("id"),
	"role" text NOT NULL,
	"content" jsonb NOT NULL,
	"model_id" text,
	"input_tokens" integer,
	"output_tokens" integer,
	"credits" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "build_steps_project" ON "build_steps" USING btree ("project_id","id");
