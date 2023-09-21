function getTotalPrice(
  decay,
  target_price,
  units,
  units_per_day,
  num_days,
  sold,
  labor_multiplier
) {
  let new_sold = sold;
  let total_price = 0;
  for (let i = 0; i < units; i++) {
    let multiplier = Math.exp(
      Math.log(1 - decay) * (num_days - new_sold / units_per_day)
    );
    let price = target_price * multiplier * labor_multiplier;

    total_price += parseInt(price);
    new_sold += 1;
  }

  return total_price;
}

// Example usage
let price = getTotalPrice(0.1, 1000, 20, 50, 0, 20, 2);
console.log("total price", price);
let balance = 79603;
console.log("resource left", balance - price);
