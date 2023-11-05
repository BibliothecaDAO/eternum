import { useDojo } from "../../DojoContext";
import { Position } from "../../types";

export function useCombat() {
  const {
    setup: {
      components: {},
    },
  } = useDojo();

  const getBattalionsOnPosition = (position: Position) => {};

  const getDefenceOnPosition = (position: Position) => {};

  const getRaidersOnPosition = (position: Position) => {};

  return {
    getBattalionsOnPosition,
    getDefenceOnPosition,
    getRaidersOnPosition,
  };
}
