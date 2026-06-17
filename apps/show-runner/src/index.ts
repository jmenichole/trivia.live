import { runDueShows } from "./runShow";

const POLL_MS = Number(process.env.SHOW_RUNNER_POLL_MS ?? 1000);

console.log(`[runner] starting — poll interval ${POLL_MS}ms`);

let running = false;

async function tick(): Promise<void> {
  if (running) return; // skip if previous tick is still in flight
  running = true;
  try {
    await runDueShows();
  } finally {
    running = false;
  }
}

// Run once immediately, then on interval
tick();
setInterval(tick, POLL_MS);
