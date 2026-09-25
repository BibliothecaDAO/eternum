# Frontier combat vectors v1

`frontier-combat-v1.txt` is shared by the Cairo replay and the client forecast test. Whitespace separates unsigned
decimal felts, written one per line for snforge’s text reader. Losses/counts use resource precision (1,000,000,000);
damage coefficients retain Cairo's 64.64 integers.

The header is version (1), exchange count (200), `TroopDamageConfig` in declaration order, `TroopStaminaConfig` in
declaration order, then the army tick interval in seconds.

Each exchange has 24 fields:

1. Case id, alternate-layer flag, biome id, attack distance, timestamp, current tick, attacker-is-guard,
   defender-is-guard.
2. Attacker: category, tier, count, stamina, updated tick, damage bonus in whole percent.
3. Defender: category, tier, count, stamina, updated tick, damage bonus in whole percent.
4. Attacker loss, defender loss, attacker remaining stamina, defender remaining stamina.

Enum ids use Cairo order (tiers 0/1/2). Even/odd cases are matching surface/Ethereal pairs. The generation seed
is 20260925. Attacker damage bonuses cover 0/10/20/30/40 percent; defender guards have none. The Cairo adapter converts
whole percent to the existing boost numerator by multiplying by 100, with expiry after this exchange. Other boosts,
initial cooldown and both die rolls are zero. Losses are clamped to starting troops.

Regenerate inputs from the repository root:

```sh
bun contracts/l3/world-native/scripts/frontier-combat-vectors.ts inputs
```

This writes placeholder results. On the coordinated build box, under `athanor.slice`, record the contract outcomes:

```sh
snforge test record_frontier_combat_exchanges --ignored --max-threads 1 > frontier-combat-recording.log
```

Back at the repository root, merge the recording and run the Cairo replay on the box:

```sh
bun contracts/l3/world-native/scripts/frontier-combat-vectors.ts record /path/to/frontier-combat-recording.log
```

```sh
snforge test frontier_combat_matches_two_hundred_shared_exchanges --max-threads 1
```

The frontend reads the same file and compares exact scaled losses using its fixed-point implementation. A separate Cairo
context regression checks that disabled dice stay zero for distinct random roots on both layers. The fixture's zero-roll
arithmetic alone would not prove the production rule gate.
