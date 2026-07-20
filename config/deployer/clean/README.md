# Runtime and launch control plane

The clean deployer contains the AWS runtime primitives and the public Blitz game-stack control plane. New production
Blitz seasons do not use the legacy factory launcher or a shared Slot Katana.

## Public Blitz launches

`cli/game-stack-api.ts` serves:

- `POST /v1/auth/challenges`
- `POST /v1/blitz/launch-quotes`
- `POST /v1/blitz/game-stacks`
- `GET /v1/blitz/game-stacks/{id}`
- `GET /v1/blitz/active`

It verifies Controller signatures and finalized L1 intents, then atomically consumes the challenge and quote while
acquiring the single authoritative `mainnet.blitz` DynamoDB admission. The service dispatches provisioning with the
immutable stack ID as its idempotency key.

Required configuration:

- `AWS_RUNTIME_CONTROL_TABLE_NAME`
- `AWS_REGION` (defaults to `us-east-2`)
- `MAINNET_RPC_URL`
- `SEASON_INTENT_READER_URL`
- `BLITZ_GAME_STACK_ORCHESTRATOR_URL`
- `BLITZ_CONTROL_PLANE_SERVICE_TOKEN`

## Provisioning orchestrator

`cli/game-stack-provisioning.ts` runs the ordered provisioning state machine. Each external operation receives a
stack-and-operation-specific idempotency key. Lifecycle state is persisted with an exact DynamoDB compare-and-swap, so a
stale worker cannot overwrite a newer transition.

The readiness order is:

1. accept the SeasonIntent;
2. provision Katana, seal its immutable identity, and verify its attestation;
3. deploy the initial World;
4. provision Torii and verify indexer readiness;
5. verify registry availability and the fixed readiness deadline;
6. recheck the A23 production authorization;
7. publish the complete Katana and Torii stack in one optimistic registry revision;
8. persist the ready state and exact publication revision.

Required configuration:

- `AWS_RUNTIME_CONTROL_TABLE_NAME`
- `AWS_REGION` (defaults to `us-east-2`)
- `BLITZ_GAME_STACK_OPERATIONS_URL`
- `RUNTIME_REGISTRY_URL`
- `FACTORY_WORKER_ADMIN_SECRET`
- `BLITZ_CONTROL_PLANE_SERVICE_TOKEN`

Both services read the checked-in A23 decision. A future GO also requires separately trusted Ed25519 keys in
`A23_RELEASE_AUTHORITY_PUBLIC_KEYS_JSON` and a positive `A23_RELEASE_SIGNATURE_QUORUM`. The current unsigned STOP record
deliberately prevents production admission and publication.

## Environment policy

New runtime resolution uses `local.blitz`, `sepolia.blitz`, or `mainnet.blitz`. `slot.*` and `slottest.*` identifiers
exist only as historical read aliases; launch, mutation, and registry publication paths reject them. There is no Slot
fallback or rollback target.

The legacy factory launcher remains available only for local and Sepolia operator/staging work. It rejects public
`mainnet.blitz` creation, which must use the game-stack API. It also rejects `mainnet.eternum` creation; Eternum stays
outside the L3 lifecycle and operator workflows may provision its Torii only.

Operator prize funding accepts only `mainnet.blitz` and `mainnet.eternum`, and verifies that the stored run record is
also mainnet before sending a transaction.

## Failure and closure

Provisioning failure records structured failure data, removes only the matching publication if one exists, aborts the
matching infrastructure, and conditionally releases only that stack's admission. At `activeUntil`, closure removes the
exact active publication before conditionally releasing admission. An older stack may continue settlement and archival
without touching a newer active stack.

Production remains blocked until the settlement program's signed A23 GO and all external proof, TEE, recovery, audit,
and release gates are satisfied.
