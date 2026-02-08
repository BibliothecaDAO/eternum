# Resource Type ID Mapping

## Confirmed Resource Types:
- **Type 1:** STONE
- **Type 2:** WOOD (confirmed via successful send)
- **Type 29:** T1 CROSSBOWMAN (troop type)
- **Type ???:** ESSENCE (unknown ID, need to discover)

## Structure Resource Balances (Hidden):
- **Structure 450:** 550B ESSENCE (+ now has 10B WOOD incoming)
- **Structure 455:** 141.9B WOOD (- 10B sent = 131.9B remaining)
- **Structure 460:** 500B ESSENCE

## Key Discoveries:
1. Resources DON'T show in `observe_game` resourceBalances array
2. Resource balances only revealed via failed upgrade/action attempts
3. Resources CAN be transferred between owned structures via `send_resources`
4. Resource type IDs include both materials (1-10?) and troops (20+?)
5. Different upgrade attempts reveal different resource requirements:
   - ESSENCE needed for some realm upgrades
   - WOOD needed for other realm upgrades

## Next Steps:
1. Find ESSENCE resource type ID (try 3-28)
2. Consolidate ESSENCE from structures 460 → 450 to reach 600B upgrade threshold
3. Test realm upgrade after consolidation
4. Explore if upgrade unlocks new mechanics

## Resource Transfer Success:
```
send_resources(
  senderEntityId: 455,
  recipientEntityId: 450,
  resources: [{ resourceType: 2, amount: 10000000000 }]
) ✓ SUCCESS
```

Transaction created arrival caravan from 455→450 with 10B WOOD.
