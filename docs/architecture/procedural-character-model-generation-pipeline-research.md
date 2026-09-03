# Scalable model-generation pipeline for horses and characters

**Research date:** 2026-08-27

**Runtime scope:** `apps/game/src/three/characters`

**Decision scope:** select a repeatable way to source more realistic horse and humanoid surfaces without replacing the
project-owned procedural motion, rig semantics, gym, or runtime asset contract.

**Implementation status (2026-08-27):** the first replaceability slice is implemented. Horse appearance and tier now
resolve through `ProceduralHorseLibrary`; `HorseRigAdapter` owns axial, neck, tail, leg, hoof, target, and saddle
semantics; and the Quaternius convention is isolated in one adapter. Scale and material roles moved into the asset and
appearance definitions. The mounted rider now consumes a species-neutral mount lifecycle, with the existing horse as its
first adapter. LODs, clip-free exports, capture repairs, the first production horse, and the dragon runtime remain open.

## Confirmed Paladin mount progression

The progression is one mounted troop with three mount forms, not three horse skins:

| Tier | Mount form | Locomotion | Attack presentation |
| ---- | ---------- | ---------- | ------------------- |
| T1   | Courser    | grounded   | rider melee         |
| T2   | Warhorse   | grounded   | heavier rider melee |
| T3   | Sky Dragon | flight     | dragon fire breath  |

Flight remains a presentation layer over the authoritative map path. Fire breath presents the existing authoritative
Paladin attack; it does not introduce area damage or new combat rules. T1 and T2 should reuse one horse body, skeleton,
LOD family, and material contract, with modular T2 armor creating the upgrade silhouette. T3 is a separate creature,
rig, flight controller, collision envelope, and ragdoll profile behind the same mounted-creature lifecycle.

The initial concept lineup is stored locally at `output/imagegen/paladin-mounts/concept-lineup-v1.png`. It is a
silhouette review artifact, not a 3D reconstruction input. Approved individual forms still require separate consistent
front, rear, side, top, and—especially for the dragon—underside reference sheets.

**Evidence policy:** product claims come from official API documentation and terms; self-hosted claims come from the
maintainers' repositories and licenses; Blender, glTF, and Three.js claims come from their official documentation. No
vendor generations were purchased or visually evaluated for this research. Quality rankings below are therefore a
recommended bake-off order, not a claim that documentation proves final art quality. Licensing notes are engineering
risk flags, not legal advice.

## Executive decision

Use generative 3D as a replaceable **source-mesh stage**, not as the production asset or animation contract.

The best first pilot is a fixed, rights-cleared four-view horse sheet run through:

1. **Tripo P1 and H-series** as the primary automated route, because Tripo exposes deterministic geometry and texture
   seeds, multiview input, PBR/UV output, target face controls, GLB delivery, and—uniquely among the researched APIs—a
   programmatic quadruped rigging path;
2. **Rodin Gen-2.5** as the high-detail geometry/material challenger, because it exposes one-to-five-image generation, a
   seed, raw or quad topology, PBR output, GLB, and explicit face targets up to two million;
3. **Meshy 7** as a secondary geometry/topology comparison, not the horse-rigging authority, because its public API
   rigging documentation still says non-humanoids are unsuitable.

Whichever candidate wins still goes through one Blender production lane: anatomy correction, deformation-aware
retopology, UV and PBR baking, skinning to a project-owned skeleton, LOD derivation, GLB optimization, and the existing
procedural-character gym. This is the reusable pipeline. Vendor generation is only one swappable intake adapter.

Keep **TRELLIS.2** as the self-hosted R&D challenger if generation volume, data control, or vendor cost later justify a
Linux/NVIDIA service. Do not adopt Hunyuan3D-2.1 for a globally distributed game without a separately negotiated
license: its official license restricts the model and its outputs outside its defined territory, which excludes the EU,
UK, and South Korea.

## Name resolution

- “Trippio” almost certainly means **Tripo AI**. Its current first-party developer site calls the service Tripo and
  documents image-, text-, and multiview-to-model endpoints plus retopology and animation APIs.
  [Tripo developer documentation](https://developers.tripo3d.ai/en/docs)
- No credible first-party product or package named **Image23JS** was found. The closest current match is
  **img2threejs**, an Apache-2.0 agent workflow that reconstructs a reference as TypeScript, Three.js primitives,
  procedural shaders, and generated geometry. Its own documentation explicitly says this is reconstruction-by-code, not
  mesh extraction, and its character examples are still marked unfinished. It may be useful for stylized props or
  intentionally procedural far representations, but it is not the right primary source for an anatomically realistic,
  deforming horse. [Official img2threejs repository](https://github.com/img2threejs/img2threejs)

If “Image23JS” refers to a different private tool, its exact URL or repository is needed before it can be evaluated.

## Repository evidence: why the current horse looks low-poly

The current asset is [`horse.glb`](../../apps/game/public/models/characters/quaternius-horse/horse.glb). Repository
inspection with `gltf-transform inspect` gives:

| Property                 | Current horse      | Consequence                                                                 |
| ------------------------ | ------------------ | --------------------------------------------------------------------------- |
| Runtime size             | 2.1 MB             | Most of the file is skin/animation data, not a detailed surface             |
| Render triangles         | 2,182              | Too little silhouette and anatomical information for a realistic near horse |
| Uploaded vertices        | 4,400              | Appropriate for a far/crowd lane, not the new near surface                  |
| Skin                     | 50 joints          | Valuable motion and ragdoll integration scaffold                            |
| Authored reference clips | 13                 | Useful validation references; procedural motion remains authoritative       |
| Materials                | 8 flat-color slots | Eight primitives/draws without UV texture detail                            |
| Textures / UV detail     | none               | No base-color, normal, roughness, metallic, or AO detail                    |

The asset provenance file confirms the 50-joint skin, eight flat-color materials, and 13 reference clips under CC0.
[`LICENSE.asset.txt`](../../apps/game/public/models/characters/quaternius-horse/LICENSE.asset.txt)

The runtime already has the harder reusable pieces:

- deterministic gait/contact generation and procedural pose filtering;
- a 14-segment leg map, hoof targets, neck and tail chains, saddle position, and Jolt handoff;
- shared skinned template instantiation and disposal;
- a gym, five-angle captures, numerical diagnostics, humanoid moving-root evidence, and mixed-unit performance
  benchmarks.

The original horse seam was not as reusable as the humanoid seam: pose-facing files imported `QUATERNIUS_HORSE_BONES`
directly. The first implementation slice now routes those semantics through registered `HorseRigAdapter`s and resolves
appearance independently from tier. New model implementations should extend those two seams and must not add Tripo-,
Rodin-, or Meshy-specific branches to gait, pose, or Jolt code.

Relevant current ownership:

- [`quaternius-horse-assets.ts`](../../apps/game/src/three/characters/horse/quaternius-horse-assets.ts)
- [`procedural-horse-rig.ts`](../../apps/game/src/three/characters/horse/procedural-horse-rig.ts)
- [`procedural-horse-avatar.ts`](../../apps/game/src/three/characters/horse/procedural-horse-avatar.ts)
- [`procedural-character-pipeline.md`](./procedural-character-pipeline.md)
- [`animation-evaluation.md`](./animation-evaluation.md)

### Runtime trace

The production and gym paths already converge on the same actor. The current horse flow is:

```text
ArmyModel authoritative transform
  -> ProceduralArmyCharacterLayer resolves horse or mounted Paladin config
  -> ProceduralUnitRuntime owns the shared update scheduler and Jolt world
  -> ProceduralHorseRuntime instantiates one actor-local skeleton/material set
  -> gait phase + four hoof contact cycles
  -> plant controller + terrain sampling + FABRIK leg solve
  -> support-derived barrel motion + neck/tail secondary layers
  -> ProceduralHorseAvatar writes the pose into the skinned GLB
  -> optional saddle pose drives the mounted humanoid actor
  -> authoritative defeat promotes the same visible pose into Jolt
```

Large crowds stagger complete bone-pose updates across three deterministic lanes while the authoritative army root keeps
moving at render rate. Geometry and textures are shared from the decoded template; skeletons and materials are cloned
per actor. This is the correct boundary to preserve: the new model should replace the surface and rig adapter, not fork
the gait, mounted, combat, or ragdoll runtimes.

Production currently selects only `idle` or `walk` for horses and mounted Paladins. Trot, canter, gallop, lead
selection, terrain presets, and detailed diagnostics exist in the gym, but they are not yet selected from production
movement speed or intent. The production troop mapping also never creates a standalone `horse`; map horses currently
exist only inside mounted Paladin actors. If “in the wild” means autonomous roaming horses rather than a shipped-quality
mount, that is a separate representation/behavior feature in addition to this surface pipeline.

### Executed visual review

The 2026-08-27 WebGL2 gym review captured a T1 horse walk and a T3 walk from four phase samples and five locked views.
The T1 sheet is preserved at
[`output/playwright/horse-review/horse-t1-walk-contact-sheet.png`](../../output/playwright/horse-review/horse-t1-walk-contact-sheet.png).
The full in-place 47-frame report is at
[`output/playwright/horse-review/horse-walk-temporal-report.json`](../../output/playwright/horse-review/horse-walk-temporal-report.json).

The objective capture passed its current generic assertions: 47 nonblank frames, no recorded pose issues, minimum horse
bend alignment `1.0`, maximum consecutive joint displacement `0.11126`, and maximum in-place stance drift `0.04669`.
Those numbers prove continuity and bend direction, not realism. The locked profiles show the visual limitation clearly:

- the shoulder, barrel, croup, jaw, and limbs are faceted rather than anatomically modelled;
- the surface has no normal or roughness detail, so lighting cannot reveal muscle or coat form that the mesh does not
  contain;
- mane, tail, fetlocks, hooves, and facial features collapse into simple wedges at the gameplay camera;
- the always-visible saddle remains a box-like procedural piece even at T1;
- T2/T3 armor, wings, and horns are generated from boxes, a seven-sided cone, and six-vertex wing geometry, so a more
  realistic body alone would still be pulled back toward the current low-poly visual language.

The review also exposed two evidence gaps:

1. `run-character-animation-capture.mjs` cannot complete for `kind=horse`: after the horse is ready it still waits for
   humanoid appearance and asset identifiers, which can never match the horse's `appearanceId="horse"` and
   `assetId="base"`.
2. Horse and mounted captures forcibly set `rootMotionSpeed` to zero, and the locomotion evaluator only accepts humanoid
   diagnostics. The resulting horse report has `locomotionHardGatePassed: null`; it cannot prove moving-root hoof
   planting even though `animation-evaluation.md` still lists that proof as a promotion priority.

Fix both gaps before using the gym to approve a generated horse. A generic `automatedHardGatePassed: true` must not be
mistaken for a horse locomotion or art-direction pass.

### Replaceability foundation and remaining blockers

1. **Resolved: horse appearance and adapter seams.** `ProceduralHorseAppearance` maps tier to asset and required rig;
   `ProceduralHorseLibrary` owns shared templates and isolated actor instances; `HorseRigAdapter` maps semantic bones;
   and `ProceduralHorseAvatar` consumes only the resolved asset and adapter.
2. **No horse representation LOD.** Every horse uses the one GLB; `ProceduralHorseConfig` has no appearance or render
   detail, and the avatar disables per-mesh frustum culling. Replacing 2.2k triangles with 30k–50k everywhere would turn
   an art fix into a crowd regression.
3. **The runtime file carries unused clips.** The horse loader requires 13 authored clips, but procedural motion never
   plays them. This contradicts the clip-free runtime contract already used by humanoids and spends roughly 1.5 MB of
   the 2.1 MB file on reference animation data. Keep clips in an offline reference/source asset and ship a clip-free
   runtime GLB.
4. **Eight flat material primitives multiply draws without texture detail.** The new lane should collapse coat/body
   surfaces into a bounded one- or two-material PBR contract and preserve separate tack only where it is actually
   swappable.
5. **Tier geometry is not part of the asset contract.** The current procedural saddle, plates, wings, and horns do not
   share the skinned model's topology, LODs, material atlas, provenance, or deformation review. Future tack and fantasy
   upgrades should become named modular asset pieces on semantic sockets.

## Candidate comparison

### Commercial/API routes

| Route             | Automation and repeatability                                                                                                                                                                                 | Geometry, UV, and PBR                                                                                                                                                                                      | Rig / animation                                                                                                                                                                                                 | Commercial and operational risk                                                                                                                                                                                                              | Recommended role                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Tripo P1 / H**  | Async REST tasks; multiview keys are front/left/back/right; at least two views including front; P1 exposes separate model and texture seeds and says identical inputs/seeds reproduce identical mesh/texture | P1 is optimized for low-poly output, exposes 50–20,000 faces, UV export, base-color/metallic/roughness/normal maps, auto-size, and meshopt geometry compression; H-series is the higher-detail source lane | API v2.5 supports quadruped and other creature rig types and returns GLB/FBX; Tripo also exposes animation retargeting. This is useful as a benchmark, but its skeleton must not become Eternum's canonical rig | Paid-user terms grant broad rights in paid outputs and say paid inputs/outputs are not used for model training; the user remains responsible for input/output rights and non-infringement. Pin model versions and archive the accepted terms | **Primary pilot.** Compare P1 direct low-poly output with H-series source + Blender retopo         |
| **Rodin Gen-2.5** | Async HTTP API; one to five images; first image drives material generation; seed range 0–65,535; `faithful`/`creative` geometry mode                                                                         | GLB/FBX/OBJ/USDZ/STL; raw or quad mesh; PBR base/metallic/normal/roughness; quad presets 4k/8k/18k/50k faces and custom targets; raw can reach 2M; 2K–12K texture options                                  | Human T/A-pose conditioning is documented, but no public rig/animation API was found                                                                                                                            | Terms allow Rodin output use subject to the agreement, laws, third-party terms, and plan; Hyper3D makes no copyrightability/non-infringement warranty                                                                                        | **High-detail challenger.** Use as source geometry/material, then canonical Blender rigging        |
| **Meshy 7**       | Async API; one to four images; first is primary/front; PBR, GLB, remesh, target topology/polycount, task streams and downloadable outputs                                                                    | Triangle or quad-dominant remesh, GLB, 2K/4K/8K textures, base color plus optional metallic/roughness/normal; multiview texture references are independently controllable                                  | API rigging currently says it works well only for standard humanoids and lists non-humanoids as unsuitable, although the web app discusses quadrupeds                                                           | Paid plans permit commercial use and assign output ownership; free output is CC BY 4.0. Inputs must be rights-cleared                                                                                                                        | **Secondary comparator.** Strong humanoid option; not a dependable automated horse-rig route today |

Primary sources:

- Tripo [H3.1 model contract](https://developers.tripo3d.ai/en/models/v3-1),
  [P-series multiview API](https://developers.tripo3d.ai/en/docs/generation-multiview-to-model/p),
  [auto rig API](https://developers.tripo3d.ai/en/docs/animations-rig),
  [mesh decimation API](https://developers.tripo3d.ai/en/docs/mesh-decimate),
  [texture API](https://developers.tripo3d.ai/en/docs/models-texture), and [terms](https://www.tripo3d.ai/terms)
- Rodin [Gen-2.5 API](https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5) and
  [terms](https://hyper3d.ai/legal/terms)
- Meshy [multi-image API](https://docs.meshy.ai/en/api/multi-image-to-3d),
  [image-to-3D API](https://docs.meshy.ai/en/api/image-to-3d), [rigging API](https://docs.meshy.ai/en/api/rigging), and
  [licensing](https://docs.meshy.ai/en/webapp/pricing)

### Self-hosted routes

| Route                | Technical capability                                                                                                                                                                                     | Infrastructure                                                                                                                                       | License / restriction                                                                                                                             | Decision                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **TRELLIS.2**        | Microsoft's 4B image-to-3D model generates full PBR attributes and extracts GLB; its companion CuMesh path covers remeshing, decimation, and UV unwrapping; source includes seeds and full training code | Official requirements are Linux, CUDA, and an NVIDIA GPU with at least 24 GB VRAM; published timings use H100. It does not rig or animate characters | Model and main code are MIT; named dependencies have their own licenses                                                                           | **Best self-hosted R&D option**, after the paid-API bake-off establishes a quality/cost baseline    |
| **Original TRELLIS** | Single-image mesh/GLB extraction plus an experimental multi-image mode                                                                                                                                   | CUDA service and preprocessing; multi-image mode was not trained as a specialized multiview model                                                    | Mostly MIT with separately licensed submodules                                                                                                    | Useful only if its experimental multiview path materially beats TRELLIS.2 for the fixed horse sheet |
| **Hunyuan3D-2.1**    | Self-hosted image-to-shape and PBR texture generation; released weights/training code; deterministic seed; synchronous/asynchronous API and GLB output                                                   | Official figures are 10 GB VRAM for shape, 21 GB for texture, and 29 GB for both                                                                     | Community license excludes EU/UK/South Korea, applies its territorial restriction to outputs, and adds terms at more than 1M monthly active users | **Do not adopt for the global game** without a negotiated license and legal review                  |

Primary sources:

- [TRELLIS.2 official repository and MIT license](https://github.com/microsoft/TRELLIS.2)
- [Original TRELLIS experimental multi-image app](https://github.com/microsoft/TRELLIS/blob/main/app.py)
- [Hunyuan3D-2.1 official repository](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1),
  [API documentation](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/API_DOCUMENTATION.md), and
  [community license](https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE)

## The scalable pipeline

```text
rights-cleared concept + neutral multiview sheet
    -> versioned provider request + immutable raw output
    -> anatomy/silhouette selection
    -> canonical Blender source asset
       (manual deform retopo -> UV/PBR bake -> canonical rig/weights -> LODs)
    -> deterministic GLB optimization + validation
    -> existing procedural animation / Jolt / gym gates
    -> promoted hero, near, mid, and far runtime artifacts
```

### 1. Freeze the input packet

Author one original horse concept turnaround with:

- front, left, back, and right orthographic-like views;
- the same neutral standing pose, proportions, tack state, lighting, and background in every image;
- clear hoof separation, visible knees/hocks/fetlocks, unobscured neck and tail roots, and no rider;
- one canonical coat/material brief and one scale reference;
- source ownership, creator, license, date, and SHA-256 for every image.

Multiview consistency matters more than prompt verbosity. Tripo requires a front view and consistent-lighting images;
Rodin treats the first image as its material reference; Meshy treats its first Meshy 7 image as the primary/front view.
Do not use copyrighted game characters, artist portfolios, or unlicensed horse photographs as source images.

### 2. Record every generation as an immutable experiment

Each raw candidate needs a manifest containing at least:

```text
asset_id and concept_version
provider, endpoint, account plan, model/tier version
ordered input paths, roles, licenses, and SHA-256 values
prompt and every request parameter
geometry seed and texture seed where supported
task/job ID, created/completed timestamps, credits/cost
raw output URL, downloaded filename, and SHA-256
terms URL, retrieval date, and archived accepted version
review status and rejection reasons
```

This makes a later regeneration explainable and prevents a silent provider/model upgrade from visually mutating an
approved asset. Tripo and Rodin both expose explicit seeds; Meshy's documented multiview request does not expose one, so
the downloaded raw result—not an assumed rerun—must be the reproducible source.

Start with a thin provider runner that emits this shared manifest. Do not build a general 3D job platform before the
first horse bake-off proves which differences actually need abstraction.

### 3. Select source geometry, not a finished game asset

Score each raw result from locked front, rear, both profiles, elevated gameplay view, and silhouette-only renders:

- horse proportions and breed/body-class intent;
- scapula/shoulder, pelvis/croup, knee, hock, fetlock, hoof, neck, jaw, and tail-root structure;
- symmetry where intended and consistent volume on unseen sides;
- absence of fused legs, doubled anatomy, hollow shells, floating tack, and texture-baked fake structure;
- material separation under neutral dynamic lighting, not only the vendor's preview render.

Reject anatomy failures before retopology. Manual cleanup can fix local shape and topology; it should not be used to
resculpt every generated region while pretending the generator scaled production.

### 4. Make Blender the canonical authoring chokepoint

The accepted output becomes a high-detail reference in a versioned `.blend`, not a directly shipped GLB. The production
steps are:

1. correct anatomy and silhouette;
2. build deformation-aware topology around the shoulder, hip, stifle, hock, fetlock, neck, jaw, and tail base;
3. unwrap stable UVs and reduce the vendor material set to the bounded Eternum material contract;
4. bake tangent-space normals and PBR channels from the corrected high source;
5. align `+Y` up, `+Z` procedural forward, metres, ground contact, pivot, saddle, and equipment sockets;
6. skin and hand-correct weights on the project-owned horse skeleton;
7. derive hero/near/mid/far geometry from the same source and bake set;
8. export clip-free production GLBs while keeping vendor/authored clips only in offline reference files.

Blender's own documentation warns that QuadriFlow is not final topology for an animated character: deformation topology
still needs manual edge flow. Its Data Transfer modifier can transfer vertex groups, UVs, and custom normals between
meshes, and selected-to-active baking produces tangent-space normal maps appropriate for animated objects. Blender can
run the deterministic mechanical parts headlessly with `blender --background --python`; anatomy, edge flow, weights, and
final art approval remain human-reviewed.

Sources: [Blender remeshing and retopology](https://docs.blender.org/manual/id/dev/modeling/meshes/retopology.html),
[Data Transfer modifier](https://docs.blender.org/UATEST/manual/en/4.5/modeling/modifiers/modify/data_transfer.html),
[Cycles selected-to-active baking](https://docs.blender.org/UATEST/manual/en/4.5/render/cycles/baking.html),
[background Python automation](https://docs.blender.org/api/main/info_tips_and_tricks.html), and
[glTF export](https://docs.blender.org/manual/en/4.2/addons/import_export/scene_gltf2.html).

### 5. Own the skeleton and adapters

For the first horse, preserve the existing semantic needs even if the canonical authoring skeleton is cleaned up:

- body/root, pelvis/back, chest/withers;
- three neck segments and head;
- complete front and hind limb chains, hoof/contact targets, and correct bend planes;
- tail chain;
- saddle/equipment sockets;
- render-bone-to-Jolt body mapping.

Add a `HorseRigAdapter`-style seam when implementation begins, mirroring the proven humanoid adapter pattern. One
adapter maps the existing Quaternius skeleton and one maps the new canonical skeleton. The gait controller emits the
same semantic pose for both. This permits a safe A/B asset switch and makes future breeds, armor families, or a later
self-hosted generator surface-only additions.

Tripo's quadruped rig is worth testing for joint discovery and a fast preview. It is not sufficient evidence to replace
the current procedural contract: Tripo's documented creature preset coverage is much smaller than its biped library, and
an automatically named vendor skeleton would couple every later model to that provider.

### 6. Publish web-specific artifacts

Use the existing representation budgets as starting points, then prove them in the gym:

| Lane | Initial horse target                            | Material / texture target                                         | Use                                |
| ---- | ----------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------- |
| Hero | 30k–50k triangles                               | at most 2 opaque materials; 2K base color, normal, and packed ORM | selected/unlock/close gym          |
| Near | 12k–25k triangles                               | same shared 2K set, fewer shader features                         | closest articulated gameplay units |
| Mid  | 3k–8k triangles                                 | one atlased material; baked major detail                          | ordinary visible squads            |
| Far  | retain current ~2.2k horse or sub-2k derivative | flat/atlas palette                                                | distant armies                     |

The numbers are promotion hypotheses, not universal limits. Measure mixed mounted squads because skinning, shadows,
draws, texture upload, and Jolt interact.

Export GLB, then use the repository's existing glTF-Transform toolchain for inspect, prune/deduplicate, controlled mesh
compression, texture conversion, and validation. Prefer KTX2/Basis for normal and packed ORM when the production loader
is wired and measured; WebP reduces transfer size but not decoded GPU texture size. Three's `GLTFLoader` supports skins,
animations, Meshopt, Draco, KTX2, and WebP, but each compressed path must have its corresponding decoder/loader wired.

Sources: [glTF Transform official repository](https://github.com/donmccurdy/glTF-Transform),
[Three.js `GLTFLoader`](https://threejs.org/docs/pages/GLTFLoader.html), and
[Khronos real-time asset guidelines](https://www.khronos.org/assets/uploads/apis/3DCommerce-Realtime-sset-Creation-Guidelines_Jul20.pdf).

Do not run glTF Transform's aggressive one-command optimization blindly on a skinned procedural asset. Preserve the
node/bone hierarchy, skin attributes, material roles, and clip-free contract, and compare inspect reports before and
after.

### 7. Promote only through existing animation evidence

The new surface passes only when the existing gym proves:

- idle, walk, run, gait transitions, mounted pose, attack response, Drop, Impulse, Reset, and Jolt handoff;
- five-angle phase atlas plus moving-root temporal sequence;
- finite transforms, exact required-bone resolution, no bone stretching, correct bend planes, and planted hooves;
- no shoulder, hip, hock, fetlock, neck, saddle, rider, tack, or tail deformation failure;
- WebGPU and forced WebGL2 visual parity;
- hero/near/mid/far switching without reload, resource growth, or a behavior branch;
- the existing 100-unit mixed benchmark with structured draw, triangle, CPU, GPU, texture, and memory results.

The generator should never be asked to solve gait quality. The GLB supplies the surface, rest skeleton, skin weights,
materials, and textures; the existing runtime continues to supply motion and ragdoll behavior.

## Pilot plan and exit gate

### Phase 0 — make the existing horse lane replaceable and reviewable

Before spending credits on candidates:

1. **Completed:** extract `HorseRigAdapter` and a horse asset/appearance library without changing the current Quaternius
   behavior;
2. add explicit `hero | near | mid | far` horse render detail and prove asset switching with the existing horse as every
   temporary lane;
3. fix the capture script's horse identity assertion, permit requested moving-root speed for horse/mounted captures, and
   add a horse-specific locomotion evaluation rather than reusing humanoid foot/knee rules;
4. move the 13 Quaternius clips to an offline reference artifact and validate a clip-free runtime horse;
5. define the first versioned source/generation/runtime manifest and the one- or two-material surface contract.

Exit when the current horse still behaves identically through walk, mounted attack, Drop, Reset, and mixed benchmark,
but a second same-rig surface can be selected without touching gait, pose, mounted, or Jolt modules. This is a narrow
enabling slice, not a general asset platform.

### Phase A — five-candidate bake-off

Generate the same horse packet with fixed parameters:

1. Tripo P1 at a 20k face limit with PBR, UVs, fixed model seed, and fixed texture seed;
2. Tripo H-series detailed geometry, then Tripo retopology/decimation only as an additional candidate;
3. Rodin Gen-2.5 `faithful`, fixed seed, `Quad`, 18k faces, PBR;
4. Rodin Gen-2.5 `faithful`, fixed seed, higher-detail raw source for manual retopology;
5. Meshy 7 multiview, PBR, remesh enabled, target near-lane polycount.

Preserve all five raw results even when rejected. Review them blind from the same Blender lighting/cameras and record
anatomy, silhouette, cleanup hours, topology, texture, and projected runtime cost.

### Phase B — one canonical horse

Take only the winner through manual deform retopology, PBR baking, canonical skeleton/weights, near and mid LODs, and
the complete gym sequence. A Tripo auto-rigged quadruped may be retained as a comparison artifact, not as the production
rig.

### Phase C — prove reuse with a second surface

Produce a second bounded variant—a different coat/breed silhouette or one fantasy mount surface—from the same accepted
source packet, Blender template, skeleton, material contract, LOD builder, manifest, optimizer, and gym gates. Keep tack
and tier upgrades modular. This is the proof that the first horse created a pipeline rather than an expensive one-off.

### Exit gate

Adopt the pipeline only when one horse:

- materially improves the locked gameplay-camera and close-gym silhouette over the current 2.2k-triangle horse;
- passes every existing procedural pose and Jolt lifecycle gate without model-family logic in gait/action code;
- stays inside the measured near/mid rendering budget;
- can be regenerated from the manifest and rebuilt through scripted mechanical Blender/export steps;
- has complete input, vendor, output, modification, and license provenance;
- produces a second model variant through the same contracts with no copied animation implementation.

If the second variant needs a new provider-specific runtime branch, the pipeline has not yet become scalable.

## Final recommendation

Fund one focused Tripo-versus-Rodin horse bake-off and one technical-art pass, not a broad autonomous asset factory.
Build the reusable value around the generator:

- one rights-cleared multiview input contract;
- one immutable experiment manifest;
- one Blender source/retopo/bake/rig/LOD lane;
- one canonical horse rig with adapters;
- one deterministic GLB optimization/validation lane;
- one existing gym and performance promotion gate.

This directly addresses the current visual limitation—2.2k flat-colored triangles—while preserving the procedural
animation investment. It also gives future horses, humanoids, creatures, armor variants, and whichever generator wins
next year the same stable path into the game.
