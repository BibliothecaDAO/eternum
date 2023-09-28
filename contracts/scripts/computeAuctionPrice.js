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
// let price = getTotalPrice(0.1, 1000, 20, 50, 0, 0, 1, 10);
// console.log("total price", price);
// let balance = 100000;
// console.log("resource left", balance - price);

const DECAY = 0.1;
const UNITS_PER_DAY = 960;
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
    console.log({ multiplier });
    if (i % interval == 0) {
      multiplier = computeCoefficient(startTimestamp, nextBlockTimestamp, i);
      sum += multiplier;
    } else {
      sum += multiplier;
    }
  }
  return sum / laborUnits; // Return the average coefficient
}

const averageCoefficient = computeAverageCoefficient(0, 0, 0, 1566, 10);

// Example usage
// console.log({ averageCoefficient });
// console.log({ totalCost: 1000 * 16 * averageCoefficient });
// console.log({ remainder: 100000 - 1000 * 20 * averageCoefficient });
