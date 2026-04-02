# Unit Command Audio PRD / TDD

## Status

- Status: Implemented
- Scope:
  - `client/apps/game/src/audio/*`
  - `client/apps/game/src/three/scenes/worldmap.tsx`
  - `client/apps/game/src/ui/features/military/battle/quick-attack-preview.tsx`
  - `client/apps/game/src/ui/features/military/battle/combat-container.tsx`
- Primary goal: replace the current selection-only unit acknowledgement with explicit command cues for select, move,
  attack, and explore

## Why This Exists

Right now army audio intent is inconsistent:

- army selection plays a dedicated acknowledgement cue
- movement and exploration share one generic marching sound
- attack does not play a command acknowledgement when the player actually confirms the attack
- the command-specific sound intent is not centralized, so the world map and battle UIs can drift

The product goal is straightforward: manual unit interactions should acknowledge the command the player gave, not just
the fact that a unit is selected.

## Constraints

1. The current repo does not contain voiced bark assets for lines like "yes sir" or "for the king".
2. The implementation therefore needs an intent-first audio layer now, while mapping those intents to existing
   placeholder assets until proper VO is added.
3. Attack confirmation is submitted from two different UI paths, so the cue cannot live only in the worldmap click
   handler.

## Product Goals

### User goals

1. Selecting an army should play a light acknowledgement cue.
2. Issuing a move command should sound different from selection.
3. Issuing an explore command should sound different from normal movement.
4. Confirming an attack should play an attack acknowledgement at the moment the transaction is submitted.

### Engineering goals

1. Command-to-sound mapping should live in one shared audio helper.
2. Manual worldmap command flows should use intent names instead of hardcoded asset ids.
3. Both attack submission UIs should use the same acknowledgement helper.
4. Existing audio ids should remain available so unrelated code does not break.

## Non-goals

1. Adding brand-new voiced audio files in this pass.
2. Retuning the whole audio mixer or category system.
3. Adding command acknowledgement audio to automation flows.
4. Changing hex selection, structure selection, or unrelated UI click sounds.

## Product Requirements

### Manual army selection

1. Selecting an army on the world map must play `select` command audio through the shared helper.

### Manual movement and exploration

1. Move and spire-travel style movement must resolve to the `move` command cue.
2. Explore must resolve to the `explore` command cue.
3. The worldmap movement handler must stop hardcoding one generic unit sound for both cases.

### Manual attack confirmation

1. Quick attack confirmation must play the `attack` command cue when the attack submission is valid and about to be
   sent.
2. Detailed combat modal confirmation must do the same.
3. The attack cue must not fire from simply opening the preview.

### Audio registry

1. The registry must define stable ids for:
   - `unit.command.select`
   - `unit.command.move`
   - `unit.command.attack`
   - `unit.command.explore`
2. This pass may map those ids to existing placeholder assets already in the repo.

## Placeholder Asset Mapping For This Pass

1. `unit.command.select` -> existing army-selected variations
2. `unit.command.move` -> existing march variations
3. `unit.command.attack` -> existing sword cue
4. `unit.command.explore` -> existing explore cue

This keeps the code intent-correct now and allows true voice assets to drop in later without changing gameplay call
sites.

## TDD Plan

## Red

1. Add a source-level audio wiring test that fails until the new command ids exist in the registry.
2. Extend that test to fail until worldmap selection and movement use shared command-audio helpers instead of hardcoded
   asset ids.
3. Extend that test to fail until both attack submission UIs call the shared `attack` acknowledgement helper.
4. Run the targeted test file and confirm it fails for those exact missing seams.

## Green

1. Add a shared unit-command-audio helper in `src/audio/`.
2. Register the four new command ids in the audio registry using current placeholder assets.
3. Update `worldmap.tsx` to use the helper for army selection and worldmap action-based cues.
4. Update `quick-attack-preview.tsx` and `combat-container.tsx` to play the shared attack cue on valid submission.
5. Add the latest-features entry describing the new command acknowledgements.

## Refactor

1. Keep command resolution logic out of the orchestration handlers.
2. Use helper names that describe command intent rather than playback mechanics.
3. Re-read the top-level worldmap handlers so the selection, movement, and attack flows still read as world actions
   first and audio details second.

## Verification Plan

1. Run the targeted unit command audio tests.
2. Run `pnpm run format`.
3. Run `pnpm run knip`.
4. Manually verify:
   - army selection
   - move on explored tiles
   - explore into fog
   - attack from quick preview
   - attack from detailed combat modal

## Verification Notes

1. `npx -y node@20.19.0 $(which pnpm) --dir client/apps/game test -- src/audio/unit-command-audio.source.test.ts src/audio/unit-command-audio.test.ts src/audio/config/registry.test.ts`
   passed.
2. `npx -y node@20.19.0 $(which pnpm) run format` passed.
3. `npx -y node@20.19.0 $(which pnpm) run knip` passed.
4. Manual in-game verification was not run in this session.
