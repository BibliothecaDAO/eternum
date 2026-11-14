// The board: every look change judged on the same fixed views (renderer-aaa-2, step 0). Plays the playtest's `board`
// steps on today's client and on this checkout, at a desktop's and a phone's size, on both renderer backends, and writes
// one page of pairs with each view's GPU time.
//
//   pnpm --dir apps/game board --today https://127.0.0.1:4275 [--branch <url>] [--port 4199] [--out <dir>]
//
// `--today` is a client you serve (origin/next, or the commit before a change) that has the board's lab game. Without
// `--branch` this checkout is built and served on `--port`, as the playtest serves it, and released at the end. The page
// is written whatever happens; the command fails when any run failed, left no transcript, failed a view or lost a still.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readBoardRun } from "./board-verdict.mjs";
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
      for (const [device, viewport] of Object.entries(DEVICES)) {
        const played = playBoard(url, viewport, join(out, `${client}-${device}`));
        runs[`${client}-${device}`] = { ...played, ...readBoardRun(played, MODES, BOARD_SHOTS) };
      }
    writeFileSync(join(out, "board.html"), boardPage(out, runs));
    const problems = Object.entries(runs).flatMap(([name, run]) =>
      run.problems.map((problem) => `${name}: ${problem}`),
    );
    console.log(JSON.stringify({ out, page: join(out, "board.html"), problems }, null, 1));
    if (problems.length > 0)
      throw new Error(`the board failed: ${problems.length} problem(s), listed above and on its page`);
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
  return { dir: run ? join(root, run) : null, exit: played.status, signal: played.signal };
}

/** Each view's still and GPU time, today beside the branch, for each size and backend, under each run's problems. */
function boardPage(out, runs) {
  const sections = [];
  for (const device of Object.keys(DEVICES))
    for (const mode of MODES) {
      const sides = ["today", "branch"].map((client) => runs[`${client}-${device}`].modes[mode]);
      const failures = ["today", "branch"].flatMap((client) =>
        runs[`${client}-${device}`].problems
          .filter((problem) => concernsMode(problem, mode))
          .map((problem) => `<li>${client}: ${escapeHtml(problem)}</li>`),
      );
      const rows = BOARD_SHOTS.map((shot) => {
        const cells = sides.map((side) => {
          const still = side.stills[shot];
          const gpu = side.gpu[shot];
          return `<td>${still ? `<img src="${relative(out, still)}" alt="${shot}">` : "missing"}<br>${gpu ? `GPU ${gpu.p50} ms (p95 ${gpu.p95})` : ""}</td>`;
        });
        return `<tr><th>${shot}</th>${cells.join("")}</tr>`;
      });
      sections.push(
        `<h2>${device}, ${mode}</h2>${failures.length ? `<ul class="failed">${failures.join("")}</ul>` : ""}<table><tr><th></th><th>Today</th><th>Branch</th></tr>${rows.join("")}</table>`,
      );
    }
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Board</title><style>body{margin:0;padding:16px;background:#14121a;color:#ece8f2;font:14px system-ui}table{border-collapse:collapse}td,th{padding:6px;vertical-align:top;text-align:left}img{width:100%;max-width:480px;display:block}td{width:45%}.failed{color:#ff8a8a}</style></head><body><h1>Board</h1>${sections.join("")}</body></html>`;
}

/** A run's problem belongs on a backend's section when it names that backend, or names none (the whole run's). */
const concernsMode = (problem, mode) => problem.startsWith(mode) || !MODES.some((other) => problem.startsWith(other));

const escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
