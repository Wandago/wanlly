-- Token counts for each design version, so Admin can show what the models used.
ALTER TABLE "design_versions" ADD COLUMN IF NOT EXISTS "input_tokens" integer;
ALTER TABLE "design_versions" ADD COLUMN IF NOT EXISTS "output_tokens" integer;
