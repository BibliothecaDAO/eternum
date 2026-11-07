# Frontier in motion

A 30 to 45 second motion film that makes a stranger want to play Frontier, authored by Claude Opus 5.5.

The first frame and the last frame are locked. Everything between them is yours. We pay several winners and we want them
to look nothing alike, so take a direction and commit to it. Everything here is public: the brief, the kit, and every
entry from the moment it lands. Watch what is already in, and go somewhere it didn't.

Read [FRONTIER.md](../FRONTIER.md) first. It is the whole game on one page.

## What the film must carry

Six beats, each landing for someone who has never heard of the game. Their order, their weight and their metaphor are
yours: a film can spend twenty seconds in the fog and two on the haul, as long as each beat reads.

1. **The fog.** A new map every day, and nobody knows what's in it.
2. **The reveal.** The land is decided the moment you step on it.
3. **A fight you can read.** The guard and the payout are shown before you attack. No dice.
4. **The haul goes home.** What you win is sent straight back to your realm.
5. **The reset.** The day ends, the map is gone, and your realm stands again on a new one with everything it kept.
6. **Free to play.** Said or shown before the end card says it again.

## The locked frames

| Frame | Landscape (required)                                | Portrait (optional)                                 | Rule                                         |
| ----- | --------------------------------------------------- | --------------------------------------------------- | -------------------------------------------- |
| Start | [`start-1920x1080.png`](frames/start-1920x1080.png) | [`start-1080x1920.png`](frames/start-1080x1920.png) | The film's first frame. Move from it at once |
| End   | [`end-1920x1080.png`](frames/end-1920x1080.png)     | [`end-1080x1920.png`](frames/end-1080x1920.png)     | Held, unchanged, for the film's last seconds |

The start is the Frontier painting under a dark grade: a column of torches walking down into the mist. The end is the
Frontier lockup, "A new map every day", and "Free to play · play.realms.party". Both are rendered from
[`frames/frames.html`](frames/frames.html); an HTML-based film can lift that markup into its first and last scenes and
match by construction. How you arrive at the end card is yours: a cut, a dissolve, the fog closing, the lockup
assembling.

The size, frame rate, length, codecs and hold are in [`spec.json`](spec.json). Check a render before you submit:

```sh
node check.mjs frontier-16x9.mp4   # needs ffmpeg and ffprobe
```

## Where you are free

Tone, story device, structure, pacing, camera, transitions, music, sound design, voice or no voice, the words on screen,
and the mix of painting, real gameplay and pure motion graphics. Directions we would be glad to see, as a prompt and not
a menu: a scout's field journal written as the fog lifts; a single hex as the protagonist; a ticker of one day's reveals
as a data poem; a mythic trailer voice undercut by a game that is honest about its odds; one unbroken camera move from
the painting down into the live map.

Words on screen use the brand faces: Realms Titling, IM Fell English SC, Cinzel and Exo 2. The palette is the brand's
plus Frontier's violet (`#bf98fb`); depart from it on purpose, and keep the film recognisably Realms.

## Hard rules

- **Authored by Claude Opus 5.5.** Everything that moves is written as code by Claude Opus 5.5 (`claude-opus-5-5`):
  HyperFrames, Remotion, HTML with GSAP, three.js, Motion Canvas, ffmpeg filter graphs, or another code-driven stack.
- **No video models.** No text-to-video or image-to-video output anywhere in the film. A generated still or texture is
  allowed when PROCESS.md discloses it and it does not depict the game's interface or play.
- **Real gameplay only.** Game footage is the clips and shots in the kit below, or your own captures from
  [play.realms.party](https://play.realms.party). Never mock up interface, and never show a feature Frontier lacks.
- **True copy.** Nothing in [What Frontier is not](../FRONTIER.md#what-frontier-is-not). Chests may be shown holding
  LORDS; never imply income, earnings, returns, a price or an investment, and never say "play to earn".
- **Readable muted.** The beats land with the sound off. Audio is licensed for commercial use and credited.
- **Nobody else's marks.** No third-party logos or characters, no real person's likeness or cloned voice.
- **Passes `check.mjs`.**

## The kit

Every asset lives in this repository; take it with a sparse clone rather than a download of the whole tree:

```sh
git clone --depth 1 --filter=blob:none --sparse https://github.com/BibliothecaDAO/eternum.git
cd eternum
git sparse-checkout set docs/taskmarket apps/game/public/images/logos apps/game/public/images/landscapes \
  apps/game/public/docs-media/frontier apps/game/public/fonts
```

| What                   | Where                                                                                                               | Notes                                                                                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontier lockup        | [`apps/game/public/images/logos/frontier-lockup.webp`](../../../apps/game/public/images/logos/frontier-lockup.webp) | 640 × 560, transparent. Never draw it larger than its own size                                                                                                                                       |
| Realms marks           | [`apps/game/public/images/logos`](../../../apps/game/public/images/logos)                                           | `realms-*`; the Blitz and Eternum lockups are not for this film                                                                                                                                      |
| Frontier painting      | [`frontier-mist-1536.webp`](../../../apps/game/public/images/landscapes/frontier-mist-1536.webp)                    | 1536 × 1024 master, the start frame's source. Full frame at 1920 it is enlarged 1.25×: keep it under a grade or in motion                                                                            |
| Other paintings        | [`apps/game/public/images/landscapes`](../../../apps/game/public/images/landscapes)                                 | `dark-plains`, `brooding-plains`, `stormy`, `winter-fortress` are the brand kit's, up to 2688 wide. Read its [SOURCE.md](../../../apps/game/public/images/landscapes/SOURCE.md) for each one's place |
| Gameplay clips         | [`apps/game/public/docs-media/frontier/*.mp4`](../../../apps/game/public/docs-media/frontier)                       | `explore`, `fight`, `ruin-chest`, `open-chest`, `realm-tiers`. Silent, 1280 wide: frame them (a card, a window, a device), or capture your own at 1080p                                              |
| Gameplay stills        | [`apps/game/public/docs-media/frontier/*.webp`](../../../apps/game/public/docs-media/frontier)                      | The HUD on desktop and phone, the fight card, the spire, shrines, research, the season pool                                                                                                          |
| Fonts                  | [`apps/game/public/fonts`](../../../apps/game/public/fonts)                                                         | Each with its licence beside it                                                                                                                                                                      |
| Palette and font roles | [`apps/game-docs/docs/brand.gen.json`](../../../apps/game-docs/docs/brand.gen.json)                                 | The brand's one source for colours and which face does what                                                                                                                                          |

## What to submit

| File                | Role     | Required |
| ------------------- | -------- | -------- |
| `frontier-16x9.mp4` | `final`  | Yes      |
| `frontier-9x16.mp4` | `final`  | No       |
| `source.zip`        | `source` | Yes      |
| `PROCESS.md`        | `source` | Yes      |

`source.zip` is the project, rendering the film from a clean unzip with one command its README states. `PROCESS.md`
holds:

- the logline: your creative direction in one or two sentences
- the stack, and the model: Claude Opus 5.5
- the turns that shaped the film: the prompts and corrections that mattered, not the whole transcript
- every audio credit and licence, and every generated still
- the `check.mjs` report for each cut

```sh
taskmarket --network tempo task submit <taskId> --role final --file frontier-16x9.mp4 [--file frontier-9x16.mp4]
taskmarket --network tempo task submit <taskId> --role source --file source.zip --file PROCESS.md
```

## How we judge

An entry that fails `check.mjs` or breaks a hard rule is out. The rest are ranked on:

1. **Clarity.** After one watch, a stranger can say what Frontier is and that it is free.
2. **Pull.** You want to play it.
3. **Craft.** Motion, timing, type and sound.
4. **Distinctiveness.** It could not be mistaken for an entry posted before it, or for a stock fantasy trailer.

A portrait cut that passes counts in an entry's favour; it never rescues a weak landscape film.

By submitting, you agree we may share your entry, credited to you, while the bounty runs and after. Winners grant
Bibliotheca DAO a perpetual, worldwide, royalty-free licence to post, cut and adapt their film and its source. We credit
the author wherever we post it.
