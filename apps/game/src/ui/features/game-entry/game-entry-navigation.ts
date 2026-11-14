import { buildPlayHref, type PlayRouteDescriptor } from "@/play/navigation/play-route";
import { UNDEFINED_STRUCTURE_ENTITY_ID } from "@/ui/constants";
import type { GameRef } from "@bibliothecadao/eternum/game-client";

type WorldMapPosition = {
  col: number;
  row: number;
};

/** What the entry's address asked of the renderer (a backend, the map client, diagnostics): the map's address carries it on. */
type RendererRequest = Pick<PlayRouteDescriptor, "rendererMode" | "mapClient" | "verboseLogs">;

type ResolveGameEntryTargetInput = GameRef & {
  structureEntityId: number;
  worldMapReturnPosition: WorldMapPosition | null;
  isSpectateMode: boolean;
  /** A player who has just created their realm in this entry: they arrive in it, to build. */
  realmFirst: boolean;
  renderer?: RendererRequest;
};

type ResolvedGameEntryTarget = {
  spectator: boolean;
  structureEntityId: number;
  url: string;
  worldMapPosition: WorldMapPosition | null;
};

const isFiniteCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/**
 * A session opens on the world map, the realm view one press of Realm away (owner, 19 October 2026), except the entry
 * that has just created the player's realm: the map boots, then hands off to the realm, where its first build is marked
 * (the owner's pick F3, 4 November 2026). The renderer request the entry was opened with goes on to the map, where the
 * renderer reads it.
 */
const buildCanonicalGameEntryUrl = ({
  chainId,
  gameId,
  isSpectateMode,
  realmFirst,
  worldMapPosition,
  renderer,
}: GameRef & {
  isSpectateMode: boolean;
  realmFirst: boolean;
  worldMapPosition: WorldMapPosition | null;
  renderer?: RendererRequest;
}) => {
  return buildPlayHref({
    ...renderer,
    bootMode: realmFirst ? "map-first" : "direct",
    chainId,
    gameId,
    col: worldMapPosition?.col ?? null,
    resumeScene: realmFirst ? "hex" : null,
    row: worldMapPosition?.row ?? null,
    scene: "map",
    spectate: isSpectateMode,
  });
};

const resolveBootstrappedWorldMapTarget = (
  input: ResolveGameEntryTargetInput,
): { structureEntityId: number; worldMapPosition: WorldMapPosition } | null => {
  if (input.structureEntityId <= UNDEFINED_STRUCTURE_ENTITY_ID || input.worldMapReturnPosition == null) {
    return null;
  }

  // The store keeps the map URL's hex already normalized (mapRouteHex), so it is used as it is.
  const { col, row } = input.worldMapReturnPosition;
  if (!isFiniteCoordinate(col) || !isFiniteCoordinate(row)) {
    return null;
  }

  return {
    structureEntityId: input.structureEntityId,
    worldMapPosition: { col, row },
  };
};

/** Only a player arrives in their realm; a spectator starts on the map. */
const arrivesInRealm = (input: ResolveGameEntryTargetInput): boolean => input.realmFirst && !input.isSpectateMode;

const buildWorldMapEntryTargetFromBootstrappedSelection = (
  input: ResolveGameEntryTargetInput,
  target: { structureEntityId: number; worldMapPosition: WorldMapPosition },
): ResolvedGameEntryTarget => {
  return {
    spectator: input.isSpectateMode,
    structureEntityId: target.structureEntityId,
    url: buildCanonicalGameEntryUrl({
      chainId: input.chainId,
      gameId: input.gameId,
      worldMapPosition: target.worldMapPosition,
      isSpectateMode: input.isSpectateMode,
      realmFirst: arrivesInRealm(input),
      renderer: input.renderer,
    }),
    worldMapPosition: target.worldMapPosition,
  };
};

const buildFallbackGameEntryTarget = (input: ResolveGameEntryTargetInput): ResolvedGameEntryTarget => {
  return {
    spectator: input.isSpectateMode,
    structureEntityId: 0,
    url: buildCanonicalGameEntryUrl({
      chainId: input.chainId,
      gameId: input.gameId,
      worldMapPosition: null,
      isSpectateMode: input.isSpectateMode,
      // Entered before the realm is selected, the hand-off waits for it rather than settling on the map.
      realmFirst: arrivesInRealm(input),
      renderer: input.renderer,
    }),
    worldMapPosition: null,
  };
};

export const resolveGameEntryTarget = ({
  chainId,
  gameId,
  structureEntityId,
  worldMapReturnPosition,
  isSpectateMode,
  realmFirst,
  renderer,
}: ResolveGameEntryTargetInput): ResolvedGameEntryTarget => {
  const input = {
    chainId,
    gameId,
    structureEntityId,
    worldMapReturnPosition,
    isSpectateMode,
    realmFirst,
    renderer,
  };
  const bootstrappedWorldMapTarget = resolveBootstrappedWorldMapTarget(input);

  if (bootstrappedWorldMapTarget) {
    return buildWorldMapEntryTargetFromBootstrappedSelection(input, bootstrappedWorldMapTarget);
  }

  return buildFallbackGameEntryTarget(input);
};
