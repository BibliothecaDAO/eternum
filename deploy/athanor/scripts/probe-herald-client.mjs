// Lab-only herald stream client: connects, resumes (fresh or from a saved boundary), logs every message as JSON lines.
// usage: pnpm lab:probe-herald -- <ws-url> <out.jsonl> [epoch] [seq] [seconds]
const [url, out, epochArg, seqArg, secondsArg] = process.argv.slice(2);
const fs = await import("node:fs");
const log = (o) => fs.appendFileSync(out, JSON.stringify({ t: Date.now(), ...o }) + "\n");
let last = { epoch: epochArg ?? "", seq: Number(seqArg ?? 0) };
const ws = new WebSocket(url);
ws.onopen = () => log({ ev: "open" });
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  log({ ...m, ev: m.type });
  if (m.type === "hello") {
    ws.send(JSON.stringify({ type: "resume", epoch: last.epoch, seq: last.seq }));
    return;
  }
  last = { epoch: m.epoch, seq: m.seq };
};
ws.onclose = (e) => {
  log({ ev: "close", code: e.code, reason: e.reason, last });
  process.exit(0);
};
setTimeout(
  () => {
    log({ ev: "timeout", last });
    ws.close();
  },
  Number(secondsArg ?? 30) * 1000,
);
