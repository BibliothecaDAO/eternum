# Procedural character art direction: from physics proxy to high-fidelity fantasy miniatures

**Research date:** 2026-08-21

**Repository baseline:** Three.js `0.185.1`, `WebGPURenderer` with native WebGPU and forced WebGL2 backends

**Related implementation:** `/debug/procedural-characters` and
[`procedural-character-animation-research.md`](./procedural-character-animation-research.md)

**Evidence policy:** technical claims use official documentation, project source, first-party developer material, or
original talks. Recommendations and proposed budgets are explicitly identified as Eternum decisions rather than facts
from those sources.

## Executive answer

Shaders are part of the route to a high-fidelity character, but they are not the layer that turns the current capsule
proxy into one.

A skeleton supplies a deforming coordinate system. A skinned mesh supplies anatomy, silhouette, topology, skin weights,
and the surfaces that bend around that skeleton. Textures and vertex data supply authored color and fine surface
information. The material shader decides how those inputs respond to light. Outline and bloom passes are subsequent
styling layers. A shader can make authored armor read as painted steel, ink its silhouette, or awaken a rune; it cannot
invent a convincing pauldron silhouette, a clean elbow deformation, or readable top-down proportions from the existing
primitive rig.

The recommended Eternum direction is a hybrid provisionally named **Illuminated Steel**:

1. **War-miniature construction:** compact, deliberately exaggerated proportions; large readable helmets, shoulders,
   weapons, shields, wings, and mounts; authored modular pieces on one canonical rig.
2. **Painterly PBR:** hand-authored broad value groups and controlled material masks, rendered with restrained physical
   metal/cloth/leather response rather than photoreal surface noise.
3. **Selective ink:** a dark colored silhouette and a few authored internal seams, not a uniform black contour around
   every edge. Full hatching appears only in hero/inspection views and fades out before it can shimmer in gameplay.
4. **Illuminated upgrades:** small, high-contrast rune and filigree masks become brighter, move, and gain new silhouette
   carriers as a unit evolves. Bloom remains selective and bounded.
5. **Camera-first readability:** every asset is judged first from Eternum's actual gameplay camera and projected size,
   then from the close gym camera. Tier progression must remain obvious in silhouette or major value blocks even when
   emissive and post-processing are disabled.

This is intentionally not a copy of any one game. It combines transferable principles seen in Blizzard's miniature
pipeline, Valve and Riot's painterly/readability work, Arc System Works' artist-controlled cel rendering, Sable's
distance-aware line art, and historical public-domain illuminated manuscripts and woodcuts. The result can belong to
Eternum because its specific shapes, palette, line grammar, heraldry, and upgrade language will be newly authored.

The immediate practical step is a **three-way style bake-off inside the existing gym**, using the same first canonical
Knight mesh and the same pose:

- `A — Painted miniature`: painterly PBR, no contour, restrained upper-body rim;
- `B — Graphic knight`: three-band toon lighting plus a variable ink contour;
- `C — Illuminated Steel`: painterly PBR plus selective ink, hero-only hatching, and masked runes.

Do not commit the whole character pipeline to an outline technology before those three variants are reviewed at gameplay
size, in motion, during a ragdoll, and on both renderer backends.

## What “high fidelity” actually requires

The rendering order is useful because it makes ownership clear:

```text
character recipe
    -> authored body and modular equipment
    -> canonical skeleton, skin weights, morphs, sockets
    -> procedural pose / authored action / Jolt handoff
    -> vertex skinning
    -> material shading (surface, light, ink masks, runes)
    -> optional outline and emissive bloom
    -> camera, tone mapping, atmosphere
```

Three.js `SkinnedMesh` requires a skeleton plus `skinIndex` and `skinWeight` geometry attributes; it deforms the
authored geometry using bone transforms. Normal maps only change per-fragment lighting and explicitly do **not** change
the silhouette. These APIs formalize the split between deformation and appearance.
[Three.js `SkinnedMesh`](https://threejs.org/docs/pages/SkinnedMesh.html),
[Three.js `MeshStandardMaterial`](https://threejs.org/docs/pages/MeshStandardMaterial.html)

### The fidelity stack, in priority order

| Layer                      | What must be authored or built                                              | What the viewer gains                                      | Can a shader replace it?             |
| -------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------ |
| Silhouette and proportions | body sculpt, helmet, armor, weapon, cape, wings, mount                      | class, tier, weight, fantasy                               | No                                   |
| Deformation                | joint topology, skin weights, corrective shapes, sockets                    | believable shoulders, elbows, cloth joins, ragdoll handoff | No                                   |
| Pose and timing            | locomotion, attack poses, overlap, procedural layers                        | personality and physical weight                            | No                                   |
| Broad value and palette    | art-directed base color, top-to-bottom value hierarchy, material separation | readability from the game camera                           | Partly                               |
| Surface response           | roughness, metalness, normal, AO, rim, lighting ramp                        | steel versus cloth versus leather; tactile detail          | Yes, using authored inputs           |
| Graphic treatment          | silhouette ink, internal line masks, hatch, posterization                   | signature illustrative language                            | Yes, but it must be art directed     |
| Upgrade effects            | rune masks, controlled emission, scroll/pulse, bloom                        | evolution and magical state                                | Yes, when supported by shape changes |

The implication is straightforward: the next art milestone is not “write more shader code against capsules.” It is
“author one production-quality canonical Knight and make three renderer treatments compete on it.” The current primitive
avatar should remain as the cheap physics and parameter-validation fixture.

### Why more polygons alone also do not solve it

High fidelity in a top-down strategy game means preservation of intentional information, not raw geometric density.
Blizzard's Warcraft Rumble team found that a detailed Warcraft III-derived style became hard to read when units crowded
a small screen. Their final miniature style emphasizes strong silhouettes, broad movement, and clear color grouping.
[Blizzard animator interview](https://news.blizzard.com/en-gb/article/23923489/developer-interview-sit-down-with-senior-animator-carin-huurnink)

The same team describes a production sequence of concept turnaround, large-shape blockout, sculpt, final texture,
rigging, and animation. For its top-down camera, most identifying information sits in roughly the upper third of a unit,
and most minis use only one or two major color breakups. That is a remarkably close reference problem to Eternum.
[Blizzard, “Inside Warcraft Rumble: Creating a Mini”](https://news.blizzard.com/en-gb/article/23899627/inside-warcraft-rumble-creating-a-mini)

Eternum should spend triangles where the gameplay camera can see a change: helmet profile, shoulder width, shield and
weapon shape, cape or wing contour, and the outer armor planes. Tiny engraved recesses should usually be normal-map,
mask, or near-view ink information rather than geometry.

## Current Eternum constraints

The existing research and asset inspection establish the following project facts:

- The game is pinned to Three.js `0.185.1` and creates `WebGPURenderer`, using native WebGPU when available and its
  WebGL2 backend fallback otherwise.
- Current Knight, Crossbowman, and Paladin T1–T3 assets are monolithic, static miniature GLBs without skins or bones.
  Their presentation already contains strong tabletop signals: dark metal, plinths, small grouped units, clear tier
  additions, wings, and increasingly fantastic mounts.
- The current army implementation preserves performance through instancing and coarse animation updates. A hero-quality
  skinned model is therefore a new near representation, not a drop-in replacement for every crowd instance.
- The first gym proof has validated procedural pose and Jolt ragdoll contracts, but its independent primitive parts and
  four ordinary `MeshStandardMaterial` instances are a validation proxy.
- The repository contains a WebGPU post-processing runtime that creates an emissive MRT and optional TSL bloom, but
  `ENABLE_NATIVE_WEBGPU_POSTPROCESS_RUNTIME` is currently `false`. Rune glow has a compatible implementation seam, not a
  production-ready assumption; enabling it requires explicit parity and performance verification.
- The current live army material path converts source PBR material data to pooled `MeshBasicMaterial`. High-fidelity
  painterly PBR therefore belongs in the new articulated representation lane rather than as an incremental shader tweak
  to the current crowd pool.
- A measured Knight T2 source is approximately 9.9k triangles and 1 m tall before the current `0.3` army scale. At the
  world camera's 38° FOV and distances 10/20/40, it projects to only about 47/24/12 pixels at 1080p. That makes
  silhouette, major value blocks, and weapon pose far more valuable than fine hatch or engraved detail in ordinary
  gameplay.

These facts make four constraints non-negotiable:

1. The winning character material must run through the production `WebGPURenderer` in both backend modes.
2. Hero/near and crowd/far characters need intentionally different representations.
3. The new look must preserve the existing tabletop-fantasy lineage instead of replacing it with generic anime cel
   shading.
4. The shader graph, texture set, and modular equipment count must be bounded; per-character material variants and
   dozens of draw calls will not survive army scale.

## Lessons from shipped styles

These references are useful for principles and failure modes. Their assets and recognizable designs are not source
material for Eternum.

### Warcraft Rumble: miniature readability and an animation test map

The strongest directly comparable reference is Warcraft Rumble, not because Eternum should look like Warcraft, but
because its developers solved a similar camera-and-scale problem.

First-party findings:

- large blockout shapes establish scale, material separation, and proportions before surface details;
- strong silhouette, shape, and a limited one-to-two-part color breakup create a quick read from above;
- a movement's physical meaning must survive exaggeration: the Gargoyle keeps a heavy wing cadence even when its speed
  increases because a fast flutter would contradict its tank identity;
- close unlock views are a separate opportunity for personality and detail;
- the animation team built a dedicated test map where it could deploy, kill, inspect walk cycles, and trigger abilities,
  including a guaranteed-kill “Death Ray.”

Sources:
[Mini creation breakdown](https://news.blizzard.com/en-gb/article/23899627/inside-warcraft-rumble-creating-a-mini),
[animator interview and test-map description](https://news.blizzard.com/en-gb/article/23923489/developer-interview-sit-down-with-senior-animator-carin-huurnink)

Eternum inference: the character gym is not a temporary toy. A comparable shipped team independently arrived at the same
need. The gym should become the production review surface for camera read, animation, death/ragdoll, upgrades, and
material scale—not only a physics debugger.

### Dota 2: top-down value design and controlled magical masks

Valve's official Workshop guidance repeatedly treats in-game top-down appearance as a first-class artifact. Its
submission tools include a desaturated debug view, and the guidance tells creators that appearance from above is as
important as the close loadout view. It also requires creators to consider value, color palettes, gradients, and texture
detail for hero readability. [Dota 2 Workshop homepage](https://www.dota2.com/workshop/faq?l=english),
[Dota 2 item submission guidance](https://help.steampowered.com/en/faqs/view/3E00-D38F-B793-7384)

The official Arcana/ability texture guide describes grayscale detail masks that localize colored and scrolling textures.
Its examples prefer focused, high-contrast areas, dark support values, and effects visible from above rather than an
even glow over the whole item. That is the right model for upgrade runes: masks author **where** magic is allowed; a
recipe controls color, strength, scroll, and pulse.
[Valve's Arcana, ability, and ambient texture guide](https://help.steampowered.com/en/faqs/view/3EB1-556D-341E-5A4F)

Eternum inference: upgrades should never be “multiply the whole character by a brighter color.” Reserve emission for a
small number of semantically important surfaces—helmet slit, weapon channel, shield sigil, wing filigree—and ensure that
the unlit silhouette still communicates tier.

### Team Fortress 2 and Riot: painterly rendering can remain dimensional

Valve's primary rendering paper is a particularly useful alternative to hard cel shading. The Team Fortress 2 style uses
strong silhouettes, minimal high-frequency detail, hand-painted textures, a warm-to-cool hue shift rather than black
shadows, an artist-authored diffuse warp, and broad rim highlights. The paper argues that loose intentional brush detail
holds up under magnification better than photo-derived noise and that the rendering choices exist to convey gross shape
and identity under varied lighting.
[Valve, “Illustrative Rendering in Team Fortress 2”](https://cdn.cloudflare.steamstatic.com/apps/valve/2007/NPAR07_IllustrativeRenderingInTeamFortress2.pdf)

Riot's first-party shader breakdown shows a later variation of the same family of ideas:

- soften the diffuse response so dark sides retain shape;
- use artist-controlled environment highlights rather than adding many expensive dynamic lights;
- add a bounded, upper-facing Fresnel to preserve character silhouette;
- fake expensive skin response using a tinted falloff and vertex-color mask;
- pack material controls into a small texture set;
- brighten and broaden readability effects with distance, within clamps;
- explicitly remove shader features by quality tier and test on low-spec hardware.

Riot reports a four-texture character baseline—base color, a packed metallic/AO/emissive/roughness map, normal, and
lighting gradients—and describes reducing character shader instruction count from 128 to 84 at lower quality by dropping
specularity rather than gameplay-readable features.
[Riot, “VALORANT Shaders and Gameplay Clarity”](https://www.riotgames.com/en/news/valorant-shaders-and-gameplay-clarity)

Riot also describes why material definitions belong in data, where artists can receive immediate viewport and in-game
feedback, while warning that arbitrary material complexity hurts frame rate and that painterly clarity is the goal—not
maximum physical effects.
[Riot, “Better Living Through Materials”](https://www.riotgames.com/en/news/better-living-through-materials)

Eternum inference: painterly PBR is the best foundation. It preserves the current steel-and-stone miniature quality,
allows armor materials to remain distinct, and leaves room for ink. The relevant shader additions are a controlled
upper-body rim, bounded dark values, broad authored roughness/highlights, and perhaps a light-warp challenger—not a
stack of clearcoat, transmission, subsurface scattering, and screen-space reflections.

### Guilty Gear Xrd: cel shading succeeds through authored control, not the `step()` function

Arc System Works' primary GDC deck is the clearest warning against treating toon shading as a checkbox. Its characters
combined models built for the shader with:

- hand-controlled normals on major features, especially faces;
- vertex colors that bias the light/shade threshold;
- separate artist-chosen lit and shadow colors;
- an inverted-hull contour with artist-controlled width and erasure;
- authored internal lines;
- character-specific light direction;
- limited animation and frame-by-frame deformation.

The deck notes that the central cel calculation is a simple threshold. The difficult part is preserving artist intent in
the normals, threshold, color pair, line placement, model, and pose. It also reports roughly 40,000 triangles and about
500 bones per character because Xrd had extreme close-ups and intentionally abandoned simulation—tradeoffs that do not
fit Eternum's army view or Jolt goal.
[Arc System Works, “Guilty Gear Xrd's Art Style: The X Factor Between 2D and 3D”](https://www.ggxrd.com/Motomura_Junya_GuiltyGearXrd.pdf),
[GDC session page](https://www.gdcvault.com/play/1022031/Guilty-Gear-Xrd-s-Art)

Eternum inference: adopt authored normal and vertex-mask controls if the cel challenger needs them, but do not adopt the
entire production model. A fixed character light, 500-bone hand posing, and disabled interpolation conflict with dynamic
world lighting, procedural motion, ragdolls, and crowds.

### Sable: lines need distance behavior and depth support

Shedworks' first-party GDC session describes building a handmade-looking 3D world while retaining gameplay integrity and
readability. The developer's breakdown explains that flat color alone weakened depth, so lighting, shadows, fog, and
lines were layered back in. Lines also fade with distance, improving perspective and concealing distant object
transitions. [GDC, “The Art of Sable”](https://www.gdcvault.com/play/1027721/The-Art-of-Sable-Imperfection),
[developer talk coverage](https://www.gamedeveloper.com/marketing/how-shedworks-refined-the-art-of-sable-in-pursuit-of-readability)

Eternum inference: outline width and opacity are LOD properties. An ink treatment that looks elegant in the gym's close
camera can become a thicket of black pixels around a squad. Every line mode needs projected-size fade, gameplay-camera
inspection, and temporal-motion testing.

### Pentiment and historical sources: build a grammar, not a copy

Obsidian describes Pentiment as a synthesis of late-medieval illuminated manuscripts and early printed woodcuts rather
than a copy of one image. Its official material calls out limited-frame animation as part of making paintings and
woodblock prints feel alive. [Official Pentiment site](https://pentiment.obsidian.net/),
[Xbox interview with Josh Sawyer](https://news.xbox.com/en-us/podcast/pentiment-herman-miller-gaming/)

Eternum does not need to become a flat manuscript game. It can borrow a **line grammar** from that history: tapered dark
brown marks, deliberate black masses, sparse parallel hatching, imperfect ornament, gold illumination, and limited
pigment families. The physical miniature and PBR lighting keep it three-dimensional; the graphic accents make it
specific.

## Style candidates

Ratings below are recommendations for Eternum's current camera and architecture, not universal judgments.

| Candidate                | Strengths                                                                                       | Main failure mode                                                                               | Three.js r185 path                                                         | Army-scale cost                                           | Recommended role                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| Thick-outline cel        | exceptional silhouette separation; clear color tiers; bold marketing look                       | generic anime association; flattens metal; contour noise where units overlap                    | `MeshToonNodeMaterial` + `toonOutlinePass`                                 | outline adds another geometry draw for every toon surface | Bake-off challenger; hero/selected mode if it wins |
| Painterly PBR            | keeps armor, cloth, leather, and carved surfaces tactile; extends current miniature lineage     | can become generic fantasy realism or noisy texture soup                                        | `MeshStandardNodeMaterial` with bounded node inputs                        | one main pass; normal and environment samples             | Production foundation                              |
| Miniature/diorama        | natural fit with present units; strong proportions and upgrade silhouettes; readable from above | can feel like plastic toys if material values and animation lack weight                         | authored geometry plus restrained PBR/contact lighting                     | cost is mostly mesh/material count, not a special shader  | Core form language                                 |
| Graphic ink/hatching     | distinctive medieval identity; makes engravings, seams, and shadow planes intentional           | shimmer, moiré, crawling screen-space patterns, lost surface materials                          | custom TSL mask/pattern; old WebGL hatching shader is reference only       | extra texture/math; must be removed by distance           | Hero and near accent only                          |
| Emissive/rune            | immediate upgrade and state communication; works well against dark armor                        | “RGB glow” look, bloom wash, loss of gameplay contrast                                          | `emissiveNode`; existing emissive MRT and TSL bloom                        | material cost is small; bloom is a full-screen chain      | Focused tier/state accent                          |
| Illuminated Steel hybrid | tactile, readable, distinctive, preserves fantasy miniatures and makes upgrades legible         | requires disciplined style guide and authored masks; more pipeline work than one stock material | standard node material + selective TSL ink/rim/rune, optional outline pass | scalable by representation and feature tier               | Recommended direction                              |

### Why pure thick outlines are not the default recommendation

They are viable. Three.js r185 now ships an official WebGPU toon example and `ToonOutlinePassNode`. The pass renders
only objects using `MeshToonMaterial` or `MeshToonNodeMaterial`, creates a back-face outline material, and extrudes
vertices in clip space. Its own source includes a TODO for per-vertex thickness ratios, so the stock pass cannot yet
reproduce the fine artist-painted line width control described by Arc System Works.
[Three.js WebGPU toon example](https://threejs.org/examples/webgpu_materials_toon.html),
[`ToonOutlinePassNode` documentation](https://threejs.org/docs/pages/ToonOutlinePassNode.html),
[`ToonOutlinePassNode` r185 source](https://github.com/mrdoob/three.js/blob/r185/src/nodes/display/ToonOutlinePassNode.js)

The stock pass is an excellent bake-off implementation, not automatically the final architecture. If the hybrid wins,
Eternum will need either a small generalized TSL inverted-hull pass for standard node materials or a selected-object
screen-space outline. The generalized pass should add projected-size compensation and a vertex/texture width mask; it
should not fork the renderer.

There are shipped precedents for the screen-space alternative. Riot's League rendering breakdown describes generating
per-skinned-mesh ink from scaled depth with a Sobel filter, with a stencil fallback. A modern first-party GDC breakdown
for _Never's End_ uses a one-pixel post-process line system with object, depth, material, section, and selection IDs; it
renders lines thicker than one pixel as scene geometry or axis-aligned texture marks. These references demonstrate how
far a full line renderer can go, but also expose its buffer, priority, and content-authoring cost. Eternum should not
add that G-buffer-like system until a simple inverted hull plus authored internal mask is proven insufficient.
[Riot, “A Trip Down the LoL Graphics Pipeline”](https://www.riotgames.com/en/news/trip-down-lol-graphics-pipeline),
[GDC 2026, “How We Draw a 3D Sprite World: The Stylized Art of Never's End”](https://media.gdcvault.com/gdc2026/Slides/Juckett_Ryan_HowWeDrawA3DSpriteWorldTheStylizedArtOfNeversEnd.pdf)

## Recommended art bible: Illuminated Steel

### Five pillars

#### 1. Chiseled silhouettes

Characters should feel carved and cast, with slightly compressed anatomy and deliberate planes. The upper third carries
identity because it survives the gameplay camera:

- helmet crown, horns, halo, hood, or crest;
- shoulder width and pauldron rhythm;
- shield profile and heraldic negative space;
- weapon head and attack arc;
- cape, banner, wing, or mount contour.

Avoid even distribution of detail. Feet and lower legs may be simpler/darker; the face, shoulders, hands, and weapon get
the strongest contrast. Every archetype needs a black-silhouette test at gameplay scale.

#### 2. Painted material planes

Use broad, intentional value groups and visible low-frequency brush variation. Fine texture should describe material,
not simulate dirt everywhere.

- **Steel:** broad cool dark body, controlled bright edge planes, roughness variation wider than albedo noise.
- **Bronze/gold:** warm focal trim, never equal in area to the primary metal.
- **Cloth:** high roughness, large folds modeled or baked, team pigment held in one coherent mass.
- **Leather/wood:** middle-value supporting material, low contrast at distance.
- **Skin:** warm shadow tint and a soft response; avoid an expensive general subsurface system.
- **Stone/bone:** chalky rough values with sparing darker cavities.

Shadows should trend cool or chromatic rather than fall to neutral black, while rune and gold accents provide warm focal
contrast. This borrows a principle from Valve's illustrative lighting, not its palette.

#### 3. Selective ink

Ink is a hierarchy:

1. outer silhouette against the world;
2. large material boundary or armor overlap;
3. face/helmet slit and heraldic mark;
4. hero-view hatch in selected shadow planes.

It is not an edge detector applied uniformly to every triangle. Use a deep blue-black, umber, or palette-relative dark
instead of pure black. Let lines taper or disappear on lit upper edges. Do not outline grass, particles, every feather,
or every adjacent armor panel.

#### 4. Illuminated evolution

Upgrade readability follows this order:

1. silhouette addition;
2. material/value change;
3. heraldry/rune area;
4. controlled animation or pulse;
5. bloom.

That order means the upgrade remains legible with bloom disabled, in a grayscale capture, and at reduced quality.

| Tier           | Form                                                                 | Surface                                                        | Illumination                                           | Motion cue                                        |
| -------------- | -------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| T1 — Forged    | clean helmet, modest shoulder, simple weapon/shield                  | dark iron, one cloth pigment, sparse trim                      | dormant slit or one small sigil                        | grounded, economical gait                         |
| T2 — Proven    | crest/pauldrons/tassets/cape; broader weapon                         | brighter heraldry, controlled worn edges, warm secondary metal | two connected rune zones                               | heavier secondary overlap; assertive pose         |
| T3 — Ascendant | wings/halo/banner or transformed weapon; unmistakable top silhouette | rare metal or stone contrast, richer but still bounded palette | active filigree with directional flow; selective bloom | ceremonial idle layer; restrained energy response |

#### 5. Readability before spectacle

All effects are judged under three conditions:

- actual game camera and world lighting;
- neutral grayscale and common color-vision simulations;
- no bloom, no contour, and low material quality.

The character still has to identify class, allegiance, facing, motion state, and tier in that stripped state.

## Original reference vocabulary

Contemporary games should teach process, not provide motifs or assets. Historical collections offer a safer basis for
Eternum's own shape and mark vocabulary:

- The Met's public-domain [mounted-knight aquamanile](https://www.metmuseum.org/art/collection/search/468633) is a
  useful reference for compact metal figurine massing and a readable horse/rider block.
- The Met's public-domain [late-Gothic armor elements](https://www.metmuseum.org/art/collection/search/22906) show
  fluting, cusps, overlapping plates, and fabric-like metal rhythms that can become original modular armor shapes.
- The Met's public-domain
  [Archangel Michael manuscript illumination](https://www.metmuseum.org/art/collection/search/32839) combines ink,
  tempera, gold, silver, and knightly iconography—a strong palette/material reference for “illumination.”
- The National Gallery of Art marks [The Four Horsemen](https://www.nga.gov/artworks/57123-four-horsemen) and the
  hand-colored [Good Shepherd woodcut](https://www.nga.gov/artworks/3742-good-shepherd) as public domain. They provide
  reference for line grouping, black-mass restraint, hatch direction, and limited hand-applied color.
- The Smithsonian's 1497 [_Ortus sanitatis_](https://www.si.edu/object/ortus-sanitatis%3Asiris_sil_406486) scan is CC0
  and contains a large woodcut bestiary that can seed research into original creature and marginalia grammar.

Use these as a reviewed mood board and redraw a project-specific system. Public-domain status allows use, but the
preferred output is still original silhouettes, ornaments, heraldry, and textures created for Eternum.

## Technical material design for Three.js r185

### TSL is the production boundary

Three.js documents `WebGPURenderer` as selecting WebGPU when available and falling back to WebGL2; `forceWebGL` selects
the fallback explicitly. TSL/node materials are its cross-backend customization path. `ShaderMaterial` and
`Material.onBeforeCompile()` are documented as `WebGLRenderer`-only, with node materials/TSL recommended for
customization. [Three.js `WebGPURenderer`](https://threejs.org/docs/pages/WebGPURenderer.html),
[Three.js `ShaderMaterial`](https://threejs.org/docs/pages/ShaderMaterial.html),
[Three.js `Material.onBeforeCompile`](https://threejs.org/docs/pages/Material.html#onBeforeCompile),
[TSL specification](https://threejs.org/docs/TSL.html)

Therefore:

- no new GLSL `ShaderMaterial` in the production character path;
- no `onBeforeCompile` patch of loaded glTF materials;
- no separate WGSL and GLSL character implementations;
- express shared logic as TSL functions and compose it into bounded node-material families;
- test native WebGPU and forced WebGL2 for every promoted style preset.

Three's official WebGPU skinning example proves the renderer's skinned path, and its individual-instancing example is a
useful later reference for crowd research. It should be benchmarked against the current army batching rather than
assumed superior. [WebGPU skinning example](https://threejs.org/examples/webgpu_skinning),
[WebGPU individual skinned instancing example](https://threejs.org/examples/webgpu_skinning_instancing_individual.html)

### Material family, not one material per cosmetic

Build one `CharacterMaterialFamily` with a small number of surfaces and shared uniforms:

| Surface family | Base node material                          | Intended variation                                                                 |
| -------------- | ------------------------------------------- | ---------------------------------------------------------------------------------- |
| armor/weapon   | `MeshStandardNodeMaterial`                  | metalness, roughness, painted edge response, optional rune                         |
| cloth/leather  | `MeshStandardNodeMaterial`                  | high roughness, pigment, broad weave/brush normal, optional sheen only if measured |
| skin/bone      | `MeshStandardNodeMaterial`                  | warm shadow support and restrained upper rim                                       |
| rune/energy    | standard node material using `emissiveNode` | mask, palette, pulse/scroll, emissive MRT contribution                             |
| cel challenger | `MeshToonNodeMaterial`                      | 2–4 sample gradient map and stock toon outline pass                                |

The family owns shared nodes for palette resolution, distance/quality feature selection, rune motion, and ink color. A
character recipe changes uniforms, masks, and modular geometry references; it does not generate a unique shader graph.
That avoids compilation and pipeline-cache growth as recipes multiply.

Three's node material API provides public `colorNode`, `normalNode`, `aoNode`, `roughnessNode`, `metalnessNode`, and
`emissiveNode` inputs. `MeshStandardNodeMaterial` retains PMREM environment lighting. These are sufficient for the first
high-quality painterly implementation without replacing Three's physical lighting internals.
[Three.js `NodeMaterial`](https://threejs.org/docs/pages/NodeMaterial.html),
[Three.js `MeshStandardNodeMaterial`](https://threejs.org/docs/pages/MeshStandardNodeMaterial.html)

Do not start by subclassing Three's internal physical lighting model. First prove the look with authored base color,
normal, roughness, metalness, AO, a TSL rim/emissive accent, and controlled scene lighting. A custom diffuse-warp
lighting model is justified only if the style bake-off demonstrates that it materially improves the result; it would
create an engine-upgrade maintenance surface.

### Proposed texture contract

One body class and its compatible equipment kit should share texel density and preferably atlases. A practical starting
contract is:

| Texture/data | Color space | Content                                                                                  |
| ------------ | ----------- | ---------------------------------------------------------------------------------------- |
| `baseColor`  | sRGB        | broad hand-painted values, pigment variation, large material color information           |
| `normal`     | linear      | sculpted folds, fluting, engraving relief, material grain; no silhouette-critical shapes |
| `orm`        | linear      | R: AO, G: roughness, B: metalness, A reserved/opaque                                     |
| `styleMask`  | linear      | R: internal ink, G: rune/emissive permission, B: palette region, A: wear/detail strength |
| vertex color | linear      | low-frequency per-vertex art control such as rim strength, shade bias, or outline width  |

The exact vertex-channel assignment must be frozen after the bake-off and validated on import; do not let different
archetypes reinterpret channels. Fine heraldry may be a decal/atlas region, but the number of extra transparent layers
must stay bounded because transparency creates sorting and overdraw costs.

Deliver runtime textures as mipmapped KTX2. Khronos documents `KHR_texture_basisu` as reducing transmission and GPU
memory through runtime transcoding; its artist guide recommends ETC1S for many color textures and UASTC for higher
quality non-color data such as normals. Three's `KTX2Loader` supports both `WebGPURenderer` and `WebGLRenderer` support
detection.
[Khronos `KHR_texture_basisu`](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_texture_basisu/README.md),
[Khronos KTX artist guide](https://github.com/KhronosGroup/3D-Formats-Guidelines/blob/main/KTXArtistGuide.md),
[Three.js `KTX2Loader`](https://threejs.org/docs/pages/KTX2Loader.html)

### Lighting and painterly response

Start with a stable world-compatible lighting rig:

- one readable key direction;
- soft hemispheric fill so dark-side shape survives;
- one bounded upper-facing Fresnel/rim term, stronger on skin/cloth than polished metal;
- broad PMREM environment highlights for metal;
- contact shadow near the unit, with real cast shadows only in the promoted near lane;
- neutral or ACES tone mapping presets tested against the world.

The Fresnel must be directional and maskable. A uniform full-body rim looks like a selection effect; an upper-facing
shoulder/helmet response reads as illustrated fill and preserves grounding. Riot's implementation similarly prioritizes
up-facing grazing angles and clamps the effect.

The gym should also include a `three-band toon` challenger using a `DataTexture` gradient with nearest filtering. Three
documents `MeshToonMaterial.gradientMap` and ships the same path as `MeshToonNodeMaterial` in its WebGPU toon example.
[Three.js `MeshToonMaterial`](https://threejs.org/docs/pages/MeshToonMaterial.html),
[WebGPU toon source](https://github.com/mrdoob/three.js/blob/r185/examples/webgpu_materials_toon.html)

### Outline implementation options

| Method                 | What it captures                         | Advantages                                                                          | Problems                                                                                    | Decision                                       |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Inverted hull          | outer silhouette of each mesh            | stable, direct, maskable, works with moving/skinned mesh                            | extra geometry draw; open/thin meshes; joins between modular parts; stock pass is toon-only | Preferred for hero/near if outline wins        |
| Depth/normal Sobel     | depth and normal discontinuities         | captures intersections and internal shape; cost tied more to pixels than mesh count | full-screen buffers/pass, distant noise, halos, line ownership/selection complexity         | Bake-off alternative, not first implementation |
| Authored UV ink mask   | artist-selected internal seams and marks | single material sample, stable, art-directed                                        | no outer silhouette; texture authoring                                                      | Use regardless of contour choice               |
| Explicit line geometry | selected seams                           | precise and stylable                                                                | skinning/sockets, z-fighting, extra objects/draws                                           | Only for rare hero ornament                    |

For the custom inverted hull:

- derive it narrowly from the public r185 `ToonOutlinePassNode` approach;
- accept any character node material, not only toon materials;
- share the exact skeleton and geometry—never maintain a second pose;
- compensate thickness by clip-space/projected size;
- multiply width/opacity by a stable vertex or texture mask;
- fade it by projected height and representation tier;
- exclude eyes, rune planes, particles, transparent cloth, and tiny feather pieces by default;
- use palette-relative ink, not hard-coded black.

### Hatching without temporal noise

Three's legacy official `ToonShaderHatching` demonstrates four luminance thresholds that introduce opposing diagonal
screen-coordinate lines. It is useful as a visual/mathematical reference, but it is implemented as a GLSL shader and
therefore sits on the WebGL-only `ShaderMaterial` route.
[`ToonShaderHatching` source](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/shaders/ToonShader.js),
[legacy toon example](https://threejs.org/examples/webgl_materials_toon.html)

For Eternum, re-express only the useful idea in TSL:

1. sample a mipmapped hatch pattern in stable object/UV space, not raw fragment coordinates;
2. rotate or select at most two hatch directions per material family;
3. reveal hatch with a broad shadow/cavity mask, never across the whole surface;
4. anti-alias thresholds with derivatives/smooth transitions;
5. fade the pattern before its period reaches one or two pixels;
6. disable it entirely below a projected character-height threshold;
7. include a temporal-motion test while orbiting the camera and during ragdoll spin.

Proposed first thresholds for the bake-off, to be tuned from captures:

- projected height above 180 px: full single-direction hatch, second direction only in the deepest shadow;
- 90–180 px: one sparse direction;
- below 90 px: no hatching, internal line mask only;
- crowd representation: no hatching.

These are test values, not product constants.

### Runes and bloom

The style mask determines where runes can appear. The resolved recipe supplies:

- two-color rune palette at most;
- intensity and exposure-compensated ceiling;
- pulse period and phase;
- one scroll direction or reveal coordinate;
- upgrade transition time;
- gameplay state multiplier.

The material writes rune energy through `emissiveNode`. The repository's currently disabled native post-process runtime
already contains the correct emissive-MRT/bloom shape, so the implementation task is to activate and prove that shared
lane—not create character-local bloom. Three's official WebGPU examples show emissive-only and selective bloom, while
the TSL render-pipeline documentation shows composing bloom from an emissive texture.
[Three.js emissive bloom example](https://threejs.org/examples/webgpu_postprocessing_bloom_emissive.html),
[selective bloom example](https://threejs.org/examples/webgpu_postprocessing_bloom_selective.html),
[TSL render-pipeline documentation](https://threejs.org/docs/TSL.html#Render-Pipeline)

Use emissive color without bloom in normal crowd rendering. Enable bloom as a world-level quality feature, not per
character, only after the disabled production post-process runtime passes backend parity and cost gates. Cap it so three
adjacent upgraded units do not merge into one glowing mass.

## Geometry, rig, and modular-kit scope

### One canonical Knight vertical slice

The first production asset should include:

- one neutral body with intentional top-down proportions;
- one canonical skeleton compatible with the procedural pose and Jolt body map;
- clean shoulder, elbow, hip, knee, wrist, neck, and cape-root deformation;
- one face/helmet solution that still reads without facial animation;
- T1 base armor;
- T2 pauldrons, crest, tassets, cape, and alternate weapon treatment;
- T3 wing/halo/banner carrier and rune-core treatment;
- sword, shield, and one alternate weapon head;
- sockets for hands, back, head, shoulders, hips, and effects;
- hero, near, and crowd geometry LODs;
- shared texture contract and all style masks;
- a ragdoll-safe part profile, including what follows a bone and what detaches.

The kit should be authored around compatibility rules, not arbitrary mix-and-match. A bounded kit keeps clipping,
weighting, material batches, and silhouettes reviewable. “Procedural” means the recipe chooses and parameterizes tested
pieces; it does not promise that every helmet fits every body with no art review.

### Proportion controls

Permit only ranges proven by skinning and collision tests:

- total height and head scale;
- shoulder and hip width;
- limb length within narrow limits;
- torso depth;
- hand/weapon scale;
- archetype stance offset.

Large body-class changes should select another authored base topology rather than stretch one mesh until joints and
armor break. Each recipe records a body class and version so a deterministic character does not visually mutate when the
kit changes later.

### Correctives and cloth

Use corrective morphs or pose-space adjustments for the small number of high-risk joints visible near the camera:

- raised shoulder/pauldron clearance;
- deep elbow bend;
- deep knee bend;
- hip flexion under skirt/tassets;
- hand grip on weapon;
- cape compression at back armor.

Do not begin with general real-time cloth simulation. Author a small procedural cape/secondary-motion chain for living
animation; on ragdoll, either promote a few cape bodies/constraints or blend to a bounded simplified solution. Validate
the visual need before adding more Jolt bodies.

## Representation and performance plan

High fidelity is allowed because it is confined to where its pixels can be seen.

The following are **initial promotion budgets**, to be proven in the gym on target machines:

| Lane | Use                                               | Geometry target                            | Materials/draws before shadow                            | Features                                                                         | Physics                    |
| ---- | ------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------- |
| Hero | selected unit, unlock, close gym, short cinematic | 30k–50k triangles                          | 4–6 base draws; at most double if ink contour is enabled | full normal/ORM/style masks, selective hatch, rune bloom, corrective morphs      | full Jolt ragdoll eligible |
| Near | closest gameplay units                            | 12k–25k triangles                          | 3–5; contour only when selected or measured safe         | painterly PBR, internal ink, rune emission, reduced correctives                  | promoted individuals only  |
| Mid  | ordinary visible squads                           | 3k–8k triangles                            | bounded instanced batches by recipe/material             | palette/material-lite shading, no hatch, no bloom, no contour; baked major lines | none                       |
| Far  | distant armies                                    | impostor, token, or sub-2k silhouette mesh | 1 batch per atlas/faction                                | major color and facing only                                                      | none                       |

Why provisional: triangle cost, fragment cost, draw calls, skinning, shadow maps, texture bandwidth, and Jolt interact.
The gym must measure the complete representation rather than enforce one number in isolation.

### Feature LOD order

Remove expensive or noisy features in this order as projected size falls:

1. crosshatch direction two;
2. all hatching;
3. outline width, then outline pass;
4. normal-map strength/fine normal;
5. live specular/environment response;
6. cast shadow;
7. independent skeleton;
8. geometry detail;
9. rune motion, leaving a stable emissive/palette mark;
10. final impostor/token.

Never remove class silhouette, facing, team pigment, tier silhouette carrier, or essential combat-state color before
cosmetic features. This follows Riot's documented approach of retaining gameplay-impacting character features while
dropping specularity at lower quality.

### Material and draw-call rules

- Atlas compatible modular parts; do not create one material per armor piece.
- A tier upgrade may add geometry, but it must reuse the bounded surface family.
- Sharing a texture does not reduce draw calls if the material/pipeline differs; count actual renderer calls.
- Transparent hair, capes, and energy planes are opt-in exceptions, not the default construction method.
- The contour's second draw belongs in the budget.
- Shadows are a representation feature. Hero/near may cast; mid/far use contact blobs or world-scale alternatives.
- Record shader pipeline count and warm-up hitch as well as steady-state frame time.

## Detailed gym expansion

The existing screen should grow into six explicit test lanes that all instantiate production character modules.

### 1. Art turntable

Purpose: judge form and material without gameplay noise.

Controls and fixtures:

- orthographic and perspective camera presets;
- front, rear, side, three-quarter, and top-gameplay snapshots;
- neutral gray, bright terrain, dark terrain, faction-color, and high-emissive backgrounds;
- studio key angle, fill, environment intensity, exposure, and tone mapping;
- albedo-only, roughness, metalness, normals, AO, style mask, emissive, ink width, and overdraw debug views;
- T1/T2/T3 scrub and deterministic recipe/seed;
- A/B/C style switch with locked camera and lighting.

### 2. Gameplay-camera lane

Purpose: answer whether the character works at the size players see.

- import exact Worldmap camera/FOV/distance profiles;
- show one unit, three-unit squad, allied/enemy overlap, and mixed archetype lineups;
- pixel-height ruler and screen occupancy;
- grayscale and color-vision simulations;
- backgrounds sampled from representative biomes;
- outline/hatch/distance-feature visualization;
- facing, selected, moving, damaged, upgraded, and obscured states.

### 3. Animation stage

Purpose: judge deformation and character weight.

- existing idle/walk/run procedural controls;
- authored attack, hit-react, upgrade, and signature-pose clips blended with procedural layers;
- foot-contact and weapon-socket overlays;
- skin-weight heat map and bone axes;
- silhouette onion skin or pose trail;
- slow motion, fixed-frame stepping, and animation-frame quantization challenger;
- cape/secondary-motion toggle;
- top-gameplay and close cameras rendered side by side.

### 4. Impact and ragdoll arena

Purpose: preserve the already-proven Jolt behavior on the final skinned representation.

- current drop, strike, pause, step, and joint-limit controls;
- exact animated-pose handoff;
- skinned mesh driven by ragdoll bone targets instead of independent rigid primitives;
- armor attachment, weapon drop/retention, wing, and cape policies;
- floor, stairs, wall, slope, and pile-up scenarios;
- material/ink behavior during rapid rotation;
- settle, sleep, finite-transform, and teardown checks.

### 5. Upgrade laboratory

Purpose: make evolution a repeatable authored transition rather than a collection of one-offs.

- T1→T2 and T2→T3 transitions at normal and slow speed;
- side-by-side before/after and silhouette-only modes;
- palette, trim, rune mask, rune intensity, flow speed, and bloom controls;
- equipment spawn/replace/dissolve policy;
- animation timing markers tied to shape and rune events;
- downgraded quality and no-post-processing previews;
- recipe JSON and stable signature display.

### 6. Crowd and backend stress grid

Purpose: determine what may be promoted to the real world.

The first implemented grid lives at `/debug/procedural-character-benchmark`: a complete 10×10 arena with 25/50/75/100
actor presets, deterministic movement, bounded Jolt death/respawn churn, backend parity, live cost controls, and
structured smoke output. It intentionally measures the current all-hero ceiling before representation LOD lands.

- 1, 3, 12, 50, 200, and representative maximum unit presets;
- hero/near/mid/far representation distribution;
- native WebGPU and forced WebGL2 buttons;
- animated/ragdoll counts and promotion/demotion churn;
- draw calls, triangles, pipeline count, GPU/CPU frame time, texture memory estimate, Jolt memory, and loading time;
- shader cold-start and warmed measurements;
- shadows, outline, hatch, normal map, bloom, and rune motion cost isolation;
- forced device-loss/recovery test using the production backend where supported.

### Parameter schema additions

Keep parameters grouped by art intent rather than shader implementation:

```ts
interface CharacterArtProfile {
  stylePreset: "painted-miniature" | "graphic-knight" | "illuminated-steel";
  palette: {
    primary: string;
    secondary: string;
    metal: string;
    trim: string;
    ink: string;
    rune: string;
  };
  surface: {
    paintVariation: number;
    normalStrength: number;
    metalnessScale: number;
    roughnessScale: number;
    wear: number;
    upperRim: number;
    shadowChroma: number;
  };
  ink: {
    contourEnabled: boolean;
    contourWidth: number;
    contourOpacity: number;
    internalInk: number;
    hatchStrength: number;
    hatchScale: number;
    distanceFadeStart: number;
    distanceFadeEnd: number;
  };
  rune: {
    intensity: number;
    pulseAmount: number;
    pulseHz: number;
    flowSpeed: number;
    bloomContribution: number;
  };
}
```

The UI may expose raw technical debug values in an advanced section, but saved presets use stable art-language fields.
Only validated named presets may enter gameplay code.

## Repository implementation map

Keep the current CC0 character set as the skinned integration baseline and build the final production visual through the
same contracts. The next implementation stages should evolve these seams:

| Current module                          | Keep                                                                       | Add or evolve                                                                                                               |
| --------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `procedural-character-avatar.ts`        | Quaternius skinned tier variants, joint markers, body-to-bone pose binding | canonical Eternum body plus modular `SkinnedMesh` equipment on one versioned skeleton                                       |
| `procedural-character-rig.ts`           | compact dimensions and 11-body physics profile inputs                      | a versioned render-skeleton definition with named bones, sockets, body classes, and a render-bone-to-physics-body map       |
| `procedural-character-pose.ts`          | deterministic gait parameters and finite-pose validation                   | a local bone-pose buffer plus authored-base/procedural/additive/IK composition; world part transforms become derived output |
| `jolt-character-ragdoll.ts`             | fixed stepping, hard limits, filtering, impulses, lifetime rules           | a body-to-bone bind adapter that writes the physics result into the render skeleton without changing Jolt ownership         |
| `procedural-character-gym-renderer.ts`  | thin shared-actor consumer, backend initialization, smoke, metrics, camera | style A/B/C comparison, exact world-camera lanes, debug buffers, and structured visual captures                             |
| `webgpu-postprocess-runtime.ts`         | single renderer-owned post-processing seam                                 | activate only behind measured plans; add shared selective bloom or outline nodes here, never as character-local composers   |
| `army-model-materials.ts` / `ArmyModel` | bounded crowd path plus guarded one-unit articulated preview seam          | measured representation controller that promotes only eligible units to the skinned/material/Jolt lane                      |

Proposed asset boundary:

```text
client/public/models/characters/knight/
  knight-body.glb
  knight-kit-t1.glb
  knight-kit-t2.glb
  knight-kit-t3.glb
  knight-animation.glb
  textures/*.ktx2
  character-manifest.json
```

glTF remains a useful interchange and delivery container. What disappears is the current product abstraction of one
complete, static, posed GLB per archetype and tier. Runtime procedural behavior comes from deterministic recipe
assembly, bounded proportions, palette/material parameters, pose composition, and representation changes—not from
converting artist-authored mesh data into TypeScript literals.

No new rendering dependency is required for Phase 0. Three r185 already supplies `MeshToonNodeMaterial`,
`toonOutlinePass`, selected-object `outline`, `sobel`, matcap coordinates, posterization, and TSL material hooks. If a
Phase-0 result cannot be built with those primitives and one production-intent Knight, adding a shader package will not
solve the art-direction problem.

## Smoke tests and promotion gates

### Automated smoke sequence

For every candidate preset and renderer backend:

1. load the canonical Knight and verify required bones, sockets, meshes, masks, and material family;
2. render neutral turntable views and assert finite transforms, nonzero work, no error pipelines, and no console errors;
3. run idle, walk, run, attack, and hit-react while checking feet/sockets/bounds;
4. transition T1→T2→T3 and verify recipe signature plus expected silhouette attachments;
5. disable contour, hatch, bloom, and normal in sequence and record the measured delta;
6. promote the exact visible pose to Jolt, drop, strike, settle, and validate bodies/constraints/sleep;
7. return to animation or dispose, then verify body, geometry, texture, material, post-process, and observer ownership;
8. run a crowd preset and collect structured frame/render statistics;
9. repeat under forced WebGL2;
10. output JSON plus a fixed contact sheet.

### Visual gates

A preset may be marked `candidate` only when:

- archetype and tier are correctly identified from black silhouette at gameplay size;
- facing and weapon action remain obvious in a three-unit overlap;
- the top third retains the intended primary/secondary value breakup;
- grayscale preserves tier hierarchy;
- common color-vision simulations preserve allegiance using value/silhouette as backup;
- ink does not fuse nearby units into one mass;
- hatch does not crawl, moiré, or flash during orbit, walk, hit, or ragdoll;
- rune state is readable without bloom and does not erase armor detail with bloom;
- no modular attachment visibly clips during the approved motion range;
- native WebGPU and forced WebGL2 captures are materially equivalent.

### Performance gates

Do not adopt universal fixed numbers before target-hardware baselines exist. Record and then lock:

- p50/p95 CPU and GPU frame time for each representation mix;
- draw calls and triangles;
- shader/pipeline count and first-use compilation hitch;
- texture bytes after GPU transcode;
- skeleton and animation update time;
- outline, hatch, shadow, and bloom incremental cost;
- Jolt heap and active ragdoll count;
- load and disposal deltas across 20 repeated create/destroy cycles.

The promotion rule is based on **incremental cost versus the current world baseline**, not a fast isolated gym frame on
a black background.

### Human art-review gate

Automation can reject failures, but it cannot select an art direction. The review contact sheet should keep camera,
pose, lighting, background, and recipe locked while comparing A/B/C. Reviewers score:

1. Eternum identity;
2. fantasy and material richness;
3. class/tier read at gameplay scale;
4. motion and ragdoll coherence;
5. visual fatigue in groups;
6. upgrade excitement;
7. feasibility for a small reusable kit.

Choose one foundation after the first Knight. Do not average all three variants into an unbounded material.

## Delivery plan

The time ranges below are planning estimates for one character/technical artist pairing plus engineering support. They
should be revised after the first style sprint.

### Phase 0 — Reference and style bake-off: 1–2 weeks

Deliver:

- public-domain historical reference board and written five-pillar art bible;
- one production-intent Knight blockout on the canonical skeleton;
- A/B/C material prototypes in the gym;
- gameplay-size and close contact sheet on WebGPU/WebGL2;
- initial cost deltas for contour, hatch, normal, shadow, and bloom;
- art-direction decision record.

Exit: one selected foundation, one explicitly rejected alternative, and a frozen first-pass texture/mask contract.

### Phase 1 — Canonical Knight hero asset: 3–5 weeks

Deliver:

- approved high sculpt, retopology, UVs, body/equipment skins, LODs;
- T1/T2/T3 modular kit and sockets;
- baseColor/normal/ORM/style-mask KTX2 set;
- corrective shapes and deformation review poses;
- ragdoll body-to-bone mapping;
- import validator and recipe manifest.

Exit: the asset passes turntable, gameplay-camera, deformation, attachment, and texture validation without final crowd
optimization.

### Phase 2 — Production material and ink system: 2–3 weeks

Deliver:

- shared `CharacterMaterialFamily` built in TSL;
- palette, painterly surface, upper rim, internal ink, rune, and quality/distance controls;
- generalized contour only if the selected style needs it;
- integration with the existing emissive MRT/bloom plan;
- native WebGPU/forced WebGL2 shader tests;
- stable named presets and no raw gym defaults in gameplay.

Exit: renderer parity, bounded pipeline count, no WebGL-only shader hooks, and measured feature LOD.

### Phase 3 — Animation and ragdoll binding: 2–4 weeks

Deliver:

- production skeleton adapter for the procedural pose;
- authored attack/hit/upgrade poses or clips;
- corrective and equipment-socket evaluation;
- exact visible-pose transfer to Jolt and ragdoll-to-skeleton driving;
- cape/wing/weapon policies;
- full gym smoke path.

Exit: no pop on promotion, no major skin collapse, stable constraints, deterministic reset, and clean teardown.

### Phase 4 — Representation LOD and crowd proof: 3–5 weeks

Deliver:

- hero/near/mid/far representations;
- recipe/material batches and current `ArmyModel` integration seam;
- promotion/demotion controller;
- shadow, outline, hatch, and rune feature LOD;
- representative army benchmark and memory report;
- one opt-in world route behind a feature flag.

Exit: target frame/memory budgets on representative hardware and no regression to current gameplay-state ownership.

### Phase 5 — Archetype expansion

Only after the Knight is promoted:

- Crossbowman: hood/head read, bow arc, projectile pose, cloth-heavy material variant;
- Paladin/mount: separate rider/mount rig contracts, mount gait, mounted ragdoll policy, progressively fantastic mount
  silhouettes;
- shared kit audit: reuse only pieces that preserve class identity and deformation quality.

The first Knight establishes the reusable contract. Building all nine apparent variants before that contract is proven
would multiply rework.

## Roles and decisions needed

Minimum recurring responsibilities:

- **art direction/concept:** silhouette sheets, tier grammar, palette, line/hatch grammar, reference review;
- **character art:** sculpt, retopo, UV, textures, modular equipment, LOD;
- **technical art:** rig/weights/correctives, masks, import validation, material tuning, gym presets;
- **graphics engineering:** TSL material family, contour/post-process, backend parity, measurement;
- **animation:** key poses/clips, procedural-layer review, secondary motion;
- **gameplay/physics engineering:** pose adapter, representation controller, Jolt mapping;
- **QA/performance:** browser/backend matrix, deterministic smoke, target-hardware captures.

Decisions required at the end of Phase 0:

1. Is the foundation standard painterly PBR or toon lighting?
2. Is outer ink always on, selected/near only, or absent in normal gameplay?
3. Is hatching part of the live hero material or reserved for portraits/upgrade presentation?
4. What are the three canonical upgrade silhouette beats for Knight?
5. What device/backend frame and memory budgets define promotion?

## Risks and mitigations

| Risk                        | Evidence/symptom                                                         | Mitigation                                                                                    |
| --------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| “Shader-first” proxy polish | attractive capsules but no production deformation/silhouette information | commission/build the canonical Knight before final shader selection                           |
| generic toon look           | thick black contour and two bands resemble many existing titles          | palette-relative selective ink, medieval line grammar, tactile PBR foundation                 |
| distant ink noise           | outlines merge; hatch shimmers or moirés                                 | projected-size fades, mipmapped object-space hatch, mid/far removal                           |
| modular draw-call explosion | each attachment owns a material and outline draw                         | bounded surface family, shared atlas, measured contour budget                                 |
| glowing upgrade soup        | bloom joins nearby units and obscures material                           | small authored masks, no-bloom readability gate, global cap                                   |
| backend divergence          | GLSL patch works only on legacy renderer                                 | TSL only, automated native WebGPU and forced WebGL2 smoke                                     |
| shader variant explosion    | recipes recompile bespoke graphs                                         | stable material family, uniforms/attributes for variation, pipeline count gate                |
| armor clipping              | random dimensions exceed authored fit                                    | body classes, bounded proportions, compatibility rules, gym extreme-pose sweep                |
| high fidelity everywhere    | crowd spends hero cost on subpixel detail                                | explicit representation controller and feature LOD                                            |
| copying reference identity  | recognizable motifs/assets create legal and artistic debt                | use techniques only; create from public-domain historical sources and original concept sheets |

## Legal and reference-use boundary

Three.js and its examples repository are MIT licensed, so its implementation patterns may be adapted while retaining the
license requirements. Each third-party example asset can have its own license and must be checked separately.
[Three.js repository and license](https://github.com/mrdoob/three.js/)

The cited game talks, screenshots, models, textures, characters, logos, and trade dress remain their owners' copyrighted
material. They are references for general production techniques—camera-first silhouette, artist-controlled normals,
diffuse ramps, mask-driven emission, line LOD—not asset sources. Valve's own Workshop FAQ explicitly warns that using an
existing likeness or unauthorized images/models from commercial properties or artist galleries is copyright
infringement. [Dota 2 Workshop Item FAQ](https://help.steampowered.com/en/faqs/view/166F-D277-FAFA-8A4B)

For any historical image incorporated directly into a texture or reference package, preserve its museum record and
verify that the specific object's page—not merely the museum generally—marks it Public Domain or CC0. Prefer original
redrawing and synthesis even when direct use is legally available.

## Decisive recommendation

Fund one canonical Knight and use it to choose the look. Build painterly PBR first because it preserves Eternum's
existing miniature fantasy and material richness. Put a stock Three.js toon/outline treatment beside it as a challenger.
Then build the recommended hybrid with selective colored ink, stable near-only hatch, and mask-driven illuminated runes.

The expected winner is **Illuminated Steel**, with these runtime rules:

- authored silhouette and deformation carry fidelity;
- TSL `MeshStandardNodeMaterial` carries the default surface response;
- internal ink is authored in a mask;
- outer contour is hero/selected/near only and must justify its extra draw;
- hatching is a close-view accent, never a crowd feature;
- runes reveal upgrades but never substitute for geometry;
- bloom is selective and belongs in the shared renderer after its native post-process activation gate;
- every style feature has a distance/quality off-ramp;
- the gym, not an isolated DCC viewport, is the promotion authority.

That path is more work than placing a shader over the current skeleton, but it spends that work in reusable assets and
contracts: one rig, a bounded kit, one material family, one art grammar, and multiple scalable representations.
