import { CAPTURE_AFTERMATH, isViewerOwner } from "@bibliothecadao/eternum";
import { StructureType } from "@bibliothecadao/types";
import type { Headline } from "./headline-types";

/** A realm or hyperstructure that changed hands, as the native Structure row's transition shows it. */
interface Capture {
  structureId: number;
  isHyperstructure: boolean;
  /** The structure's shared name; null when the world reader does not hold it yet. */
  structureName: string | null;
  previousOwner: bigint;
  newOwner: bigint;
  site: { x: number; y: number } | null;
  /** The player this client views, who reads as "you" when the capture was theirs to lose. */
  viewer: bigint | null;
  nameOf: (owner: bigint) => string;
  at: number;
}

/**
 * The War Report for a capture: who took what from whom, and, when a player held it, what went with it. The viewer who
 * lost it reads "from you".
 */
export function buildCaptureHeadline(capture: Capture): Headline {
  const type = capture.isHyperstructure ? "hyper-capture" : "realm-fall";
  const playerLost = isViewerOwner(capture.previousOwner, capture.viewer);
  const structure = capture.structureName ?? (capture.isHyperstructure ? "a hyperstructure" : "a structure");
  const holder = playerLost ? "you" : capture.nameOf(capture.previousOwner);
  const taken = `${capture.nameOf(capture.newOwner)} took ${structure} from ${holder}`;
  return {
    id: `capture:${capture.structureId}:${capture.previousOwner}:${capture.newOwner}:${capture.at}`,
    type,
    icon: type,
    title: captureTitle(capture.isHyperstructure, isViewerOwner(capture.newOwner, capture.viewer), playerLost),
    description: capture.previousOwner === 0n ? taken : `${taken}. ${CAPTURE_AFTERMATH}.`,
    location: capture.site ? { ...capture.site, entityId: capture.structureId } : undefined,
    action: captureIdentity(capture.structureId, capture.previousOwner, capture.newOwner),
    timestamp: capture.at,
  };
}

/** One capture, however it is told: its structure, who held it, who took it; its story and its headline share it. */
export const captureIdentity = (structureId: unknown, previousOwner: unknown, newOwner: unknown): string =>
  `capture:${BigInt(String(structureId))}:${BigInt(String(previousOwner))}:${BigInt(String(newOwner))}`;

const captureTitle = (isHyperstructure: boolean, playerTook: boolean, playerLost: boolean) => {
  if (isHyperstructure) return "Hyperstructure seized";
  if (playerTook) return "Realm captured";
  if (playerLost) return "Realm lost";
  return "Realm falls";
};

/** Realms and hyperstructures; rifts and camps change hands too often to be news. */
export const NEWSWORTHY_CAPTURES = new Set<StructureType>([StructureType.Realm, StructureType.Hyperstructure]);
