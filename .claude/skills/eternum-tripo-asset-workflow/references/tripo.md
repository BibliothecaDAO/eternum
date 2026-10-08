# Tripo generation, preservation and recovery

Checked 2026-09-22 against installed CLI 0.5.1 and current official developer docs. Recheck capability/pricing for the
actual route before spending; Studio and API entitlements/features can differ. The promotional Astra landing page
returned HTTP 403 in web, direct fetch and Chromium. The accessible official character tutorial and API contract support
the design below; no claim is made that this task reproduced a marketing demonstration.

## Source quality first

Choose generation quality for the complete unit's measured runtime needs and the repair/baking work it will save. The
recorded v3.1 route below is a capability reference, not a standing instruction to request extreme textures or millions
of faces. Verify current supported controls/cost; choose deliberate topology/texture constraints or a game-ready
provider result when it preserves the approved silhouette, construction and joint regions. Inspect it before approval.
Request a denser temporary source only when visible detail or a planned bake justifies the added cost. Do not infer
runtime suitability from a provider's mobile/low-poly label; measure the actual result and test deformation early.

P1 is a low-poly option; P2 is an explicit topology/cost alternative, not an automatic higher-fidelity choice. Preserve
all output maps at source resolution in ignored local scratch through approval/baking, then apply
[retention](retention.md). Compare actual appearance, not the provider's model name or a triangle headline. If newer
supported models appear, verify their exact dated IDs, parameters, cost and route before updating the adapter.

Tripo H-series currently offers adaptive topology, detailed geometry and an extreme texture tier. Its horizontal
multiview input uses `front`, `left`, `back`, `right`, requiring front plus at least one other view. It does not accept
top. Source limits and texture sizes are provider capabilities, not targets for every asset.
[Official H-series contract](https://developers.tripo3d.ai/en/docs/generation-multiview-to-model/standard).

## Whole object versus parts

Use whole-object generation for readable, separable forms. A rider on a horse obscures anatomy and joins, so normally
use rider and mount packets, plus equipment as needed. Head/hair can be separate when face fidelity or hair swaps
justify it. Preserve assembly proportions from the complete approved design. Review the derived references and
individual results against that design. Do not substitute an unrelated high-detail face/body after concept approval.

The official character example generates body/head/hair, assembles around the complete reference, preserves materials,
and can reuse imported weights. It also says its illustrations/clips are separate demonstrations, so they are not proof
of one automatic end-to-end outcome. Adapt the method, not a promised quality guarantee.
[Official character workflow](https://www.tripo3d.ai/blog/gpt-6-astra-3d-character-workflow).

The `generate_parts` parameter is not equivalent to independently directed, textured component generation: the current
H-series contract makes it incompatible with textures/PBR. Separate textured requests or later segmentation are distinct
cost/quality choices. Do not silently turn textures off to obtain parts.

## Account and spend

Use existing authorized Tripo access; `tripo login` handles secrets outside chat/repository. Read version, identity and
balance only as needed. Credits alone do not prove commercial rights. Verify the current terms and actual route's
paid/evaluation entitlement, preserve original provenance, and do not relabel old free-evaluation sources after a
purchase. Unknown rights block shipping, not authorized local evaluation or skill maintenance. Do not repeatedly request
rights or provider approvals already established for the selected packet/scope.

A candidate is a generated alternative; separate part requests and retries still consume work/spend. Record a task-wide
allowance, spent/reserved amounts, and remaining amount. The wrapper's candidate count is **per call (maximum four)**;
that is not a universal cap on a multi-part project. Every call gets an allocation within the total approved allowance.
No automated reroll loops. A model-quality change may alter price: verify before submission, not after billing.

The CLI dry run is offline parameter validation, not a price quote or hard billing limit. Inspect every planned API step
for unexpected scenario/rig/retopology chains. Reserve a verified upper cost for that exact plan within remaining
credits. The executor records overruns after billing; it cannot prevent provider billing errors. If cost is unknown or
the allocation is exceeded, stop only the paid action and request the missing allocation with a concrete plan.

## Versioned adapter

New examples use schema 2: source quality intent and a geometry-stage pending rig are explicit. Legacy schema 1 stays
readable to recover old runs. Call scripts from the actual installed skill folder, not a hard-coded repo-relative path.

```bash
tripo --version
tripo docs --topic commands/generate
tripo docs --topic commands/make
node <skill-dir>/scripts/record-imagegen-packet.mjs --spec <packet-dir>/imagegen-packet-spec.json --output <packet-dir>/manifest.json
node <skill-dir>/scripts/prepare-tripo-run.mjs --spec <asset-dir>/tripo-run-spec.json --run-dir <asset-dir>/generation/tripo/<run-id>
```

Fill `assets/tripo-run-spec.example.json` with actual approvals, cost allocation, model/seed/params and two to four
approved **horizontal** inputs. No mobile preset is supplied. Freeze/hashes preserve exact inputs and requests.
Single-image component generation is also supported by the v2 adapter with a front-role input. Do not send a whole sheet
as a single-image component. Check `request.json` against the intended payload. Any downgraded/stripped quality
parameter or implicit destructive processing step is a failed preparation, even if the provider considers it valid.

After concept/provider/spend approvals already cover this plan:

```bash
node <skill-dir>/scripts/execute-tripo-run.mjs --run-dir <run-dir> --approved-credit-cap <allocated-cap>
```

Return the actual generated mesh for approval before editing it. Its raw files remain immutable during active
approval/baking, then follow [retention](retention.md). Record owner selection, accepted defects and local repair scope
in the asset brief. Importing/rendering for inspection is permitted before this approval; substantive geometry/material
edits and rigging wait for it unless explicitly delegated.

## Recovery

On interruption preserve the task ID and poll/download the same task, not a new generation:

```bash
tripo history --json --no-open
tripo task get <task-id> --json --no-open
tripo task watch <task-id> --download --json --no-open
node <skill-dir>/scripts/record-tripo-run.mjs --run-dir <run-dir>
```

Only resubmit when evidence establishes no accepted task, and within the remaining allowance. Save full terminal JSON,
raw artifacts/hashes and actual charges before moving on; payloads remain temporary scratch under
[retention](retention.md). Auth recovery, an existing task and a geometry-quality failure are different problems. Do not
change model parameters during a retry of the same task.

## Source selection and repair economics

Select the source for visible detail, separability, material quality and likely repair cost, not the smallest mesh.
Retain task IDs, hashes, rights and selected captures; keep raw provider files in ignored scratch only while needed for
approval, baking or comparison under [retention](retention.md). Evaluate fused moving boundaries and missing
construction from raw views before committing to elaborate local patches; compare a bounded repair with a component
regeneration proposal. New spend requires its existing authorization, while already directed local repairs do not
acquire an extra approval gate. A provider adapter fixture or dry run is scoped to source bytes and does not certify a
candidate or spend.
