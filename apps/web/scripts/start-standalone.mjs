// `next start` does not work with `output: "standalone"`. Run the standalone
// server instead, after copying the static files and public folder next to it
// (the same two copies the Dockerfile does).
import { cpSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, ".next", "standalone", "apps", "web");
const server = join(out, "server.js");
if (!existsSync(server)) {
  console.error("Standalone build not found. Run `pnpm --filter @prospex/web build` first.");
  process.exit(1);
}
cpSync(join(root, ".next", "static"), join(out, ".next", "static"), { recursive: true });
if (existsSync(join(root, "public"))) cpSync(join(root, "public"), join(out, "public"), { recursive: true });

const child = spawn(process.execPath, [server], {
  stdio: "inherit",
  env: { ...process.env, PORT: process.env.PORT || "3000", HOSTNAME: process.env.HOSTNAME || "0.0.0.0" },
});
child.on("exit", (code) => process.exit(code ?? 0));
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill(s));
