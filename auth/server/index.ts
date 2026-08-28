import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { auth, authOptions } from "./auth.js";
import { db, sqlite } from "./db.js";

const PORT = Number(process.env.AUTH_PORT ?? 4000);

const TEST_EMAIL = process.env.AUTH_TEST_EMAIL ?? "test@docu.com";
const TEST_PASSWORD = process.env.AUTH_TEST_PASSWORD ?? "password";

async function runMigrations() {
  const plan = await getMigrations(authOptions, { throwOnUnsafe: false });
  await plan.runMigrations();
  console.log(
    `[auth] schema ready (${plan.toBeCreated.length} tables, ${plan.toBeAdded.length} columns created)`
  );
}

async function seedTestUser() {
  const existing = sqlite
    .prepare("SELECT id FROM user WHERE email = ?")
    .get(TEST_EMAIL) as { id: string } | undefined;
  if (existing) {
    console.log(`[auth] sample user already present: ${TEST_EMAIL}`);
    return;
  }

  const seedAuth = betterAuth({
    ...authOptions,
    emailAndPassword: { enabled: true, disableSignUp: false },
  });

  try {
    await seedAuth.api.signUpEmail({
      body: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        name: "Test User",
      },
    });
  } catch (err) {
    const stillMissing = !sqlite
      .prepare("SELECT id FROM user WHERE email = ?")
      .get(TEST_EMAIL);
    if (stillMissing) {
      throw new Error(
        `failed to seed sample user: ${err instanceof Error ? err.message : err}`
      );
    }
  }
  console.log(`[auth] sample login ready: ${TEST_EMAIL} / ${TEST_PASSWORD}`);
}

async function main() {
  await runMigrations();
  await seedTestUser();
  const app = new Hono();
  app.on(["GET", "POST", "PUT", "PATCH", "DELETE"], "/api/auth/*", (c) =>
    auth.handler(c.req.raw)
  );
  serve({ fetch: app.fetch, port: PORT }, (info) => {
    console.log(`[auth] DocuVerify auth service listening on :${info.port}`);
  });
}

main().catch((err) => {
  console.error("[auth] failed to start", err);
  process.exit(1);
});