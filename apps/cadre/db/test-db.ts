// Test database helpers. Tests that need Postgres run only when TEST_DATABASE_ADMIN_URL is
// set (a superuser on a throwaway database), e.g. postgres://postgres:postgres@localhost:5432/cadre_test
import pg from "pg";
import { migrate } from "../scripts/migrate.mjs";

export const adminUrl = process.env.TEST_DATABASE_ADMIN_URL;

export function appUrl(): string {
  const u = new URL(adminUrl!);
  u.username = "cadre_app_login";
  u.password = "cadre_test";
  return u.toString();
}

export async function admin<T>(fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const c = new pg.Client({ connectionString: adminUrl });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

/** Empties the database, runs every migration, and sets up the app's login role. */
export async function resetDatabase(): Promise<void> {
  await admin(async (c) => {
    await c.query("drop schema public cascade; create schema public;");
  });
  await migrate(adminUrl!, () => {});
  await admin(async (c) => {
    await c.query(`do $$ begin
      create role cadre_app_login login password 'cadre_test';
    exception when duplicate_object then null; end $$;`);
    await c.query("grant cadre_app to cadre_app_login");
  });
}
