import { divideByPrecision } from "@bibliothecadao/eternum";

type BuyResourceFillLimit = {
  action: "buy-resource";
  availableLords: number;
  requestedResourceRaw: number;
  totalLordsRaw: number;
};

type SellResourceFillLimit = {
  action: "sell-resource";
  availableResource: number;
  requestedResourceRaw: number;
};

type OrderRowResourceInputLimit = BuyResourceFillLimit | SellResourceFillLimit;

export const resolveOrderRowResourceInputLimit = (input: OrderRowResourceInputLimit) => {
  const requestedResourceAmount = divideByPrecision(input.requestedResourceRaw, false);
  if (requestedResourceAmount <= 0) return 0;

  if (input.action === "sell-resource") {
    return Math.min(input.availableResource, requestedResourceAmount);
  }

  const totalLordsAmount = divideByPrecision(input.totalLordsRaw, false);
  if (totalLordsAmount <= 0) return 0;

  const affordableRatio = Math.min(1, input.availableLords / totalLordsAmount);
  return requestedResourceAmount * affordableRatio;
};
