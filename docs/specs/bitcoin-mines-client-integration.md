# Bitcoin Mines - Client Integration Guide

This document provides technical details for integrating Bitcoin Mines into the Eternum client.

---

## Contract Interface

### System Contract: `bitcoin_mine_systems`

```cairo
#[starknet::interface]
pub trait IBitcoinMineSystems<T> {
    /// Contribute labor to a phase
    fn contribute_labor(ref self: T, mine_id: ID, target_phase_id: u64, labor_amount: u128);

    /// Process claims for multiple mines in a phase (permissionless)
    fn claim_phase_reward(ref self: T, phase_id: u64, mine_ids: Array<ID>);

    /// View: Get current phase ID (time-based)
    fn get_current_phase(self: @T) -> u64;

    /// View: Get mine's contribution percentage for a phase (basis points)
    fn get_mine_contribution(self: @T, mine_id: ID, phase_id: u64) -> u128;
}
```

---

## Models

### BitcoinPhaseLabor

Tracks global state for each phase. Key: `phase_id`

```typescript
interface BitcoinPhaseLabor {
  phase_id: u64;
  prize_pool: u128; // SATOSHI allocated (base + rollover)
  total_labor: u128; // Cumulative labor deposited
  participant_count: u32; // Distinct mines that contributed
  claim_count: u32; // Mines that have attempted claim
  reward_receiver_phase: u64; // See interpretation below
}
```

**`reward_receiver_phase` interpretation:**

- `0` = Pending (lottery not yet complete) or burned (no qualifying phase found)
- `phase_id` (same as key) = Winner found in this phase
- Other value = Prize forwarded to that phase

### BitcoinMinePhaseLabor

Tracks each mine's contribution per phase. Key: `(phase_id, mine_id)`

```typescript
interface BitcoinMinePhaseLabor {
  phase_id: u64;
  mine_id: ID;
  labor_contributed: u128;
  claimed: bool; // Has this mine attempted claim
}
```

---

## Configuration

### BitcoinMineConfig

Retrieved via `WorldConfigUtilImpl::get_member(world, selector!("bitcoin_mine_config"))`

```typescript
interface BitcoinMineConfig {
  enabled: bool;
  prize_per_phase: u128; // Base SATOSHI prize per phase
  min_labor_per_contribution: u128; // Minimum labor per contribution (must be > 0)
}
```

### TickConfig

Phase timing is derived from `bitcoin_phase_in_seconds`:

```typescript
interface TickConfig {
  armies_tick_in_seconds: u64;
  delivery_tick_in_seconds: u64;
  bitcoin_phase_in_seconds: u64; // Default: 600 (10 minutes)
}
```

---

## Phase Timing

### Calculating Current Phase

```typescript
const currentPhase = Math.floor(Date.now() / 1000 / bitcoinPhaseInSeconds);
```

### Phase Windows

Each phase has a contribution window that ends 1 second before the next phase starts:

```typescript
function getPhaseEndTime(phaseId: number, phaseInterval: number): number {
  return (phaseId + 1) * phaseInterval - 1;
}

function isContributionOpen(phaseId: number, phaseInterval: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now < getPhaseEndTime(phaseId, phaseInterval);
}

function hasContributionClosed(phaseId: number, phaseInterval: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now >= getPhaseEndTime(phaseId, phaseInterval);
}
```

### Valid Contribution Targets

Players can contribute to:

- Current phase (if window still open)
- Up to 30 phases ahead (`MAX_FUTURE_PHASES = 30`)

```typescript
function isValidTargetPhase(targetPhase: number, currentPhase: number): boolean {
  if (targetPhase === 0) return false; // Phase 0 is invalid
  if (targetPhase < currentPhase) return false; // No past phases
  if (targetPhase > currentPhase + 30) return false; // Max 30 ahead
  return true;
}
```

---

## Events

### BitcoinMineProductionStory

Emitted when labor is contributed to a phase.

```typescript
interface BitcoinMineProductionStory {
  mine_id: ID;
  owner: ContractAddress;
  phase_id: u64;
  labor_deposited: u128;
}
```

### BitcoinPhaseLotteryStory

Emitted when a winner is determined.

```typescript
interface BitcoinPhaseLotteryStory {
  phase_id: u64;
  total_labor: u128;
  winner_mine_id: ID;
  winner_owner: ContractAddress;
  winner_labor: u128;
  prize_awarded: u128;
}
```

---

## Client Workflows

### 1. Display Phase Information

```typescript
async function getPhaseInfo(phaseId: number) {
  const phaseLabor = await world.read_model<BitcoinPhaseLabor>(phaseId);
  const currentPhase = await bitcoinMineSystem.get_current_phase();
  const phaseInterval = tickConfig.bitcoin_phase_in_seconds;

  return {
    phaseId,
    prizePool: phaseLabor.prize_pool,
    totalLabor: phaseLabor.total_labor,
    participantCount: phaseLabor.participant_count,
    isActive: phaseId >= currentPhase,
    contributionOpen: isContributionOpen(phaseId, phaseInterval),
    hasWinner: phaseLabor.reward_receiver_phase === phaseId,
    wasForwarded: phaseLabor.reward_receiver_phase !== 0 && phaseLabor.reward_receiver_phase !== phaseId,
    endTime: getPhaseEndTime(phaseId, phaseInterval),
  };
}
```

### 2. Display Mine's Contribution

```typescript
async function getMineContributionInfo(mineId: ID, phaseId: number) {
  const minePhaseLabor = await world.read_model<BitcoinMinePhaseLabor>([phaseId, mineId]);
  const contributionBps = await bitcoinMineSystem.get_mine_contribution(mineId, phaseId);

  return {
    laborContributed: minePhaseLabor.labor_contributed,
    claimed: minePhaseLabor.claimed,
    contributionPercent: contributionBps / 100, // Convert bps to percentage
    winProbability: contributionBps / 10000, // Convert bps to decimal
  };
}
```

### 3. Contribute Labor

```typescript
async function contributeLabor(mineId: ID, targetPhaseId: number, laborAmount: bigint) {
  // Validations client should check before calling
  const currentPhase = await bitcoinMineSystem.get_current_phase();
  const config = await getConfig<BitcoinMineConfig>("bitcoin_mine_config");

  if (!config.enabled) throw new Error("Bitcoin mine system disabled");
  if (targetPhaseId === 0) throw new Error("Phase 0 is invalid");
  if (targetPhaseId < currentPhase) throw new Error("Cannot contribute to past phase");
  if (targetPhaseId > currentPhase + 30) throw new Error("Phase too far in future");
  if (laborAmount < config.min_labor_per_contribution) throw new Error("Below minimum");

  // Check contribution window
  const phaseInterval = tickConfig.bitcoin_phase_in_seconds;
  if (!isContributionOpen(targetPhaseId, phaseInterval)) {
    throw new Error("Contribution window closed");
  }

  // Execute transaction
  await bitcoinMineSystem.contribute_labor(mineId, targetPhaseId, laborAmount);
}
```

### 4. Claim Phase Reward (Permissionless)

Anyone can trigger the lottery for any phase after its window closes:

```typescript
async function claimPhaseReward(phaseId: number, mineIds: ID[]) {
  const phaseInterval = tickConfig.bitcoin_phase_in_seconds;

  // Validate window has closed
  if (!hasContributionClosed(phaseId, phaseInterval)) {
    throw new Error("Contribution window still open");
  }

  // Check if already processed
  const phaseLabor = await world.read_model<BitcoinPhaseLabor>(phaseId);
  if (phaseLabor.reward_receiver_phase !== 0) {
    console.log("Phase already processed");
    return;
  }

  // Execute claim
  await bitcoinMineSystem.claim_phase_reward(phaseId, mineIds);
}
```

---

## UI Recommendations

### Phase Timer

Display countdown to phase end:

```typescript
function getTimeRemaining(phaseId: number, phaseInterval: number): number {
  const endTime = getPhaseEndTime(phaseId, phaseInterval);
  const now = Math.floor(Date.now() / 1000);
  return Math.max(0, endTime - now);
}
```

### Contribution Odds Display

Show probability as percentage:

```typescript
function formatWinProbability(contributionBps: number): string {
  const percent = contributionBps / 100;
  return `${percent.toFixed(2)}%`;
}
```

### Phase Status Badges

```typescript
function getPhaseStatus(phaseLabor: BitcoinPhaseLabor, currentPhase: number): string {
  if (phaseLabor.reward_receiver_phase === phaseLabor.phase_id) {
    return "winner_found";
  }
  if (phaseLabor.reward_receiver_phase !== 0) {
    return "forwarded";
  }
  if (phaseLabor.phase_id < currentPhase) {
    return "pending_claim";
  }
  return "active";
}
```

### Jackpot Indicator

Highlight phases with accumulated prizes:

```typescript
function isJackpotPhase(phaseLabor: BitcoinPhaseLabor, basePrize: bigint): boolean {
  return phaseLabor.prize_pool > basePrize;
}
```

---

## Constants

```typescript
const SATOSHI_RESOURCE_TYPE = 58;
const MAX_FUTURE_PHASES = 30;
const MAX_ROLLOVER_PHASES = 6;
const RESOURCE_PRECISION = 1_000_000_000_000_000_000n; // 10^18
```

---

## Torii Queries

### Get All Phase Labor Records

```graphql
query GetBitcoinPhases($first: Int, $after: String) {
  bitcoinPhaseLaborModels(first: $first, after: $after) {
    edges {
      node {
        phase_id
        prize_pool
        total_labor
        participant_count
        claim_count
        reward_receiver_phase
      }
    }
  }
}
```

### Get Mine's Contributions

```graphql
query GetMineContributions($mineId: ID!) {
  bitcoinMinePhaseLaborModels(where: { mine_id: $mineId }) {
    edges {
      node {
        phase_id
        mine_id
        labor_contributed
        claimed
      }
    }
  }
}
```

### Subscribe to Lottery Events

```graphql
subscription OnLotteryWinner {
  storyEvents(where: { story_type: "BitcoinPhaseLotteryStory" }) {
    id
    timestamp
    story {
      ... on BitcoinPhaseLotteryStory {
        phase_id
        winner_mine_id
        winner_owner
        prize_awarded
      }
    }
  }
}
```

---

## Error Handling

| Error Message                                                  | Cause                          | Client Action            |
| -------------------------------------------------------------- | ------------------------------ | ------------------------ |
| "Bitcoin mine system is not enabled"                           | System disabled in config      | Hide Bitcoin Mine UI     |
| "caller is not owner"                                          | Non-owner trying to contribute | Check ownership          |
| "Structure is not a bitcoin mine"                              | Wrong structure type           | Validate structure type  |
| "Phase ID must be greater than 0"                              | Invalid phase                  | Use phase >= 1           |
| "Cannot contribute to past phase"                              | Phase already ended            | Target current or future |
| "Cannot contribute to phase more than 30 phases in the future" | Phase too far ahead            | Limit phase selection    |
| "Contribution window has closed"                               | Phase ended                    | Target next phase        |
| "Labor amount must be > 0"                                     | Zero contribution              | Validate input           |
| "Labor below minimum contribution"                             | Below min threshold            | Show minimum required    |
| "Not enough labor"                                             | Insufficient balance           | Show available labor     |
| "Phase has no participants"                                    | Empty phase                    | Skip claim               |
| "Contribution window has not closed yet"                       | Too early to claim             | Wait for phase end       |
| "phase ends after season"                                      | Season ended                   | Disable contributions    |

---

## Testing Checklist

- [ ] Phase timer counts down correctly
- [ ] Contribution succeeds for current and future phases
- [ ] Contribution fails for past phases
- [ ] Win probability updates after contribution
- [ ] Lottery can be triggered after phase ends
- [ ] Winner notification displays correctly
- [ ] SATOSHI balance updates for winner
- [ ] Rollover phases show accumulated prize
- [ ] Multiple contributions from same mine accumulate
- [ ] Claim button disabled during contribution window
