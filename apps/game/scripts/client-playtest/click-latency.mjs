import { blocked, completed, failed } from "./evidence.mjs";

/**
 * Click to result: one action timed from the player's press to the first frame showing what it did, cut where the
 * client records its way (the brief's segments: handler, send, chain and Herald, facts applied, drawn). Every mark is
 * the page's own clock; the frames between the press and the result are kept, so a reader can replay the cut.
 */

/** The cut, in order: each segment runs from the mark before it to its own mark. */
export const CLICK_TO_RESULT_SEGMENTS = [
  { mark: "command", segment: "handled", what: "the press handled and its command handed to the client" },
  { mark: "answered", segment: "sent", what: "signed, sent and answered by the shard's RPC" },
  { mark: "diff", segment: "confirmed", what: "the chain and Herald, to the pre-confirmed diff arriving" },
  { mark: "applied", segment: "applied", what: "the diff's facts in the fact store" },
  { mark: "visible", segment: "drawn", what: "the first frame showing the result" },
];

/**
 * What one action's press led to, from the step's probe read and the client's records: each mark, each segment between
 * two marks, the total, and the frames that cover the press to the result. A mark the client never reached is named in
 * `missing`, and its segments are left out rather than guessed.
 *
 * `result` names what a player sees: `{ watch: <name> }`, a condition the probe checked each frame;
 * `{ rendered: true }`, the client's own rendered mark for the action (an explored tile drawn); `{ walking: <army> }`,
 * that army starting to walk; `{ mark: <prefix> }`, a scene's performance mark of that name (a building drawn on its
 * plot). The result is visible from the first frame that begins after it was seen.
 */
export function measureClickToResult({ probe, actionLatency, since, result }) {
  const click = lastPressBefore(probe.inputs ?? [], since, firstCommandAfter(actionLatency, since));
  if (click === null) return { missing: ["click"] };
  const record = recordOfTheSend(actionLatency.clientActions ?? [], click);
  const marks = {
    click,
    command: stageAt(record, "command"),
    answered: stageAt(record, "answered"),
    diff: record?.phases?.diff_received ?? null,
    applied: record?.phases?.store_applied ?? null,
    visible: visibleAt({ probe, actionLatency, record, click, result }),
  };
  const missing = Object.entries(marks)
    .filter(([, at]) => at === null)
    .map(([mark]) => mark);
  return {
    marks,
    missing,
    segments: segmentsOf(marks),
    totalMs: marks.visible === null ? null : round(marks.visible - click),
    frames: framesBetween(probe.frames ?? [], click, marks.visible),
    transactionHash: record?.transactionHash ?? null,
  };
}

/**
 * The step's verdict: blocked when the game offered nothing to press (no army, no tile with the order), failed when a
 * mark was never reached or the frames from the press to the result were not all observed, else completed with the cut.
 */
export function judgeClickToResult(played, measured) {
  if (played.offered && played.target === undefined) {
    return blocked(
      `no tile offered the order (offered: ${played.offered.filter(Boolean).join(", ") || "none"})`,
      played,
    );
  }
  if (measured.missing.includes("click")) return failed("nothing was pressed", played);
  if (measured.missing.length > 0)
    return failed(`never reached: ${measured.missing.join(", ")}`, { clickToResult: measured });
  if (!measured.frames.covered)
    return failed("the frames from the press to the result were not all observed", { clickToResult: measured });
  return completed({ clickToResult: measured });
}

/** The earliest time a send's command was handed to the client at or after `since`; null when none was. */
function firstCommandAfter({ clientActions = [] }, since) {
  const commands = clientActions
    .map((record) => stageAt(record, "command"))
    .filter((at) => at !== null && at >= since)
    .sort((left, right) => left - right);
  return commands[0] ?? null;
}

/** The press that sent the command: the last pointer press or key since the step began and before the command. */
function lastPressBefore(inputs, since, command) {
  const presses = inputs.filter((input) => input.t >= since && (command === null || input.t <= command));
  return presses.at(-1)?.t ?? null;
}

/** The client's record of the first send after the press: an action's own record with its send, or the send alone. */
function recordOfTheSend(clientActions, click) {
  return (
    clientActions
      .filter((record) => (stageAt(record, "command") ?? -Infinity) >= click)
      .sort((left, right) => stageAt(left, "command") - stageAt(right, "command"))[0] ?? null
  );
}

function stageAt(record, stage) {
  return record?.send?.stages?.find((reached) => reached.stage === stage)?.at ?? null;
}

/**
 * When the frame that shows the result ran: the first frame callback after the result was seen (by the probe's check,
 * the client's own mark, or a scene's mark), the frame the browser then paints. Its callback time, not its start: a
 * frame begins before the work that blocks it, and paints only after.
 */
function visibleAt({ probe, actionLatency, record, click, result }) {
  const seen = seenAt({ probe, actionLatency, record, click, result });
  return seen === null ? null : ((probe.frameRuns ?? []).find((ran) => ran >= seen) ?? null);
}

function seenAt({ probe, actionLatency, record, click, result }) {
  if (result.watch)
    return (probe.watched ?? []).find((seen) => seen.name === result.watch && seen.at >= click)?.at ?? null;
  if (result.rendered) return record?.phases?.rendered ?? null;
  if (result.mark)
    return (probe.marks ?? []).find((mark) => mark.name.startsWith(result.mark) && mark.t >= click)?.t ?? null;
  if (result.walking !== undefined) {
    const walking = (actionLatency.armyMovement ?? []).find(
      (entry) =>
        entry.phase === "movement_started" && Number(entry.entityId) === result.walking && entry.wallTimeMs >= click,
    );
    return walking?.wallTimeMs ?? null;
  }
  throw new Error(`measureClickToResult has no way to see ${JSON.stringify(result)}`);
}

/** Each segment whose two marks were reached, in ms. */
function segmentsOf(marks) {
  const order = ["click", ...CLICK_TO_RESULT_SEGMENTS.map(({ mark }) => mark)];
  return Object.fromEntries(
    CLICK_TO_RESULT_SEGMENTS.flatMap(({ mark, segment }, index) => {
      const from = marks[order[index]];
      const to = marks[mark];
      return from === null || to === null ? [] : [[segment, round(to - from)]];
    }),
  );
}

/**
 * The frames from the press to the result. `covered` holds only when the probe saw a frame start at or before the press
 * and one at or after the result, with every frame between: a window with a hole cannot say what the player saw. The
 * worst frame counts the interval that crosses the result, so a long frame ending after it is not hidden.
 */
export function framesBetween(frames, from, to) {
  if (to === null) return { covered: false, count: 0, worstMs: null };
  const first = frames.findLastIndex((frame) => frame <= from);
  const last = frames.findIndex((frame) => frame >= to);
  if (first === -1 || last === -1) return { covered: false, count: 0, worstMs: null };
  const intervals = frames
    .slice(first, last + 1)
    .flatMap((frame, index, window) => (index === 0 ? [] : [frame - window[index - 1]]));
  return { covered: true, count: intervals.length, worstMs: round(Math.max(0, ...intervals)) };
}

function round(value) {
  return Math.round(value * 10) / 10;
}

/**
 * The runs' table, one per renderer mode: each timed action's segments and total as median (min–max) in ms over the
 * runs whose step completed on a quiet machine, with that run count. Empty when no step timed an action.
 */
export function clickToResultTable(byMode) {
  const columns = [...CLICK_TO_RESULT_SEGMENTS.map(({ segment }) => segment), "total"];
  const tables = Object.entries(byMode).flatMap(([mode, { steps }]) => {
    const rows = Object.entries(steps).flatMap(([step, metrics]) => {
      const total = metrics["verdict.clickToResult.totalMs"];
      if (!total) return [];
      const cells = columns.map((column) =>
        spreadCell(
          metrics[column === "total" ? "verdict.clickToResult.totalMs" : `verdict.clickToResult.segments.${column}`],
        ),
      );
      return [`| ${step} | ${total.n} | ${cells.join(" | ")} |`];
    });
    if (rows.length === 0) return [];
    return [
      `### ${mode}`,
      "",
      `| action | n | ${columns.join(" | ")} |`,
      `|---|---|${columns.map(() => "---").join("|")}|`,
      ...rows,
      "",
    ];
  });
  return tables.length === 0 ? "" : ["ms, median (min–max)", "", ...tables].join("\n");
}

const spreadCell = (spread) =>
  spread ? `${Math.round(spread.median)} (${Math.round(spread.min)}–${Math.round(spread.max)})` : "–";
