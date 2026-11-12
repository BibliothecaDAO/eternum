// The board: every look change judged on the same fixed views (renderer-aaa-2, step 0). Plays the playtest's `board`
// steps on today's client and on this checkout, at a desktop's and a phone's size, on both renderer backends, and writes
// one page of pairs with each view's GPU time.
//
//   pnpm --dir apps/game board --today https://127.0.0.1:4275 [--branch <url>] [--port 4199] [--out <dir>]
//
// `--today` is a client you serve (origin/next, or the commit before a change) that has the board's lab game. Without
// `--branch` this checkout is built and served on `--port`, as the playtest serves it, and released at the end.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { startClient } from "./client-server.mjs";
import { createRunOwner } from "./run-owner.mjs";
import { BOARD_SHOTS } from "./steps.mjs";

const DEVICES = { desktop: "1920x1080", phone: "390x844" };
const MODES = ["webgpu-auto", "webgpu-force-webgl"];
const RUNNER = fileURLToPath(new URL("../run-client-playtest.mjs", import.meta.url));

const option = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? fallback : process.argv[at + 1];
};

async function main() {
  const today = option("--today");
  if (!today) throw new Error("--today <url> names the client the branch is compared with");
  const out = resolve(process.env.INIT_CWD ?? process.cwd(), option("--out", ".context/board"), stamp());
  mkdirSync(out, { recursive: true });
  const owner = createRunOwner();
  try {
    const branch =
      option("--branch") ?? (await startClient({ owner, port: Number(option("--port", 4199)), runDir: out })).baseUrl;
    const runs = {};
    for (const [client, url] of Object.entries({ today, branch }))
      for (const [device, viewport] of Object.entries(DEVICES))
        runs[`${client}-${device}`] = playBoard(url, viewport, join(out, `${client}-${device}`));
    writeFileSync(join(out, "board.html"), boardPage(out, runs));
    console.log(JSON.stringify({ out, page: join(out, "board.html"), runs }, null, 1));
  } finally {
    await owner.releaseAll();
  }
}

/** One playtest run of the board's steps at one size, on both backends; its run directory, whatever its verdict. */
function playBoard(url, viewport, root) {
  const played = spawnSync(
    process.execPath,
    [RUNNER, "--base-url", url, "--steps", "board", "--viewport", viewport, "--iterations", "1", "--out", root],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  const [run] = existsSync(root) ? readdirSync(root).filter((name) => name.endsWith("-spectator")) : [];
  return { dir: run ? join(root, run) : null, exit: played.status };
}

/** Each view's still and GPU time, today beside the branch, for each size and backend. */
function boardPage(out, runs) {
  const sections = [];
  for (const device of Object.keys(DEVICES))
    for (const mode of MODES) {
      const sides = ["today", "branch"].map((client) => readRun(runs[`${client}-${device}`]?.dir, mode));
      const rows = BOARD_SHOTS.map((shot) => {
        const cells = sides.map((side) => {
          const still = side.stills[shot];
          const gpu = side.gpu[shot];
          return `<td>${still ? `<img src="${relative(out, still)}" alt="${shot}">` : "missing"}<br>${gpu ? `GPU ${gpu.p50} ms (p95 ${gpu.p95})` : ""}</td>`;
        });
        return `<tr><th>${shot}</th>${cells.join("")}</tr>`;
      });
      sections.push(
        `<h2>${device}, ${mode}</h2><table><tr><th></th><th>Today</th><th>Branch</th></tr>${rows.join("")}</table>`,
      );
    }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Board</title><style>body{margin:0;padding:16px;background:#14121a;color:#ece8f2;font:14px system-ui}table{border-collapse:collapse}td,th{padding:6px;vertical-align:top;text-align:left}img{width:100%;max-width:480px;display:block}td{width:45%}</style></head><body><h1>Board</h1>${sections.join("")}</body></html>`;
}

/** A run's stills by view, and each view's GPU time from its transcript. */
function readRun(dir, mode) {
  const stills = {};
  const gpu = {};
  if (!dir) return { stills, gpu };
  const named = new RegExp(`^spectator-${mode}-1-\\d\\d-(.+)\\.png$`);
  for (const name of readdirSync(dir)) {
    const shot = named.exec(name)?.[1];
    if (shot && BOARD_SHOTS.includes(shot)) stills[shot] = join(dir, name);
  }
  const transcript = join(dir, `spectator-${mode}-1-transcript.json`);
  if (existsSync(transcript))
    for (const step of JSON.parse(readFileSync(transcript, "utf8")).steps ?? [])
      if (step.gpuDoneMs) gpu[step.name] = { p50: step.gpuDoneMs.p50, p95: step.gpuDoneMs.p95 };
  return { stills, gpu };
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
