# Downloadable character asset shortlist

**Research date:** 2026-08-21  
**Decision:** use the **Quaternius Universal Base Characters and Modular Fantasy Outfits** as the first real skinned
characters in the procedural character gym. They are the closest match to Eternum's needs: a shared humanoid rig,
editable fantasy equipment, direct glTF/FBX delivery, and an unambiguous CC0 license. The animation library is optional
reference material, not a runtime dependency.

This is a production **starting point**, not finished Eternum art. Its topology and rig can get skinning, procedural
posing, equipment swapping, shader experiments, and Jolt handoff working immediately. The final silhouette, armor,
textures, normals, and material masks should still be art-directed into Eternum's own “Illuminated Steel” style.

## Ranked recommendation

| Rank  | Asset                                                                                                                                                                                                                                                                                              | Best use                                                           | License and repository use                                                                                                                                                        | Verdict                                                                                                                               |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | [Quaternius Universal Base Characters](https://quaternius.itch.io/universal-base-characters) + [Modular Character Outfits — Fantasy](https://quaternius.itch.io/modular-character-outfits-fantasy); optional [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) | Canonical humanoid scaffold and first production-intent character  | All three pages identify the assets as **CC0**. Commercial modification and redistribution are permitted; keep the original license file and provenance in the repository anyway. | **Choose this.** Best combination of compatible rig, modular fantasy art, source availability, and optional animation breadth.        |
| **2** | [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers) + [KayKit Character Animations](https://kaylousberg.itch.io/kaykit-character-animations)                                                                                                                                      | Faster, smaller fantasy gym integration and animation reference    | **CC0**; commercial use and modification allowed, with no required attribution. The creator asks users not to resell unmodified copies or claim authorship.                       | Excellent fallback, but its cute, highly simplified proportions impose a lower visual ceiling and a less suitable Eternum silhouette. |
| **3** | [Quaternius LowPoly Animated Knight](https://quaternius.itch.io/lowpoly-animated-knight)                                                                                                                                                                                                           | Literal one-download proof of skinned Knight loading and animation | **CC0**; commercial use, modification, and redistribution permitted.                                                                                                              | Fastest single-file experiment, but old, non-modular, and not a foundation for the full character system.                             |
| **4** | [Blender Studio Rain](https://studio.blender.org/characters/rain/v1/)                                                                                                                                                                                                                              | Deformation, weighting, facial-rig, and Blender-quality reference  | **CC BY**. Redistribution and commercial adaptation are allowed only with credit, a license link, and an indication of changes.                                                   | High-quality film rig, but modern clothing, Blender-specific controls, and export cleanup make it a poor direct game base.            |
| **5** | Kenney [Mini Arena](https://kenney.nl/assets/mini-arena)                                                                                                                                                                                                                                           | Loader, skin, animation, and Jolt-to-bone smoke fixture            | **CC0**; Kenney confirms commercial use and says attribution is optional.                                                                                                         | A tiny, genuinely skinned combat character, but far below the production-art target.                                                  |
| **6** | Khronos [Rigged Figure](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/RiggedFigure) / [Rigged Simple](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/RiggedSimple)                                                                                      | Minimal glTF skin/animation conformance tests                      | **CC BY 4.0** with Cesium attribution.                                                                                                                                            | Standards fixtures only. They test a loader; they do not solve character art, modularity, or a useful humanoid rig.                   |

## 1. Quaternius Universal stack — recommended

### What can be downloaded now

- **Universal Base Characters:** the free 122 MB Standard archive contains the Superhero male and female engine-ready
  bodies plus hairstyles. The storefront describes the complete pack as six male/female bodies in regular, superhero,
  and teen proportions, but archive inspection confirms that the other proportions are reserved for the optional 600 MB
  Source tier. Both tiers use the same retargetable humanoid rig; the Source tier is $19.99 and includes rigged `.blend`
  files. [Download and specification](https://quaternius.itch.io/universal-base-characters),
  [format details](https://quaternius.com/packs/universalbasecharacters.html)
- **Modular Character Outfits — Fantasy:** the free 280 MB Standard archive contains complete male/female Peasant and
  Ranger outfits and their modular parts. The storefront's 12 outfits, 62 interchangeable parts, and three texture
  variants describe the complete $20 Source tier, not the free subset. Both tiers use the same humanoid rig and are
  compatible with the base heads. The pack was updated in July 2026 to fix glTF exports and Blender texture paths.
  [Download and changelog](https://quaternius.itch.io/modular-character-outfits-fantasy),
  [format details](https://quaternius.com/packs/modularcharacteroutfitsfantasy.html)
- **Universal Animation Library:** the free 15 MB Standard archive contains 120+ humanoid animations, including
  eight-direction locomotion, jog, sprint, combat, push, crawl, swim, sit, and death. It offers root-motion and in-place
  versions and was updated in June 2026 to share the new rig naming scheme with the base characters and outfits. The
  editable `.blend` Source tier is 46 MB and $14.99.
  [Download, contents, and changelog](https://quaternius.itch.io/universal-animation-library)

The complete editable trio costs **$54.98** at the listed minimums. The two free character Standard archives are enough
for a base → Peasant → Ranger procedural integration; the paid character tiers are required for the advertised regular
and teen bodies, Knight outfit, all modular parts, and convenient source projects. The paid tiers do not use a different
license: the official pages label the source content CC0 as well. Quaternius's
[official license FAQ](https://quaternius.com/faq.html) additionally confirms that all models are CC0, attribution is
unnecessary, and modification or combination with other packs is allowed.

### Why it wins

The shared rig is more valuable than any individual mesh. It lets us establish one canonical bone map, attach a Jolt
ragdoll once, test authored clips against procedural pose layers, and swap 62 equipment pieces without retargeting a
different skeleton for every tier. The existing three body proportions also give the gym useful morphology tests before
we author Eternum-specific body variants.

The fantasy kit already covers the required visual vocabulary—knight, wizard, noble, and peasant pieces—but remains
generic enough to reshape. Use its topology, rig, and modular seams; replace or substantially revise the most visible
helmet, shoulders, shield, weapon, cape, and tier-up silhouettes. Repaint the three supplied texture variations into the
Eternum palette and add the project-specific material/style mask required by the TSL shader.

### Risks

- The art is polished low-poly stock art, not a unique high-fidelity identity. Shipping it unchanged would look
  recognizable and generic.
- “Compatible humanoid rig” still requires an import audit: bone orientation/names, bind pose, scale, skin influences,
  root motion, weapon sockets, and glTF material layout must be recorded before adopting it as the canonical contract.
- Randomly combining all 62 parts is not guaranteed to be clipping-free. The creator's July 2026 update reduced
  clipping, which implies the gym still needs an outfit compatibility matrix.
- The Source archives are large. Do not commit Unity, Unreal, or Godot projects; preserve the original license and
  source provenance outside the client bundle, then commit only the canonical `.blend` and optimized runtime GLBs we
  actually maintain.

## 2. KayKit Adventurers — strongest fallback

The free 12 MB Adventurers archive has five textured, rigged, animated dungeon characters, more than 25 weapons and
accessories, basic movement animations, and FBX/glTF exports. It uses one 1024×1024 gradient atlas that can be reduced
to 128×128. The $11.95 Source tier adds `.blend` files and three extra characters.
[Official pack page](https://kaylousberg.itch.io/kaykit-adventurers)

Its companion animation pack currently lists **161** animations across locomotion, melee, ranged, spellcasting, hit,
death, emotes, and tools for Medium and Large KayKit rigs. The FBX/glTF set is free; editable `.blend` animation sets
cost $14.99. It was updated on 12 August 2026, so this is an actively maintained option rather than an abandoned sample.
[Official animation pack](https://kaylousberg.itch.io/kaykit-character-animations)

This is probably the quickest visually coherent fantasy option and is safe for commercial modification under CC0.
However, the large heads, tiny limbs, gradient-atlas look, and very low-poly construction push Eternum toward a cute
roguelike aesthetic. It is a better prototype and animation reference than the basis of the proposed painterly, engraved
miniature style.

Kay Lousberg explicitly asks users not to resell unmodified copies or claim them as their own. That sentence is framed
as a request alongside CC0, not an additional license, but Eternum should honor it: retain a provenance note, credit the
creator voluntarily, and distribute only our integrated/modified runtime assets rather than mirroring the raw archive.

## Other candidates and why they do not win

### Quaternius legacy packs

The [LowPoly Animated Knight](https://quaternius.itch.io/lowpoly-animated-knight) is an 8 MB CC0 archive with Blender,
FBX, and OBJ files and idle, death, jump, roll, run, walk, and attack animations. It is the best answer if the immediate
goal is simply “put one downloaded Knight in the gym today.” The
[Ultimate Animated Character Pack](https://quaternius.com/packs/ultimatedanimatedcharacter.html) expands that route to
52 textured, animated characters in FBX/OBJ/Blend under CC0. Both predate the newer shared Universal rig and modular
fantasy system, so building the production contract around them would create avoidable migration work. The older
[RPG Character Pack](https://quaternius.com/packs/rpgcharacters.html) is another credible fallback—six rigged, animated,
textured fantasy characters in FBX, OBJ, Blend, and glTF under CC0—but has the same migration disadvantage.

### Blender Studio assets

[Rain v1](https://studio.blender.org/characters/rain/v1/) is a free high-quality Blender 2.80 character rig under CC BY.
Blender Studio requires the credit `Rain Rig © Blender Foundation | cloud.blender.org`. It is valuable for inspecting
skin weights, bendy-bone deformation, IK/FK controls, and facial controls. Those film-oriented controls and scripts must
be baked down to a game skeleton, its contemporary outfit is unrelated to Eternum, and the page does not provide a
compatible fantasy equipment or gameplay-animation library.

The official [Human Base Meshes v1.4.1](https://www.blender.org/download/demo-files/) bundle is a stronger CC0 sculpting
resource: 49 MB of Blender source with quad topology, UVs, face sets, and multiple bodies. It is not a ready skinned
character, however, so it does not answer the present “download and use” requirement. It may later be useful when an
artist reshapes the Quaternius body or authors an original Eternum body.

### Kenney

[Mini Arena](https://kenney.nl/assets/mini-arena) is the useful Kenney candidate: its official page marks version 1.1 as
the character-rig update and provides a direct CC0 download. Inspection of the current official archive confirms FBX,
GLB, and OBJ variants; the soldier GLB has `JOINTS_0` and `WEIGHTS_0` skin attributes and 25 embedded clips covering
idle, locomotion, jumping, death, melee, and kicks.
[Direct official archive](https://kenney.nl/media/pages/assets/mini-arena/88f977a0cb-1709220730/kenney_mini-arena.zip)

[Blocky Characters](https://kenney.nl/assets/blocky-characters) looks tempting because its page says “Animation,” but
archive inspection shows that its meshes do not have joint or weight attributes; 27 clips animate separate rigid body
nodes. That makes it a segmented-ragdoll test, not the skinned base requested here.
[Animated Characters — Protagonists](https://kenney.nl/assets/animated-characters-protagonists) supplies a humanoid FBX,
four skins, and idle/jump/run FBX clips. Kenney's own documentation explains its humanoid models and separate animation
FBXs, while its support page permits commercial use and makes attribution optional.
[Character import guide](https://kenney.nl/knowledge-base/game-assets-3d/importing-characters-and-animations),
[license FAQ](https://www.kenney.nl/support)

These are exceptionally safe test fixtures, but they offer neither medieval equipment nor the surface and silhouette
quality needed for the style bake-off. Quaternius and KayKit dominate this use case.

### Khronos glTF Sample Assets

Khronos describes its repository as assets that demonstrate glTF features. `RiggedFigure` and `RiggedSimple` are tagged
`testing`, consist of downloadable GLBs with skins and animation, and are CC BY 4.0 to Cesium.
[Rigged Figure evidence](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/RiggedFigure/README.md),
[Rigged Simple evidence](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/RiggedSimple/README.md)

Use them only for automated loader conformance. `CesiumMan` is also marked by Khronos as having an issue because it
contains a Cesium logo, and `Fox` is non-humanoid with split CC0/CC-BY credits. Neither is an Eternum character seed.
[CesiumMan warning](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/CesiumMan/README.md),
[Fox license and clips](https://github.com/KhronosGroup/glTF-Sample-Assets/blob/main/Models/Fox/README.md)

## License handling

[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) permits copying, modifying, and distributing the work,
including commercially, without asking permission. That makes Quaternius, KayKit, and Kenney safe to vendor and modify
in this repository. We should still store a `LICENSE.asset.txt`, original URL, creator, downloaded version/date, and a
short modification log beside every derived asset; that is provenance hygiene and protects future contributors from
guessing.

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) also permits commercial sharing and adaptation, but requires
appropriate creator credit, a license link, and an indication of modifications, and prohibits additional legal or
technical restrictions that remove the recipient's licensed rights. Blender Studio and the selected Khronos models
therefore can be redistributed, but carry more compliance work than the CC0 candidates.

## Proposed first download and acceptance gate

Download the two free Quaternius character Standard archives first. Import the Superhero male base and the male Peasant
and Ranger outfits, then compose the compatible base head onto the outfit skeletons. Export runtime GLBs with no
authored clips and promote them to the gym only if they pass all of these checks:

1. Three.js loads one `SkinnedMesh`; all required bones have stable unique names and four-or-fewer normalized skin
   influences per vertex.
2. Procedural idle, locomotion, and ragdoll poses deform all three skins without scale, root, foot-slide, head, or
   orientation surprises.
3. Procedural breathing, look, stride scaling, and foot IK can drive the shared bones with zero baked root motion.
4. The 11 Jolt rigid bodies map cleanly to pelvis, chest, head, upper/lower arms, and upper/lower legs, and recovery
   from ragdoll can blend back to an animation pose.
5. At least three fantasy equipment recipes interchange without broken weights or unacceptable clipping.
6. The model remains readable at Eternum's actual gameplay camera and accepts the three style-bake-off materials on both
   WebGPU and WebGL2.

If that audit succeeds, buy the two character Source tiers only when the Knight and editable `.blend` sources are
needed, then turn the shared humanoid rig into Eternum's canonical authoring template. Buy the animation Source tier
only if we later decide to use authored recovery or special-action clips. If the audit fails, evaluate KayKit with the
same gate.
