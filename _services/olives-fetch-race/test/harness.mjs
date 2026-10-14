import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, createHash } from "node:crypto";
import { createServer } from "node:net";
export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const repo = resolve(root, "../..");
// Throwaway test keys exist only in the test process and browser contexts.
export const keys = [
  randomBytes(32).toString("base64url"),
  randomBytes(32).toString("base64url"),
];
export const hashes = keys.map((k) =>
  createHash("sha256").update(k).digest("hex"),
);
export async function startWorker({
  port = 8887,
  directory,
  origin = "http://127.0.0.1:4173",
  configured = true,
  credentialHashes = hashes,
  layout = process.env.TEST_LAYOUT || "classic-v1",
} = {}) {
  // Never mistake an unrelated listener (or the review preview) for our Worker.
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", () =>
      reject(
        new Error(
          `Local port ${port} is occupied or unavailable. Stop only your own preview or choose another port.`,
        ),
      ),
    );
    probe.listen(port, "127.0.0.1", () => probe.close(resolve));
  });
  const ownDir = !directory;
  directory ||= await mkdtemp(join(tmpdir(), "olives-fetch-race-"));
  const args = [
    join(root, "node_modules/wrangler/bin/wrangler.js"),
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    String(port),
    "--inspector-port",
    "0",
    "--persist-to",
    join(directory, "state"),
    "--var",
    `ALLOWED_ORIGIN:${origin}`,
    "--var",
    `INITIAL_LAYOUT:${layout}`,
    "--show-interactive-dev-session=false",
  ];
  if (configured)
    args.push(
      "--var",
      `FETCH_MIKE_KEY_HASH:${credentialHashes[0]}`,
      "--var",
      `FETCH_AIMEE_KEY_HASH:${credentialHashes[1]}`,
    );
  const child = spawn(process.execPath, args, {
    cwd: root,
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      XDG_CONFIG_HOME: join(directory, "config"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (b) => (output += b));
  child.stderr.on("data", (b) => (output += b));
  const base = `http://127.0.0.1:${port}`;
  const stop = async () => {
    child.kill("SIGTERM");
    await Promise.race([
      new Promise((r) => child.once("exit", r)),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
    if (child.exitCode === null) child.kill("SIGKILL");
    if (ownDir) await rm(directory, { recursive: true, force: true });
  };
  try {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(output);
      try {
        const r = await fetch(base + "/state");
        if ([401, 503].includes(r.status)) return { base, directory, stop };
      } catch {}
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error("Worker startup timed out: " + output);
  } catch (e) {
    await stop();
    throw e;
  }
}
export async function call(base, player = 0, move, extra = {}) {
  const response = await fetch(base + (move ? "/move" : "/state"), {
    method: move ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${keys[player]}`,
      "X-Fetch-Protocol": "5",
      ...(move ? { "Content-Type": "application/json" } : {}),
      ...(extra.headers || {}),
    },
    ...(move ? { body: JSON.stringify(move) } : {}),
    ...Object.fromEntries(Object.entries(extra).filter(([k]) => k !== "headers")),
  });
  return {
    status: response.status,
    headers: response.headers,
    ...(await response.json()),
  };
}
export const move = (version, action = { type: "step", to: 37 }) => ({
  id: crypto.randomUUID(),
  version,
  kind: "move",
  action,
});
