# Army selection

`army-selection.wav` is original procedural foley, licensed under the repository's
[MIT license](../../../../../LICENSE). No recordings, samples, voices, or external sound libraries are used. This ledger
covers this file only; it makes no provenance claim about the other unit sounds.

| Layer           | Source                         | Treatment                                                     |
| --------------- | ------------------------------ | ------------------------------------------------------------- |
| Cloth drag      | Fixed-seed uniform noise       | Low-pass smoothing, rumble removal, 130 ms curved envelope    |
| Buckle contacts | Three inharmonic sine partials | Two contacts at 58 and 92 ms, 4–9 ms decays, softened attacks |

Rebuild from the repository root:

```sh
pnpm --dir apps/game build:army-selection
pnpm --dir apps/game build:army-selection --check
```

The script uses only Node's standard library and writes 16-bit mono PCM at 44,100 Hz, exactly 160 ms, with a peak of
0.25 full scale (−12.04 dBFS). The registry applies 0.5 gain before the player's combat and master settings. The
uncompressed file is 14,156 bytes; it avoids codec padding on this short cue. Rebuilding is byte-identical.

SHA-256: `d2f22cec6ec6f2d8f35021f44bb047b412bacdf77d19672112cfccc0812a0457`.

One cue replaces the three selection shouts and their random variations. The unused legacy selection alias is removed.
No playback mechanism or gameplay state is added; the existing selection callers, cooldown, mute and volume controls
still apply.
