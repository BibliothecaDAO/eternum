import { Event, client, getEventsQuery } from "./graphqlClient";
import { SWAP_EVENT } from "@bibliothecadao/eternum";

export const MAX_EVENTS = 5000;
export const ADMIN_BANK_ENTITY_ID = "0x0de0b6b3a763fffe";

export interface BankStatsInterface {
  ownerTotalLordsFees: number;
  ownerTotalResourceFees: Map<string, number>;
  poolTotalLordsFees: number;
  poolTotalResourceFees: Map<string, number>;
  dailyClosingPriceResults: Map<string, any>;
}

export async function computeBankStats() {
  const query = `
    query GetBankEvents($keys: [String!]!, $last: Int!) {
      events(keys: $keys, last: $last) {
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
  const variables = {
    keys: [SWAP_EVENT, ADMIN_BANK_ENTITY_ID],
    last: MAX_EVENTS,
  };

  const response = await client.request<getEventsQuery>(query, variables);
  const { events } = response;

  let ownerTotalLordsFees = 0;
  let ownerTotalResourceFees = new Map<string, number>();
  let poolTotalLordsFees = 0;
  let poolTotalResourceFees = new Map<string, number>();
  let dailyClosingPrices = new Map<string, { date: string; prices: number[] }[]>();

  events.edges.forEach(({ node }) => {
    const eventData = parseSwapEventData(node);
    ownerTotalLordsFees += eventData.fees.ownerLordsFees;
    updateResourceFees(ownerTotalResourceFees, eventData.resourceId, eventData.fees.ownerResourceFees);
    poolTotalLordsFees += eventData.fees.poolLordsFees;
    updateResourceFees(poolTotalResourceFees, eventData.resourceId, eventData.fees.poolResourceFees);

    const date = new Date(eventData.timestamp).toDateString();
    const { resourceId, lordsAmount } = parseSwapEventData(node.data);

    if (!dailyClosingPrices.has(resourceId)) {
      dailyClosingPrices.set(resourceId, []);
    }

    const pricesForId = dailyClosingPrices.get(resourceId);
    if (pricesForId) {
      const existingEntry = pricesForId.find((entry) => entry.date === date);
      if (existingEntry) {
        existingEntry.prices.push(lordsAmount);
      } else {
        pricesForId.push({ date, prices: [lordsAmount] });
      }
    }
  });

  const dailyClosingPriceResults = new Map<string, any>();
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
  const buy = Boolean(buyFlag);

  return {
    resourceId,
    lordsAmount,
    resourceAmount,
    bankOwnerFees,
    lpFees,
    resourcePrice,
    buy,
    fees: {
      ownerLordsFees: buy ? bankOwnerFees : 0,
      ownerResourceFees: buy ? 0 : bankOwnerFees,
      poolLordsFees: buy ? 0 : lpFees,
      poolResourceFees: buy ? lpFees : 0,
    },
    timestamp,
  };
}

function updateResourceFees(feesMap: Map<string, number>, resourceId: string, amount: number) {
  const currentAmount = feesMap.get(resourceId) || 0;
  feesMap.set(resourceId, currentAmount + amount);
}
