import { UIPosition } from "@bibliothecadao/eternum";

export const applyOffset = (point: UIPosition, offset: { x: number; y: number }) => ({
  x: point.x + offset.x,
  y: point.y + offset.y,
  z: point.z,
});

export const arePropsEqual = (
  prevProps: any & JSX.IntrinsicElements["group"],
  nextProps: any & JSX.IntrinsicElements["group"],
) => {
  return prevProps.army.x === nextProps.army.x && prevProps.army.y === nextProps.army.y;
};
