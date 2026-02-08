# Heartbeat - Recurring Monitoring Tasks

## Every Tick (Critical - CURRENT STATE)

- [x] Check all structure guard slots
- [x] Monitor enemy army 517 position
- [x] Check resource balances on all structures
- [x] Check stamina levels on all explorers
- [x] Verify leaderboard position

## State Change Alerts (Watch For These)

- 🔔 **Resource appears on any structure** → Immediate building action
- 🔔 **Stamina increases above 0** → Begin exploration planning
- 🔔 **StructureType changes from "unknown"** → Structures initialized
- 🔔 **New explorer appears** → Someone created units
- 🔔 **Arrivals appear** → Claim immediately

## Every 5 Ticks (Regular)

- [ ] Review enemy army movements (positions changing?)
- [ ] Check if other players' resources/stamina different from mine
- [ ] Look for new neutral structures or entities
- [ ] Review market activity (swaps, orders)
- [ ] Check if guild membership changed

## Every 10 Ticks (Strategic)

- [ ] Evaluate if any experimental actions worth trying
- [ ] Review leaderboard point changes
- [ ] Assess if stamina regeneration rate detected
- [ ] Check for any game events or announcements
- [ ] Update threat assessment if enemy positions changed

## Every 20 Ticks (Long-term)

- [ ] Strategic review: are we still in initialization or stuck?
- [ ] Consider if current approach needs fundamental change
- [ ] Evaluate if other players progressing while we're stuck
- [ ] Review all documentation for missed opportunities
- [ ] Assess risk of falling behind in points
