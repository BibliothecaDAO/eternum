function getTotalPrice(
  decay,
  target_price,
  units,
  units_per_day,
  num_days,
  sold,
  labor_multiplier,
  price_update_interval
) {
  let new_sold = sold;
  let total_price = 0;

  let multiplier = Math.exp(
    Math.log(1 - decay) * (num_days - new_sold / units_per_day)
  );
  for (let i = 0; i < units; i++) {
    let price = target_price * multiplier * labor_multiplier;

    total_price += parseInt(price);
    new_sold += 1;
    if (new_sold % price_update_interval == 0) {
      multiplier = Math.exp(
        Math.log(1 - decay) * (num_days - new_sold / units_per_day)
      );
    }
  }

  return total_price;
}

// Example usage
let price = getTotalPrice(0.1, 10, 2219523, 100000, 14, 88067000, 1, 100000);
console.log("total price", price);
// let balance = 100000;
// console.log("resource left", balance - price);

const DECAY = 0.1;
const UNITS_PER_DAY = 50;
const SECONDS_PER_DAY = 86400;

function computeCoefficient(startTimestamp, nextBlockTimestamp, sold) {
  return Math.exp(
    Math.log(1 - DECAY) *
      (Math.floor((nextBlockTimestamp - startTimestamp) / SECONDS_PER_DAY) -
        sold / UNITS_PER_DAY)
  );
}

function computeAverageCoefficient(
  startTimestamp,
  nextBlockTimestamp,
  sold,
  laborUnits,
  interval
) {
  let sum = 0;
  let multiplier = computeCoefficient(startTimestamp, nextBlockTimestamp, sold);
  // start at number of units already sold and add 1 everytime
  for (let i = sold; i < sold + laborUnits; i++) {
    // console.log({ multiplier });
    if (i % interval == 0) {
      multiplier = computeCoefficient(startTimestamp, nextBlockTimestamp, i);
      sum += multiplier;
    } else {
      sum += multiplier;
    }
  }
  return sum / laborUnits; // Return the average coefficient
}

function getLordsAmountFromBankAuction(
  totalCost,
  target_price,
  startTimestamp,
  nextBlockTimestamp,
  sold,
  price_update_interval
) {
  let unitsBought = 0;
  let cost = 0;

  let coefficient = computeCoefficient(
    startTimestamp,
    nextBlockTimestamp,
    sold
  );

  while (cost <= totalCost) {
    if (sold % price_update_interval == 0) {
      coefficient = computeCoefficient(
        startTimestamp,
        nextBlockTimestamp,
        sold
      );
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
}

// Example usage
let totalCost = 1000000; // Example total cost
let laborUnits = getLordsAmountFromBankAuction(
  totalCost,
  10, // target_price
  1701420311, // startTimestamp
  1701456643, // nextBlockTimestamp
  0, // initially sold
  100000 // price_update_interval
);

// console.log("Labor Units that can be bought: ", laborUnits);

// const laborUnits = 80;
// const interval = 10;
// const averageCoefficient = computeAverageCoefficient(
//   0,
//   0,
//   0,
//   laborUnits,
//   interval
// );

// const totalCost = Math.floor(3 * 80 * averageCoefficient);

// Example usage
// console.log({ averageCoefficient });
// console.log({ totalCost });
// // console.log({ totalCost: 1000 * 16 * averageCoefficient });
// console.log({ remainder: 100000 - totalCost });
