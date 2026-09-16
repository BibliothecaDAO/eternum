# Native contract development

Run `scarb fmt`, `scarb build` and domain-filtered `snforge test` in `contracts/l3/world-native`. Domain tests encode
the pinned gameplay rules and explicit rejections. Fact models in `schema/fact-models.mjs` define the rows consumed by
Herald and the client.

Run `bun contracts/l3/world-native/scripts/generate-schema.mjs --check` from the repository root after building. The
generated schema fixtures test event decoding. The fixed inputs under `tests/fixtures` support native contract tests;
they are not comparison reports.

The local authority helper remains available as `pnpm run lab:slice:prepare-authority SEED [MANIFEST]`. It deploys the
sequencing account used by the recorded execution interface. Local manifests belong under `deploy/madara-lab/.lab/`;
never overwrite the tracked game manifest for a rehearsal.

Full-game acceptance uses the main lab harness after the contract domains land. The paired oracle, comparison reports,
cost extraction and provenance gates have been removed.
