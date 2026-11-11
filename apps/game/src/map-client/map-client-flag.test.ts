import { describe, expect, it } from "vitest";

import { resolveMapClientFromSearch } from "./map-client-flag";

describe("resolveMapClientFromSearch", () => {
  it("keeps today's map unless the address asks for the trial", () => {
    expect(resolveMapClientFromSearch("")).toBe("today");
    expect(resolveMapClientFromSearch("?spectate=true")).toBe("today");
    expect(resolveMapClientFromSearch("?mapClient=anything")).toBe("today");
  });

  it("gives the trial when the address asks for it, among other parameters", () => {
    expect(resolveMapClientFromSearch("?spectate=true&mapClient=next&rendererMode=webgpu-force-webgl")).toBe("next");
  });
});
