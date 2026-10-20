import { CAPTURE_AFTERMATH, isViewerOwner } from "@bibliothecadao/eternum";
import { NEUTRAL_OWNER_NAME, StructureType } from "@bibliothecadao/types";
import type { Headline, HeadlinePart } from "./headline-types";

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
  const holder = playerLost ? "you" : owner(capture.previousOwner);
  const taken: HeadlinePart[] = [owner(capture.newOwner), ` took ${structure} from `, holder];
  return {
    id: `capture:${capture.structureId}:${capture.previousOwner}:${capture.newOwner}:${capture.at}`,
    type,
    icon: type,
    title: captureTitle(capture.isHyperstructure, isViewerOwner(capture.newOwner, capture.viewer), playerLost),
    description: capture.previousOwner === 0n ? taken : [...taken, `. ${CAPTURE_AFTERMATH}.`],
    location: capture.site ? { ...capture.site, entityId: capture.structureId } : undefined,
    timestamp: capture.at,
  };
}

/** An owner as the line names it: nobody's is the neutral side, a player is named where the line is drawn. */
const owner = (account: bigint): HeadlinePart => (account === 0n ? NEUTRAL_OWNER_NAME : { player: account });

const captureTitle = (isHyperstructure: boolean, playerTook: boolean, playerLost: boolean) => {
  if (isHyperstructure) return "Hyperstructure seized";
  if (playerTook) return "Realm captured";
  if (playerLost) return "Realm lost";
  return "Realm falls";
};

/** Realms and hyperstructures; rifts and camps change hands too often to be news. */
export const NEWSWORTHY_CAPTURES = new Set<StructureType>([StructureType.Realm, StructureType.Hyperstructure]);
