# Frontier, the cinematic

A 15 second cinematic, made with video models, that makes a stranger want to play Frontier.

The last frame is locked. Everything before it is yours: the story, the look, the models, the edit. We pay several
winners and we want them to look nothing alike, so take a direction and commit to it. Everything here is public: the
brief, the kit, and every entry from the moment it lands. Watch what is already in, and go somewhere it didn't.

Read [FRONTIER.md](../FRONTIER.md) first. It is the whole game on one page.

## What the film carries

Pick at least two of these and make them land for someone who has never heard of the game. Fifteen seconds is short: one
moment told well beats five rushed.

1. **The fog.** A new map every day, and nobody knows what's in it.
2. **The reveal.** The land is decided the moment an army steps on it.
3. **A fight you can read.** The guard and the prize are plain before you attack. No dice.
4. **The haul goes home.** What you win is sent straight back to your realm.
5. **The reset.** The day ends, the map is gone, and your realm stands again on a new one.

The end card says it is free to play; the film does not have to.

## The locked end

| Cut                  | End frame                                       | Rule                                |
| -------------------- | ----------------------------------------------- | ----------------------------------- |
| Landscape (required) | [`end-1920x1080.png`](frames/end-1920x1080.png) | Held, unchanged, for the last 1.5 s |
| Portrait (optional)  | [`end-1080x1920.png`](frames/end-1080x1920.png) | Held, unchanged, for the last 1.5 s |

The end card is the Frontier lockup, "A new map every day", and "Free to play · play.realms.party". How you arrive at it
is yours: a cut, a dissolve, the fog closing over the last shot.

The opening is free. If you want a seed, [`start-1920x1080.png`](frames/start-1920x1080.png) and its
[portrait](frames/start-1080x1920.png) are the Frontier painting under a dark grade, ready as a first frame for
image-to-video. Both cards are rendered from [`frames/frames.html`](frames/frames.html).

The size, frame rates, length, codecs and hold are in [`spec.json`](spec.json). Check a render before you submit:

```sh
node check.mjs frontier-16x9.mp4   # needs ffmpeg and ffprobe
```

## Where you are free

Everything not in the hard rules: genre, tone, story device, camera, style, which models and how many, the edit, music,
sound design, voice or none, words on screen or none. It need not look like the game's paintings; it should feel like
the same world by the time the end card lands. A few directions, as a prompt and not a menu: one unbroken shot as an
army's torches push into the fog; a beast that watches a scout from the far side of a reveal; a realm's day told from
dawn to reset in four cuts; a cart of treasure crossing a map that dissolves behind it.

## Hard rules

- **Made with video models.** The film's moving images are generated: text-to-video, image-to-video or video-to-video,
  with any model whose terms let you license the output for commercial use. Edit, grade and composite as you like. Real
  gameplay from the kit may be cut in; it is not required.
- **The world, not the screen.** Never generate the game's interface, or footage made to pass as gameplay. Show nothing
  Frontier lacks: the fog holds beasts, camps, rifts, ruins, shrines, wells and chests.
- **True copy.** Nothing in [What Frontier is not](../FRONTIER.md#what-frontier-is-not). Chests may be shown holding
  LORDS; never imply income, earnings, returns, a price or an investment, and never say "play to earn".
- **Readable muted.** What the film says lands with the sound off. Audio, generated or not, is licensed for commercial
  use.
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

| What              | Where                                                                                                               | Notes                                                                                                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontier lockup   | [`apps/game/public/images/logos/frontier-lockup.webp`](../../../apps/game/public/images/logos/frontier-lockup.webp) | 640 × 560, transparent. The end card already carries it                                                                                                                    |
| Frontier painting | [`frontier-mist-1536.webp`](../../../apps/game/public/images/landscapes/frontier-mist-1536.webp)                    | 1536 × 1024, the start card's source. A seed or a style reference                                                                                                          |
| Other paintings   | [`apps/game/public/images/landscapes`](../../../apps/game/public/images/landscapes)                                 | `dark-plains`, `brooding-plains`, `stormy`, `winter-fortress`, up to 2688 wide. [SOURCE.md](../../../apps/game/public/images/landscapes/SOURCE.md) says where each belongs |
| Gameplay clips    | [`apps/game/public/docs-media/frontier/*.mp4`](../../../apps/game/public/docs-media/frontier)                       | `explore`, `fight`, `ruin-chest`, `open-chest`, `realm-tiers`. What the world holds, to prompt from or to cut in                                                           |
| Gameplay stills   | [`apps/game/public/docs-media/frontier/*.webp`](../../../apps/game/public/docs-media/frontier)                      | The HUD, the fight card, the spire, shrines, research, the season pool                                                                                                     |
| Fonts             | [`apps/game/public/fonts`](../../../apps/game/public/fonts)                                                         | Realms Titling, IM Fell English SC, Cinzel, Exo 2, each with its licence. For any words you add                                                                            |

## What to submit

| File                | Role     | Required |
| ------------------- | -------- | -------- |
| `frontier-16x9.mp4` | `final`  | Yes      |
| `frontier-9x16.mp4` | `final`  | No       |
| `source.zip`        | `source` | Yes      |
| `PROCESS.md`        | `source` | Yes      |

`source.zip` holds every generated clip the film uses, uncut, and the edit project. `PROCESS.md` holds:

- the logline: your creative direction in one or two sentences
- every model you used, and for each shot its prompt, its input image and its settings
- the edit and grade tools
- every audio credit and licence
- the `check.mjs` report for each cut

```sh
taskmarket --network tempo task submit <taskId> --role final --file frontier-16x9.mp4 [--file frontier-9x16.mp4]
taskmarket --network tempo task submit <taskId> --role source --file source.zip --file PROCESS.md
```

## How we judge

An entry that fails `check.mjs` or breaks a hard rule is out. The rest are ranked on:

1. **Pull.** After one watch, you want to play it.
2. **Clarity.** A stranger can say something true about Frontier, and that it is free.
3. **Craft.** Shots that hold together: no warping, flicker or melting hands. Cutting, timing and sound.
4. **Distinctiveness.** It could not be mistaken for an entry posted before it, or for a stock fantasy trailer.

A portrait cut that passes counts in an entry's favour; it never rescues a weak landscape film.

By submitting, you agree we may share your entry, credited to you, while the bounty runs and after. Winners grant
Bibliotheca DAO a perpetual, worldwide, royalty-free licence to post, cut and adapt their film and its source. We credit
the author wherever we post it.
