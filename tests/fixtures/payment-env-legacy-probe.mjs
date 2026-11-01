// Reproduce only the former env-loader expression. Never call/load env or DB.
import nextEnv from "@next/env";
let status = "UNEXPECTED_AVAILABLE";
try { if (typeof nextEnv.loadEnvConfig === "function") status = "DEFAULT_LOADER_AVAILABLE"; }
catch (error) { status = error instanceof TypeError ? "DEFAULT_EXPORT_TYPE_ERROR" : "OTHER_ERROR"; }
console.log(JSON.stringify({ status }));
if (status === "DEFAULT_EXPORT_TYPE_ERROR") process.exitCode = 1;
