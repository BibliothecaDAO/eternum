# Bitcoin Mines - Feature Specification

## Overview

Bitcoin Mines are special structures that players can discover and conquer in the Ethereal layer of Eternum. Once owned,
players can contribute labor to participate in periodic lotteries for SATOSHI rewards.

---

## Discovery

### Where to Find Them

- Bitcoin Mines can **only** be found in the **Ethereal layer** (the alternate dimension)
- They are discovered randomly while exploring with troops
- Discovery chance: **1 in 50** (2% per exploration)

### What Happens When Found

- A Bitcoin Mine structure appears on the map at that location
- The mine is initially **guarded by bandits** (Tier 3 Paladin defenders)
- Players must **defeat the guards** to claim ownership of the mine

---

## How It Works

### The Phase System

Bitcoin Mines operate on a **phase-based cycle**:

- Each phase lasts **10 minutes**
- Phases are numbered sequentially (Phase 1, Phase 2, Phase 3, etc.)
- All Bitcoin Mines in the game share the same phase schedule

### Contributing Labor

Once you own a Bitcoin Mine, you can participate by contributing labor:

1. **Send labor** from your mine to a specific phase
2. You can contribute to:
   - The **current phase** (if the contribution window is still open)
   - **Future phases** (up to 30 phases ahead)
3. Each contribution must meet the **minimum labor requirement**
4. You can make **multiple contributions** to the same phase
5. Labor is **burned** (consumed) when contributed

### The Lottery

At the end of each phase, a lottery determines who wins the prize:

- **Your odds = Your labor contribution / Total labor in that phase**
- Example: If you contributed 300 labor and the total is 1,000, you have a 30% chance to win
- The more labor you contribute, the better your chances
- **Anyone can trigger** the lottery once the phase ends (it's permissionless)

### Winning

When a winner is determined:

- **SATOSHI tokens** are minted directly at the winning mine
- The owner can then transport SATOSHI using donkeys like any other resource
- Only **one winner per phase** - once someone wins, the lottery stops

---

## Prize Pool & Rollover

### Base Prize

- Each phase has a **base prize pool** (configured by admins)
- This prize is in **SATOSHI** (an in-game resource)

### What If No One Wins?

If all participants claim and no one wins the lottery:

1. The prize **rolls over** to a future phase
2. It goes to the **next available phase** (starting from the current phase)
3. This can create **jackpot accumulation** - multiple prizes stacking up

### Rollover Limits

- Prizes can roll over for a **maximum of 6 phases**
- If no winner after 6 phases, the prize is **burned** (lost forever)
- This creates scarcity and urgency to participate

---

## Key Rules

### Contribution Rules

| Rule | Description |
|------|-------------|
| Ownership required | Only the mine owner can contribute labor from that mine |
| Minimum contribution | Each contribution must meet the minimum labor amount |
| No past phases | Cannot contribute to phases that have already ended |
| Future limit | Can only contribute up to 30 phases ahead |
| Window closes | Each phase has a contribution deadline (1 second before next phase starts) |

### Claiming Rules

| Rule | Description |
|------|-------------|
| Anyone can claim | Any player can trigger the lottery for any phase |
| Phase must end | Can only claim after the phase's contribution window closes |
| One winner | Once a winner is found, claiming stops for that phase |
| Season limit | Phases that end after the season ends cannot be claimed |

---

## Strategy Tips

### Maximizing Your Chances

1. **Contribute more labor** - Higher contribution = higher win probability
2. **Contribute early** - Secure your spot in the phase
3. **Watch the total** - Monitor how much others are contributing
4. **Target jackpot phases** - Phases with rolled-over prizes have bigger rewards

### Risk Considerations

1. **Labor is burned** - You lose your labor whether you win or not
2. **Probability, not guarantee** - Even 90% odds can lose
3. **Competition** - More participants = smaller individual odds
4. **Timing** - Contributing near phase end is risky (window might close)

---

## Example Scenario

**Setup:**
- Phase 5 has a prize pool of 100 SATOSHI
- Three players participate:
  - Alice contributes 500 labor (50%)
  - Bob contributes 300 labor (30%)
  - Charlie contributes 200 labor (20%)
- Total labor in Phase 5: 1,000

**Outcome possibilities:**
- Alice has 50% chance to win
- Bob has 30% chance to win
- Charlie has 20% chance to win

**If no one wins:**
- Prize rolls to the next phase (e.g., Phase 10 if we're currently in Phase 10)
- That phase now has 100 + its base prize = bigger jackpot

---

## Summary

| Aspect | Detail |
|--------|--------|
| Location | Ethereal layer only |
| Discovery chance | 1 in 50 (2%) |
| Phase duration | 10 minutes |
| Prize type | SATOSHI (in-game resource) |
| Win odds | Proportional to labor contributed |
| Max future contribution | 30 phases ahead |
| Max rollover | 6 phases before prize burns |
| Who can claim | Anyone (permissionless) |

---

## Glossary

- **Phase**: A 10-minute time window for contributions and lottery
- **Labor**: An in-game resource that players burn to participate
- **SATOSHI**: The reward token minted to winners
- **Rollover**: When an unclaimed prize moves to a future phase
- **Permissionless**: Any player can perform the action, not just the owner
- **Ethereal layer**: The alternate dimension in Eternum (accessed via portals)
