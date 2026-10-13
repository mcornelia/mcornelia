import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { repo, keys } from "./harness.mjs";
export async function startWeb({
  port = 0,
  workerPort = 8887,
  review = false,
} = {}) {
  const web = createServer(async (req, res) => {
    const path = new URL(req.url, "http://local").pathname;
    res.setHeader("Cache-Control", "no-store");
    if (review && ["/review/mike", "/review/aimee"].includes(path)) {
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<script>localStorage.setItem('olives-fetch-race:v1:key',${JSON.stringify(keys[path.endsWith("mike") ? 0 : 1])});location.replace('/play/olives-fetch-race/')</script>`,
      );
      return;
    }
    if (path === "/play/olives-fetch-race/config.mjs") {
      res.setHeader("Content-Type", "text/javascript");
      res.end(`export const API_ORIGIN='http://127.0.0.1:${workerPort}';`);
      return;
    }
    const file = resolve(
      repo,
      "." + (path.endsWith("/") ? path + "index.html" : path),
    );
    if (!file.startsWith(join(repo, "play/olives-fetch-race") + "/")) {
      res.writeHead(404).end();
      return;
    }
    try {
      res.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".mjs": "text/javascript",
          ".css": "text/css",
          ".svg": "image/svg+xml",
        }[extname(file)] || "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((r, j) => {
    web.on("error", j);
    web.listen(port, "127.0.0.1", r);
  });
  return {
    origin: `http://127.0.0.1:${web.address().port}`,
    stop: () => new Promise((r) => web.close(r)),
  };
}
