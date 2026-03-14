import type { ActionPath } from "./action-paths";

export type ActionHighlightKind =
  | "route"
  | "destination"
  | "frontier"
  | "support"
  | "attack"
  | "chest"
  | "create-army";

export interface ActionHighlightDescriptor {
  hex: { col: number; row: number };
  actionType: ActionPath["actionType"];
  kind: ActionHighlightKind;
  isEndpoint: boolean;
  isSharedRoute: boolean;
  pathDepth: number;
}

type HighlightAccumulator = {
  descriptor: ActionHighlightDescriptor;
  occurrences: number;
};

function resolveHighlightKind(actionType: ActionPath["actionType"], isEndpoint: boolean): ActionHighlightKind {
  if (!isEndpoint) {
    return "route";
  }

  switch (actionType) {
    case "explore":
      return "frontier";
    case "attack":
      return "attack";
    case "help":
      return "support";
    case "chest":
      return "chest";
    case "create_army":
      return "create-army";
    default:
      return "destination";
  }
}

function shouldPromoteDescriptor(
  current: ActionHighlightDescriptor,
  nextActionType: ActionPath["actionType"],
  nextIsEndpoint: boolean,
): boolean {
  if (nextIsEndpoint && !current.isEndpoint) {
    return true;
  }

  if (nextIsEndpoint !== current.isEndpoint) {
    return false;
  }

  if (current.actionType === "move" && nextActionType !== "move") {
    return true;
  }

  return false;
}

export function resolveActionHighlightDescriptors(
  paths: Iterable<ActionPath[]>,
  feltCenter: number,
): ActionHighlightDescriptor[] {
  const descriptors = new Map<string, HighlightAccumulator>();

  for (const path of paths) {
    const nonOriginSteps = path.slice(1);

    nonOriginSteps.forEach((step, index) => {
      const col = step.hex.col - feltCenter;
      const row = step.hex.row - feltCenter;
      const key = `${col},${row}`;
      const isEndpoint = index === nonOriginSteps.length - 1;
      const pathDepth = index + 1;
      const nextDescriptor: ActionHighlightDescriptor = {
        hex: { col, row },
        actionType: step.actionType,
        kind: resolveHighlightKind(step.actionType, isEndpoint),
        isEndpoint,
        isSharedRoute: false,
        pathDepth,
      };

      const existing = descriptors.get(key);
      if (!existing) {
        descriptors.set(key, {
          descriptor: nextDescriptor,
          occurrences: 1,
        });
        return;
      }

      existing.occurrences += 1;
      existing.descriptor.isSharedRoute = existing.occurrences > 1;
      existing.descriptor.pathDepth = Math.min(existing.descriptor.pathDepth, pathDepth);

      if (shouldPromoteDescriptor(existing.descriptor, step.actionType, isEndpoint)) {
        existing.descriptor.actionType = step.actionType;
        existing.descriptor.kind = nextDescriptor.kind;
        existing.descriptor.isEndpoint = isEndpoint;
      }
    });
  }

  return Array.from(descriptors.values(), ({ descriptor, occurrences }) => ({
    ...descriptor,
    isSharedRoute: occurrences > 1,
  }));
}
