import { Has, HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Position, Resource, UIPosition } from "../../types";
import { getContractPositionFromRealPosition, getEntityIdFromKeys } from "../../utils/utils";
import banks from "../../data/banks.json";
import { computeCoefficient, getLordsAmountFromBankAuction } from "../../components/worldmap/banks/utils";
import useBlockchainStore from "../store/useBlockchainStore";

export const targetPrices = {
  254: 10,
  255: 5,
};

export const BANK_AUCTION_DECAY = 0.1;

type LaborAuction = {
  start_time: number;
  per_time_unit: number;
  sold: number;
  price_update_interval: number;
};

export interface BankInterface {
  name: string;
  wheatPrice: number;
  fishPrice: number;
  bankId: number;
  uiPosition: UIPosition;
  position: Position;
  wheatLaborAuction: LaborAuction | undefined;
  fishLaborAuction: LaborAuction | undefined;
}

export const useBanks = () => {
  const {
    setup: {
      components: { Position, Bank, BankAuction },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);

  const getResourceBankPrice = (laborAuction: LaborAuction, resourceId: number): number | undefined => {
    const coefficient = laborAuction
      ? computeCoefficient(
          laborAuction.start_time,
          nextBlockTimestamp,
          laborAuction.sold,
          0.1,
          laborAuction.per_time_unit,
        )
      : undefined;

    return coefficient ? coefficient * targetPrices[resourceId] : undefined;
  };

  const getBankEntityId = (bankPosition: Position): number | undefined => {
    const entityIds = runQuery([Has(Bank), HasValue(Position, bankPosition)]);
    return Array.from(entityIds).length === 1 ? Array.from(entityIds)[0] : undefined;
  };

  const getLordsAmountFromBank = (bankPosition: Position, resource: Resource): number | undefined => {
    const bankId = getBankEntityId(bankPosition);
    const laborAuction =
      bankId !== undefined
        ? getComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(resource.resourceId)]))
        : undefined;

    const { per_time_unit, sold, start_time, price_update_interval } = laborAuction;

    return laborAuction
      ? getLordsAmountFromBankAuction(
          resource.amount,
          targetPrices[resource.resourceId],
          BANK_AUCTION_DECAY,
          per_time_unit,
          start_time,
          nextBlockTimestamp,
          sold,
          price_update_interval,
        )
      : undefined;
  };

  const getBanks = (): BankInterface[] => {
    return banks.map((bank, i) => {
      const { name, x, y, z } = bank;
      const position = getContractPositionFromRealPosition({ x, y: z });
      const bankId = getBankEntityId(position);
      console.log({ bankId });
      const wheatLaborAuction = getComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(253)]));
      console.log({ wheatLaborAuction });
      const fishLaborAuction = getComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(253)]));
      const wheatPrice = getResourceBankPrice(wheatLaborAuction, 254);
      const fishPrice = getResourceBankPrice(fishLaborAuction, 255);

      return {
        name,
        bankId,
        wheatPrice,
        fishPrice,
        uiPosition: { x, y, z },
        position,
        wheatLaborAuction,
        fishLaborAuction,
      };
    });
  };

  return {
    getBanks,
    getResourceBankPrice,
    getLordsAmountFromBank,
  };
};
