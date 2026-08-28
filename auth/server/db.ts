import Database from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const dbFile = fileURLToPath(new URL("../data.db", import.meta.url));
mkdirSync(dirname(dbFile), { recursive: true });

export const sqlite = new Database(dbFile);
sqlite.pragma("journal_mode = WAL");

export interface DatabaseSchema {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    expiresAt: Date;
    token: string;
    createdAt: Date;
    updatedAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    userId: string;
  };
  account: {
    id: string;
    accountId: string;
    providerId: string;
    userId: string;
    accessToken: string | null;
    refreshToken: string | null;
    idToken: string | null;
    accessTokenExpiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
    scope: string | null;
    password: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  verification: {
    id: string;
    identifier: string;
    value: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
  };
}

export const db = new Kysely<DatabaseSchema>({
  dialect: new SqliteDialect({ database: sqlite }),
});