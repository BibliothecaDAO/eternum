// @vitest-environment node

import { beforeEach, describe, expect, it } from "vitest";

import {
  buildWorldDeployment,
  getDefaultWorld,
  getWorldById,
  getWorldDirectory,
  installWorldDirectory,
} from "./world-directory";

const buildBlitzWorld = () =>
  buildWorldDeployment({
    id: "blitz",
    chain: "madara",
    manifest: {
      world: { address: "0xw0r1d" },
      contracts: [{ selector: "0xABC", address: "0x1" }],
    },
    heraldBaseUrl: "https://herald.realms.test/",
    rpcUrl: "https://rpc.realms.test/rpc/v0_9_0",
    browserFacing: false,
    playerAccountClassHash: "0x2",
    playerRegistryAddress: "0x3",
    bindingAuthorityAddress: "0x4",
  });

describe("buildWorldDeployment", () => {
  it("indexes manifest contracts by normalized selector and derives the namespace", () => {
    const world = buildBlitzWorld();
    expect(world.namespace).toBe("s2");
    expect(world.worldAddress).toBe("0xw0r1d");
    expect(world.contractsBySelector).toEqual({ [`0x${"abc".padStart(64, "0")}`]: "0x1" });
    expect(world.heraldBaseUrl).toBe("https://herald.realms.test");
    expect(world.rpcUrl).toBe("https://rpc.realms.test/rpc/v0_9_0");
  });

  it("rejects an endpoint that is not an absolute URL", () => {
    expect(() =>
      buildWorldDeployment({
        id: "blitz",
        chain: "madara",
        manifest: { world: { address: "0x0" }, contracts: [] },
        heraldBaseUrl: "https://herald.realms.test",
        rpcUrl: "",
        browserFacing: false,
        playerAccountClassHash: "0x2",
        playerRegistryAddress: "0x3",
        bindingAuthorityAddress: "0x4",
      }),
    ).toThrow('RPC URL for world "blitz" is required');
  });
});

describe("world directory", () => {
  beforeEach(() => {
    installWorldDirectory(() => [buildBlitzWorld()]);
  });

  it("resolves worlds by id and falls back to the first world as default", () => {
    expect(getWorldById("blitz")?.id).toBe("blitz");
    expect(getWorldById("eternum")).toBeNull();
    expect(getWorldById(null)).toBeNull();
    expect(getDefaultWorld().id).toBe("blitz");
  });

  it("builds the directory once per install", () => {
    let builds = 0;
    installWorldDirectory(() => {
      builds += 1;
      return [buildBlitzWorld()];
    });
    getWorldDirectory();
    getWorldDirectory();
    expect(builds).toBe(1);
  });
});
