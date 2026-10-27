import { startWeb } from "./server.mjs";
import { startWorker } from "./harness.mjs";
const port = Number(process.env.PREVIEW_PORT || 4193);
const workerPort = Number(process.env.WORKER_PORT || 8917);
const web = await startWeb({ port, workerPort, review: true });
let worker;
try {
  worker = await startWorker({
    port: workerPort,
    origin: web.origin,
    layout: process.env.TEST_LAYOUT || "orchard-v5",
  });
} catch (e) {
  await web.stop();
  throw e;
}
console.log(
  `Local review only. Disposable in-memory identities; fresh room per launch.\nMike: http://127.0.0.1:${port}/review/mike\nAimee (separate browser/profile): http://127.0.0.1:${port}/review/aimee\nStop with Ctrl-C. Nothing is deployed.`,
);
process.on("SIGINT", async () => {
  await web.stop();
  await worker.stop();
  process.exit();
});
process.on("SIGTERM", async () => {
  await web.stop();
  await worker.stop();
  process.exit();
});
