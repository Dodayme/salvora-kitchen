// Fixed inert target for GUI-launcher verification. No env loader, DB or HTTP.
if (process.env.SALVORA_LAUNCHER_SMOKE !== "1") process.exit(1);
console.log("launcher-test-private-stdout-sentinel");
console.error("launcher-test-private-stderr-sentinel");
const code = Number(process.env.SALVORA_LAUNCHER_FIXTURE_EXIT);
process.exitCode = [0, 1, 2].includes(code) ? code : 1;
