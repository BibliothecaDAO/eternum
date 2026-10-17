// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { GameProvider } from "@/hooks/context/game-context";
import { frontierDay } from "@/ui/features/frontier/deploy/deploy-fixture";
import { setBlockTimestampSource } from "@bibliothecadao/eternum";
import type { GameClientSetup } from "@bibliothecadao/eternum/game-client";
import { RESOURCE_PRECISION, ResourcesIds } from "@bibliothecadao/types";
import { nativePresetForId, nativePresetIdFor } from "../../../../../../config/source/native";
import { useRelicEssenceStatus, useRelicMetadata } from "./hooks/use-relic-activation";
import { relicLine } from "./relic-words";

/** The deploy fixture's realm 7 under the Blitz preset's relic rules, holding the Essence given (and producing none). */
const realmWithEssence = (essence: number) => {
  const { store } = frontierDay();
  store.applyFacts([
    {
      model: "RelicRules",
      key: "0xa1",
      value: { game_id: 1, rules: nativePresetForId(nativePresetIdFor("blitz")).relics },
    },
    {
      model: "ResourceBalance",
      key: "0xe38e",
      value: {
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Essence,
        balance: String(BigInt(essence) * BigInt(RESOURCE_PRECISION)),
      },
    },
    {
      model: "ResourceProduction",
      key: "0xf38",
      value: {
        game_id: 1,
        entity_id: 7,
        resource_type: ResourcesIds.Essence,
        building_count: 0,
        production_rate: "0",
        output_amount_left: "0",
        last_settled_at: 350,
      },
    },
  ] as never);
  return store;
};

/** What the activation surfaces read for Damage Relic I held by realm 7: its cost and whether the realm can pay it. */
const activationFor = (store: ReturnType<typeof realmWithEssence>) => {
  const Probe = () => {
    const { essenceCost } = useRelicMetadata(ResourcesIds.DamageRelic1);
    const { hasEnoughEssence, shortfall } = useRelicEssenceStatus(7, essenceCost);
    return <output>{JSON.stringify({ essenceCost, hasEnoughEssence, shortfall })}</output>;
  };
  const host = document.createElement("div");
  const root = createRoot(host);
  act(() =>
    root.render(
      <GameProvider value={{ store } as unknown as GameClientSetup} account={{ address: "0x111" } as never}>
        <Probe />
      </GameProvider>,
    ),
  );
  const read = JSON.parse(host.textContent ?? "null") as {
    essenceCost: number;
    hasEnoughEssence: boolean;
    shortfall: string;
  };
  act(() => root.unmount());
  return read;
};

afterEach(() => setBlockTimestampSource(null));

it("prices a relic in whole Essence as the preset sets it, and refuses an activation the holding cannot pay", () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

  const short = realmWithEssence(249);
  expect(relicLine(ResourcesIds.DamageRelic1)).toMatch(/Costs 250 Essence to activate\.$/);
  expect(relicLine(ResourcesIds.DamageRelic2)).toMatch(/Costs 500 Essence to activate\.$/);
  expect(relicLine(ResourcesIds.DamageRelic2, 200)).toMatch(/Costs 500 Essence to activate; you have 200\.$/);
  expect(relicLine(ResourcesIds.DamageRelic2, 500)).toMatch(/Costs 500 Essence to activate\.$/);
  expect(activationFor(short)).toEqual({
    essenceCost: 250,
    hasEnoughEssence: false,
    shortfall: "Need 1 more essence.",
  });

  expect(activationFor(realmWithEssence(250))).toMatchObject({ essenceCost: 250, hasEnoughEssence: true });
});
