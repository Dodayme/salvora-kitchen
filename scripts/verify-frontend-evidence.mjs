/** Read-only evidence reconciliation. Does not run tests, browser, DB, gateway or worker. */
import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { createHash } from "node:crypto";
const sources = [
  ["FE-05", "controller/HTTP/PostgreSQL", ".local/fe05/http-result.json"],
  ["FE-05", "browser checkout checkpoint", ".local/fe05/ui-result.json"],
  ["FE-06", "payment client HTTP; provider excluded", ".local/fe06/http-result.json"],
  ["FE-07", "order/review client HTTP", ".local/fe07/http-result.json"],
  ["FE-08", "dashboard client HTTP", ".local/fe08/http-result.json"],
  ["FE-09", "catalog client HTTP", ".local/fe09/http-result.json"],
  ["FE-10", "admin order client HTTP", ".local/fe10/http-result.json"],
  ["FE-10", "browser admin checkpoint", ".local/fe10/ui-result.json"],
  ["FE-11", "account/voucher client HTTP", ".local/fe11/http-result.json"],
];
const entries = [];
for (const [task, scope, file] of sources) {
  try {
    const raw = await readFile(file), value = JSON.parse(raw);
    const status = value.status ?? value.result;
    if (!["PASS", "FAIL", "FAILED"].includes(status)) throw Error("Unrecognized evidence status");
    entries.push({ task, scope, file, sha256: createHash("sha256").update(raw).digest("hex"), timestamp: typeof value.timestamp === "string" && /^\d{4}-\d\d-\d\dT/.test(value.timestamp) ? value.timestamp : null,
      status, cleanup: value.cleanupPass === true || value.cleanup === "PASS" ? "PASS" : "UNCONFIRMED", fingerprintTables: Array.isArray(value.fingerprintTables) ? value.fingerprintTables.length : Number.isInteger(value.fingerprintTables) ? value.fingerprintTables : null,
      browserTested: value.browserTested === true, providerCalls: value.providerCalls === 0 ? 0 : "UNCONFIRMED" });
  } catch { entries.push({ task, scope, file, status: "MISSING_OR_INVALID" }); }
}
const files = ["docs/FE-VERIFICATION.md", "docs/TASKS-FRONTEND.md", "docs/FRONTEND-HANDOFF.md", "README.md"];
let links = 0;
for (const file of files) {
  const content = await readFile(file, "utf8");
  if (content.includes("\0") || /postgres(?:ql)?:\/\/[^\s]+|SB-Mid-server-[A-Za-z0-9_-]{8,}/.test(content)) throw Error("Unsafe documentation pattern");
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1]; if (/^(https?:|#)/.test(target)) continue;
    await access(new URL(target.split("#")[0], new URL(file, `file:///${process.cwd().replaceAll("\\", "/")}/`))); links++;
  }
}
const result = { recordedAt: new Date().toISOString(), kind: "existing evidence index, not a fresh test run", entries, docs: { files: files.length, localLinks: links, unsafePatterns: 0 }, frontendAcceptance: "INCOMPLETE", providerVerifiedByThisScript: false };
await mkdir(".local/fe12", { recursive: true }); await writeFile(".local/fe12/evidence-index.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify({ index: "PASS", entries: entries.length, missingOrInvalid: entries.filter(row => row.status === "MISSING_OR_INVALID").length, failedHistoricalCheckpoints: entries.filter(row => ["FAIL", "FAILED"].includes(row.status)).length, localLinks: links, frontendAcceptance: result.frontendAcceptance, testsRun: false }));
