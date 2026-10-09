CREATE TABLE "images" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"prompt" text NOT NULL,
	"model" text NOT NULL,
	"credits" integer DEFAULT 0 NOT NULL,
	"ref_id" text NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "images_user" ON "images" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "images_ref" ON "images" USING btree ("ref_id");