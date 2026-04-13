import { afterEach, describe, expect, it } from "vitest";

import { consumePlayRouteHandoff, recordPlayRouteHandoff } from "./play-route-handoff";

describe("play-route handoff", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("consumes a fresh landing handoff once for the matching canonical play route", () => {
    recordPlayRouteHandoff({
      chain: "mainnet",
      worldName: "iron-age",
      scene: "hex",
      col: 4,
      row: 9,
      spectate: false,
    });

    expect(
      consumePlayRouteHandoff({
        chain: "mainnet",
        worldName: "iron-age",
        scene: "hex",
        col: 4,
        row: 9,
        spectate: false,
      }),
    ).toBe(true);

    expect(
      consumePlayRouteHandoff({
        chain: "mainnet",
        worldName: "iron-age",
        scene: "hex",
        col: 4,
        row: 9,
        spectate: false,
      }),
    ).toBe(false);
  });
});
