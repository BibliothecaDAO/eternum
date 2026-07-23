# Local settlement sandbox

The local settlement sandbox runs one isolated Katana process as the Starknet settlement-chain stand-in and a second
isolated Katana process as the Blitz appchain. It is the substrate for the approved G17 two-chain tracer.

The sandbox is deliberately test-only:

- only `local.blitz` accepts fixture evidence
- every result sets `productionCompletionEvidence` to `false`
- fixture identities are never inputs to production manifests or release bundles
- each run uses distinct chain IDs, ports, data directories, logs, and genesis identities
- execution and evidence-writing seams independently revalidate the canonical local-only plan
- every JSON-RPC readiness request and the overall readiness loop have bounded timeouts
- both processes are stopped even when execution or one cleanup step fails

Plan a run without starting processes:

```sh
pnpm settlement:e2e:sandbox -- \
  --operation plan \
  --environment local.blitz \
  --run-id g17-plan
```

Run the current two-chain process smoke:

```sh
pnpm settlement:e2e:sandbox -- \
  --operation smoke \
  --environment local.blitz \
  --run-id g17-smoke
```

The default evidence path is `.context/settlement-e2e/runs/<run-id>/run.json`. Passed and failed runs both write this
artifact. It records the observed Katana version, chain IDs, genesis block hashes, state roots, process lifecycle and
cleanup outcomes, structured failures, and the explicit evidence classification.

The current smoke observes the workspace's Katana 1.7.1 feasibility binary. It does not emulate SEV-SNP, produce an
attestation quote, or count as A23, production G17, or release evidence. The next slice deploys the frozen-ABI test-only
contract fixtures and drives the typed resource/cancellation path through these two live RPC boundaries.
