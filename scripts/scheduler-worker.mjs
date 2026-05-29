const baseUrl = process.env.SCHEDULER_BASE_URL || "http://127.0.0.1:3000";
const tickPath = process.env.SCHEDULER_TICK_PATH || "/api/internal/scheduler/tick";
const intervalMs = Number(process.env.SCHEDULER_INTERVAL_MS || 30000);
const secret = process.env.SCHEDULER_SECRET || "";

if (!Number.isFinite(intervalMs) || intervalMs < 1000) {
  throw new Error("SCHEDULER_INTERVAL_MS must be a number >= 1000");
}

const url = `${baseUrl}${tickPath}`;
let running = false;

async function tick() {
  if (running) {
    console.log("[scheduler-worker] tick skipped (previous tick still running)");
    return;
  }

  running = true;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: secret ? { "x-scheduler-secret": secret } : {},
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[scheduler-worker] tick failed (${res.status}): ${text}`);
    } else {
      console.log(`[scheduler-worker] tick ok: ${text}`);
    }
  } catch (error) {
    console.error("[scheduler-worker] tick error:", error);
  } finally {
    running = false;
  }
}

console.log(
  `[scheduler-worker] starting loop url=${url} intervalMs=${intervalMs}`
);

await tick();
setInterval(() => {
  void tick();
}, intervalMs);
