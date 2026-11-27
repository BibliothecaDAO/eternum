import { useNativeFacts } from "@/hooks/helpers/use-native-facts";
import { configManager } from "@bibliothecadao/eternum";
import type { NativeFactStore, NativeModelName } from "@bibliothecadao/eternum/game-client";
import { type AspectId, catalogAspectId } from "@bibliothecadao/types";
import { useMemo } from "react";

const ASPECT_MODELS: readonly NativeModelName[] = ["HomeAspect", "Structure"];

const parseFeltAddress = (address: string | bigint | null | undefined): bigint | null => {
  if (typeof address === "bigint") return address === 0n ? null : address;
  if (typeof address !== "string") return null;
  const trimmed = address.trim();
  if (!trimmed) return null;
  try {
    const felt = BigInt(trimmed);
    return felt === 0n ? null : felt;
  } catch {
    return null;
  }
};

export const readPlayerAspects = (store: NativeFactStore, gameId: number): ReadonlyMap<bigint, AspectId> => {
  const byPlayer = new Map<bigint, AspectId>();
  for (const membership of store.inGame("HomeAspect", gameId)) {
    const aspect = catalogAspectId(membership.aspect);
    const structure = store.get("Structure", { game_id: gameId, entity_id: membership.home });
    if (structure && structure.owner !== 0n) {
      byPlayer.set(structure.owner, aspect);
    }
  }
  return byPlayer;
};

export const playerAspectOf = (
  aspects: ReadonlyMap<bigint, AspectId>,
  address: string | bigint | null | undefined,
): AspectId | null => {
  const felt = parseFeltAddress(address);
  return felt === null ? null : (aspects.get(felt) ?? null);
};

export const usePlayerAspects = (): ReadonlyMap<bigint, AspectId> => {
  const facts = useNativeFacts(ASPECT_MODELS);
  const gameId = configManager.getActiveGameId();
  return useMemo(() => readPlayerAspects(facts.store, gameId), [facts, gameId]);
};
