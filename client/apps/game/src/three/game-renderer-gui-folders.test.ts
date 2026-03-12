import { describe, expect, it } from "vitest";
import { createGameRendererGuiFoldersFixture } from "./game-renderer-gui-folders-fixture";

describe("GameRenderer GUI folders", () => {
  it("destroys tracked GUI folders during teardown", () => {
    const fixture = createGameRendererGuiFoldersFixture();

    fixture.destroy();

    expect(fixture.activeGuiFolders).toBe(0);
  });
});
