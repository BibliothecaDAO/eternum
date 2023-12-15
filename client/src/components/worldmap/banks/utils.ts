import { divideByPrecision } from "../../../utils/utils";

const SECONDS_PER_DAY = 86400;

export function computeCoefficient(
  startTimestamp: number,
  nextBlockTimestamp: number,
  sold: number,
  decay: number,
  units_per_day: number,
) {
  return Math.exp(
    Math.log(1 - decay) * (Math.floor((nextBlockTimestamp - startTimestamp) / SECONDS_PER_DAY) - sold / units_per_day),
  );
}

export const getLordsAmountFromBankAuction = (
  totalCost: bigint,
  target_price: number,
  decay: number,
  units_per_day: number,
  startTimestamp: number,
  nextBlockTimestamp: number,
  sold: number,
  price_update_interval: number,
) => {
  let unitsBought = 0;
  let cost = 0;

  let coefficient = computeCoefficient(startTimestamp, nextBlockTimestamp, sold, decay, units_per_day);

  while (cost <= totalCost) {
    if (sold % price_update_interval == 0) {
      coefficient = computeCoefficient(startTimestamp, nextBlockTimestamp, sold, decay, units_per_day);
    }
    let priceForNextUnit = target_price * coefficient;

    // Check if the next unit can be purchased within the totalCost
    if (cost + priceForNextUnit <= totalCost) {
      cost += priceForNextUnit;
      unitsBought++;
      sold++;
    } else {
      break; // Break if the next unit cannot be purchased
    }
  }

  // divide by 1000
  // todo: seems like im overestimating by 1 sometimes, need to investigate why
  return Math.max(divideByPrecision(unitsBought - 1), 0);
};
