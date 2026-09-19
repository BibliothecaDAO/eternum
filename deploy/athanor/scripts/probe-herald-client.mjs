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
  if (m.type === "hello") { log({ ev: "hello", epoch: m.epoch, seq: m.seq, confirmed: m.confirmed_block, pre: m.preconfirmed_block });
    ws.send(JSON.stringify({ type: "resume", epoch: last.epoch, seq: last.seq })); return; }
  last = { epoch: m.epoch, seq: m.seq };
  const summary = { ev: m.type, seq: m.seq };
  if (m.type === "snapshot") { summary.model = m.model; summary.rows = m.rows.length; }
  if (m.type === "diff") { summary.block = m.block; summary.pre = m.preconfirmed; summary.set = m.set.map((s) => s.model + ":" + s.key.slice(0, 10)); summary.del = m.del.length; }
  if (m.type === "tx") { summary.hash = m.hash.slice(0, 14); summary.status = m.status; summary.reason = m.revert_reason; }
  if (m.type === "head") { summary.block = m.block; }
  if (m.type === "overlay_reset") { summary.confirmed = m.confirmed_block; }
  log(summary);
};
ws.onclose = (e) => { log({ ev: "close", code: e.code, reason: e.reason, last }); process.exit(0); };
setTimeout(() => { log({ ev: "timeout", last }); ws.close(); }, Number(secondsArg ?? 30) * 1000);
