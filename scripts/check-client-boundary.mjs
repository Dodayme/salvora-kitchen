/** FE client graph + production browser artifacts only. Never print secret values. */
import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname, extname, relative } from "node:path";
import ts from "typescript";
import { parse } from "dotenv";

const root = process.cwd();
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(resolve(directory, entry.name)) : resolve(directory, entry.name)))).flat();
}
const entries = [...await files(resolve(root, "src/components")), resolve(root, "src/app/dev/ui/ui-preview.tsx"), ...["http/client.ts", "format.ts", "utils.ts"].map(file => resolve(root, "src/lib", file))].filter(file => /\.[cm]?[jt]sx?$/.test(file));
const visited = new Set(), failures = [];
async function visit(file) {
  if (visited.has(file)) return; visited.add(file);
  const source = await readFile(file, "utf8"), ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const imports = [];
  function walk(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || ts.isIdentifier(node.expression) && node.expression.text === "require")) {
      if (node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) imports.push(node.arguments[0].text);
      else failures.push("dynamic_import");
    }
    ts.forEachChild(node, walk);
  }
  walk(ast);
  for (const specifier of imports) {
    if (/^(server-only|@prisma\/|pg$|bcryptjs$|node:)/.test(specifier)) failures.push("server_import");
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      const base = specifier.startsWith("@/") ? resolve(root, "src", specifier.slice(2)) : resolve(dirname(file), specifier);
      if (/[/\\](generated|server|config)[/\\]/.test(base)) failures.push("server_path");
      const candidates = extname(base) ? [base] : [base + ".ts", base + ".tsx", resolve(base, "index.ts"), resolve(base, "index.tsx")];
      let found;
      for (const candidate of candidates) { try { await readFile(candidate); found = candidate; break; } catch (error) { if (error.code !== "ENOENT") throw error; } }
      if (!found) failures.push("unresolved_import"); else await visit(found);
    }
  }
  if (/process\.env\.(?!NEXT_PUBLIC_)[A-Z_]+/.test(source)) failures.push("private_environment_read");
}
for (const entry of entries) await visit(entry);

const privateNames = ["DATABASE_URL", "TEST_DATABASE_URL", "AUTH_SECRET", "MIDTRANS_SERVER_KEY"];
const privateValues = new Set(privateNames.map(name => process.env[name]).filter(value => value?.length >= 12));
for (const name of [".env", ".env.local", ".env.production", ".env.production.local"]) {
  let content; try { content = await readFile(resolve(root, name), "utf8"); } catch (error) { if (error.code === "ENOENT") continue; throw error; }
  const values = parse(content);
  for (const key of privateNames) if (values[key]?.length >= 12) privateValues.add(values[key]);
}
const artifacts = (await files(resolve(root, ".next/static"))).filter(file => /\.(js|css|map)$/.test(file) && !relative(resolve(root, ".next/static"), file).split(/[/\\]/).includes("development"));
if (!artifacts.length) throw Error("Build produksi diperlukan sebelum pemeriksaan bundle.");
for (const artifact of artifacts) {
  const content = await readFile(artifact, "utf8");
  if (/\b(?:DATABASE_URL|TEST_DATABASE_URL|AUTH_SECRET|MIDTRANS_SERVER_KEY|PrismaClient)\b/.test(content)) failures.push("server_marker_in_browser_artifact");
  for (const value of privateValues) {
    if ([value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)].some(candidate => content.includes(candidate))) failures.push("private_value_in_browser_artifact");
  }
}
if (failures.length) {
  console.error(JSON.stringify({ status: "FAILED", categories: [...new Set(failures)], sourceFiles: visited.size, browserArtifacts: artifacts.length }));
  process.exitCode = 1;
} else console.log(JSON.stringify({ status: "PASS", sourceFiles: visited.size, browserArtifacts: artifacts.length, privateValuesChecked: privateValues.size, scope: "FE source graph + production .next/static; no server artifacts, database or network calls" }));
