interface LabelWithPosition<TPosition> {
  position: {
    copy: (position: TPosition) => void;
    y: number;
  };
}

export function syncArmyLabelPresentationState<TPosition>(input: {
  label?: LabelWithPosition<TPosition>;
  position: TPosition;
}): void {
  if (!input.label) {
    return;
  }

  input.label.position.copy(input.position);
  input.label.position.y += 1.5;
}
