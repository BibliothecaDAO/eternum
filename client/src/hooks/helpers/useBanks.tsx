import { HasValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Position, UIPosition } from "../../types";

export interface BankInterface {
  price: number;
  uiPosition: UIPosition;
  position: Position;
}

export const useBanks = () => {
  const {
    setup: {
      components: { Position },
    },
  } = useDojo();

  const getBankPrice = (bankPosition: Position): number | undefined => {
    const entityId = runQuery([HasValue(Position, bankPosition)]);
    console.log({ entityId });
    return 0.5;
  };

  return {
    getBankPrice,
  };
};
