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
  totalCost: number,
  target_price: number,
  decay: number,
  units_per_day: number,
  startTimestamp: number,
  nextBlockTimestamp: number,
  sold: number,
  price_update_interval: number,
) => {
  //console log all props
  console.log({ totalCost });
  console.log({ target_price });
  console.log({ decay });
  console.log({ units_per_day });
  console.log({ startTimestamp });
  console.log({ nextBlockTimestamp });
  console.log({ sold });
  console.log({ price_update_interval });

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

  return unitsBought;
};
