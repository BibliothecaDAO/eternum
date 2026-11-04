# Diwali painted effects

Season 0's end on Diwali (`src/shell/season-tab/festival-art.tsx`): four painted fireworks (gold, saffron, pink, teal)
and a terracotta diya whose flame breathes over a fixed bowl, painted for the Devcon greeting on 4 November 2026.

Each is a transparent WebP sheet in `public/images/festival/`: sixteen frames in four columns and four rows, read
row-major, at 12 fps (1.333 s a cycle). A firework's last frames are fading embers, so each plays once per burst; the
diya loops. `manifest.json` gives each sheet's frames, columns, fps, poster frame (the still drawn under reduced
motion), encoding, bytes and SHA-256; `icon-meaning.ts` reads it (`DIWALI_SPRITES`), and `festival-art.test.ts` fails
when a sheet's bytes no longer match its hash.

The five sheets cost 785,050 bytes (10 MiB decoded). Draw them with ordinary alpha: their glow is painted in, so no
blend, blur or black-key is laid over them.
