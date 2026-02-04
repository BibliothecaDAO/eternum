# Exploration Discovery - Specification

This document explains the structure discovery system during exploration, including probabilities and the order in which discoveries are checked.

---

## Overview

When troops explore the map, they may discover structures. The discovery system uses a sequential lottery process - each structure type is checked in a specific order, and if a discovery is made, the process stops immediately. This creates **conditional probabilities** where earlier structure types suppress the discovery of later ones.

---

## Game Modes

Eternum has two game modes that affect which structures can be discovered:

| Mode | Description | Unique Discoveries |
|------|-------------|-------------------|
| **Season Mode** (Eternum) | The main competitive season | Hyperstructures, Holy Sites |
| **Blitz Mode** | Faster-paced gameplay | Relic Chests, Camps |

Some structures are discoverable in both modes:
- **Fragment Mines** - Always discoverable
- **Bitcoin Mines** - Ethereal layer only (both modes)
- **Agents** - Always discoverable

---

## Discovery Order

### Season Mode (Eternum)

```
1. Hyperstructure     → If found, STOP
      ↓ (not found)
2. Fragment Mine      → If found, STOP
      ↓ (not found)
3. Holy Site          → If found, STOP
      ↓ (not found)
4. Bitcoin Mine*      → If found, STOP (*Ethereal layer only)
      ↓ (not found)
5. Agent              → If found, STOP
      ↓ (not found)
   Nothing found
```

### Blitz Mode

```
1. Relic Chest        → Time-based global discovery (separate check)
      ↓ (continues regardless)
2. Fragment Mine      → If found, STOP
      ↓ (not found)
3. Bitcoin Mine*      → If found, STOP (*Ethereal layer only)
      ↓ (not found)
4. Camp               → If found, STOP
      ↓ (not found)
5. Agent              → If found, STOP
      ↓ (not found)
   Nothing found
```

**Note:** In Blitz mode, Relic Chest discovery uses a time-based system separate from the lottery, so it doesn't suppress other discoveries.

---

## Probability Configuration

Discovery probabilities are configured in `MapConfig`. The lottery uses a weighted random choice where:

```
Probability = win_probability / (win_probability + fail_probability)
```

### Structure Probabilities

| Structure | Config Fields | Description |
|-----------|--------------|-------------|
| **Fragment Mine** | `shards_mines_win_probability`, `shards_mines_fail_probability` | Standard lottery |
| **Hyperstructure** | `hyps_win_prob`, `hyps_fail_prob` | Modified by distance and count |
| **Holy Site** | `holysite_win_probability`, `holysite_fail_probability` | Standard lottery |
| **Bitcoin Mine** | `bitcoin_mine_win_probability`, `bitcoin_mine_fail_probability` | Default: 2% (200/10000) |
| **Camp** | `camp_win_probability`, `camp_fail_probability` | Standard lottery |
| **Agent** | `agent_discovery_prob`, `agent_discovery_fail_prob` | Subject to agent limit |
| **Relic Chest** | `relic_discovery_interval_sec` | Time-based, not lottery |

### Bitcoin Mine Default Probability

Bitcoin Mines have a default configuration of:
- Win probability: 200 (basis points)
- Fail probability: 9800 (basis points)
- **Effective probability: 2% (1 in 50)**

---

## Conditional Probability Math

Because discoveries are checked sequentially, the **actual** probability of finding a specific structure is lower than its configured probability.

### Example Calculation

Given these individual probabilities:
- Mine: 5%
- Holy Site: 3%
- Bitcoin Mine: 2%

The actual discovery probabilities in Season Mode would be:

| Order | Structure | Individual Prob | Actual Prob | Calculation |
|-------|-----------|----------------|-------------|-------------|
| 1 | Hyperstructure | P(H) | P(H) | Direct |
| 2 | Mine | P(M) | P(M) × (1 - P(H)) | Requires no Hyperstructure |
| 3 | Holy Site | P(S) | P(S) × (1 - P(H)) × (1 - P(M)) | Requires neither above |
| 4 | Bitcoin Mine | P(B) | P(B) × (1 - P(H)) × (1 - P(M)) × (1 - P(S)) | Requires none above |
| 5 | Agent | P(A) | P(A) × (1 - P(H)) × ... | Requires none above |

### Bitcoin Mine Suppression

For Bitcoin Mines specifically (in Season Mode on Ethereal layer):

```
Actual Bitcoin Mine Probability =
    P(Bitcoin) × (1 - P(Hyperstructure)) × (1 - P(Mine)) × (1 - P(HolySite))
```

This means the **effective** probability of finding a Bitcoin Mine is always lower than 2% due to suppression by earlier structure checks.

---

## Special Conditions

### Reserved Tiles

Structure discovery cannot happen on **reserved tiles**. If a tile is reserved (has `StructureReservation.reserved = true`), the lottery immediately returns with no discovery.

### Ethereal Layer (Alt Dimension)

Bitcoin Mines can **only** be discovered when exploring in the Ethereal layer. The discovery check specifically requires `tile.alt = true`.

### Agent Limit

Agent discovery has an additional constraint - it stops when the global agent count limit is reached (`AgentCountImpl::limit_reached`).

### Hyperstructure Distance Modifier

Hyperstructure discovery probability decreases based on:
1. **Distance from center**: `hyps_fail_prob_increase_p_hex` per hex
2. **Count already found**: `hyps_fail_prob_increase_p_fnd` per hyperstructure

This makes Hyperstructures easier to find near the center of the map and progressively harder as more are discovered.

---

## Relic Chest Discovery (Blitz Mode Only)

Relic Chests use a different discovery mechanism:
- **Time-based**: Discovered at intervals (`relic_discovery_interval_sec`)
- **Global**: One discovery opportunity shared across all explorers
- **Distance requirement**: Must be within `relic_hex_dist_from_center` of center
- **Non-suppressive**: Doesn't prevent other structure discoveries

---

## Summary by Mode

### Season Mode (Eternum)

| Structure | Probability | Special Conditions |
|-----------|-------------|-------------------|
| Hyperstructure | Distance & count modified | Season mode only |
| Fragment Mine | Configured | Always available |
| Holy Site | Configured | Season mode only |
| Bitcoin Mine | ~2% | Ethereal layer only |
| Agent | Configured | Subject to limit |

### Blitz Mode

| Structure | Probability | Special Conditions |
|-----------|-------------|-------------------|
| Relic Chest | Time-based | Blitz mode only |
| Fragment Mine | Configured | Always available |
| Bitcoin Mine | ~2% | Ethereal layer only |
| Camp | Configured | Blitz mode only |
| Agent | Configured | Subject to limit |

---

## Technical Reference

### VRF Offsets

Each lottery uses a unique VRF offset to prevent correlated outcomes:

| Structure | VRF Offset |
|-----------|------------|
| Fragment Mine | 2 |
| Agent | 3 |
| Holy Site | 6 |
| Camp | 7 |
| Bitcoin Mine | 10 |

### Config Struct Location

Discovery probabilities are stored in `MapConfig` (see `contracts/game/src/models/config.cairo`).
