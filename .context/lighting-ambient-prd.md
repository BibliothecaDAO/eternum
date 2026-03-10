# Lighting And Ambient Stabilization PRD

## Problem

The current Three.js lighting and ambient stack has cross-system ownership conflicts and timing drift:

- storm-only lighting is active in clear weather
- fog is disabled in normal play unless toggled from debug GUI
- fog range is owned by multiple systems
- worldmap shadow resolution ignores quality settings
- ambience audio can enter rain before rain visuals begin
- delayed lightning can survive scene cleanup

These issues make the scene feel inconsistent and make future tuning unsafe.

## Goals

- Keep storm-only lighting inactive during clear weather.
- Make atmospheric fog visible by default when quality allows it.
- Give fog range a single runtime owner.
- Keep day/night responsible for color palette changes, not camera-distance fog range.
- Respect quality-controlled shadow map sizes in worldmap.
- Align ambience weather transitions with rendered rain/storm intensity.
- Ensure all lightning timers are cleaned up deterministically.

## Non-Goals

- Reworking the artistic look of the day/night palette.
- Adding new post-processing or new weather types.
- Large scene-architecture changes outside the affected lighting and ambience paths.

## Ownership Model

- `HexagonScene`: fog enablement, fog near/far range, storm-light activation, lightning timer cleanup
- `DayNightCycleManager`: sky/light/fog color palette only
- `WeatherManager`: authoritative rain/storm intensity
- `AmbienceManager`: audio scheduling from cycle progress plus actual rain/storm intensity
- `WorldmapScene`: shadow camera extents, but not shadow resolution policy

## Acceptance Criteria

1. In clear weather, storm point light intensity is zero and ambient/hemisphere storm flicker is not applied.
2. On supported quality levels, fog is attached without requiring a debug GUI toggle.
3. Fog near/far are not mutated by `DayNightCycleManager`.
4. Weather fog density is applied from the scene fog owner, not from the day/night manager.
5. Worldmap directional shadow map size matches the current quality feature when shadows are enabled.
6. Rain ambience does not switch on before rain visuals are eligible to render.
7. Scene cleanup cancels both delayed lightning start and follow-up strike timers.

## Test Plan

- unit test storm lighting policy for clear weather vs storm weather
- unit test day/night manager no longer mutates fog near/far
- unit test ambience weather resolution from rain/storm intensities
- unit test lightning timer cleanup
- unit test worldmap shadow sizing policy
- run focused Three.js lighting/ambient tests from `client/apps/game`
