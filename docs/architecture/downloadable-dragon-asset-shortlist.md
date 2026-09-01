# Downloadable winged dragon asset shortlist

_License and availability re-verified 2 September 2026. This is an asset-selection note, not legal advice._

## Decision

Use **Icy Dragon** by chengzijieczj for the in-app Sky Dragon test. Its CC BY 4.0 Sketchfab archive has now passed local
license, hierarchy, skin, texture, runtime-loading, walk, flight, and fire-cycle inspection. Keep **European Dragon** as
the lighter flight-authored alternative and **Cethiel's Dragon 3D** as the CC0 fallback.

Both licenses permit putting the model files themselves in a public source repository. That is a hard requirement: a
license that permits shipping a compiled game but prohibits redistribution of the underlying asset is not sufficient for
this repository.

Do not treat either asset as the final T3 art. The test should prove the dragon adapter, saddle and mouth sockets,
procedural flight control, fire-breath timing, and replacement boundary before custom generation begins.

## Where to search

Search creator-owned listings and genuinely open repositories before general asset marketplaces:

1. **Sketchfab**, filtered to downloadable CC0 or CC BY models. Verify the uploader is the creator and that the model is
   not copied from a film, game, or other franchise. CC BY permits keeping and adapting the source in the repository
   when its attribution requirements are met.
2. **OpenGameArt**, filtered to CC0 3D art. Prefer entries with direct source archives, an explicit provenance
   statement, and an inspectable rig and animation set.
3. **Creator-owned asset sites**, but compare the asset page with the creator's current general license before download.
   A marketplace-style license may permit shipping a compiled game while prohibiting raw source redistribution.

Do not rely on a search-result license badge alone. Reject noncommercial licenses, franchise fan models, extracted or
ripped models, and licenses that only permit distributing a compiled product. Avoid share-alike assets unless the
project deliberately accepts their downstream licensing obligations.

### Quaternius license conflict

The Quaternius dragon remains marked CC0 on its older pack page and Poly Pizza record. However, the creator's current
Quaternius Asset License, dated August 28, 2026, prohibits redistributing assets in original or modified form as assets.
That license says changes are not retroactive for copies already obtained under an earlier license, but a fresh download
now creates avoidable ambiguity. Do not use a newly downloaded Quaternius dragon in this repository without written
clarification or preserved evidence that the exact copy was obtained under CC0 before the change.

## Ranked candidates

| Rank | Asset                                                                                                                | Why it fits                                                                                                                                                            | License and constraint                                                                                                                                                                  | Decision                              |
| ---- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1    | [Icy Dragon](https://sketchfab.com/3d-models/icy-dragon-2db9268227b943e6a41e88390f2875a6) by chengzijieczj           | Winged quadruped; 133,666 triangles; six skinned meshes; 88-joint rig; bilateral wing fingers; four articulated legs; textured glTF archive                            | CC BY 4.0. Eternum retains the supplied notice, credits the creator, links the license, and records texture and runtime modifications beside the model.                                 | **Selected and integrated**           |
| 2    | [European Dragon](https://sketchfab.com/3d-models/european-dragon-82f393a2e6c048ad80c171ce3b3a7b87) by Regina Cachoa | Winged four-legged European dragon; 42,338 triangles; 21,225 vertices; game-ready FBX; Idle Stand, Idle Sit, Walk, Run, and Fly clips; 2K and 4K hand-painted textures | CC BY 4.0. Commercial use and adaptation are allowed, but Eternum must credit the author, link the license, and identify modifications. Original download requires a Sketchfab account. | Lighter authored-flight alternative   |
| 3    | [Cethiel's Dragon 3D](https://opengameart.org/content/cethiels-dragon-3d) by Drummyfish and Cethiel                  | Direct archive; quadruped; genuine skinned mesh; bilateral wing chains; articulated jaw, tongue, neck, tail, and four legs; Attack, Die, Idle, and Walk animation data | CC0; attribution is not required. Only 1,262 triangles and no authored flight clip.                                                                                                     | **Best no-friction adapter fallback** |
| 4    | [Simple 3D Dragon Model](https://opengameart.org/content/simple-3d-dragon-model) by MattBas                          | Direct GLB and Blender source; 2,698 triangles; 65-joint skin with jaw, four legs, wing-finger chains, and tail; Flying, Idle, Run, and Walk clips                     | CC BY-SA 4.0. Share-alike obligations make it a poor production foundation even though it is the easiest flight-ready GLB.                                                              | Pipeline fallback only                |
| 5    | [Low Poly Ice Dragon](https://opengameart.org/content/low-poly-ice-dragon) by xTerryx                                | Winged dragon with creator-described fly and bite animations                                                                                                           | CC0, but supplied only as a Blender 3.04 file. The local importer did not recover its skin or animation data, so Blender conversion is required before an objective audit.              | Skip for the first test               |

The static Stanford-dragon models in the Khronos glTF sample repository are material demonstrations, not winged, rigged
mount candidates. The CC0 Mazo dragon is humanoid and therefore does not match the Sky Dragon form.

## Repository redistribution gate

| License or marketplace term                                                                | Public source repository? | What Eternum must do                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                              | **Yes**                   | No attribution condition. Keep provenance and a license record anyway so later reviewers can verify why the asset is present.                                                                       |
| [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode.en)                      | **Yes**                   | Credit the creator, identify the asset, link the source and license, retain supplied notices, and indicate modifications. The license expressly permits sharing originals and adaptations.          |
| [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)                            | Yes, with share-alike     | Meet the BY duties and distribute adapted material under the same license. Avoid here because the compliance boundary is less convenient than CC0 or CC BY.                                         |
| [Sketchfab Standard](https://sketchfab.com/licenses) or **Free Standard**                  | **No**                    | It permits use in a derivative product but prohibits making the model available as a standalone/extractable file. Do not commit these downloads.                                                    |
| [Fab Standard](https://www.fab.com/eula?lang=en)                                           | **No**                    | It permits commercial products and private collaborator access, but prohibits free or paid standalone redistribution.                                                                               |
| [Unity Asset Store standard EULA](https://assetstore.unity.com/browse/eula-faq)            | **No**                    | Unity permits distribution only when an asset is embedded in a substantial game or digital product and cannot be extracted separately.                                                              |
| [Quaternius Asset License v1.0](https://quaternius.com/license.html), dated 28 August 2026 | **No**                    | It permits games and other products but prohibits redistributing original **or modified** assets. Only use a specific older download if its exact CC0 grant and acquisition record are unambiguous. |

The model-page license controls the shortlist. “Free download,” “commercial use,” “royalty-free,” or “game ready” does
not, by itself, authorize committing source assets.

## Sources screened in the September 2026 re-check

- **Sketchfab CC0/CC BY downloadable filters:** still the best place to look for a visually stronger replacement, but
  inspect the exact model API record and creator provenance. Do not accept Free Standard, editorial, non-commercial, or
  no-derivatives results. Newly uploaded dragon results frequently lack enough creator history or description to
  establish trustworthy provenance. Icy Dragon was selected after its six-year-old CC BY record, third-party attributed
  reuse, and source archive passed review. European Dragon remains the lighter alternative: its current
  [API record](https://api.sketchfab.com/v3/models/82f393a2e6c048ad80c171ce3b3a7b87) reports downloadable, five
  animations, 42,338 faces, 21,225 vertices, and CC BY 4.0.
- **OpenGameArt:** the best low-friction source for directly downloadable CC0/CC BY source archives. The re-check found
  no newer candidate that displaces European Dragon or Cethiel's Dragon 3D. Verify the uploader, license field,
  attribution notice, and every file inside the archive rather than relying on collection metadata.
- **Quaternius:** the 2022 [Ultimate Monsters](https://quaternius.com/packs/ultimatemonsters.html) and
  [LowPoly Animated Monsters](https://quaternius.itch.io/lowpoly-animated-monsters) pages still label their downloads
  CC0, while Quaternius's new site-wide QAL prohibits asset redistribution and says changes are non-retroactive. That
  conflict makes a fresh download a poor choice without written clarification or a preserved pre-QAL acquisition record.
  The two Poly Pizza dragon exports were also audited: both are animated CC0 listings, but neither is a quadruped mount.
  The 3,826-triangle Dragon has a 13-bone wing/body rig and eight clips; the 6,702-triangle Dragon Evolved has arms,
  wings, a 46-bone rig, and eight clips, but no four-leg dragon anatomy.
- **Poly Pizza:** useful as an index of downloadable CC models, not as a substitute for creator provenance. Prefer an
  exact creator-owned page and record the page's license at acquisition time.
- **Kenney:** its first-party catalog remains an excellent CC0 source, but no winged, rigged dragon match was found.
- **Fab and the Unity Asset Store:** useful for visual reference or closed-asset production workflows, but their
  standard licenses do not fit a public repository. A specific listing is eligible only if the creator separately
  applies CC0, CC BY, or another license that expressly permits source redistribution.

## Verified local audit: Cethiel fallback

The official 1.4 MB archive was downloaded into the gitignored `.context/dragon-asset-audit` directory and inspected
without modifying the app. The base Collada file contains:

- one skinned, UV-mapped mesh with 633 source positions and 1,262 triangles;
- 32 skeleton joints, with 31 joints weighted by the mesh importer;
- left and right `wing_lower -> wing_upper` chains;
- `jaw_upper`, `jaw_lower`, `tongue`, three neck joints, three tail joints, two back joints, and four four-joint leg
  chains;
- one diffuse texture reference and two supplied 472 x 420 texture variants.

Four separate Collada animation files contain real transform channels:

| Clip   | Channels | Key samples | Approximate duration |
| ------ | -------: | ----------: | -------------------: |
| Attack |       32 |           9 |               1.67 s |
| Die    |       31 |          13 |               2.46 s |
| Idle   |       28 |          22 |               4.21 s |
| Walk   |       31 |           9 |               1.63 s |

The Attack data drives the upper jaw, lower jaw, and tongue. This is sufficient to validate a mouth socket and a
fire-breath action even though flight must be procedural.

## Implemented Icy Dragon import

1. Retain the creator-provided glTF, binary geometry, supplied license record, source URL, author, and CC BY 4.0 notice.
2. Deliver the seven supplied textures at 1024 × 1024 and record that modification beside the asset.
3. Validate six skinned meshes and the semantic 88-joint subset needed for body, neck, head, jaw, mouth, four legs,
   bilateral wing chains, tail, and saddle.
4. Bake the first sample of the authored clip as the neutral reference pose, then discard clip playback so the
   procedural runtime remains the sole animation authority.
5. Normalize scale and ground placement from the two primary meshes; accessory bind-space coordinates must not affect
   actor scale.
6. Run the adapter through `ProceduralDragonMountActor` without changing authoritative Paladin movement or fire timing.

## Acceptance gate before keeping the test asset

- Wings flap, fold, bank, and glide through independently weighted left/right chains.
- The rider remains stable at the derived saddle through idle, forward flight, banking, and attack anticipation.
- Head aim and jaw opening produce a stable mouth origin for fire breath.
- Tail and neck motion remain procedural and do not fight the imported animation.
- The normalized glTF loads with only its checked-in dependencies and reports finite bounds, skin weights, and poses.
- A future custom dragon can replace the asset by supplying a new adapter and appearance manifest, without changing
  Paladin gameplay or rider composition.

## Source notes

- The [Sketchfab model record](https://api.sketchfab.com/v3/models/82f393a2e6c048ad80c171ce3b3a7b87) independently
  reports that European Dragon is downloadable, has five animations, 42,338 faces, 21,225 vertices, and a commercial-use
  CC Attribution license.
- The [Icy Dragon model record](https://api.sketchfab.com/v3/models/2db9268227b943e6a41e88390f2875a6) reports that it is
  downloadable, has one animation, 133,666 faces, 67,699 vertices, and a CC Attribution license.
- [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) permits sharing and adaptation for commercial purposes with
  appropriate credit, a license link, and an indication of changes.
- The current [Quaternius Asset License](https://quaternius.com/license.html) permits incorporating assets into a
  product but prohibits redistributing the assets themselves; it also states that license changes do not apply
  retroactively to assets already obtained under an earlier version.
- Candidate claims above come from the creators' own downloadable asset listings. Geometry, skeleton, and animation
  details for Cethiel and MattBas were additionally checked against the downloaded source archives.
