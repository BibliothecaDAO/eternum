import { describe, expect, it } from "vitest";

import {
  buildPlaytestUrl,
  collectBrowserErrors,
  collectFrameSpikes,
  refusalErrors,
  comparePlaytestSummary,
  deriveBootMetrics,
  evaluatePlaytestSummary,
  hasEntryFinished,
  selectPlaytestGame,
  summarizePlaytestResults,
  summarizeRpcSends,
  summarizeStep,
  describeOrders,
  eligibilityOf,
  assertInTargetGame,
  gameOfPath,
  judgeNextOrder,
  judgeExplore,
  judgeBurst,
} from "./evidence.mjs";

describe("buildPlaytestUrl", () => {
  it("enters the game by Play's Watch link, with the dev overlays off", () => {
    expect(
      buildPlaytestUrl({ baseUrl: "https://127.0.0.1:4173", chainId: "0xa1", gameId: 4, rendererMode: "webgpu-auto" }),
    ).toBe("https://127.0.0.1:4173/g/0xa1/4?spectate=true&rendererMode=webgpu-auto&dev=0");
  });

  it("turns the dev overlays on for steps that play the dev tools", () => {
    const url = buildPlaytestUrl({
      baseUrl: "https://127.0.0.1:4173",
      chainId: "0xa1",
      gameId: 4,
      rendererMode: "webgpu-auto",
      devOverlays: true,
    });
    expect(new URL(url).searchParams.get("dev")).toBe("1");
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

  it("measures the step's frames, long frames, inputs, heap, label elements and Herald messages to their frame", () => {
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
        labelNodes: [
          [990, 900],
          [1000, 240],
          [1100, 260],
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
      labelNodes: { n: 2, p50: 240, p95: 260, p99: 260, max: 260 },
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

  it("leaves out what the client logged for a failure a step provoked, and only that", () => {
    const refused = "[error] Transaction 0x79 not sent (refused)";
    expect(collectBrowserErrors("", `${refused}\n[error] shader failed`, [refused])).toEqual(["[error] shader failed"]);
  });
});

describe("refusalErrors", () => {
  const refusal = [
    "[error] Transaction failed: Transaction 0x79f not sent (refused)",
    "[error] System call error: Transaction 0x79f not sent (refused)",
    '[error] Army movement failed: {transactionHash: "0x79f", name: "TransactionNotSentError"}',
  ];

  it("exempts only the lines of the refused transaction; an unrelated error in the same window still fails", () => {
    const window = [...refusal, "[error] Unrelated renderer failure", "[log] ready"];
    const provoked = refusalErrors(window);
    expect(provoked).toEqual(refusal);
    expect(collectBrowserErrors("", window.join("\n"), provoked)).toEqual(["[error] Unrelated renderer failure"]);
  });

  it("exempts nothing when two transactions were refused, or none was", () => {
    expect(refusalErrors([...refusal, "[error] Transaction failed: Transaction 0x5ee not sent (refused)"])).toEqual([]);
    expect(refusalErrors(["[error] Unrelated renderer failure"])).toEqual([]);
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
  it("counts each node's JSON-RPC methods: sends, refused, on a fresh connection, and their durations", () => {
    const shard = { host: "rpc.shard.test", status: 200, rpcError: null };
    expect(
      summarizeRpcSends([
        { ...shard, rpcMethod: "starknet_addInvokeTransaction", connectionReused: false, connectMs: 40, totalMs: 160 },
        { ...shard, rpcMethod: "starknet_addInvokeTransaction", connectionReused: true, connectMs: null, totalMs: 110 },
        { ...shard, rpcMethod: "starknet_getNonce", connectionReused: true, totalMs: 105 },
        { ...shard, rpcMethod: "starknet_getNonce", connectionReused: true, totalMs: 90, rpcError: "Invalid params" },
        { ...shard, rpcMethod: "starknet_getNonce", connectionReused: true, totalMs: 80, status: 403 },
        { host: "l2.test", rpcMethod: "preflight", connectionReused: false, connectMs: 30, totalMs: 60, status: 204 },
      ]),
    ).toEqual({
      "rpc.shard.test": {
        starknet_addInvokeTransaction: {
          count: 2,
          refused: 0,
          freshConnections: 1,
          totalMs: { n: 2, p50: 110, p95: 160, p99: 160, max: 160 },
          freshConnectMs: { n: 1, p50: 40, p95: 40, p99: 40, max: 40 },
        },
        starknet_getNonce: {
          count: 3,
          refused: 2,
          freshConnections: 0,
          totalMs: { n: 3, p50: 90, p95: 105, p99: 105, max: 105 },
          freshConnectMs: null,
        },
      },
      "l2.test": {
        preflight: {
          count: 1,
          refused: 0,
          freshConnections: 1,
          totalMs: { n: 1, p50: 60, p95: 60, p99: 60, max: 60 },
          freshConnectMs: { n: 1, p50: 30, p95: 30, p99: 30, max: 30 },
        },
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

  it("fails an explore whose army's plate climbed back to an older bar while it settled", () => {
    const action = explore({ store_applied: 1190, rendered: 1230 }, { transactionHash: "0xabc" });
    // Army 2's third explore on dev Frontier (c6006261cbb): 90, then its first explore's 120 for a second, then 60.
    const staleWalk = [
      [500, 90],
      [1000, 90],
      [1500, 120],
      [2000, 120],
      [2500, 60],
    ];
    expect(judgeExplore({ ...pressed(41.5), plateStamina: staleWalk }, [action]).reason).toBe(
      "the army's plate read 90 stamina, then 120: a bar it no longer has",
    );
    // The bar paid, then regenerating; a reading before the press and a deselected plate are not judged.
    const paidThenRegenerating = [
      [500, 150],
      [1000, 90],
      [1500, null],
      [2000, 60],
      [2500, 61],
    ];
    expect(judgeExplore({ ...pressed(41.5), plateStamina: paidThenRegenerating }, [action]).status).toBe("completed");
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

describe("describeOrders", () => {
  it("lists the army's commands with hash and confirmation, and each next-order step with its tile, in the window", () => {
    const armyTrace = [
      { phase: "move_requested", entityId: 7, wallTimeMs: 1002 },
      { phase: "explore_intent_queued", entityId: 7, wallTimeMs: 1002 },
      { phase: "next_order_queued", entityId: 7, wallTimeMs: 1050, details: { col: 3, row: 4 } },
      { phase: "tx_submitted", entityId: 7, wallTimeMs: 1120, txHash: "0x1" },
      { phase: "tx_confirmed", entityId: 7, wallTimeMs: 1190 },
      { phase: "next_order_run", entityId: 7, wallTimeMs: 1200, details: { col: 3, row: 4 } },
      { phase: "move_requested", entityId: 7, wallTimeMs: 1201 },
      { phase: "next_order_dropped", entityId: 7, wallTimeMs: 1300, details: { col: 5, row: 4, reason: "replaced" } },
      { phase: "move_requested", entityId: 7, wallTimeMs: 5000 },
    ];
    expect(describeOrders({ armyTrace, from: 900, to: 2500 })).toEqual({
      commands: [
        { kind: "explore", hash: "0x1", confirmed: true },
        { kind: "move", hash: null, confirmed: false },
      ],
      next: [
        { step: "queued", hex: { col: 3, row: 4 } },
        { step: "run", hex: { col: 3, row: 4 } },
        { step: "dropped:replaced", hex: { col: 5, row: 4 } },
      ],
    });
  });
});

describe("judgeNextOrder", () => {
  const played = { army: "Army 1", targets: {}, firstSent: true, queuedShown: true };
  const confirmed = { kind: "move", hash: "0x1", confirmed: true };
  const queued = (col) => ({ step: "queued", hex: { col, row: 4 } });
  const ran = (col) => ({ step: "run", hex: { col, row: 4 } });
  const runs = { next: ["queued", "run"], confirmed: 2 };

  it("completes a next order that ran behind the order in flight, as the tile last queued", () => {
    const orders = { commands: [confirmed, confirmed], next: [queued(3), ran(3)] };
    expect(judgeNextOrder({ expected: runs, played, orders })).toEqual({ status: "completed", orders });
  });

  it("fails a next order that never left the queue, or left another way than expected", () => {
    const stuck = { commands: [confirmed], next: [queued(3)] };
    expect(judgeNextOrder({ expected: runs, played, orders: stuck }).reason).toBe(
      "the next order went queued, not queued → run",
    );
    const dropped = { commands: [confirmed], next: [queued(3), { step: "dropped:out-of-reach", hex: {} }] };
    expect(judgeNextOrder({ expected: runs, played, orders: dropped }).reason).toBe(
      "the next order went queued → dropped:out-of-reach, not queued → run",
    );
  });

  it("fails when the order that ran was not confirmed, or is not the tile queued", () => {
    const unconfirmed = { commands: [confirmed, { ...confirmed, confirmed: false }], next: [queued(3), ran(3)] };
    expect(judgeNextOrder({ expected: runs, played, orders: unconfirmed }).reason).toBe(
      "1 orders were sent and confirmed, not 2",
    );
    const elsewhere = { commands: [confirmed, confirmed], next: [queued(3), ran(5)] };
    expect(judgeNextOrder({ expected: runs, played, orders: elsewhere }).reason).toBe(
      "the order that ran is not the tile last queued",
    );
  });

  it("fails when nothing was in flight or the order bar never showed the queue", () => {
    const orders = { commands: [confirmed, confirmed], next: [queued(3), ran(3)] };
    expect(judgeNextOrder({ expected: runs, played: { ...played, firstSent: false }, orders }).status).toBe("failed");
    expect(judgeNextOrder({ expected: runs, played: { ...played, queuedShown: false }, orders }).reason).toBe(
      "the order bar never showed the next order queued",
    );
  });

  it("is blocked, not failed, when the army has nothing to order", () => {
    const orders = { commands: [], next: [] };
    expect(judgeNextOrder({ expected: runs, played: { army: null }, orders }).status).toBe("blocked");
    const short = { army: "Army 1", targets: null, scanned: [{ verb: "short" }, { verb: null }] };
    expect(judgeNextOrder({ expected: runs, played: short, orders })).toEqual({
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

describe("judgeBurst", () => {
  const trace = (sequence, entityId, phase, wallTimeMs, details) => ({
    sequence,
    entityId,
    phase,
    wallTimeMs,
    details,
  });
  const played = { startedAt: 1_000, targets: [{ army: 7 }, { army: 8 }], burst: [{ army: 7 }, { army: 8 }] };
  const armyMovement = [
    trace(1, 7, "move_requested", 500, { actionType: "move" }),
    trace(2, 7, "move_requested", 1_100, { actionType: "move" }),
    trace(3, 8, "move_requested", 1_250, { actionType: "explore" }),
    trace(4, 7, "tx_response_received", 1_220),
    trace(5, 7, "tx_confirmed", 1_300),
    trace(6, 8, "tx_response_received", 1_370),
    trace(7, 7, "movement_started", 1_310),
    trace(8, 8, "tx_confirmed", 1_460),
  ];
  // An explore may leave its army where it stood: it shows as its reveal rendered.
  const clientActions = [
    { operation: "explore_reveal", entityId: 8, phases: { click: 400, rendered: 600 } },
    { operation: "explore_reveal", entityId: 8, phases: { click: 1_250, rendered: 1_490 } },
  ];

  it("times each order from its right-click to its answer, Herald's status and its move or its reveal on screen", () => {
    expect(judgeBurst(played, { armyMovement, clientActions })).toEqual({
      status: "completed",
      spanMs: 150,
      orders: [
        { army: 7, order: "move", requestedAt: 1_100, answeredMs: 120, confirmedMs: 200, visibleMs: 210 },
        { army: 8, order: "explore", requestedAt: 1_250, answeredMs: 120, confirmedMs: 210, visibleMs: 240 },
      ],
    });
  });

  it("fails a burst whose explore never rendered its reveal, and blocks one with a single army", () => {
    expect(judgeBurst(played, { armyMovement, clientActions: clientActions.slice(0, 1) })).toMatchObject({
      status: "failed",
      reason: "army 8's order never showed on screen",
    });
    expect(judgeBurst({ ...played, targets: [{ army: 7 }] }, { armyMovement, clientActions })).toMatchObject({
      status: "blocked",
      reason: "1 armies offered an order: a burst needs two",
    });
  });
});
