import type Node from "three/src/nodes/core/Node.js";
import { hash, int, uint } from "three/tsl";

export const cellHash = (cell: Node<"vec2">, salt = 0): Node<"float"> => {
  const ix = int(cell.x).toUint();
  const iy = int(cell.y).toUint();
  return hash(
    ix
      .mul(uint(374761393))
      .bitXor(iy.mul(uint(668265263)))
      .bitXor(uint(salt)),
  );
};
