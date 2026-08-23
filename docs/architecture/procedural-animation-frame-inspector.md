# Procedural animation frame inspector

The promotion criteria and latest scored review live in [Animation evaluation](./animation-evaluation.md).

## Purpose

The character gym can replay an animation from frame zero at the configured fixed timestep, capture either every frame
or a five-view phase atlas, and reconstruct any captured frame exactly. This removes wall-clock timing and camera drift
from animation review.

Open `/debug/procedural-characters` and choose **Frames**. The inspector provides:

- a horizontally scrollable frame strip;
- expected and actual action phases;
- left/right elbow angles;
- hand-to-head clearances;
- bow grip, arrow/head, and nock/jaw measurements;
- semantic pose assertions and nonblank-image checks;
- JSON pose-report and PNG contact-sheet downloads;
- optional numbered joint, limb-chain, angle, contact, clearance, and equipment overlays;
- **5-view atlas** and **Every frame** capture modes.

For a grounded humanoid in walk or run mode, choose **Gait** instead. That capture advances the actor root at the
configured gait's natural travel speed, locks stance feet in world space, and keeps the inspection camera following the
actor. Its all-frame result adds cycle coverage, root travel, left/right contact duty, double-support, flight, swing
clearance, swing-apex timing, and plant-drift measurements directly to the inspector.

## Minimum spatial coverage

The default atlas captures one representative pose from every named animation phase at five angles:

| View                   | What it exposes                                                        |
| ---------------------- | ---------------------------------------------------------------------- |
| Front                  | left/right symmetry, stance width, hand orientation, weapon alignment  |
| Right profile          | weapon or draw-arm bend, forward reach, head and torso clearance       |
| Rear                   | shoulder, spine, equipment, rider-seat, and limb crossover errors      |
| Left profile           | shield or bow-arm extension, silhouette, and opposite-side clearance   |
| Elevated three-quarter | depth ordering, arm-to-torso intersections, mounts, saddles, and hands |

Four cardinal views alone hide vertical and depth intersections, while a second elevated/rear three-quarter adds less
new information than it costs. Five is therefore the default spatial minimum for the current asymmetric characters. The
atlas uses one midpoint per named action phase: 45 images for the nine-phase archer shot and 30 for the six-phase melee
attack. Locomotion instead uses four quarter-cycle poses (20 images) so every biped and horse contact pattern is
represented. The single three-quarter **Every frame** capture remains the temporal proof for transitions, so the default
does not create 735 near-duplicate images for one 147-frame archer cycle.

Captured actions are selected from the active unit:

| Unit                | Sequence                   |
| ------------------- | -------------------------- |
| Archer              | complete shot cycle        |
| Knight              | melee attack cycle         |
| Mounted Paladin     | mounted melee attack cycle |
| Horse / Crossbowman | one locomotion cycle       |

## Automated capture

Run the reusable browser capture from `client/apps/game`:

```bash
pnpm capture:character-animation \
  --base-url https://127.0.0.1:4174 \
  --kind knight \
  --motion-mode run \
  --sequence locomotion-cycle \
  --sampling all-frames \
  --overlay diagnostic \
  --output-dir ../../../output/animation-capture/knight-run
```

Supported kinds are `archer`, `crossbowman`, `horse`, `knight`, and `paladin`. Sampling is `phase-atlas`, `key-phases`,
or `all-frames`; overlay mode is `diagnostic` or `clean`. `--motion-mode walk|run` selects the grounded gait,
`--sequence locomotion-cycle` overrides a combat unit's default action capture, and `--root-motion-speed` can override
the natural distance-per-cycle speed. The command writes one labelled WebP per sampled frame and view, plus a
reproducible `pose-report.json` containing the complete unit configuration, phase plan, root speed, viewpoint metadata,
named joint positions, contact cycles, locomotion metrics, and issues. It exits non-zero for a blank view, phase drift,
non-finite joints, invalid anatomy or equipment, or a moving-root locomotion gate failure.

The read-only browser seam is `window.__proceduralCharacterGym`:

- `captureFrames(sampling, overlay, { sequence?, rootMotionSpeed? })`
- `seekFrame(frameIndex, sequence?, rootMotionSpeed?)`
- `getFrameCaptureReport()`
- `getCapturedFrameImage(frameIndex, viewId?)`

## Iteration loop

1. Capture the current configuration.
2. Inspect the first failing frame and its named phase.
3. Change the smallest relevant pose parameter.
4. Recapture from frame zero.
5. Compare the same frame and verify that no neighboring phase regressed.
6. Run the phase atlas and moving-root all-frame capture before promotion.

The inspector is presentation-only. It does not write gameplay state, advance Cairo combat, or infer damage from mesh
positions.
