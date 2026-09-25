# Ysolde of the Fox

Tutorial guide portraits for Realms: Frontier. The runtime dialogue busts are 256 × 256 WebPs with alpha, sized for the
guide card (at most 160 px on screen) and described under "Transparent dialogue busts" below:

- `ysolde-neutral.webp` — attentive neutral expression; runtime path `/images/guides/ysolde-neutral.webp`.
- `ysolde-pleased.webp` — restrained closed-mouth smile; runtime path `/images/guides/ysolde-pleased.webp`.

## References and source policy

The style references are `../avatars/01.png`, `../avatars/06.png`, and `../avatars/12.png`: fine ink contours, engraved
shading, dark teal clothing, pale gold backgrounds and ornamental foliage. The insignia reference is
`../orders/fox.png`. These establish the existing art direction, not the character identity.

The neutral portrait establishes Ysolde's identity. The pleased portrait uses the neutral image as its edit source and
preserves the pose, framing, clothing and working objects. The prompts below are the editable source specification for
these raster portraits. Review originals and captures stay outside the repository. The 600 × 600 PNG masters stay
outside the repository too. The shipped files have ancillary metadata stripped; only delivery resizing follows portrait
creation.

Master conversion for each expression, using its square source image:

```sh
magick portrait-original.png -filter Lanczos -resize 600x600 -strip portrait.png
```

## Neutral portrait prompt

Use case: illustration-story. Create one square 600 x 600 pixel tutorial-guide portrait for Realms: Frontier: Ysolde of
the Fox, neutral expression. The first three supplied images are STYLE references only from the existing avatar set:
carry over their intricate fine ink contours, engraved crosshatching, muted deep teal and charcoal clothing, aged pale
gold light, botanical ornamental linework, and restrained antique print colors. Do not copy the character identities,
armor, axes or poses. The fourth image is the exact Order of the Fox insignia: reproduce its simple angular pointed
outline as a small antique-gold clasp on the cloak, not an animal face or generic fox drawing. Character: a human woman
about forty, a seasoned mist-walker and practical mapmaker. Olive skin, gray-green eyes, angular nose, faint travel
lines, a dark braid tucked into a deep ink-blue hood. Calm attentive neutral expression, lips relaxed and closed,
capable and approachable, looking slightly toward the viewer in a gentle three-quarter turn. No smile in this neutral
version. No crown or heavy armor. Clothing and props: layered hooded travel cloak in charcoal teal, restrained stitched
gold edging, Fox clasp at her collar. Soft dark leather gloves visibly stained with ink at the fingertips. One gloved
hand steadies a partially folded parchment map at the lower chest, with delicate unreadable map lines; the other holds a
slender pale ivory wand with no glowing gem. A small brass lantern hangs at her hip and is partly visible near the lower
right edge of the crop, with warm pale-gold light. These are a guide's working objects, not combat weapons. Composition:
a single waist-up bust portrait cropped at the upper hip so the lantern can peek into the frame, square, face large and
readable in the upper-middle, full hood visible with a little breathing room, hands and tools in the lower half. Match
the painterly ink-and-gold density and craftsmanship of the references. Background: quiet pale-gold mist, dark curving
fern silhouettes and fine map-contour motifs; enough quiet contrast around the face. Flat illustrative lighting with
subtle lantern warmth, not 3D rendering or photorealism. No text, lettering, signatures, watermark, border, panels or
UI. One character, one neutral expression, no expression sheet.

## Pleased expression prompt

Use case: identity-preserve. Edit the supplied neutral portrait of Ysolde of the Fox to make the pleased expression for
the same tutorial guide. Change only her facial expression: a modest, warm, closed-mouth smile, slightly lifted cheeks
and gentler pleased eyes, as if the player has just understood her advice. Preserve the exact same woman, age, facial
structure, skin, nose, gray-green eye color, gaze direction and head angle. Preserve everything outside the face: hood
and braid, intricate ink contours and crosshatching, antique pale-gold and charcoal-teal palette, angular gold Fox
clasp, ivory wand, ink-stained gloves, folded parchment map, hip lantern, background foliage and mist, composition and
square crop. Keep the expression restrained and believable; no teeth, no broad grin, no beauty retouching or change of
identity. Single square portrait, not an expression sheet. No text, signature or watermark.

## Transparent dialogue busts

The runtime busts are `ysolde-neutral.webp` and `ysolde-pleased.webp`, both 256 × 256 WebP with alpha. Their paths are
`/images/guides/ysolde-neutral.webp` and `/images/guides/ysolde-pleased.webp`.

The approved 600 px masters are retained outside the repository at `~/projects/eternum-art-originals/ysolde/`. The cut
method is a background-extraction pass on each expression: remove the mist, ferns and scenery while retaining the
figure, wand, parchment, scrolls and lantern; finish the outer silhouette with antialiased alpha and a short waist fade.
The neutral cutout supplies the framing reference for the pleased cutout. The extraction prompts are recorded below.
Intermediate RGBA cutouts are retained in that external directory's `cutouts/` folder. No review background is baked
into the delivered images.

WebP conversion preserves alpha, uses Lanczos downsampling and strips ancillary metadata. Run from the repository root:

```sh
YSOLDE_ORIGINALS="$HOME/projects/eternum-art-originals/ysolde"
magick "$YSOLDE_ORIGINALS/cutouts/ysolde-neutral.png" -filter Lanczos -resize 256x256 -strip -quality 90 -define webp:alpha-quality=100 apps/game/public/images/guides/ysolde-neutral.webp
magick "$YSOLDE_ORIGINALS/cutouts/ysolde-pleased.png" -filter Lanczos -resize 256x256 -strip -quality 90 -define webp:alpha-quality=100 apps/game/public/images/guides/ysolde-pleased.webp
```

### Neutral cutout prompt

Use case: background-extraction. Edit target: the supplied approved neutral portrait of Ysolde. Make a transparent-alpha
waist-up bust for a dark dialogue HUD. Remove only the pale-gold mist, distant scenery, contour-map background and ALL
ferns behind the character, including small background gaps between the wand and the body. Preserve the exact approved
face and neutral closed mouth, pose, gaze, braid, ink-and-gold drawing, teal hood and cloak, Fox clasp, ink-stained
gloves, pale wand, parchment map and brass hip lantern. The parchment and lantern gold are foreground: do not erase
them. Preserve the original painted details and colors; do not redesign or beautify the character. Isolate the whole
bust with a clean gently antialiased edge, no pale fringe, no new outline, no cast shadow or backdrop. Give the outer
hood and shoulders a small transparent margin; minimally complete any clipped outer silhouette so it does not meet a
square crop edge. Keep the wand and lantern readable and fully contained. Terminate naturally at the waist with a short
soft alpha fade across the bottom of the cloak, map and lantern, rather than a hard rectangular base. Keep her face
large enough to read at 256px. Output a single square RGBA image with a genuinely transparent background, not a
checkerboard drawing. No text or frame.

### Pleased cutout prompt

Use case: background-extraction. Image 1 is the EDIT TARGET: the approved pleased portrait of Ysolde, whose exact face,
modest closed-mouth smile and gentle pleased eyes must be preserved. Image 2 is a COMPOSITION REFERENCE: the matching
neutral transparent bust. Produce the pleased transparent-alpha bust with the same framing, scale, silhouette and waist
fade as image 2, using the expression in image 1. Remove only the pale-gold mist, distant scenery, contour-map
background and ALL background ferns, including gaps between wand and body. Preserve the hood, braid, teal cloak with
ink-and-gold detail, Fox clasp, ink-stained gloves, pale wand, parchment map, scrolls and brass hip lantern. Keep the
face and all foreground colors and details true to the approved image. No redesign, no new objects or background, no
beauty retouching. The map and lantern gold remain opaque foreground. Give the outer hood and shoulders a small
transparent margin; minimally complete any clipped outer silhouette so it does not meet a square crop edge. Keep wand
and lantern readable. End at the waist with the same short soft alpha fade as image 2. Clean gently antialiased
silhouette with no pale fringe, colored fringe, shadow or extra outline; readable against a dark HUD at 256px. Single
square RGBA image with genuinely transparent background, never a painted checkerboard. No text, border or frame.
