import { describe, expect, test } from "bun:test";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";

const GAME_DIRECTORY = path.resolve(import.meta.dir, "../../../../contracts/l3/game");
const BLITZ_PROFILE = path.join(GAME_DIRECTORY, "dojo_appchain_blitz.toml");
const ETERNUM_PROFILE = path.join(GAME_DIRECTORY, "dojo_appchain_eternum.toml");

interface AppchainManifest {
  world: { address: string; seed: string };
  contracts: Array<{ tag: string; class_hash: string }>;
  models: Array<{ tag: string; class_hash: string }>;
  events: Array<{ tag: string; class_hash: string }>;
}

function removeWorldIdentity(profile: string): string {
  return profile
    .replace(/^seed = .*$/m, "seed = <world>")
    .replace(/^name = .*$/m, "name = <world>")
    .replace(/^description = .*$/m, "description = <world>")
    .replace(/^world_address = .*$/gm, "world_address = <world>");
}

async function readManifest(name: "blitz" | "eternum"): Promise<AppchainManifest> {
  return await Bun.file(path.join(GAME_DIRECTORY, `manifest_appchain_${name}.json`)).json();
}

function resourceClasses(entries: Array<{ tag: string; class_hash: string }>): string[] {
  return entries.map((entry) => `${entry.tag}:${entry.class_hash}`).sort();
}

describe("dual appchain world profiles", () => {
  test("keeps both profiles identical outside world identity", async () => {
    const blitz = await Bun.file(BLITZ_PROFILE).text();
    const eternum = await Bun.file(ETERNUM_PROFILE).text();

    expect(removeWorldIdentity(blitz)).toBe(removeWorldIdentity(eternum));
    expect(blitz).toContain('default = "s2"');
    expect(blitz).toContain('seed = "s2_blitz_1"');
    expect(eternum).toContain('seed = "s2_eternum_1"');
    expect(existsSync(path.join(GAME_DIRECTORY, "dojo_appchain.toml"))).toBe(false);
  });

  test("maps executable hyphen profiles to the canonical configs", () => {
    expect(realpathSync(path.join(GAME_DIRECTORY, "dojo_appchain-blitz.toml"))).toBe(realpathSync(BLITZ_PROFILE));
    expect(realpathSync(path.join(GAME_DIRECTORY, "dojo_appchain-eternum.toml"))).toBe(realpathSync(ETERNUM_PROFILE));
  });

  test("commits two worlds with the same resource classes", async () => {
    const blitz = await readManifest("blitz");
    const eternum = await readManifest("eternum");

    expect(blitz.world.seed).toBe("s2_blitz_1");
    expect(eternum.world.seed).toBe("s2_eternum_1");
    expect(blitz.world.address).not.toBe(eternum.world.address);
    expect(resourceClasses(blitz.contracts)).toEqual(resourceClasses(eternum.contracts));
    expect(resourceClasses(blitz.models)).toEqual(resourceClasses(eternum.models));
    expect(resourceClasses(blitz.events)).toEqual(resourceClasses(eternum.events));
    expect(blitz.contracts.every((entry) => entry.tag.startsWith("s2-"))).toBe(true);
    expect(eternum.contracts.every((entry) => entry.tag.startsWith("s2-"))).toBe(true);
  });
});
