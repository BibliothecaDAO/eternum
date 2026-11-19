import { nativeFragmentConstants, type NativeFactStore } from "@bibliothecadao/eternum/game-client";
import { SPIRE_ARMY } from "@/ui/features/frontier/spire-fixture";
import { nativeReleaseConstants } from "../../../../../contracts/l3/world-native/schema/client.gen";

import { wire, type LabCommand, type LabFact, type LabScenario } from "./lab-chain";
import { armySpent, spireScenario } from "./spire-scenario";

const FRAGMENTS_HELD = 1_500n;
const STAMINA_LEFT = 20n;
const FRAGMENTS_KEY = "0xf7a1";
const SEAL_KEY = "0x5ea1";

export const shopScenario = (): LabScenario => {
  const spire = spireScenario();
  const { store } = spire;
  const army = store.require("ExplorerTroops", { game_id: 1, explorer_id: BigInt(SPIRE_ARMY) });
  const release = store.require("GameRelease", { game_id: 1 });
  store.applyFacts([
    {
      model: "GameRelease",
      key: store.wireKeyOf("GameRelease", release)!,
      value: wire({
        ...release,
        release_id: nativeReleaseConstants.SEAL_RELEASE,
        created_release_id: nativeReleaseConstants.SEAL_RELEASE,
      }),
    },
    {
      model: "ExplorerTroops",
      key: store.wireKeyOf("ExplorerTroops", army)!,
      value: wire({
        ...army,
        troops: {
          ...army.troops,
          stamina: { Inline: { amount: STAMINA_LEFT, settled_at: spire.startsAt, remainder: 0 } },
        },
      }),
    },
    fragmentsHeld(spire.player, FRAGMENTS_HELD),
  ] as never);
  return {
    ...spire,
    answer: (command, chain, now) => {
      if (command.kind === "BuyStamina") return staminaBought(command, chain, spire.player, now);
      if (command.kind === "BuySeal") return sealBought(chain, spire.player, now);
      return spire.answer(command, chain, now);
    },
  };
};

const staminaBought = (command: LabCommand, chain: NativeFactStore, player: string, now: number): LabFact[] => {
  const fragments = BigInt(command.fields.fragments);
  const points = fragments * BigInt(nativeFragmentConstants.STAMINA_PER_FRAGMENT);
  return [
    armySpent(chain, BigInt(command.fields.explorer_id), -points, now),
    fragmentsHeld(player, heldBy(chain, player) - fragments),
  ];
};

const sealBought = (chain: NativeFactStore, player: string, now: number): LabFact[] => {
  const seal = { game_id: 1, account: BigInt(player), granted_at: BigInt(now) };
  return [
    { model: "Seal", key: SEAL_KEY, value: wire(seal) },
    fragmentsHeld(player, heldBy(chain, player) - BigInt(nativeFragmentConstants.SEAL_FRAGMENTS)),
  ];
};

const heldBy = (chain: NativeFactStore, player: string): bigint =>
  chain.require("Fragments", { game_id: 1, account: BigInt(player) }).balance;

const fragmentsHeld = (player: string, balance: bigint): LabFact => {
  const row = { game_id: 1, account: BigInt(player), balance };
  return { model: "Fragments", key: FRAGMENTS_KEY, value: wire(row) };
};
