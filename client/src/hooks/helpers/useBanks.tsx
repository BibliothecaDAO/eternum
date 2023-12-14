import { Has, HasValue, getComponentValue, runQuery } from "@dojoengine/recs";
import { useDojo } from "../../DojoContext";
import { Position, Resource } from "@bibliothecadao/eternum";
import { getContractPositionFromRealPosition, getEntityIdFromKeys } from "../../utils/utils";
import banks from "../../data/banks.json";
import { computeCoefficient, getLordsAmountFromBankAuction } from "../../components/worldmap/banks/utils";
import useBlockchainStore from "../store/useBlockchainStore";
import { useComponentValue } from "@dojoengine/react";
import useRealmStore from "../store/useRealmStore";
import { AuctionInterface, BankInterface, BankStaticInterface } from "@bibliothecadao/eternum";

export const targetPrices = {
  254: 10,
  255: 5,
};

export const BANK_AUCTION_DECAY = 0.1;

export const useBanks = () => {
  const {
    setup: {
      components: { Position, Bank, BankAuction },
    },
  } = useDojo();

  const nextBlockTimestamp = useBlockchainStore((state) => state.nextBlockTimestamp);
  const realmEntityIds = useRealmStore((state) => state.realmEntityIds);

  const getResourceBankPrice = (auction: AuctionInterface, resourceId: 254 | 255): number | undefined => {
    const coefficient =
      auction && nextBlockTimestamp
        ? computeCoefficient(auction.start_time, nextBlockTimestamp, auction.sold, 0.1, auction.per_time_unit)
        : undefined;

    return coefficient ? coefficient * targetPrices[resourceId] : undefined;
  };

  const getBankEntityId = (bankPosition: Position): number | undefined => {
    const entityIds = runQuery([Has(Bank), HasValue(Position, bankPosition)]);
    return Array.from(entityIds).length === 1 ? Array.from(entityIds)[0] : undefined;
  };

  const getLordsAmountFromBank = (bankPosition: Position, resource: Resource): number | undefined => {
    const bankId = getBankEntityId(bankPosition);
    const auction =
      bankId !== undefined
        ? getComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(resource.resourceId)]))
        : undefined;

    const { per_time_unit, sold, start_time, price_update_interval } = auction || {};

    return auction && per_time_unit && start_time && nextBlockTimestamp && sold && price_update_interval
      ? getLordsAmountFromBankAuction(
          resource.amount,
          targetPrices[resource.resourceId as 254 | 255],
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
    return banks
      .map((bank) => {
        const { name, x, y, z } = bank;
        const position = getContractPositionFromRealPosition({ x, y: z });
        const bankId = getBankEntityId(position);
        const wheatAuction =
          bankId !== undefined
            ? getComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(253), BigInt(0)]))
            : undefined;
        const fishAuction =
          bankId !== undefined
            ? getComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(253), BigInt(1)]))
            : undefined;
        const wheatPrice = wheatAuction ? getResourceBankPrice(wheatAuction, 254) || 0 : 0;
        const fishPrice = fishAuction ? getResourceBankPrice(fishAuction, 255) || 0 : 0;
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

        if (bankId) {
          return {
            name,
            bankId,
            wheatPrice,
            fishPrice,
            uiPosition: { x, y, z },
            position,
            wheatAuction,
            fishAuction,
            distance,
          };
        }
      })
      .filter(Boolean) as BankInterface[];
  };

  const useGetBank = (bank: BankStaticInterface): BankInterface | undefined => {
    const { name, uiPosition, distance, position } = bank;
    const bankId = getBankEntityId(position);
    const wheatAuction =
      bankId !== undefined
        ? useComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(253), BigInt(0)]))
        : undefined;
    const fishAuction =
      bankId !== undefined
        ? useComponentValue(BankAuction, getEntityIdFromKeys([BigInt(bankId), BigInt(253), BigInt(1)]))
        : undefined;
    const wheatPrice = wheatAuction ? getResourceBankPrice(wheatAuction, 254) || 0 : 0;
    const fishPrice = fishAuction ? getResourceBankPrice(fishAuction, 255) || 0 : 0;

    if (bankId) {
      return {
        name,
        bankId,
        wheatPrice,
        fishPrice,
        uiPosition,
        position,
        wheatAuction,
        fishAuction,
        distance,
      };
    }
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
