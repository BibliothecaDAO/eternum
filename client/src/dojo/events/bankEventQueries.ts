import { numberToHex } from "@/ui/utils/utils";
import { Event, client, getEventsQuery } from "./graphqlClient";
import { SWAP_EVENT } from "@bibliothecadao/eternum";

export const MAX_EVENTS = 5000;
export const ADMIN_BANK_ENTITY_ID = "0x3b9ac9fe"; //999999998n;

export interface BankStatsInterface {
  ownerTotalLordsFees: number;
  ownerTotalResourceFees: Map<number, number>;
  poolTotalLordsFees: number;
  poolTotalResourceFees: Map<number, number>;
  dailyClosingPriceResults: Map<number, any>;
}

export async function computeBankStats() {
  const query = `
    query GetBankEvents {
      events(keys: ["${SWAP_EVENT}","${ADMIN_BANK_ENTITY_ID}"], last: ${MAX_EVENTS}) {
        edges {
          node {
            id
            keys
            data
            createdAt
          }
        }
      }
    }
  `;

  const response = await client.request<getEventsQuery>(query);
  const { events } = response;

  let ownerTotalLordsFees = 0;
  let ownerTotalResourceFees = new Map<number, number>();
  let poolTotalLordsFees = 0;
  let poolTotalResourceFees = new Map<number, number>();
  let dailyClosingPrices = new Map<number, { date: string; prices: number[] }[]>();

  events.edges.forEach(({ node }) => {
    const eventData = parseSwapEventData(node);
    ownerTotalLordsFees += eventData.fees.ownerLordsFees;
    updateResourceFees(ownerTotalResourceFees, eventData.resourceId, eventData.fees.ownerResourceFees);
    poolTotalLordsFees += eventData.fees.poolLordsFees;
    updateResourceFees(poolTotalResourceFees, eventData.resourceId, eventData.fees.poolResourceFees);

    const date = new Date(eventData.timestamp).toDateString();
    const { resourceId, resourcePrice } = eventData;

    if (!dailyClosingPrices.has(resourceId)) {
      dailyClosingPrices.set(resourceId, []);
    }

    const pricesForId = dailyClosingPrices.get(resourceId);
    if (pricesForId) {
      const existingEntry = pricesForId.find((entry) => entry.date === date);
      if (existingEntry) {
        existingEntry.prices.push(resourcePrice);
      } else {
        pricesForId.push({ date, prices: [resourcePrice] });
      }
    }
  });

  const dailyClosingPriceResults = new Map<number, any>();
  dailyClosingPrices.forEach((values, key) => {
    const dailyPrices = values.map(({ date, prices }) => ({
      date,
      closingPrice: prices[prices.length - 1], // Last price of the day is the closing price
    }));
    dailyClosingPriceResults.set(key, dailyPrices);
  });

  return {
    ownerTotalLordsFees,
    ownerTotalResourceFees,
    poolTotalLordsFees,
    poolTotalResourceFees,
    dailyClosingPriceResults,
  };
}

function parseSwapEventData(eventData: Event) {
  const [resourceId, lordsAmount, resourceAmount, bankOwnerFees, lpFees, resourcePrice, buyFlag, timestamp] =
    eventData.data;
  const buy = Boolean(Number(buyFlag));

  return {
    resourceId: Number(resourceId),
    lordsAmount: Number(lordsAmount),
    resourceAmount: Number(resourceAmount),
    bankOwnerFees: Number(bankOwnerFees),
    lpFees: Number(lpFees),
    resourcePrice: Number(resourcePrice),
    buy,
    fees: {
      ownerLordsFees: buy ? Number(bankOwnerFees) : 0,
      ownerResourceFees: buy ? 0 : Number(bankOwnerFees),
      poolLordsFees: buy ? Number(lpFees) : 0,
      poolResourceFees: buy ? 0 : Number(lpFees),
    },
    timestamp: Number(timestamp),
  };
}

function updateResourceFees(feesMap: Map<number, number>, resourceId: number, amount: number) {
  const currentAmount = feesMap.get(resourceId) || 0;
  feesMap.set(resourceId, currentAmount + amount);
}
