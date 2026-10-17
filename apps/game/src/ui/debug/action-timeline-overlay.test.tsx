import { act, Profiler } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  beginClientActionLatency,
  clearClientActionLatency,
  recordClientActionRendered,
  recordClientActionSendStage,
  recordClientActionSubmitted,
} from "@/observability/client-action-latency";
import { ActionTimelineOverlay } from "./action-timeline-overlay";

let host: HTMLDivElement;
let root: Root;
let clock = 0;
const at = (ms: number) => (clock = ms);

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  clearClientActionLatency();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("the action timeline", () => {
  it("shows nothing to a player and does not re-render while actions are recorded", () => {
    window.history.replaceState({}, "", "/g/0x1/2/map");
    let commits = 0;
    act(() =>
      root.render(
        <Profiler id="timeline" onRender={() => (commits += 1)}>
          <ActionTimelineOverlay />
        </Profiler>,
      ),
    );
    const mounted = commits;

    act(() => recordClientActionSendStage("1:1", "command"));
    act(() => recordClientActionSendStage("1:1", "release-ready"));
    act(() => void beginClientActionLatency({ operation: "explore_reveal", surface: "worldmap" }));

    expect(host.textContent).toBe("");
    expect(commits - mounted).toBe(0);
  });

  it("names, under ?logs=1, each step of an action's send and its stream, timed from the click", () => {
    window.history.replaceState({}, "", "/g/0x1/2/map?logs=1");
    act(() => root.render(<ActionTimelineOverlay />));

    act(() => {
      at(1_000);
      const action = beginClientActionLatency({ operation: "explore_reveal", surface: "worldmap" });
      at(1_200);
      recordClientActionSendStage("1:1", "command");
      at(1_203);
      recordClientActionSendStage("1:1", "release-ready");
      recordClientActionSendStage("1:1", "left-queue");
      recordClientActionSendStage("1:1", "nonce", "known", "0xabc");
      at(40_200);
      recordClientActionSendStage("1:1", "answered", "proxy", "0xabc");
      recordClientActionSubmitted(action, "0xabc");
      at(40_230);
      recordClientActionSendStage("1:1", "included", "herald", "0xabc");
      recordClientActionSendStage("1:1", "settled", undefined, "0xabc");
      at(40_500);
      recordClientActionRendered(action);
      at(41_000);
      recordClientActionSendStage("1:2", "command");
      at(41_090);
      recordClientActionSendStage("1:2", "settled", "TransactionNotSentError");
    });

    expect([...host.querySelectorAll("li")].map((line) => line.textContent)).toEqual([
      "send 1:2 · command +0ms · settled TransactionNotSentError +90ms",
      "explore_reveal · command +200ms · release-ready +203ms · left-queue +203ms · nonce known +203ms · " +
        "answered proxy +39.2s · submitted +39.2s · included herald +39.2s · settled +39.2s · rendered +39.5s",
    ]);
  });
});
