import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useGuideSeen } from "./guide-seen";

let latest: ReturnType<typeof useGuideSeen> | null = null;
const Probe = ({ player }: { player: string }) => {
  latest = useGuideSeen(7, player);
  return null;
};

const mount = async (player: string) => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(<Probe player={player} />));
  return root;
};

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  latest = null;
});

describe("useGuideSeen", () => {
  it("remembers dismissed lines per game and player, forgets them on replay, and turns every line off", async () => {
    const root = await mount("0xA1");
    await act(async () => latest!.markSeen(["arrival"]));
    expect(window.localStorage.getItem("frontier-guide:7:0xa1")).toBe('["arrival"]');
    await act(async () => latest!.replay());
    expect(latest!.seen.size).toBe(0);
    await act(async () => latest!.skipAll());
    expect(latest!.seen.has("season-over")).toBe(true);
    await act(async () => root.unmount());
  });

  it("still works when storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const root = await mount("0xB2");
    await act(async () => latest!.markSeen(["arrival", "deploy"]));
    expect([...latest!.seen]).toEqual(["arrival", "deploy"]);
    await act(async () => root.unmount());
  });
});
