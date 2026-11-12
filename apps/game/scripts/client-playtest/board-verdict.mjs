// What the board's runs proved: each run's stills and GPU times by view, and every reason it is not a proof. A run that
// did not exit cleanly, left no transcript, failed a view or lost a still fails the board.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * One run of the board's steps at one size (`dir` its run directory, `exit` and `signal` how the playtest ended), read
 * on each backend in `modes`: its stills and GPU times by view, and its problems.
 */
export function readBoardRun({ dir, exit, signal }, modes, shots) {
  const problems = [];
  if (signal) problems.push(`the playtest was stopped by ${signal}`);
  else if (exit !== 0) problems.push(`the playtest exited ${exit ?? "without starting"}`);
  if (!dir) {
    problems.push("the playtest left no run directory");
    return { problems, modes: Object.fromEntries(modes.map((mode) => [mode, { stills: {}, gpu: {} }])) };
  }
  const read = Object.fromEntries(modes.map((mode) => [mode, readMode(dir, mode, shots, problems)]));
  return { problems, modes: read };
}

function readMode(dir, mode, shots, problems) {
  const stills = {};
  const gpu = {};
  const named = new RegExp(`^spectator-${mode}-1-\\d\\d-(.+)\\.png$`);
  for (const name of readdirSync(dir)) {
    const shot = named.exec(name)?.[1];
    if (shot && shots.includes(shot)) stills[shot] = join(dir, name);
  }
  const transcriptPath = join(dir, `spectator-${mode}-1-transcript.json`);
  if (!existsSync(transcriptPath)) {
    problems.push(`${mode}: no transcript`);
    return { stills, gpu };
  }
  const transcript = JSON.parse(readFileSync(transcriptPath, "utf8"));
  if (transcript.ok !== true)
    problems.push(`${mode}: the run did not pass${transcript.error ? `: ${transcript.error}` : ""}`);
  const steps = new Map((transcript.steps ?? []).map((step) => [step.name, step]));
  for (const shot of shots) {
    const step = steps.get(shot);
    if (step?.gpuDoneMs) gpu[shot] = { p50: step.gpuDoneMs.p50, p95: step.gpuDoneMs.p95 };
    if (!step) problems.push(`${mode} ${shot}: not played`);
    else if (step.verdict?.status !== "completed")
      problems.push(
        `${mode} ${shot}: ${step.verdict?.status ?? "no verdict"}${step.verdict?.reason ? `: ${step.verdict.reason}` : ""}`,
      );
    if (!stills[shot]) problems.push(`${mode} ${shot}: no still`);
  }
  return { stills, gpu };
}
