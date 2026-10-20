import { describe, expect, it, vi } from "vitest";
import {
  buildRendererDebugUrl,
  buildRendererRecoveryUrl,
  buildRendererUrl,
  DEFAULT_RENDERER_BUILD_MODE,
  readRendererPreference,
  removeRetiredRendererModePreference,
  resolveRendererBuildMode,
  resolveRendererBuildModeFromSearch,
  writeRendererPreference,
} from "./renderer-build-mode";

describe("renderer build mode", () => {
  it("ships the WebGPU renderer with automatic WebGL2 fallback", () => {
    expect(resolveRendererBuildMode(undefined)).toBe(DEFAULT_RENDERER_BUILD_MODE);
    expect(DEFAULT_RENDERER_BUILD_MODE).toBe("webgpu-auto");
  });

  it("accepts retired deployment names as aliases", () => {
    expect(resolveRendererBuildMode(["experimental", "webgpu", "auto"].join("-"))).toBe("webgpu-auto");
    expect(resolveRendererBuildMode(["experimental", "webgpu", "force", "webgl"].join("-"))).toBe("webgpu-force-webgl");
  });

  it("uses a supported query override and ignores unknown values", () => {
    expect(
      resolveRendererBuildModeFromSearch({
        envBuildMode: "webgpu-auto",
        saved: null,
        search: "?rendererMode=webgpu-force-webgl",
      }),
    ).toBe("webgpu-force-webgl");
    expect(resolveRendererBuildMode("bogus")).toBe("webgpu-auto");
  });

  it("asks for the address's renderer first, then the one saved in Settings, then the build's", () => {
    const ask = (search: string, saved: "webgpu-auto" | "webgpu-force-webgl" | null) =>
      resolveRendererBuildModeFromSearch({ envBuildMode: "webgpu-auto", saved, search });
    expect(ask("?rendererMode=webgpu-auto", "webgpu-force-webgl")).toBe("webgpu-auto");
    expect(ask("?col=4", "webgpu-force-webgl")).toBe("webgpu-force-webgl");
    expect(ask("?col=4", null)).toBe("webgpu-auto");
  });

  it("saves the renderer chosen in Settings and reads back only a renderer it knows", () => {
    const stored = new Map<string, string>();
    const storage = {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    };
    expect(readRendererPreference(storage)).toBeNull();
    writeRendererPreference(storage, "webgpu-force-webgl");
    expect(readRendererPreference(storage)).toBe("webgpu-force-webgl");
    stored.set("eternum-renderer", "bogus");
    expect(readRendererPreference(storage)).toBeNull();
  });

  it("reloads onto a renderer with the page's match, camera and spectator intent kept, and no debug logs", () => {
    const url = new URL(
      buildRendererUrl("https://game.test/g/0x1/6/map?spectate=true&col=4#world", "webgpu-force-webgl"),
    );
    expect([url.pathname, Object.fromEntries(url.searchParams), url.hash]).toEqual([
      "/g/0x1/6/map",
      { spectate: "true", col: "4", rendererMode: "webgpu-force-webgl" },
      "#world",
    ]);
  });

  it("removes the retired renderer preference", () => {
    const removeItem = vi.fn();
    removeRetiredRendererModePreference({ removeItem });
    expect(removeItem).toHaveBeenCalledWith("RENDERER_MODE");
  });

  it("recovers the same game and camera in WebGL without enabling debug logs", () => {
    const href =
      "https://localhost:4183/play/madara/game-28/map?col=5&row=3&spectate=true&rendererMode=webgpu-auto#world";
    const url = new URL(buildRendererRecoveryUrl(href));
    expect(url.pathname).toBe("/play/madara/game-28/map");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      col: "5",
      row: "3",
      spectate: "true",
      rendererMode: "webgpu-force-webgl",
    });
    expect(url.hash).toBe("#world");
    expect(buildRendererRecoveryUrl(url.href)).toBe(url.href);
  });

  it("builds an explicit renderer reload without dropping spectator intent", () => {
    const result = new URL(
      buildRendererDebugUrl(
        "https://game.test/play/madara/iron-age/map?spectate=true&col=4#world",
        "webgpu-force-webgl",
      ),
    );

    expect(result.pathname).toBe("/play/madara/iron-age/map");
    expect(result.searchParams.get("spectate")).toBe("true");
    expect(result.searchParams.get("col")).toBe("4");
    expect(result.searchParams.get("rendererMode")).toBe("webgpu-force-webgl");
    expect(result.searchParams.get("logs")).toBe("1");
    expect(result.hash).toBe("#world");
  });
});
