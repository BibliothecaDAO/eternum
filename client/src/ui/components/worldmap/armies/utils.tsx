import { UIPosition } from "@bibliothecadao/eternum";
import { ArmyProps } from "./Army";

export const applyOffset = (point: UIPosition, offset: { x: number; y: number }) => ({
  x: point.x + offset.x,
  y: point.y + offset.y,
  z: point.z,
});

export const arePropsEqual = (
  prevProps: ArmyProps & JSX.IntrinsicElements["group"],
  nextProps: ArmyProps & JSX.IntrinsicElements["group"],
) => {
  return (
    prevProps.army.position.x === nextProps.army.position.x && prevProps.army.position.y === nextProps.army.position.y
  );
};
