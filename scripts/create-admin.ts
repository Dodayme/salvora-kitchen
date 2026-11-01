import nextEnv from "@next/env";
import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hash } from "bcryptjs";
import { z } from "zod";
import { createDatabaseClient } from "../src/lib/db/client";

nextEnv.loadEnvConfig(process.cwd(), true, { info: () => {}, error: () => {} });
const db = createDatabaseClient();
try {
  if (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "production") throw new Error("Local internal provisioning only");
  const explicit = Boolean(process.env.SEED_ADMIN_EMAIL || process.env.SEED_ADMIN_PASSWORD);
  const email = z.email().parse(explicit ? process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() : "admin.demo@salvora.example.test");
  const password = z.string().min(12).refine(value => Buffer.byteLength(value, "utf8") <= 72).parse(explicit ? process.env.SEED_ADMIN_PASSWORD : randomBytes(24).toString("base64url"));
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new Error("Existing accounts are never promoted or reset by this script");
  const credentialsFile = join(process.cwd(), ".local", "admin-demo.json");
  if (!explicit && existsSync(credentialsFile)) throw new Error("Refusing to overwrite credentials file");
  const id = `admin-${randomBytes(16).toString("hex")}`;
  // Hold the DB transaction until the new local credential file is written.
  await db.$transaction(async tx => {
    await tx.user.create({ data: { id, email, name: "Admin Demo Salvora", role: "ADMIN", passwordHash: await hash(password, 12) } });
    if (!explicit) {
      mkdirSync(join(process.cwd(), ".local"), { recursive: true });
      writeFileSync(credentialsFile, JSON.stringify({ email, password }, null, 2), { flag: "wx", mode: 0o600 });
    }
  });
  console.log(explicit ? "Admin internal dibuat dengan kredensial dari environment; tidak dicetak." : "Admin demo baru dibuat. Kredensial hanya di .local/admin-demo.json (diabaikan Git); tidak dicetak ke terminal.");
} catch {
  console.error("Admin tidak dibuat. Periksa input/config atau akun yang sudah ada; script tidak mempromosikan, mereset, atau menimpa akun/kredensial lama.");
  process.exitCode = 1;
} finally { await db.$disconnect(); }
