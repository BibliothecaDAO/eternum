type ArmyPointRendererKey = "agent" | "enemy" | "player";

interface ArmyPointRenderer<TEntityId, TVector> {
  setPoint: (input: { entityId: TEntityId; position: TVector }) => void;
  hasPoint: (entityId: TEntityId) => boolean;
  removePoint: (entityId: TEntityId) => void;
  setHover: (entityId: TEntityId) => void;
  clearHover: () => void;
}

interface ArmyPointRenderers<TEntityId, TVector> {
  player: ArmyPointRenderer<TEntityId, TVector>;
  enemy: ArmyPointRenderer<TEntityId, TVector>;
  ally: ArmyPointRenderer<TEntityId, TVector>;
  agent: ArmyPointRenderer<TEntityId, TVector>;
}

export function resolveArmyPointRendererKey(input: {
  isDaydreamsAgent: boolean;
  isMine: boolean;
}): ArmyPointRendererKey {
  if (input.isDaydreamsAgent) {
    return "agent";
  }

  return input.isMine ? "player" : "enemy";
}

export function syncArmyPointIconState<TEntityId, TVector>(input: {
  renderers?: ArmyPointRenderers<TEntityId, TVector>;
  rendererKey: ArmyPointRendererKey;
  entityId: TEntityId;
  position: TVector;
}): void {
  if (!input.renderers) {
    return;
  }

  input.renderers[input.rendererKey].setPoint({
    entityId: input.entityId,
    position: input.position,
  });
}

export function removeArmyPointIconState<TEntityId, TVector>(input: {
  renderers?: ArmyPointRenderers<TEntityId, TVector>;
  entityId: TEntityId;
}): void {
  if (!input.renderers) {
    return;
  }

  for (const renderer of getArmyPointRenderers(input.renderers)) {
    if (renderer.hasPoint(input.entityId)) {
      renderer.removePoint(input.entityId);
    }
  }
}

export function setArmyPointHoverState<TEntityId, TVector>(input: {
  renderers?: ArmyPointRenderers<TEntityId, TVector>;
  rendererKey: ArmyPointRendererKey;
  entityId: TEntityId;
}): void {
  if (!input.renderers) {
    return;
  }

  input.renderers[input.rendererKey].setHover(input.entityId);
}

export function clearArmyPointHoverState<TEntityId, TVector>(input: {
  renderers?: ArmyPointRenderers<TEntityId, TVector>;
}): void {
  if (!input.renderers) {
    return;
  }

  for (const renderer of getArmyPointRenderers(input.renderers)) {
    renderer.clearHover();
  }
}

function getArmyPointRenderers<TEntityId, TVector>(
  renderers: ArmyPointRenderers<TEntityId, TVector>,
): ArmyPointRenderer<TEntityId, TVector>[] {
  return [renderers.player, renderers.enemy, renderers.ally, renderers.agent];
}
