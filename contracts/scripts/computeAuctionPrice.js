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
let price = getTotalPrice(0.1, 1000, 20, 50, 0, 0, 1, 10);
console.log("total price", price);
let balance = 100000;
console.log("resource left", balance - price);
