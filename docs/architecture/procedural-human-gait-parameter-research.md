# Adult human gait targets for procedural walk and run

**Research date:** 2026-08-24

**Scope:** healthy adult, level-ground walking and running; implementation targets for the procedural humanoid rig and
gym. This is not a clinical definition of “normal.”

**Evidence policy:** numerical observations come from peer-reviewed original studies or their published primary
datasets. Values labelled **chosen target**, **warning**, or **fail** are engineering decisions derived from that
evidence; they are not published biological limits.

## Executive finding

The visible bow-leggedness should be treated first as a **frontal-plane geometry defect**, not as insufficient bob,
twist, or randomness. The strongest checks are, in order:

1. the stance knee's outward distance from the projected hip-to-ankle line;
2. midline-to-midline step width normalized by leg length;
3. persistent bilateral hip abduction instead of crossing neutral into stance adduction;
4. excessive toe-out; and
5. a pelvis that stays centered while both legs reach outward instead of shifting over the support foot.

The highest-confidence measured anchors are:

- preferred walking step width is `0.13 × legLength` at 1.25 m/s;
- running step width was `8–10 cm` across 2.5–4.5 m/s, supporting a chosen target near `0.09–0.10 × legLength` for an
  adult-sized rig;
- natural walking foot progression is about `5–6°` toe-out in a recent instrumented baseline (`5.2 ± 5.5°` by pressure
  walkway; `5.6 ± 4.9°` by IMU);
- healthy walking knees are close to neutral in stance: group means `-0.4…+0.8°` varus/valgus with about `3.0–3.3°`
  between-person SD;
- ordinary walking uses about `62–65%` stance per foot and no flight; ordinary running uses about `39%` stance per foot
  and therefore has flight;
- at preferred speeds, walking cadence is about `116 steps/min` and recreational running cadence about `164 steps/min`;
  and
- true vertical center-of-mass excursion is about `4–5 cm` in preferred walking and `77 ± 12 mm` in recreational running
  near 9.9 km/h.

## Definitions and normalization

Use these definitions in diagnostics so published and runtime values are comparable:

- `H`: standing character height.
- `L`: functional leg length, hip-joint center to ground in the neutral rig. Do not substitute mesh scale.
- `stride`: same-foot initial contact to the next same-foot initial contact; one controller cycle.
- `stepWidth`: mediolateral distance between the **midlines** of consecutive left and right footprints, not outer shoe
  edges and not hip width.
- `footProgression`: signed angle from travel direction to the heel-to-second-metatarsal/foot-forward axis; positive is
  toe-out after mirroring left and right into one convention.
- `strideH = strideLength / H`.
- `speedH = speed / sqrt(g × H)`. This height-normalized speed is reported only where a study did not publish `L`; it
  must not be mislabeled as a leg-length Froude number.
- Joint angles must be zeroed from each rig's neutral anatomical calibration. Mirror the left side before aggregating.

## Measured evidence

### Spatial, temporal, and vertical targets

| Measure                     | Walking evidence                                                                                                                                                                                                                                          | Running evidence                                                                                                                                                                                                                                                                                                                                               | Confidence and animation consequence                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Step width                  | Ten healthy adults at 1.25 m/s preferred `0.13L`; minimum metabolic cost was `0.12L`, and foot width was `0.11L`. Widths `>=0.15L` increasingly raised mechanical and metabolic cost. [Donelan, Kram & Kuo, 2001](https://doi.org/10.1098/rspb.2001.1761) | Twenty-eight regular runners had `0.10 ± 0.02`, `0.09 ± 0.02`, and `0.08 ± 0.02 m` at 2.5, 3.5, and 4.5 m/s; width narrowed with speed but the study's speed effect did not reach significance. [Fukuchi, Fukuchi & Duarte, 2017](https://doi.org/10.7717/peerj.3298)                                                                                          | **High** for walk; **moderate-high** for run. Use `0.13L` for walk and about `0.08–0.11L` for run as controller targets. The run normalization is a chosen cross-study mapping of 8–10 cm to an adult leg near 0.9–1.0 m, not a directly reported ratio.                                                                                                         |
| Cadence                     | In 20 young active women, 1.04/1.32/1.62 m/s produced `101/116/128 steps/min` (`0.84/0.97/1.07 stride Hz`). [Winiarski, Pietraszewska & Pietraszewski, 2019](https://doi.org/10.1155/2019/9232430)                                                        | The 28-runner study reported `162/171/183 steps/min` (`1.35/1.43/1.53 stride Hz`) at 2.5/3.5/4.5 m/s. A separate 860-runner cohort at preferred speed, 9.9 ± 1.5 km/h, reported `164 ± 9 steps/min`. [Fukuchi et al., 2017](https://doi.org/10.7717/peerj.3298), [Malisoux et al., 2023](https://doi.org/10.1177/23259671231204629)                            | **High.** Runtime phase is stride Hz, so divide step cadence by 120 rather than by 60.                                                                                                                                                                                                                                                                           |
| Normalized stride and speed | With mean `H=1.686 m`, the same walking study measured stride `1.25/1.38/1.54 m`, hence `strideH=0.74/0.82/0.91`, and `speedH=0.26/0.33/0.40`. [Winiarski et al., 2019](https://doi.org/10.1155/2019/9232430)                                             | With mean `H≈1.76 m`, the 28-runner study measured stride `1.86/2.46/2.96 m`, hence `strideH=1.06/1.40/1.68`, and `speedH=0.60/0.84/1.08`. [Fukuchi et al., 2017](https://doi.org/10.7717/peerj.3298)                                                                                                                                                          | **Moderate-high.** These are cohort means, not universal proportions. Couple stride and cadence to speed; do not expose them as unrelated oscillators.                                                                                                                                                                                                           |
| Contact regime              | At 1.04/1.32/1.62 m/s, stance was `64.5/62.9/62.0%` and swing `35.5/36.6/38.0%` of a stride. Each of the two double-support windows was about `14.5/13.0/11.7%` of a stride. [Winiarski et al., 2019](https://doi.org/10.1155/2019/9232430)               | Public force curves from the 28-runner dataset give per-foot duty factors `39.4 ± 2.8%`, `34.8 ± 2.2%`, and `32.8 ± 2.1%` at 2.5/3.5/4.5 m/s. The 860-runner cohort independently reported `39 ± 4%` at preferred speed. [Fukuchi dataset](https://doi.org/10.6084/m9.figshare.4543435.v5), [Malisoux et al., 2023](https://doi.org/10.1177/23259671231204629) | **High.** Walk has double support and must never have flight. Run has no double support. With symmetric feet offset by 0.5 stride, each chosen run flight window is `0.5 - dutyFactor` (about 11%, 15%, 17% at those speeds); that flight fraction is a controller derivation, not a separately measured statistic.                                              |
| Vertical COM                | Ten adults walking at 0.8–2.0 m/s supported the established `4–5 cm` preferred-walk excursion; the sacral marker increasingly overestimated true COM excursion at faster speeds. [Gard, Miff & Kuo, 2004](https://doi.org/10.1016/j.humov.2003.11.002)    | In 860 healthy recreational runners, force-derived vertical COM oscillation was `77 ± 12 mm` at preferred speed. [Malisoux et al., 2023](https://doi.org/10.1177/23259671231204629)                                                                                                                                                                            | **High.** Start near `0.025–0.035H` peak-to-peak for walk and `0.035–0.055H` for run. Walk rises during single-support midstance; run compresses during stance and rises in flight. Near gait transition, COM rose 31 mm in first-half walking stance but fell 73 mm in first-half running stance. [Lee & Farley, 1998](https://doi.org/10.1242/jeb.201.21.2935) |

### Frontal and transverse kinematics

| Measure                     | Measured evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Implementation interpretation                                                                                                                                                                                                                                                                        | Confidence                                                                                                                   |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Foot progression            | Twenty healthy adults walking naturally measured `5.2 ± 5.5°` toe-out by pressure walkway and `5.6 ± 4.9°` by IMU. [Urbanus, Grayson, Harlaar & Simic, 2022](https://doi.org/10.3390/app12136519) A separate 20-woman motion-capture cohort averaged about `9.3°` toe-out at preferred speed, demonstrating method/population spread. [Winiarski et al., 2019](https://doi.org/10.1155/2019/9232430)                                                                                                                                                                                          | Default to `+6°`, permit individual variation around it, and rotate the actual foot segment—not the whole leg pole. A large fixed toe-out is not a substitute for step width. Running-specific evidence here is weak, so retain the modest walking default rather than inventing a larger run value. | **Moderate-high** for walk; **low-moderate** for run transfer.                                                               |
| Walking knee varus/valgus   | In 98 healthy adults aged 18–40, right/left means were `0.69 ± 2.98° / 0.44 ± 3.27°` at heel strike, `0.84 ± 3.16° / 0.33 ± 3.13°` at midstance, and `-0.24 ± 3.17° / -0.41 ± 3.09°` at terminal stance (positive varus). [Patathong et al., 2023](https://doi.org/10.1186/s12891-023-07081-7)                                                                                                                                                                                                                                                                                                | A stance knee should track close to the hip-to-ankle plane. Treat about `3°` as population spread, not as an oscillation amplitude to add. Persistent bilateral outward knee poles are not supported by the data.                                                                                    | **High** for this cohort and marker model. Absolute joint angles remain calibration-sensitive.                               |
| Running knee frontal motion | Re-analysis of the 28-runner processed curves found stance means near `+3.5°` in the dataset's frontal convention, with mean participant stance extrema near `0°` and `+6°`; between-runner SD was about `3–4°`. [Fukuchi dataset](https://doi.org/10.6084/m9.figshare.4543435.v5)                                                                                                                                                                                                                                                                                                            | Do not force the walk's zero-centered angle onto a bent running leg. Use the geometric knee-tracking metric below as the primary bow-leg gate, and use calibrated joint-angle envelopes only as a secondary check.                                                                                   | **Moderate.** Soft-tissue marker cross-talk makes exact frontal knee angles model-dependent.                                 |
| Hip ab/adduction            | At preferred walking speed, young active women traversed about `-7.7°` abduction to `+9.4°` adduction (`17.0°` ROM). [Winiarski et al., 2019](https://doi.org/10.1155/2019/9232430) In the running dataset, mean stance hip adduction was `4.6/5.6/6.1°` at 2.5/3.5/4.5 m/s; mean participant stance extrema ran from near neutral/slight abduction to `9.3/11.1/12.2°` adduction. [Fukuchi dataset](https://doi.org/10.6084/m9.figshare.4543435.v5)                                                                                                                                          | Natural locomotion crosses or approaches neutral and develops stance adduction. Two legs held in abduction for the whole cycle create the characteristic splayed silhouette.                                                                                                                         | **Moderate.** Walk cohort is women-only; running result is our reproducible analysis of a predominantly male public dataset. |
| Hip axial rotation          | Preferred walking covered about `-2.0°` to `+13.6°` (`15.8°` ROM) in the Winiarski convention. Running stance in the public dataset centered near zero, with mean participant extrema about `-5.5…+3.9°` at 2.5 m/s and `-7.0…+3.4°` at 4.5 m/s. [Winiarski et al., 2019](https://doi.org/10.1155/2019/9232430), [Fukuchi dataset](https://doi.org/10.6084/m9.figshare.4543435.v5)                                                                                                                                                                                                            | Keep axial hip rotation smaller than frontal/sagittal leg motion and independent from foot progression. Persistent symmetric external rotation of both femurs reads as a cowboy stance.                                                                                                              | **Moderate-low.** Transverse joint angles are especially sensitive to anatomical-axis calibration.                           |
| Pelvic obliquity and yaw    | In 23 healthy adults walking overground, pelvic obliquity ROM was `3.39 ± 0.89°` in men and `4.58 ± 1.14°` in women; transverse rotation ROM was `10.86 ± 3.77°` and `11.43 ± 5.37°`. [Lim & Lee, 2018](https://doi.org/10.1589/jpts.30.619) A different young-women optical system measured larger preferred-walk ROM (`11.3°` obliquity, `15.9°` rotation), so system definitions matter. In 101 runners, obliquity ROM was about `7.8–9.6°` and rotation `10.0–16.1°`, increasing with speed and differing by sex. [Perpiñá-Martínez et al., 2023](https://doi.org/10.3390/ijerph20043631) | Use modest support-driven roll and stride-driven yaw. Start walk near `3–6°` obliquity ROM and `9–14°` yaw ROM; run near `7–11°` and `10–17°`. Do not use pelvic roll to hide bad knee poles.                                                                                                        | **Moderate.** Sensor, sex, surface, and coordinate conventions materially change ROM.                                        |
| Arm/trunk opposition        | Eight adults walking and running showed prevailing anti-phase pelvic–scapular coordination, tending toward `180°` as speed increased. [Dedieu & Zanone, 2012](https://doi.org/10.1016/j.humov.2011.07.009) In ten walkers, holding arms still raised metabolic cost 12%, while deliberately opposite-to-normal phasing raised it 26%. [Collins, Adamczyk & Kuo, 2009](https://doi.org/10.1098/rspb.2009.0664)                                                                                                                                                                                 | The left arm moves opposite the left leg (and with the right leg); chest yaw counter-rotates pelvis yaw. Target one arm cycle per stride, not independent arm noise. Allow lag, but preserve the sign relationship.                                                                                  | **Moderate-high.** Exact phase fluctuates, but opposition is robust.                                                         |

## Chosen controller targets and promotion gates

The table below is the implementation contract. It deliberately uses wider fail bands than the measured group means.

| Runtime metric          | Chosen target                                                                               | Warning                         | Fail                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| Walk `stepWidth / L`    | `0.12–0.14` (`0.13` default)                                                                | outside `0.09–0.17`             | outside `0.06–0.20`; values above the band contribute strongly to bow-leg diagnosis      |
| Run `stepWidth / L`     | `0.08–0.11`, narrowing with speed                                                           | `>0.13`                         | `>0.16`                                                                                  |
| Foot progression        | `+5…+7°` toe-out (`+6°` default)                                                            | outside `-2…+12°`               | outside `-6…+18°`                                                                        |
| Walk foot duty factor   | `0.645` near 1.0 m/s, `0.63` near 1.3, `0.62` near 1.6                                      | outside `0.60–0.67`             | `<0.50` (illegal flight) or `>0.70`                                                      |
| Run foot duty factor    | about `0.42` at slow jog, `0.39` at 2.5 m/s, `0.35` at 3.5, `0.33` at 4.5                   | outside speed target by `0.04`  | `>=0.50` (no flight) or `<0.28` for this non-sprint controller                           |
| Walk cadence            | speed curve through `101/116/128 steps/min` at `1.04/1.32/1.62 m/s`                         | more than `10%` from curve      | more than `20%` from curve                                                               |
| Run cadence             | speed curve through `162/171/183 steps/min` at `2.5/3.5/4.5 m/s`                            | more than `10%` from curve      | more than `20%` from curve                                                               |
| Walk `strideLength / H` | curve through `0.74/0.82/0.91` at the three walk speeds                                     | more than `12%` from curve      | more than `25%` from curve                                                               |
| Run `strideLength / H`  | curve through `1.06/1.40/1.68` at the three run speeds                                      | more than `12%` from curve      | more than `25%` from curve                                                               |
| Walk knee frontal angle | stance phase mean within `±1°`; population envelope centered near zero                      | mirrored outward peak `>6°`     | mirrored outward peak `>8°` for more than 10% of stance                                  |
| Run knee frontal angle  | calibrated stance envelope roughly `0…+7°` in the selected joint convention                 | mirrored outward peak `>8°`     | mirrored outward peak `>10°` for more than 10% of stance; geometry gate below still wins |
| Pelvis ROM              | walk: obliquity `3–6°`, yaw `9–14°`; run: `7–11°`, `10–17°`                                 | 25% outside band                | 50% outside band or wrong support phase                                                  |
| Vertical COM excursion  | walk `0.025–0.035H`; run `0.035–0.055H`                                                     | outside band                    | wrong phase shape: walk low at midstance or run high at midstance                        |
| Arm/leg phase           | ipsilateral shoulder and hip approximately `180°` apart; scapular and pelvic yaw anti-phase | phase error `>25°` over a cycle | same-direction ipsilateral arm/leg motion for most of a cycle                            |

### Primary bow-leg geometry gate

Joint-angle conventions can lie; joint positions cannot. In a front-plane projection, compute per side:

```text
kneeOutward = signed outward distance(knee, line(hip, ankle)) / L
```

Evaluate it only while that foot is in stance, and mirror left/right so outward is positive for both.

- **Chosen target:** cycle mean near `0`; 95th percentile `<=0.015L`.
- **Warning:** either side exceeds `0.025L`, or both sides are outward simultaneously for more than 10% of a cycle.
- **Fail:** sustained outward deviation exceeds `0.035L` in walk or `0.044L` in run for more than 10% of stance, or the
  population median exceeds `0.015L`.

For a nearly straight two-segment leg, `0.015L` is approximately the position-space effect of a `3°` frontal joint
deviation; `0.035L` is about `8°`, and `0.044L` about `10°`. Those walk/run fail limits are deliberately added animation
tolerance around a healthy walking mean near zero with about `3°` population SD; they are **engineering gates, not
clinical norms**. The conversion is a small-angle approximation—especially rough for a flexed running leg—which is why
the position and angle gates are reported separately.

A frame is diagnostically **bow-legged**, rather than merely wide, when outward knee deviation is paired with at least
one of:

- `stepWidth > 0.17L` walking or `>0.13L` running;
- both hips abducted by more than `3°` during the same stance interval;
- toe-out above `12°`; or
- pelvis lateral position moving away from the active support foot.

Do not classify from knee separation alone: morphology changes hip width, and a wide pelvis can have healthy
hip–knee–ankle tracking.

## Verification process for the gym

1. Record at least ten steady-state strides after warm-up for every morphology and for walk speeds `1.04/1.32/1.62 m/s`
   and run speeds `2.5/3.5/4.5 m/s` (or dynamically similar rig-scaled speeds).
2. Emit per-stride JSON for actual root speed, `L`, `H`, step width, foot progression, cadence, stride length, contact
   intervals, COM excursion, pelvis ROM, mirrored hip/knee angles, `kneeOutward`, and arm/leg phase.
3. Evaluate medians and 5th/95th percentiles across the 100-character population. A pretty median must not conceal a
   seeded tail of bowed knees.
4. Capture synchronized front orthographic, side orthographic, and perspective cycles with hip-to-ankle guide lines,
   footprint midlines, contact state, and COM projection. The front view convicts bowing; the side view protects
   sagittal flexion and foot plant while tuning it out.
5. Change one coupled family at a time: footprint width -> knee pole -> hip frontal/axial motion -> pelvis support shift
   -> foot progression -> secondary torso and arm motion. Re-run the same seeds and speeds after each change.

### Reproducible dataset check used for this note

The running duty and stance-angle values above were independently checked against version 5 of the authors' public
[Figshare dataset](https://doi.org/10.6084/m9.figshare.4543435.v5):

- selected the original paper cohort, `RBDS001processed.txt` through `RBDS028processed.txt`;
- read the 101-point right-leg curves at 2.5, 3.5, and 4.5 m/s;
- defined contact where published vertical GRF exceeded `0.25 N/kg`, close to the study's 20 N event threshold after
  mass normalization;
- computed each participant's stance fraction, stance mean, and extrema before aggregating mean ± SD; and
- compared against the paper's separately reported stride-length/cadence trend and obtained duty factors
  `39.4/34.8/32.8%`, consistent with the independent 860-runner reference (`39 ± 4%`).

This check is suitable for choosing controller envelopes, not for claiming a new population norm.

## Caveats

- Speed, sex, age, footwear, treadmill versus overground locomotion, and anatomical calibration all move these values.
- Frontal and transverse joint angles are less portable across marker models than temporal measures and footprint
  geometry. Position-space gates should therefore outrank exact hip/knee angle gates.
- Several cohorts are narrow: the detailed walking waveform is young women; the 2017 running dataset is predominantly
  men; the knee reference is healthy Thai adults. Preserve style variation inside the gates instead of collapsing all
  characters to one mean.
- Running is not a faster walk: duty factor crosses below 0.5, double support disappears, flight appears, COM phase
  reverses, pelvis ROM increases, and cadence/stride scale on different curves.
- Armor and carried weapons may reduce arm amplitude, but should not silently reverse arm–leg opposition or drive the
  feet and knees outside the locomotion gates.

## Primary source index

- J. Maxwell Donelan, Rodger Kram & Arthur D. Kuo (2001),
  [_Mechanical and metabolic determinants of the preferred step width in human walking_](https://doi.org/10.1098/rspb.2001.1761).
- Slawomir Winiarski, Jadwiga Pietraszewska & Bogdan Pietraszewski (2019),
  [_Three-Dimensional Human Gait Pattern: Reference Data for Young, Active Women Walking with Low, Preferred, and High Speeds_](https://doi.org/10.1155/2019/9232430).
- Reginaldo K. Fukuchi, Claudiane A. Fukuchi & Marcos Duarte (2017),
  [_A public dataset of running biomechanics and the effects of running speed on lower extremity kinematics and kinetics_](https://doi.org/10.7717/peerj.3298),
  with [primary data](https://doi.org/10.6084/m9.figshare.4543435.v5).
- Laurent Malisoux, Christopher Napier, Paul Gette, Nicolas Delattre & Daniel Theisen (2023),
  [_Reference Values and Determinants of Spatiotemporal and Kinetic Variables in Recreational Runners_](https://doi.org/10.1177/23259671231204629).
- Steven A. Gard, Steve C. Miff & Arthur D. Kuo (2004),
  [_Comparison of kinematic and kinetic methods for computing the vertical motion of the body center of mass during walking_](https://doi.org/10.1016/j.humov.2003.11.002).
- C. R. Lee & Claire T. Farley (1998),
  [_Determinants of the center of mass trajectory in human walking and running_](https://doi.org/10.1242/jeb.201.21.2935).
- Francine C. A. Urbanus, Jane Grayson, Jaap Harlaar & Milena Simic (2022),
  [_Reliability and Validity of IMU-Based Foot Progression Angle Measurement under Different Gait Retraining Strategies_](https://doi.org/10.3390/app12136519).
- Tanyaporn Patathong, Krongkaew Klaewkasikum, Chanika Angsnuntsukh, Thira Woratanarat, Chusak Kijkunasathian, Jongsook
  Sanguantrakul & Patarawan Woratanarat (2023),
  [_The knee kinematic patterns and associated factors in healthy Thai adults_](https://doi.org/10.1186/s12891-023-07081-7).
- Seung-Yeop Lim & Wan-Hee Lee (2018),
  [_Effects of pelvic range of motion and lower limb muscle activation pattern on over-ground and treadmill walking at the identical speed in healthy adults_](https://doi.org/10.1589/jpts.30.619).
- Sara Perpiñá-Martínez, María Dolores Arguisuelas-Martínez, Borja Pérez-Domínguez, Ivan Nacher-Moltó & Javier
  Martínez-Gramage (2023),
  [_Differences between Sexes and Speed Levels in Pelvic 3D Kinematic Patterns during Running Using an Inertial Measurement Unit (IMU)_](https://doi.org/10.3390/ijerph20043631).
- Philippe Dedieu & Pier-Giorgio Zanone (2012),
  [_Effects of gait pattern and arm swing on intergirdle coordination_](https://doi.org/10.1016/j.humov.2011.07.009).
- Steven H. Collins, Peter G. Adamczyk & Arthur D. Kuo (2009),
  [_Dynamic arm swinging in human walking_](https://doi.org/10.1098/rspb.2009.0664).
