import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { db } from "./db.js";

export const authOptions: BetterAuthOptions = {
  database: { db, type: "sqlite", casing: "camel" } as never,
  baseURL: process.env.AUTH_BASE_URL ?? "http://localhost:5173",
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "docuverify-dev-secret-change-me-in-prod",
  trustedOrigins: [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
  ],
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
};

export const auth = betterAuth(authOptions);