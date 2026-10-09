CREATE TABLE "design_versions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"prompt" text NOT NULL,
	"html" text NOT NULL,
	"model_id" text NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_versions" ADD CONSTRAINT "design_versions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "design_versions_project" ON "design_versions" USING btree ("project_id","id");