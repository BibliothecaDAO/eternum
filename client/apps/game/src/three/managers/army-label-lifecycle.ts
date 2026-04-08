interface LabelWithPosition<TEntityId, TPosition, TArmy> {
  renderOrder: number;
  parent: unknown;
  position: {
    copy: (position: TPosition) => void;
    y: number;
  };
  element: HTMLElement;
  userData: {
    entityId?: TEntityId;
    lastDataKey?: string | null;
    baseRenderOrder?: number;
  };
}

export function initializeArmyLabelState<TEntityId, TPosition, TArmy>(input: {
  label: LabelWithPosition<TEntityId, TPosition, TArmy>;
  entityId: TEntityId;
  position: TPosition;
}): void {
  input.label.position.copy(input.position);
  input.label.position.y += 2.1;
  input.label.userData.entityId = input.entityId;
  input.label.userData.lastDataKey = null;
}

export function configureArmyLabelHoverPriority<TEntityId, TPosition, TArmy>(
  label: LabelWithPosition<TEntityId, TPosition, TArmy>,
): void {
  const baseRenderOrder = label.userData.baseRenderOrder ?? label.renderOrder;
  label.userData.baseRenderOrder = baseRenderOrder;

  label.element.onmouseenter = () => {
    label.renderOrder = Infinity;
  };

  label.element.onmouseleave = () => {
    label.renderOrder = baseRenderOrder;
  };
}

export function revealArmyLabelState<TEntityId, TPosition, TArmy>(input: {
  label: LabelWithPosition<TEntityId, TPosition, TArmy>;
  labelsGroup: {
    add: (label: LabelWithPosition<TEntityId, TPosition, TArmy>) => void;
  };
  army?: TArmy;
  renderLabel: (army: TArmy) => void;
}): void {
  if (input.label.parent !== input.labelsGroup) {
    input.labelsGroup.add(input.label);
  }

  if (input.army) {
    input.renderLabel(input.army);
  }
}
