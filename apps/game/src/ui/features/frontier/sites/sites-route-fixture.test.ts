import { afterEach, expect, it, vi } from "vitest";
import { Position, setBlockTimestampSource } from "@bibliothecadao/eternum";
import { getHexDistance } from "@bibliothecadao/types";
import { useChainTimeStore } from "@/hooks/store/use-chain-time-store";
import { useAccountStore } from "@/hooks/store/use-account-store";
import { sitesBeside } from "./site-fixture";
import { stageFrontierSites } from "../../../../../scripts/frontier-sites-route-fixture.mjs";

const active = vi.hoisted(() => ({ client: null as unknown }));
vi.mock("@/sync/active-game-client", async (original) => ({
  ...(await original<typeof import("@/sync/active-game-client")>()),
  requireActiveGameClient: () => active.client,
  startRealmVisit: () => undefined,
}));
afterEach(() => {
  vi.restoreAllMocks();
  useAccountStore.setState({ account: null });
  setBlockTimestampSource(null);
});

/**
 * The sites proof's staging, on the sites fixture's Frontier day: a Shrine and a Well beside the army and a Shrine three
 * tiles off, the camera sent there through the minimap's Position contract, and a use that is recorded, answered as
 * the chain answers it (the tile emptied, the outcome applied) and never signed.
 */
it("stages both sites beside the army, records a use as the chain answers it, and signs nothing", async () => {
  const { store } = sitesBeside(40n);
  useChainTimeStore.getState().anchor({ timestamp: 350_000 });
  const realWait = vi.fn();
  active.client = {
    setup: { store, systemCalls: {} },
    connect: () => undefined,
    visit: () => undefined,
    waitForAction: realWait,
  };
  const client = active.client as {
    setup: { systemCalls: Record<string, (input: unknown) => Promise<{ transaction_hash: string }>> };
    waitForAction: (hash: string) => Promise<{ status: string }>;
  };
  let requested: unknown;
  const hear = (event: Event) => (requested = (event as CustomEvent).detail);
  window.addEventListener("minimapCameraMove", hear);
  try {
    const fixture = stageFrontierSites();
    const { armyTile, sites } = fixture.summary;
    expect(requested).toBeInstanceOf(Position);
    expect((requested as Position).getContract()).toEqual({ x: armyTile.col, y: armyTile.row });
    const [shrine, well, far] = sites;
    expect(sites.map((site: { kind: string }) => site.kind)).toEqual(["Shrine", "Well", "FarShrine"]);
    expect(getHexDistance(shrine.tile, armyTile)).toBe(1);
    expect(getHexDistance(well.tile, armyTile)).toBe(1);
    expect(getHexDistance(far.tile, armyTile)).toBe(3);
    expect(sites.every((site: { standing: boolean }) => site.standing)).toBe(true);
    // The army's owner is the viewer, with an account that cannot sign.
    expect(() => (useAccountStore.getState().account as unknown as { execute: () => void }).execute()).toThrow(
      "cannot sign",
    );

    const sent = await client.setup.systemCalls.interact_site({
      explorer_id: fixture.armyId,
      coord: { alt: false, x: shrine.tile.col, y: shrine.tile.row },
    });
    expect(fixture.summary.sent).toEqual([
      { kind: "Shrine", explorerId: fixture.armyId, coord: { alt: false, x: shrine.tile.col, y: shrine.tile.row } },
    ]);
    expect(fixture.summary.sites[0].standing).toBe(false);
    expect(fixture.summary.armyTile).toEqual(armyTile);
    await expect(client.waitForAction(sent.transaction_hash)).resolves.toMatchObject({ status: "SUCCEEDED" });
    expect(realWait).not.toHaveBeenCalled();
    // Any other tile is no fixture site: the recorder refuses it rather than recording a use the proof did not stage.
    await expect(
      client.setup.systemCalls.interact_site({ explorer_id: fixture.armyId, coord: { alt: false, x: 0, y: 0 } }),
    ).rejects.toThrow("did not target a fixture site");
  } finally {
    window.removeEventListener("minimapCameraMove", hear);
  }
});
