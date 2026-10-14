import { describe, expect, it } from "vitest";

import {
  buildPlaytestUrl,
  collectBrowserErrors,
  collectFrameSpikes,
  comparePlaytestSummary,
  deriveBootMetrics,
  evaluatePlaytestSummary,
  hasEntryFinished,
  selectPlaytestGame,
  summarizePlaytestResults,
  summarizeRpcSends,
  summarizeStep,
  describeBurst,
  eligibilityOf,
  assertInTargetGame,
  gameOfPath,
  judgeBurst,
  judgeExplore,
} from "./evidence.mjs";

describe("buildPlaytestUrl", () => {
  it("opens the game's map as a spectator with the dev overlays off", () => {
    expect(
      buildPlaytestUrl({ baseUrl: "https://127.0.0.1:4173", chainId: "0xa1", gameId: 4, rendererMode: "webgpu-auto" }),
    ).toBe("https://127.0.0.1:4173/g/0xa1/4/map?spectate=true&rendererMode=webgpu-auto&dev=0");
  });
});

describe("selectPlaytestGame", () => {
  it("picks the newest live game of the steps' mode on the first active shard that has one", () => {
    const directory = {
      shards: [
        { chainId: "0xold", status: "retired", games: [{ game_id: 9, status: "Live", mode: "frontier" }] },
        {
          chainId: "0xdev",
          status: "active",
          games: [
            { game_id: 1, status: "Live", mode: "frontier" },
            { game_id: 3, status: "Live", mode: "blitz" },
            { game_id: 2, status: "Ended", mode: "frontier" },
          ],
        },
      ],
    };
    expect(selectPlaytestGame(directory, "frontier")).toEqual({ chainId: "0xdev", gameId: 1, mode: "frontier" });
    expect(selectPlaytestGame(directory, "blitz")).toEqual({ chainId: "0xdev", gameId: 3, mode: "blitz" });
    expect(selectPlaytestGame({ shards: [] }, "frontier")).toBeNull();
  });
});

describe("deriveBootMetrics", () => {
  it("reads entry, renderer and first-byte-to-playable timings from the boot snapshot", () => {
    expect(
      deriveBootMetrics({
        diagnostics: {
          startupTimings: { "webgpu-backend-total": 1450, "webgpu-module-import": 320, "webgpu-renderer-init": 840 },
        },
        durations: { "renderer-init": 2500, "renderer-init-backend-await": 1600 },
        elapsedMs: 7200,
        milestones: [
          { elapsedMs: 1000, name: "renderer-init-started", timestamp: 1400 },
          { elapsedMs: 3500, name: "renderer-init-completed", timestamp: 3900 },
          { elapsedMs: 7200, name: "entry-ready", timestamp: 7600 },
          { elapsedMs: 9600, name: "world-interactive", timestamp: 10_000 },
        ],
        navigationTiming: { responseStart: 250 },
      }),
    ).toEqual({
      worldInteractiveMs: 9600,
      firstByteToPlayableMs: 9750,
      enterClickToPlayableMs: null,
      entryReadyMs: 7200,
      backendTotalMs: 1450,
      rendererBackendAwaitMs: 1600,
      rendererInitMs: 2500,
      rendererStalledAfterStartMs: 2500,
      webgpuModuleImportMs: 320,
      webgpuRendererInitMs: 840,
    });
  });
});

describe("deriveBootMetrics for a player", () => {
  it("measures boot from the player's click on the home page, not from the home page's first byte", () => {
    const metrics = deriveBootMetrics({
      entered: { name: "enter", t: 3000 },
      milestones: [{ elapsedMs: 2100, name: "world-interactive", timestamp: 5100 }],
      navigationTiming: { responseStart: 250 },
    });
    expect(metrics.enterClickToPlayableMs).toBe(2100);
    expect(metrics.firstByteToPlayableMs).toBeNull();
  });
});

describe("hasEntryFinished", () => {
  it("waits for world-interactive, not for entry-ready", () => {
    expect(hasEntryFinished({ milestones: [{ name: "entry-ready", elapsedMs: 2500 }] })).toBe(false);
    expect(hasEntryFinished({ milestones: [{ name: "world-interactive", elapsedMs: 9500 }] })).toBe(true);
  });
});

const MB = 1024 * 1024;

const probeOf = (overrides) => ({
  draws: [],
  events: [],
  frames: [],
  heap: [],
  loafs: [],
  messages: [],
  now: 0,
  steps: [],
  timeOrigin: 1_000_000,
  timeline: [],
  ...overrides,
});

describe("summarizeStep", () => {
  const startedOn = { name: "pan", t: 1000, heapBytes: 100 * MB, timeOrigin: 1_000_000 };

  it("measures the step's frames, long frames, inputs, heap and Herald messages to their frame", () => {
    const summary = summarizeStep(
      probeOf({
        // One frame before the step gives the first in-step frame its interval.
        frames: [990, 1000, 1016, 1100, 1116],
        draws: [9, 10, 12, 30, 12],
        loafs: [
          {
            start: 1016,
            durationMs: 84,
            blockingMs: 34,
            scripts: [{ invoker: "FrameRequestCallback", source: "/assets/app.js", fn: "render", durationMs: 70 }],
          },
        ],
        events: [
          { name: "click", target: "Map", start: 1010, durationMs: 40, inputDelayMs: 2, processingMs: 8 },
          { name: "pointerenter", target: "Map", start: 1010, durationMs: 40, inputDelayMs: 2, processingMs: 0 },
        ],
        heap: [
          [1000, 110 * MB],
          [1100, 130 * MB],
        ],
        messages: [{ arrived: 1050, start: 1052, end: 1053, bytes: 2048, host: "herald", type: "head" }],
        inputs: [
          { type: "keydown", key: "Enter", t: 1012, trusted: true },
          { type: "keydown", key: "Enter", t: 1200, trusted: true },
        ],
        steps: [startedOn, { name: "pan:end", t: 1120, heapBytes: 104 * MB }],
        now: 1130,
      }),
      { name: "pan", startedOn },
    );

    expect(summary).toEqual({
      name: "pan",
      durationMs: 120,
      reload: null,
      frames: {
        count: 4,
        fps: 33.3,
        ms: { n: 4, p50: 16, p95: 84, p99: 84, max: 84 },
        jankCount: 1,
      },
      drawCalls: { n: 4, p50: 12, p95: 30, p99: 30, max: 30 },
      longFrames: {
        count: 1,
        totalMs: 84,
        blockingMs: 34,
        topScripts: [{ script: "FrameRequestCallback /assets/app.js#render", count: 1, totalMs: 70 }],
      },
      inputLatency: [
        { name: "click", target: "Map", durationMs: 40, inputDelayMs: 2, processingMs: 8, presentationMs: 30 },
      ],
      presses: [{ type: "keydown", key: "Enter", atMs: 12, trusted: true }],
      heap: { startMb: 100, endMb: 104, retainedDeltaMb: 4, peakMb: 130 },
      herald: {
        count: 1,
        kb: 2,
        types: { head: 1 },
        queueMs: { n: 1, p50: 2, p95: 2, p99: 2, max: 2 },
        handlerMs: { n: 1, p50: 1, p95: 1, p99: 1, max: 1 },
        arrivalToFrameMs: { n: 1, p50: 50, p95: 50, p99: 50, max: 50 },
        frameMsAfterMessage: { n: 1, p50: 16, p95: 16, p99: 16, max: 16 },
      },
    });
  });

  it("measures a step whose page reloaded on the new page, with the time back to playable", () => {
    const summary = summarizeStep(
      probeOf({
        timeOrigin: 1_001_500,
        frames: [3000, 3016],
        draws: [5, 5],
        timeline: [{ name: "world-interactive", elapsedMs: 4000, timestamp: 4500 }],
        steps: [{ name: "pan:end", t: 6000, heapBytes: 90 * MB }],
        now: 6010,
      }),
      { name: "pan", startedOn },
    );

    expect(summary.reload).toEqual({ navigationAfterStepStartMs: 500, toPlayableMs: 5000 });
    expect(summary.durationMs).toBe(6000);
    expect(summary.heap).toEqual({ startMb: null, endMb: 90, retainedDeltaMb: null, peakMb: null });
  });
});

describe("summarizePlaytestResults", () => {
  const run = (label, { load = 2, bootOk = true, worldInteractiveMs, fps, status = "completed" }) => ({
    label,
    ok: bootOk,
    bootOk,
    machine: { loadAverageMax: load },
    metrics: { worldInteractiveMs },
    rendererMode: "webgpu-auto",
    steps: [{ name: "pan", frames: { fps }, verdict: { status } }],
  });

  it("takes boot metrics from clean boots and step metrics from completed steps, on a quiet machine only", () => {
    const { byMode, excluded } = summarizePlaytestResults([
      run("a", { worldInteractiveMs: 3000, fps: 58 }),
      run("b", { worldInteractiveMs: 2000, fps: 50 }),
      run("busy", { load: 15.6, worldInteractiveMs: 9000, fps: 20 }),
      run("bad-boot", { bootOk: false, worldInteractiveMs: 2500, fps: 59 }),
      run("blocked", { worldInteractiveMs: 2600, fps: 12, status: "blocked" }),
    ]);

    expect(byMode["webgpu-auto"].boot.worldInteractiveMs).toEqual({ n: 3, median: 2600, min: 2000, max: 3000 });
    expect(byMode["webgpu-auto"].steps.pan).toEqual({
      verdicts: { completed: 4, blocked: 1 },
      "frames.fps": { n: 3, median: 58, min: 50, max: 59 },
    });
    expect(excluded).toEqual([
      { run: "busy", scope: "boot", reasons: ["maximum sampled load average 15.6 is over 12"] },
      { run: "busy", scope: "steps", reasons: ["maximum sampled load average 15.6 is over 12"] },
      { run: "bad-boot", scope: "boot", reasons: ["the boot was not clean"] },
    ]);
  });
});

describe("eligibilityOf", () => {
  it("keeps a cut-short or unmeasured run out of every timing population", () => {
    expect(eligibilityOf({ bootOk: true, machine: {}, cancelled: false }).timing).toEqual([
      "maximum sampled load average unknown is over 12",
    ]);
    expect(
      eligibilityOf({ bootOk: true, machine: { loadAverageMax: 3 }, cancelled: true, error: "cancelled: SIGINT" }),
    ).toEqual({
      timing: ["the run was cancelled: SIGINT"],
      boot: ["the run was cancelled: SIGINT"],
    });
  });
});

describe("evaluatePlaytestSummary", () => {
  const bootedRun = {
    ok: true,
    expectedSteps: ["map-idle"],
    steps: [{ name: "map-idle", verdict: { status: "completed" } }],
    diagnostics: { activeMode: "webgpu" },
    metrics: { entryReadyMs: 2500, worldInteractiveMs: 3500 },
    rendererMode: "webgpu-auto",
    iteration: 1,
  };

  it("rejects a bootstrapped game that never becomes interactive", () => {
    const result = { ...bootedRun, metrics: { entryReadyMs: 2500, worldInteractiveMs: null } };
    expect(evaluatePlaytestSummary({ results: [result] }).failures).toEqual([
      "webgpu-auto #1: world-interactive exceeded 30000ms",
    ]);
    expect(evaluatePlaytestSummary({ results: [bootedRun] }).ok).toBe(true);
  });

  it("fails when nothing was played", () => {
    expect(evaluatePlaytestSummary({ results: [] }).failures).toEqual(["no run was played"]);
  });

  it("fails a run that did not boot cleanly or threw, even with good boot numbers", () => {
    expect(evaluatePlaytestSummary({ results: [{ ...bootedRun, ok: false }] }).failures).toEqual([
      "webgpu-auto #1: the run did not boot cleanly",
    ]);
    expect(evaluatePlaytestSummary({ results: [{ ...bootedRun, ok: false, error: "no canvas" }] }).failures).toEqual([
      "webgpu-auto #1: the run failed: no canvas",
    ]);
  });

  it("fails a run whose steps were not all played, or that declares none", () => {
    const short = { ...bootedRun, expectedSteps: ["map-idle", "pan", "zoom"] };
    expect(evaluatePlaytestSummary({ results: [short] }).failures).toEqual([
      "webgpu-auto #1: steps not played: pan, zoom",
    ]);
    const empty = { ...bootedRun, expectedSteps: [], steps: [] };
    expect(evaluatePlaytestSummary({ results: [empty] }).failures).toEqual([
      "webgpu-auto #1: the run declares no steps to play",
    ]);
  });

  it("fails a failed or unjudged step and warns on a blocked one", () => {
    const evaluation = evaluatePlaytestSummary({
      results: [
        {
          ...bootedRun,
          expectedSteps: ["pan", "explore-1", "zoom", "menu"],
          steps: [
            { name: "pan", verdict: { status: "failed", reason: "the view barely changed" } },
            { name: "explore-1", verdict: { status: "blocked", reason: "no tile beside the army offered Explore" } },
            { name: "zoom", verdict: { status: "completed" } },
            { name: "menu" },
          ],
        },
      ],
    });
    expect(evaluation.failures).toEqual([
      "webgpu-auto #1: pan failed: the view barely changed",
      "webgpu-auto #1: menu has no verdict",
    ]);
    expect(evaluation.warnings).toEqual(["webgpu-auto #1: explore-1 blocked: no tile beside the army offered Explore"]);
  });

  it("fails a run taken while the machine's load average was over 12", () => {
    const busyRun = { ...bootedRun, machine: { cpus: 16, loadAverageMax: 31.4, loadSamples: [8, 31.4] } };
    expect(evaluatePlaytestSummary({ results: [busyRun] }).failures).toEqual([
      "webgpu-auto #1: load average reached 31.4: its timings are not evidence",
    ]);
    const quietRun = { ...bootedRun, machine: { cpus: 16, loadAverageMax: 11.9, loadSamples: [11.9] } };
    expect(evaluatePlaytestSummary({ results: [quietRun] }).ok).toBe(true);
  });

  it("warns, without failing, when a step reloaded the page", () => {
    const evaluation = evaluatePlaytestSummary({
      results: [{ ...bootedRun, reloads: [{ step: "open-map", toPlayableMs: 6761 }] }],
    });
    expect(evaluation.ok).toBe(true);
    expect(evaluation.warnings).toEqual(["webgpu-auto #1: the page reloaded during open-map (6761ms to playable)"]);
  });

  it("fails when WebGPU falls back without a reason", () => {
    const evaluation = evaluatePlaytestSummary({
      results: [
        {
          ...bootedRun,
          diagnostics: { activeMode: "webgl2-fallback", fallbackReason: null, requestedMode: "webgpu-auto" },
        },
      ],
    });
    expect(evaluation.failures).toEqual(["webgpu-auto #1: fallback happened without a fallback reason"]);
  });
});

describe("comparePlaytestSummary", () => {
  it("fails when the worst boot run regresses past the threshold", () => {
    const summaryOf = (worldInteractiveMs) => ({
      byMode: { "webgpu-auto": { boot: { worldInteractiveMs: { max: worldInteractiveMs } } } },
    });
    expect(comparePlaytestSummary(summaryOf(3000), summaryOf(4000)).ok).toBe(true);
    expect(comparePlaytestSummary(summaryOf(3000), summaryOf(5000)).failures).toEqual([
      "webgpu-auto worldInteractiveMs worst run regressed from 3000ms to 5000ms",
    ]);
  });
});

describe("collectBrowserErrors", () => {
  it("fails entry on logged manager timeouts even when no exception escaped", () => {
    expect(
      collectBrowserErrors("", "[warn] [WorldmapScene] Manager updates timed out: army, structure\n[log] ready"),
    ).toEqual(["[warn] [WorldmapScene] Manager updates timed out: army, structure"]);
    expect(collectBrowserErrors("uncaught failure", "[error] shader failed")).toEqual([
      "uncaught failure",
      "[error] shader failed",
    ]);
  });
});

describe("collectFrameSpikes", () => {
  it("counts digested spike frames and the owner of each reported spike", () => {
    expect(
      collectFrameSpikes(
        [
          "[warning] [FramePerf] spike renderer_mode=webgpu duration_ms=1415 frame_owner=render:backend owner_ms=804",
          "[warning] [FramePerf] 70 spike frames in 10.1s, worst 1415ms — [FramePerf] spike duration_ms=1415 frame_owner=render:backend",
          "[warning] [FramePerf] 8 spike frames in 10.0s, worst 85ms — [FramePerf] spike duration_ms=85 frame_owner=render:backend",
          "[warning] [FramePerf] spike renderer_mode=webgpu duration_ms=1200 frame_owner=scene:hexception:grid owner_ms=900",
        ].join("\n"),
      ),
    ).toEqual({
      digestedSpikeFrames: 78,
      reportedOwners: {
        "render:backend": { count: 1, worstMs: 1415 },
        "scene:hexception:grid": { count: 1, worstMs: 1200 },
      },
    });
  });
});

describe("summarizeRpcSends", () => {
  it("counts each JSON-RPC method's sends, those on a fresh connection, and their durations", () => {
    expect(
      summarizeRpcSends([
        { rpcMethod: "starknet_addInvokeTransaction", connectionReused: false, connectMs: 40, totalMs: 160 },
        { rpcMethod: "starknet_addInvokeTransaction", connectionReused: true, connectMs: null, totalMs: 110 },
        { rpcMethod: "starknet_getNonce", connectionReused: true, connectMs: null, totalMs: 105 },
      ]),
    ).toEqual({
      starknet_addInvokeTransaction: {
        count: 2,
        freshConnections: 1,
        totalMs: { n: 2, p50: 110, p95: 160, p99: 160, max: 160 },
        freshConnectMs: { n: 1, p50: 40, p95: 40, p99: 40, max: 40 },
      },
      starknet_getNonce: {
        count: 1,
        freshConnections: 0,
        totalMs: { n: 1, p50: 105, p95: 105, p99: 105, max: 105 },
        freshConnectMs: null,
      },
    });
  });
});

describe("judgeExplore", () => {
  const explore = (phases, extra = {}) => ({
    operation: "explore_reveal",
    phases: { click: 1000, ...phases },
    ...extra,
  });

  const pressed = (tileChange) => ({ offered: ["Explore"], pressedAt: 998, tileChange });

  it("counts an explore only when its hashed outcome applied and the explored tile changed on screen", () => {
    const action = explore({ store_applied: 1190, rendered: 1230 }, { transactionHash: "0xabc" });
    expect(judgeExplore(pressed(41.5), [action])).toEqual({ status: "completed", action, tileChange: 41.5 });
  });

  it("fails an applied explore the screen never showed, or the client never marked rendered", () => {
    const applied = explore({ store_applied: 1190 }, { transactionHash: "0xabc" });
    expect(judgeExplore(pressed(41.5), [applied]).reason).toBe("the client never marked the reveal rendered");
    const marked = explore({ store_applied: 1190, rendered: 1230 }, { transactionHash: "0xabc" });
    expect(judgeExplore(pressed(3.1), [marked]).reason).toBe(
      "the explored tile did not visibly change on screen (3.1)",
    );
    expect(judgeExplore(pressed(null), [marked]).reason).toBe(
      "the explored tile did not visibly change on screen (null)",
    );
  });

  it("calls a tile that offered only Move or nothing a refusal, not an explore", () => {
    expect(judgeExplore({ offered: ["Move", null] }, [])).toEqual({
      status: "blocked",
      reason: "no tile beside the army offered Explore (offered: Move, null)",
    });
    expect(judgeExplore({ offered: [null, "short"] }, [])).toEqual({
      status: "blocked",
      reason: "the army cannot pay for an order (the order bar shows a short cost) (offered: null, short)",
    });
  });

  it("calls a player without an army blocked", () => {
    expect(judgeExplore({ army: null, offered: [] }, [])).toEqual({
      status: "blocked",
      reason: "the player has no army on the HUD",
    });
  });

  it("fails a pressed explore that was never sent, failed, or never applied", () => {
    expect(judgeExplore({ offered: ["Explore"], pressedAt: 998 }, []).reason).toBe(
      "Enter on Explore started no explore",
    );
    expect(judgeExplore({ offered: ["Explore"], pressedAt: 998 }, [explore({})]).reason).toBe(
      "the explore was never sent (no hash)",
    );
    expect(
      judgeExplore({ offered: ["Explore"], pressedAt: 998 }, [explore({}, { transactionHash: "0xabc" })]).reason,
    ).toBe("the explore's outcome was not applied");
    expect(
      judgeExplore({ offered: ["Explore"], pressedAt: 998 }, [explore({}, { failedReason: "stamina" })]).reason,
    ).toBe("the explore failed: stamina");
  });
});

describe("describeBurst", () => {
  it("pairs each command the army trace records with its press, hash and confirmation", () => {
    const presses = [
      { type: "pointerdown", key: null, t: 990 },
      { type: "keydown", key: "Enter", t: 1000 },
      { type: "keydown", key: "Enter", t: 1400 },
      { type: "keydown", key: "Enter", t: 1800 },
    ];
    const armyTrace = [
      { phase: "move_requested", entityId: 7, wallTimeMs: 1002 },
      { phase: "explore_intent_queued", entityId: 7, wallTimeMs: 1002 },
      { phase: "tx_submitted", entityId: 7, wallTimeMs: 1120, txHash: "0x1" },
      { phase: "tx_confirmed", entityId: 7, wallTimeMs: 1190 },
      { phase: "move_requested", entityId: 7, wallTimeMs: 1803 },
      { phase: "tx_submitted", entityId: 7, wallTimeMs: 1920, txHash: "0x2" },
      { phase: "move_requested", entityId: 7, wallTimeMs: 5000 },
    ];
    expect(
      describeBurst({
        presses,
        taps: [{ verb: "Explore" }, { verb: null }, { verb: "Move" }],
        armyTrace,
        from: 900,
        to: 2500,
      }),
    ).toEqual({
      presses: 3,
      pressSpacingMs: [400, 400],
      offered: ["Explore", null, "Move"],
      commands: [
        { kind: "explore", afterPressMs: 2, hash: "0x1", confirmedAfterMs: 188 },
        { kind: "move", afterPressMs: 3, hash: "0x2", confirmedAfterMs: null },
      ],
    });
  });
});

describe("judgeBurst", () => {
  const confirmedMove = { kind: "move", afterPressMs: 1, hash: "0x1", confirmedAfterMs: 150 };

  it("fails an offered order that was never sent: a silent drop is not a refusal", () => {
    expect(judgeBurst({ taps: [{ verb: "Move" }, { verb: null }], commands: [] })).toEqual({
      status: "failed",
      reason: "1 orders offered, 0 seen refused, only 0 sent and confirmed: the rest were dropped silently",
    });
  });

  it("fails a requested command that never got a hash", () => {
    const unsent = { ...confirmedMove, hash: null };
    expect(judgeBurst({ taps: [{ verb: "Move" }], commands: [unsent] }).reason).toBe(
      "1 commands were requested but never sent (no hash)",
    );
  });

  it("completes when every offered order was confirmed or seen refused", () => {
    expect(
      judgeBurst({
        taps: [{ verb: "Move" }, { verb: "Move", seen: "refused" }, { verb: null }],
        commands: [confirmedMove],
      }),
    ).toEqual({ status: "completed", offered: 2, seenRefused: 1, confirmed: 1 });
  });

  it("is blocked when no tap offered an order", () => {
    expect(judgeBurst({ taps: [{ verb: "short" }, { verb: null }], commands: [] })).toEqual({
      status: "blocked",
      reason: "the army cannot pay for an order (the order bar shows a short cost)",
    });
  });
});

describe("assertInTargetGame", () => {
  const frontier = { chainId: "0x4445", gameId: 1 };

  it("reads the game a route is in", () => {
    expect(gameOfPath("/g/0x4445/4/map")).toEqual({ chainId: "0x4445", gameId: 4 });
    expect(gameOfPath("/sign-in")).toBeNull();
  });

  it("refuses to play when the home page's call to action led to another game than the target", () => {
    expect(() => assertInTargetGame("/g/0x4445/4/hex", frontier)).toThrow(
      "entered game 4 on 0x4445, not the target game 1 on 0x4445: no order was sent",
    );
    expect(() => assertInTargetGame("/sign-in", frontier)).toThrow("entered /sign-in, not the target game 1");
    expect(assertInTargetGame("/g/0x004445/1/map", frontier)).toEqual({ chainId: "0x004445", gameId: 1 });
  });
});
