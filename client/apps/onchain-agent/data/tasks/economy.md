---
domain: economy
---

# Economy Tasks

## Resource Production

- Review all structures for active production buildings. If a realm has open building slots and sufficient resources, use `create_building` to add production for the most-needed resource.
- Check for paused productions each tick. Use `resume_production` immediately unless pausing was intentional (low input resources).
- Only use `pause_production` when input resources drop below 50 units to avoid wasting them.

## Resource Transfers

- Use `send_resources` to redistribute resources between your structures. Send from surplus to deficit.
- Always batch multiple resource types into a single send when possible (the `resources` array supports multiple entries).
- Before sending, confirm the recipient structure is yours using the world state `entities` list.

## Claiming Arrivals

- Every tick, check for `incomingArrivals` on each structure. Use `claim_arrivals` to offload them promptly.
- Unclaimed arrivals block the receiving slot. Prioritize claiming over new sends.

## Bank Trading

- Use `buy_resources` when a resource is critically low (below 15% of average) and the bank price is within 20% of recent average.
- Use `sell_resources` when a resource exceeds 200% of your average balance and the bank price is favorable.
- Never sell a resource you are currently short on, even if the price is high.

## Liquidity Provision

- Use `add_liquidity` only when you have stable surpluses of both the resource and LORDS tokens. Liquidity should be a long-term passive income strategy, not a short-term play.
- Use `remove_liquidity` if you need emergency resources or if the pool is imbalanced against you.

## Trade Orders

- Use `create_order` to place limit orders when bank AMM prices are unfavorable but you anticipate demand.
- Review `openOrders` each tick. Use `cancel_order` on orders that have been open for more than 10 ticks without filling.
- Use `accept_order` when you find another player's order with better terms than the AMM.

## Realm Upgrades

- Use `upgrade_realm` when your realm has been at current level for more than 20 ticks and you have 150% of the upgrade cost in reserves.
- Prioritize upgrading your primary resource-producing realm first.

## Decision Criteria

- Economy actions should target maintaining all resources above a 20% baseline relative to your highest resource.
- Prefer production over trading. Production is free; trading costs fees.
- Track resource trends across ticks. If a resource is declining, act before it hits critical.
