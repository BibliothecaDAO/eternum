# Factory V2

This document is the working brief for the Factory V2 rebuild.

The goal is to stop iterating on a dashboard shape that still feels heavy and instead build a calmer factory that feels
obvious within a few seconds.

## Product Goal

Factory V2 should feel like a simple launcher, not an operator console.

The user should only need to understand:

- what kind of game they are working with
- whether they want to start a game or check a game
- what is happening right now
- what one action to take next

Everything else should stay secondary until it is needed.

## Problems To Fix

- Too many sections compete on the screen at the same time.
- Too many cards look alike.
- Color is being used decoratively instead of structurally.
- The current page still exposes workflow thinking instead of user intent.
- The current watch flow still makes the user manage too much state.
- The current start flow still asks the user to scan more than they should.
- The full step list is still too visible and too important by default.

## V2 Principles

### Intent First

The first choice is the user's goal, not the system's structure.

- `Start game`
- `Check game`

### One Main Surface

Each path should have one main surface.

- Start path: one setup chooser and one launch action
- Check path: one status card and one next action

### Secondary Details Stay Secondary

- Other games should be compact and easy to ignore
- The full step list should stay hidden until the user asks for it
- Technical language should stay behind labels the user can skip

### Calm Visual Hierarchy

- fewer borders
- flatter surfaces
- stronger spacing
- one strong accent at a time
- neutral structure colors
- semantic warning colors only when something needs attention

### Readable State

The user should be able to answer these questions instantly:

1. What game am I looking at?
2. Is it moving, done, or stuck?
3. What should I press next?

## V2 UI Structure

### Global Shape

- lightweight header
- game type switch
- intent switch
- one main card for the chosen intent

### Start Game

- show one picked setup at a time
- keep alternate setups visible but quiet
- explain the chosen setup in plain language
- show one large start button
- keep follow-up expectations short and human

### Check Game

- compact game switcher
- one large state card
- one primary action
- one secondary refresh action
- optional details drawer for the full step list

### Step Language

Use plain language first.

Prefer:

- `Making the world`
- `Waiting for live data`
- `Opening the game`
- `Needs another try`

Avoid leading with:

- workflow names
- contract nouns
- CI jargon
- recovery jargon

## Mode Direction

### Eternum

- slower
- heavier
- warmer
- more deliberate

### Blitz

- faster
- lighter
- cleaner
- more immediate

Both should look clearly different, but neither should feel visually busy.

## Build Plan

1. Write the V2 brief and lock the goals.
2. Reduce the page to the two main intents: start or check.
3. Replace the multi-card stack with one dominant content surface.
4. Simplify copy until the page reads in plain language.
5. Rebuild the watch state around one large status card.
6. Hide detailed steps behind an explicit reveal.
7. Rework the visual system so sections are distinct without noisy gradients.
8. Review the result specifically for simplicity and visual calm.

## Working Checklist

- [ ] Replace the old stacked section flow with a true intent-first layout
- [ ] Simplify the start path into one dominant launch surface
- [ ] Simplify the watch path into one dominant status surface
- [ ] Make the game switcher compact and secondary
- [ ] Reduce technical copy across the page
- [ ] Distinguish Eternum and Blitz with cleaner visual systems
- [ ] Hide detailed steps behind a deliberate reveal
- [ ] Review the top-level components for readability and intent-first flow
