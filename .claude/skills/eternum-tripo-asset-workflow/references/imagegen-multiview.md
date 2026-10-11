# One approved design, four inspection views

Use built-in `imagegen`. Make front, back, true left or right profile, and top before the first user approval. One image
per call gives usable reconstruction files; a coherent sheet is also acceptable when views are separately extractable
without repainting. Keep the complete approval packet in ignored local scratch through raw-source approval; at handoff
retain selected small reference images, prompts, hashes and approval provenance under [retention](retention.md). Use the
approved original anchor in every subsequent call, not only the preceding derived image. Inspect local references before
passing `referenced_image_paths`; use recent-image inclusion only when local paths are unavailable. Never mix both
mechanisms.

## Design prompt

Describe a detailed 3D asset concept with explicit anatomy, silhouette, construction, material roles and intended style.
Name visible leather grain/stitching, cloth seams, wood grain, metal edges and actual facial/hair volumes where
relevant. Do not insert `low-poly`, `mobile`, `simple primitive`, `flat colour`, `12k faces` or another
aesthetic-limiting phrase unless requested. Subtle Bastion styling is expressed through the approved shape/material
references, not a generic fantasy label. Preserve all owner constraints: tier, gloves, mount armour, equipment, fixed
authored palette and common human scale; ownership is represented elsewhere in the game.

Example, adapted to the actual brief:

> Render the described asset as a detailed, physically plausible 3D model concept, matching the supplied approved art
> reference. Show a strict orthographic FRONT elevation, full object with generous margins, neutral background and broad
> studio light. Make construction and material distinctions readable without baked dramatic shadows. Preserve the
> specified proportions, modular equipment and approved authored palette. No scene dressing, text, perspective crop,
> oversimplified face, toy-like limbs, invented ornament or fused movable parts.

For shields, omit rear arm loops, straps and bands from all views; preserve front/rim design and show a simple rear
surface intended to sit against the forearm. See [equipment construction and fit](equipment-fit.md).

## Derived views

Each prompt names every image's role, repeats the full design invariants, and requests a camera rotation around the
**same unchanged object**, not another model. Back reveals rear construction. Side means the object's anatomical left or
right, recorded explicitly. Top means the camera looks down the vertical axis: preserve width/depth and the same scale,
reveal crown, shoulders, saddle, horse back, roof or openings as applicable. Do not label an elevated three-quarter view
as top. A top view naturally occludes lower surfaces; supplementary component views resolve those areas.

Compare front/back widths, side depth, top plan, part counts, equipment handedness and material boundaries. Fix drifting
views using the original anchor. If a packet is inconsistent, do not ask Tripo to average conflicting designs.

## Component preparation

Show the complete assembled concept first, including mounted seating when applicable. Rider generation can then use an
unobscured A/T pose and the mount a neutral standing pose. Derive component references from the approved design; record
their connection to it and inspect them before spending. A crop alone often removes neck joins or hidden surfaces.
Preserve the full reference, do not reconstruct the whole assembly separately for each part. Reapprove a component only
if it introduces a material design change beyond the accepted concept.

For an isolated component, the same recorder accepts schema 2 with `packetKind: "component"`, one or more views
including `front`, `designReference: {"manifest": "../approved-concept/manifest.json"}`, and an `approval.basis`
recording the accepted design and delegated inspection or explicit component approval. It hashes that original design
and checks its images. This avoids generating four new images for every small part. The full initial concept still
requires front/back/profile/top. The component must preserve the approved design; a redesign needs a new decision.

## Packet and provider roles

The schema-v2 packet has `front`, `back`, one of `left`/`right`, and `top`; the opposite profile is optional. A single
sheet can give views the same actual generation prompt with extraction provenance, but each saved view has its own path
and hash. `referenceRoles` records the real source chain, not a fabricated one. Legacy schema-v1 four-horizontal-view
packets remain readable for history; new work uses v2.

Copy `assets/imagegen-packet-spec.example.json`, fill actual prompts/files and approval, then run:

```bash
node <skill-dir>/scripts/record-imagegen-packet.mjs --spec <packet-dir>/imagegen-packet-spec.json --output <packet-dir>/manifest.json
```

The recorder validates metadata and hashes, not image quality. Preserve original prompts and record unavailable tool
model/seed values as null. Human approval and delegated review must be labelled accurately.

**Top is a review/construction reference.** The current Tripo multiview endpoint accepts front/left/back/right only,
with front and at least one other horizontal view. Send the approved front/back/profile subset with explicit roles;
never rename top to right or submit a combined sheet as one horizontal view. Keep top in the brief and Blender reviews.
Use the opposite profile only when needed or when a future verified endpoint supports more input views.
