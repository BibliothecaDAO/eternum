import { CAPTURE_AFTERMATH, isViewerOwner } from "@bibliothecadao/eternum";
import {
  aspectName,
  catalogAspectId,
  DEEP_CAPTURE_LINES,
  NEUTRAL_OWNER_NAME,
  StructureType,
} from "@bibliothecadao/types";
import type { IconMeaning } from "@/ui/design-system/icon";
import { DEEP_CAPTURE_WORDS } from "@/ui/design-system/kit/words";
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

interface DeepCapture {
  structureId: number;
  site: { name: string; icon: IconMeaning; beast: string; at: { x: number; y: number } | null };
  newOwner: bigint;
  takerAspect: number;
  holderAspect: number | undefined;
  viewerAspects: ReadonlySet<number>;
  at: number;
}

export function buildDeepCaptureHeadline(capture: DeepCapture): Headline {
  const taker = capture.takerAspect;
  const holder = capture.holderAspect;
  const ours = (aspect: number | undefined) => aspect !== undefined && capture.viewerAspects.has(aspect);
  const lost = ours(holder) && !ours(taker);
  const site = capture.site.name;
  const takerName = aspectName(taker);
  return {
    id: `deep-capture:${capture.structureId}:${holder ?? 0}:${taker}:${capture.at}`,
    type: "deep-capture",
    icon: "deep-capture",
    look: {
      icon: capture.site.icon,
      eyebrow: lost ? DEEP_CAPTURE_WORDS.siteLost : DEEP_CAPTURE_WORDS.eyebrow(takerName),
      ...(lost ? { tone: "bad" as const } : {}),
      aspect: catalogAspectId(taker),
    },
    title: lost
      ? DEEP_CAPTURE_WORDS.lost(site)
      : holder === undefined
        ? DEEP_CAPTURE_WORDS.taken(site)
        : DEEP_CAPTURE_WORDS.seized(site),
    description: [
      { player: capture.newOwner },
      DEEP_CAPTURE_WORDS.sentence(
        holder === undefined
          ? DEEP_CAPTURE_LINES.slew(takerName, capture.site.beast, site)
          : DEEP_CAPTURE_LINES.seized(takerName, site, aspectName(holder)),
      ),
    ],
    location: capture.site.at ? { ...capture.site.at, entityId: capture.structureId } : undefined,
    timestamp: capture.at,
  };
}
