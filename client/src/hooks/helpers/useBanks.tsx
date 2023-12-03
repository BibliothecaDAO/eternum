import { Has, HasValue, getComponentValue, runQuery } from "@latticexyz/recs";
import { useDojo } from "../../DojoContext";
import { Position, Resource, UIPosition } from "../../types";
import { getContractPositionFromRealPosition, getEntityIdFromKeys } from "../../utils/utils";
import banks from "../../data/banks.json";
import { computeCoefficient, getLordsAmountFromBankAuction } from "../../components/worldmap/banks/utils";
import useBlockchainStore from "../store/useBlockchainStore";
import { useComponentValue } from "@dojoengine/react";
import useRealmStore from "../store/useRealmStore";

export const targetPrices = {
  254: 10,
  255: 5,
};

export const BANK_AUCTION_DECAY = 0.1;

type Auction = {
  start_time: number;
  per_time_unit: number;
  sold: number;
  price_update_interval: number;
};

export interface BankStaticInterface {
  name: string;
  uiPosition: UIPosition;
  position: Position;
  distance: number | undefined;
}

export interface BankInterface {
  name: string;
  wheatPrice: number;
  fishPrice: number;
  bankId: number;
  uiPosition: UIPosition;
  position: Position;
  wheatLaborAuction: Auction | undefined;
  fishLaborAuction: Auction | undefined;
  distance: number | undefined;
}

export const useBanks = () => {
  const {
    setup: {
      components: { Position, Bank, BankAuction },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const getResourceBankPrice = (laborAuction: Auction, resourceId: number): number | undefined => {
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
      const wheatLaborAuction =
        bankId !== undefined
          ? getComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(253), BigInt(0)]))
          : undefined;
      const fishLaborAuction =
        bankId !== undefined
          ? getComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(253), BigInt(1)]))
          : undefined;
      const wheatPrice = getResourceBankPrice(wheatLaborAuction, 254);
      const fishPrice = getResourceBankPrice(fishLaborAuction, 255);
      let distance = 0;
      if (realmEntityIds.length > 0) {
        const startPosition = getComponentValue(
          Position,
          getEntityIdFromKeys([BigInt(realmEntityIds[0].realmEntityId)]),
        );

        if (startPosition && position) {
          const x: number =
            startPosition.x > position.x
              ? Math.pow(startPosition.x - position.x, 2)
              : Math.pow(position.x - startPosition.x, 2);

          const y: number =
            startPosition.y > position.y
              ? Math.pow(startPosition.y - position.y, 2)
              : Math.pow(position.y - startPosition.y, 2);

          // Using bitwise shift for the square root approximation for BigInt.
          // we store coords in x * 10000 to get precise distance
          distance = (x + y) ** 0.5 / 10000;
        }
      }

      return {
        name,
        bankId,
        wheatPrice,
        fishPrice,
        uiPosition: { x, y, z },
        position,
        wheatLaborAuction,
        fishLaborAuction,
        distance,
      };
    });
  };

  const useGetBank = (bank: BankStaticInterface): BankInterface => {
    const { name, uiPosition, distance, position } = bank;
    const bankId = getBankEntityId(position);
    const wheatLaborAuction =
      bankId !== undefined
        ? useComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(253), BigInt(0)]))
        : undefined;
    const fishLaborAuction =
      bankId !== undefined
        ? useComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(253), BigInt(1)]))
        : undefined;
    const wheatPrice = getResourceBankPrice(wheatLaborAuction, 254);
    const fishPrice = getResourceBankPrice(fishLaborAuction, 255);

    return {
      name,
      bankId,
      wheatPrice,
      fishPrice,
      uiPosition,
      position,
      wheatLaborAuction,
      fishLaborAuction,
      distance,
    };
  };

  const getBanksStatic = (): BankStaticInterface[] => {
    return banks
      .map((bank, i) => {
        const { name, x, y, z } = bank;
        const position = getContractPositionFromRealPosition({ x, y: z });

        let distance = 0;
        if (realmEntityIds.length > 0) {
          const startPosition = getComponentValue(
            Position,
            getEntityIdFromKeys([BigInt(realmEntityIds[0].realmEntityId)]),
          );

          if (startPosition && position) {
            const x: number =
              startPosition.x > position.x
                ? Math.pow(startPosition.x - position.x, 2)
                : Math.pow(position.x - startPosition.x, 2);

            const y: number =
              startPosition.y > position.y
                ? Math.pow(startPosition.y - position.y, 2)
                : Math.pow(position.y - startPosition.y, 2);

            // Using bitwise shift for the square root approximation for BigInt.
            // we store coords in x * 10000 to get precise distance
            distance = (x + y) ** 0.5 / 10000;
          }
        }

        return {
          name,
          uiPosition: { x, y, z },
          position,
          distance,
        };
      })
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  };

  return {
    useGetBank,
    getBanks,
    getBanksStatic,
    getResourceBankPrice,
    getLordsAmountFromBank,
  };
};
