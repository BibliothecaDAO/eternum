import type { Miniflare } from "miniflare";
export const runScheduledWorkers = async (mf: Pick<Miniflare, "getWorker">, signal: AbortSignal) => {
  const timers = ["identity", "launch", "relay", "monitor"].map((name) => {
    let busy = false;
    const tick = async () => {
      if (busy || signal.aborted) return;
      busy = true;
      try {
        await (await mf.getWorker(name)).scheduled({ cron: "* * * * *" });
      } catch {
        console.error(JSON.stringify({ status: "tick_failed", service: name }));
      } finally {
        busy = false;
      }
    };
    void tick();
    return setInterval(() => void tick(), 60000);
  });
  try {
    await new Promise<void>((resolve) => {
      if (signal.aborted) resolve();
      else signal.addEventListener("abort", () => resolve(), { once: true });
    });
  } finally {
    for (const timer of timers) clearInterval(timer);
  }
};
