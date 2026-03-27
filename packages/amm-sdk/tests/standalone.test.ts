import { describe, expect, it } from "vitest";
import {
  DEFAULT_STANDALONE_AMM_ADDRESS,
  DEFAULT_STANDALONE_AMM_INDEXER_URL,
  DEFAULT_STANDALONE_AMM_LORDS_ADDRESS,
  STANDALONE_AMM_RESOURCES,
  resolveStandaloneAmmTokenName,
} from "../src";

describe("standalone AMM defaults", () => {
  it("ships a local preview indexer URL and non-empty standalone contract defaults", () => {
    expect(DEFAULT_STANDALONE_AMM_ADDRESS).toMatch(/^0x[0-9a-f]+$/i);
    expect(DEFAULT_STANDALONE_AMM_INDEXER_URL).toBe("http://127.0.0.1:3001");
    expect(DEFAULT_STANDALONE_AMM_LORDS_ADDRESS).toBe(
      "0x124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
    );
  });

  it("resolves mainnet standalone resource addresses into readable pool names", () => {
    expect(resolveStandaloneAmmTokenName("0x40d8907cec0f7ae9c364dfb12485a1314d84c129bf1898d2f3d4b7fcc7d44f4")).toBe(
      "Wood",
    );
    expect(resolveStandaloneAmmTokenName(DEFAULT_STANDALONE_AMM_LORDS_ADDRESS)).toBe("LORDS");
    expect(resolveStandaloneAmmTokenName("0x0695b08ecdfdd828c2e6267da62f59e6d7543e690ef56a484df25c8566b332a5")).toBe(
      "Ancient Fragment",
    );
    expect(resolveStandaloneAmmTokenName("0x65444738984a01c4eb7ab1b5236904c5a2ffdb8825d86919f284fd2d27ebf2e")).toBe(
      "Crossbowman II",
    );
  });

  it("lists standalone preview pools without duplicating the LORDS side of the market", () => {
    expect(STANDALONE_AMM_RESOURCES.length).toBeGreaterThan(20);
    expect(
      STANDALONE_AMM_RESOURCES.every((resource) => resource.address !== DEFAULT_STANDALONE_AMM_LORDS_ADDRESS),
    ).toBe(true);
    expect(STANDALONE_AMM_RESOURCES.some((resource) => resource.name === "LORDS")).toBe(false);
    expect(STANDALONE_AMM_RESOURCES.some((resource) => resource.name === "Fish")).toBe(true);
  });
});
