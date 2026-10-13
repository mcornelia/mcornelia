import { startWeb } from "./server.mjs";
import { startWorker } from "./harness.mjs";
const web = await startWeb({ port: 4183, workerPort: 8887, review: true });
let worker;
try {
  worker = await startWorker({
    port: 8887,
    origin: web.origin,
    layout: "meadow-crossroads-v3",
  });
} catch (e) {
  await web.stop();
  throw e;
}
console.log(
  "Local review only. Disposable in-memory identities; fresh room per launch.\nMike: http://127.0.0.1:4183/review/mike\nAimee (separate browser/profile): http://127.0.0.1:4183/review/aimee\nStop with Ctrl-C. Nothing is deployed.",
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
