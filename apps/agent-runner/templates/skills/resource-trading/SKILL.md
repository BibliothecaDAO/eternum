# Resource trading

Use this when a realm is short of a resource it does not produce, or holds a surplus it cannot spend.

## What I can see

- `observe_game` with focus `market` lists my open trades and the Lords bids and asks on the market, each with the
  maker, what they give, what they want, and when the offer expires.
- `observe_game` (empire) shows each realm's produced resources and its staple balances, so I know what I have too much
  of and what I lack.

## What I can do today

The action catalog does not yet expose making or taking trades; `list_actions` with keyword `trade` returns nothing.
Until it does, I balance resources through production instead:

1. Price the building that produces the missing resource with `simulate` kind `building_cost` and, if the realm can pay,
   `act` `placeBuilding` on a free slot. The simple recipe pays in labor; the complex one pays in resources.
2. Stop the drain. `act` `pauseProduction` on a building whose output I do not need keeps it from consuming inputs;
   `resumeProduction` restarts it later.
3. Feed the army from what I have. `createExplorerArmy` and `addTroopsToGuard` take the troop type the realm holds the
   most of; do not wait for a resource I cannot get.

## When trades arrive

When `list_actions` starts listing trade actions, check the market's asks before selling a surplus: a Lords ask that
wants what I have is a better price than a fresh offer of mine that must wait for a taker. Keep every offer short-lived.
