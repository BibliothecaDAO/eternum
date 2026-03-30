# PRD: Player First Load Opens World Map

## Problem

When a player enters the game, the loading handoff currently redirects straight into the player's realm hex view. That
skips the broader world context and makes first load feel like a forced drill-down instead of an arrival into the game
world.

## Goal

On first load, players should land on the world map centered on their first synced realm instead of opening directly
inside that realm.

## Non-Goals

- Changing spectator entry behavior
- Changing which owned structure becomes the default controlled structure
- Changing later in-session navigation between map and hex views

## Desired Behavior

1. Entering the game still waits for owned structures to sync.
2. The first synced owned structure is still stored as the selected controlled structure.
3. Once that structure is known, player entry navigates to `/play/map` using that structure's normalized coordinates.
4. The loading overlay copy describes world-map entry rather than realm entry.

## Acceptance Criteria

- A player first load no longer redirects to `/play/hex`.
- A player first load redirects to `/play/map?col=<x>&row=<y>` for the first synced owned structure.
- The selected controlled structure remains set to that owned structure.
- Spectator behavior is unchanged.

## TDD Plan

1. Add a component test for `GameLoadingOverlay` that renders the player path with a synced owned structure.
2. Verify the test fails because the current implementation navigates to `/play/hex` and shows realm-specific copy.
3. Update the loading overlay to route players to `/play/map` and refresh the copy.
4. Re-run the test and the required repo checks.
