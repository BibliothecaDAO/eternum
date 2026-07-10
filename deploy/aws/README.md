# AWS Runtime Platform

This directory contains the isolated AWS ECS runtime platform for Katana and Torii. Terraform owns each environment's
foundation. GitHub Actions own runtime mutations through `config/deployer/clean/cli/aws-runtime.ts`.

## Containment

Keep `RUNTIME_PROVIDER=slot` in every GitHub environment until the rollout gates below pass. Keep
`AWS_RUNTIME_AUTO_TEARDOWN_ENABLED=false` and `FACTORY_RUNTIME_FALLBACK_SWEEP_ENABLED=false`; automated AWS
teardown is intentionally disabled during the remediation rollout. A registry rollback changes aliases back to Slot
and does not delete either provider's state.

Account and region ownership is fixed:

| Account class | Environments | Region |
| --- | --- | --- |
| non-production | `slot.blitz`, `slot.eternum`, `slottest.blitz`, `slottest.eternum` | `us-east-1` |
| production | `mainnet.blitz`, `mainnet.eternum` | `us-east-1` |
| isolated DR | `dr-mainnet.blitz`, `dr-mainnet.eternum` | `us-west-2` |

The non-production account owns one shared Katana for `slot` and one for `slottest`. They use
`LifecycleClass=shared`, are never game-owned, and cannot enter automated teardown. Mainnet permits Torii only.

## Foundation

Apply one fixed root under `deploy/aws/terraform/roots` per environment. Each root creates a VPC, ECS cluster, EFS
filesystem, control table, ECR repository, ALB shards, WAF, workload roles, GitHub OIDC roles, alarms, budgets, and
backup policy dedicated to that environment.

The foundation uses a rotating environment KMS key for runtime data and logs, encrypted VPC flow logs, a deny-all
default security group, private ECS tasks, TLS-only public ALB listeners, and versioned ALB access logs. Runtime task
egress is limited to HTTPS, VPC DNS, and the environment EFS mount targets.

The important outputs map directly to GitHub environment variables:

- `AWS_MAINTENANCE_ROLE_TO_ASSUME`
- `AWS_REGION`
- `AWS_ROLE_TO_ASSUME`
- `AWS_RUNTIME_ALB_ACCESS_LOG_BUCKET`
- `AWS_RUNTIME_ALB_LISTENER_ARN`
- `AWS_RUNTIME_ALB_LISTENER_ARNS`
- `AWS_RUNTIME_BACKUP_VAULT_ARN`
- `AWS_RUNTIME_CLUSTER`
- `AWS_RUNTIME_CONTROL_TABLE_NAME`
- `AWS_RUNTIME_CORS_ORIGINS`
- `AWS_RUNTIME_DOMAIN`
- `AWS_RUNTIME_DR_ROLE_ARN`
- `AWS_RUNTIME_E2E_ROLE_ARN`
- `AWS_RUNTIME_ECR_REPOSITORY_URL`
- `AWS_RUNTIME_EFS_FILE_SYSTEM_ID`
- `AWS_RUNTIME_EFS_REPLICATION_ROLE_ARN`
- `AWS_RUNTIME_FOUNDATION_MANIFEST_PARAMETER`
- `AWS_RUNTIME_IMAGE_ROLE_ARN`
- `AWS_RUNTIME_LOG_GROUP`
- `AWS_RUNTIME_REQUIRE_CONTROL_TABLE`
- `AWS_RUNTIME_ROUTE_HOSTS`
- `AWS_RUNTIME_SECURITY_GROUP_IDS`
- `AWS_RUNTIME_SNS_TOPIC_ARN`
- `AWS_RUNTIME_SUBNET_IDS`
- `AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN`
- `AWS_RUNTIME_TASK_ROLE_ARN`
- `AWS_RUNTIME_UPSTREAM_RPC_SECRET_ARN`
- `AWS_RUNTIME_VPC_ID`
- `DR_WORKFLOW_ENVIRONMENT_VARIABLES`
- `GITHUB_ENVIRONMENT_VARIABLES`

Operator-set GitHub environment variables:

- `RUNTIME_PROVIDER=slot`
- `AWS_RUNTIME_IMAGE_DIGEST` set to an approved `sha256:` digest
- `AWS_RUNTIME_HEALTH_START_PERIOD_SECONDS` only when restores need more than the 90-second floor
- `RUNTIME_REGISTRY_URL` for the versioned public registry
- `AWS_RUNTIME_REGISTRY_ACTIVATE=false` until a shadow runtime is approved for traffic
- `AWS_RUNTIME_DR_EFS_FILE_SYSTEM_ARN` on production for the cross-account replica
- `AWS_RUNTIME_DR_RECOVERY_MANIFEST` for approved regional recovery
- `AWS_RUNTIME_SOURCE_DR_ROLE_ARN` and `AWS_RUNTIME_DESTINATION_DR_ROLE_ARN` for the two-account recovery workflow

For each mainnet environment, merge `dr_workflow_environment_variables` from its production and DR roots into the
same protected GitHub environment. The maps provide the source/destination roles, replica ARN, destination runtime
foundation, explicit CORS and secret settings, and per-shard ALB DNS/hosted-zone values used to approve Route53 changes.

The protected GitHub environments also provide `FACTORY_WORKER_ADMIN_SECRET` so successful runtime mutations can
publish registry revisions. Keep it scoped to the exact factory worker and never expose it to a runtime task.

Sensitive upstream RPC values are written out of band to the Terraform-created Secrets Manager secret. SSM contains
only the non-secret foundation manifest. Do not place RPC credentials in GitHub variables or Terraform values.

## GitHub Environment Checklist

Configure these GitHub environments before dispatching runtime workflows:

- `slot.blitz`
- `slot.eternum`
- `slottest.blitz`
- `slottest.eternum`
- `mainnet.blitz`
- `mainnet.eternum`

Each Terraform root binds its deploy, maintenance, image-promotion, DR, and non-production E2E roles to one exact
GitHub environment. A role for one environment cannot assume or mutate another environment's foundation. Mainnet
environments require required reviewers and deployment branch policy = `next`.

## Remote State

Use `deploy/aws/terraform/state-bootstrap` once per AWS account to create the account-wide GitHub OIDC provider, the
KMS-encrypted, versioned, public-blocked, TLS-only state bucket, dedicated access-log bucket, and deletion-protected
DynamoDB lock table. Pass its `github_oidc_provider_arn` output into every environment root in that account.
Production bootstrap inputs must configure cross-account state replication to the isolated DR account. Bootstrap the
trust without a circular dependency:

1. Apply the DR bootstrap with the production account ID and `eternum-mainnet-` ECR prefix to create its state bucket,
   KMS key, and destination registry policy.
2. Apply the two DR environment roots to pre-create immutable, KMS-encrypted repositories with the production
   repository names.
3. Apply the production bootstrap with the DR account ID, the same ECR prefix, both state destination ARNs,
   `enable_state_replication=false`, and `enable_ecr_replication=false`; record the `replication_role_arn` output.
4. Reapply the DR bootstrap with `replication_source_role_arn` set to that exact production role ARN.
5. Reapply the production bootstrap with `enable_state_replication=true` and `enable_ecr_replication=true`.

Every root has a committed backend key:

- `aws-runtime/non-production/slot.blitz.tfstate`
- `aws-runtime/non-production/slot.eternum.tfstate`
- `aws-runtime/non-production/slottest.blitz.tfstate`
- `aws-runtime/non-production/slottest.eternum.tfstate`
- `aws-runtime/production/mainnet.blitz.tfstate`
- `aws-runtime/production/mainnet.eternum.tfstate`
- `aws-runtime/dr/mainnet.blitz.tfstate`
- `aws-runtime/dr/mainnet.eternum.tfstate`

Initialize an exact root with account-owned backend inputs:

```sh
terraform -chdir=deploy/aws/terraform/roots/slottest-blitz init \
  -backend-config="bucket=<state-bucket>" \
  -backend-config="dynamodb_table=aws-runtime-foundation-locks" \
  -backend-config="region=us-east-1" \
  -backend-config="kms_key_id=<state-kms-key-arn>"
terraform -chdir=deploy/aws/terraform/roots/slottest-blitz plan
```

Never apply the reusable `deploy/aws/terraform` module directly.

## Access Control

The OIDC subject grants one exact GitHub environment per role set:
`repo:<org>/<repo>:environment:<environment>`. A role cannot assume another environment boundary. Deploy roles create and reconcile runtime
resources. Maintenance roles own destructive service, task-definition, routing, access-point, alarm, and snapshot
cleanup. Image roles build or promote ECR digests. DR roles own replication, recovery, and failover records. The
non-production E2E role combines deploy and maintenance grants only for forced-crash testing.

ECS actions are constrained to the environment cluster, listener rules to declared shard listeners, task-definition
lifecycle to environment-prefixed families, and create APIs to required `Project` and `Environment` tags. Workload
roles can mount only their environment EFS access points and cannot use EFS root access. The execution role can read
only the exact environment secret. ECS Exec callers are restricted to the `runtime-checkpoint` sidecar and explicitly
denied direct `ssm:StartSession` access so checkpoint transcripts cannot bypass the cluster audit configuration.

## Images

`aws-runtime-image.yml` builds `{dojoVersion}-{gitSha}`, requires the requested version to match the Dockerfile's
digest-pinned Dojo version, emits the repository digest, creates an SPDX SBOM and build provenance, waits for ECR
scanning, and signs the digest with keyless cosign. Docker base images and libmdbx source are digest/commit pinned. The runtime container runs as UID/GID `1000:1000`, uses a read-only root filesystem, drops all
Linux capabilities, and writes only to explicit `/data`, `/tmp`, `/snapshots`, and `/runtime-control` mounts. The
non-essential `runtime-checkpoint` sidecar also drops every capability and defaults to UID/GID `1000:1000`, but keeps
the writable root filesystem required by the AWS-managed Exec agent. It has no listener, no upstream RPC secret, and
is reachable only through the exact environment's audited deploy and maintenance roles.

`aws-runtime-image-promote.yml` runs under a protected mainnet environment. It verifies the candidate signature,
rejects any Critical or High finding unless `AWS_RUNTIME_SCAN_EXCEPTION_EXPIRES_AT` is a future timestamp, copies the
approved digest into production ECR, signs the production digest, and retains promotion evidence for one year.
Task definitions always use `repository@sha256:...`; tag-only production registration is rejected.

## Runtime Identity

Runtime identity is `{environmentId, runtimeKind, runtimeName, runtimeInstanceId}`. Names are canonical lowercase
alphanumeric/hyphen values up to 48 characters. The immutable UUID is generated once per run and reused across
retries. ECS services, task-definition families, target groups, access points, and alarms include a readable prefix
plus a 16-character identity hash.

Every deploy, resize, checkpoint, and delete acquires the same DynamoDB mutation lease. Route assignment is sticky and
stored in the same table. Delete re-reads live ECS tags immediately before mutation and refuses a different instance
ID. A successful delete writes a 90-day audit tombstone recording the immutable identity and snapshot retention intent.

The deployer keeps the current and two prior task-definition revisions after a healthy rollout. It deregisters older
revisions and removes all revisions on destructive deletion.

## Routing

ALBs are append-only shards. New runtimes receive one shard permanently; each shard admits at most 80 runtimes and
alarms at 70. Hosts are stable, for example `s0.slottest-blitz.runtime.realms.world`. Adding `s1` never moves an
existing endpoint.

WAF managed protections and rate rules begin in Count mode on Slot/slottest shadow traffic. Mainnet foundations reject
Terraform apply unless enforcement is set to `block`. The
path proxy enforces URL/body limits, explicit CORS origins, connection/upstream timeouts, semantic health checks, and
WebSocket connection/idle limits. Torii reads are public. `slot` and `slottest` Katana are the explicit public-dev RPC
exception. Mainnet Katana and production mutation requests are rejected.

Every Terraform root requires a non-empty `cors_origins` list. Entries must be pathless HTTPS origins or explicit
`localhost`/`127.0.0.1` development origins.

Production uses per-AZ production NAT gateways; non-production uses one non-production NAT gateway. Keep
`enable_vpc_endpoints=true` so S3, ECR API/Docker, and CloudWatch Logs traffic remains on private endpoints.

Clients do not build hosts. They resolve factory, global, shared-chain, and per-game aliases from
`/api/runtime-registry/v1`. Each alias retains a Slot endpoint. Provider rollback updates `activeProvider` only and
does not destroy AWS or Slot state.

Seed the registry once before the first launch publication:

```sh
RUNTIME_REGISTRY_URL=https://<factory-worker>/api/runtime-registry/v1 \
FACTORY_WORKER_ADMIN_SECRET=<admin-secret> \
bun scripts/update-runtime-registry.ts --seed-default true
```

Slot game launches publish their resolved Torii endpoints in one revision after `create-indexer` or
`create-indexers`. AWS launches add the immutable artifact while retaining those Slot endpoints. The generic AWS
deployer does the same for shared-chain, factory, global, and manually managed game runtimes;
`registry_json.activate` defaults to false so publication and traffic activation remain separate approvals.

## Snapshots

The snapshot supervisor serializes checkpoints, retries transient failures, streams checksums, emits structured
freshness/failure metrics, and exits after repeated unrecoverable errors so ECS replaces the task. Snapshots include
format version, runtime identity, world, image digest, compatibility metadata, and a checksum. Twelve local snapshots
are retained.

Before deploy, resize, or delete, the deployer runs a one-shot, non-shell checkpoint command through ECS Exec in the
dedicated sidecar and requires its correlated success marker. The ECS API-required interactive transport is not
exposed as an operator shell. Session data is KMS encrypted and its transcript is retained in the environment's
encrypted CloudWatch log group. SIGTERM snapshotting is fallback only. Mainnet targets are 5-minute RPO and
30-minute RTO in-region, and 20-minute RPO and 2-hour RTO for regional recovery.

## E2E Validation

After applying a non-production foundation and publishing a digest:

```sh
AWS_RUNTIME_E2E_ENVIRONMENT=slottest.blitz \
AWS_RUNTIME_E2E_RUNTIME_KIND=katana \
AWS_RUNTIME_E2E_RUNTIME_NAME=aws-runtime-e2e-smoke \
AWS_RUNTIME_E2E_IMAGE_DIGEST=sha256:<64-hex-digest> \
make aws-runtime-e2e
```

For Torii also set `AWS_RUNTIME_E2E_RPC_URL` and `AWS_RUNTIME_E2E_WORLD_ADDRESS`. The harness tests concurrent deploy
locking, checkpointed update with zero marker loss, PID 1 forced crash, measured RPO/RTO, retained restore, destructive
delete/recreate, and resource-specific eventual cleanup for ECS services, task definitions, listener rules, target
groups, EFS access points, alarms, registry records, and snapshot intent.

## Backup And DR

Production EFS recovery points copy cross-account to `us-west-2`. Vault Lock retains daily points for 35 days, weekly
points for 13 weeks, and monthly points for one year. The warm DR account keeps VPC, ECS, ALB, ECR, WAF, and replica
EFS foundations ready.

DR roots require `existing_certificate_arn` for a separately validated `us-west-2` ACM certificate. They set
`manage_public_dns=false`, so the warm foundation never competes with the production roots for shard aliases; only the
audited recovery operation changes those records.

`aws-runtime-dr.yml` runs a quarterly replication-readiness check and supports an approved on-demand promotion. The
approved configure operation disables destination overwrite protection immediately before creating replication;
Terraform leaves that mutable EFS state unmanaged. Promotion checks `TimeSinceLastSync`, enforces the 20-minute
regional RPO, validates every registry-selected image digest in destination ECR, and only then deletes the replication
configuration, which makes EFS automatically re-enable overwrite protection
and return the replica to writable service. Recovery then recreates access points
and services from registry-selected runtime aliases, updates Route53, and publishes registry provider changes. The
approved recovery manifest supplies non-public runtime settings and exact alias prefixes; immutable instance IDs,
image digests, routing shards, and complete endpoint sets must match the live public registry before deployment. The
Route53 batch must contain exactly one ALB alias UPSERT for every registry-resolved shard host; empty, duplicate, or
unrelated record changes are rejected. Recreated tasks use the DR foundation's upstream RPC secret ARN and explicit
CORS origins. The manifest carries `recoveryStartedAt`; the final measurement records RTO and fails when it exceeds two hours. Retain
each drill artifact and fail a promotion drill when RPO exceeds 20 minutes or RTO exceeds two hours.

Each environment has 50/80/100/120-percent budget notifications. Production apply fails without an alert destination.
Alerts cover snapshot freshness/failure, restore and backup failures, service capacity/restarts, target health, ALB
latency/5xx, WAF blocks, EFS pressure, and replication lag.

## Storage Validation Results

Mainnet cutover remains blocked until this table is fully green and has explicit RPO/RTO sign-off.

| Check | Katana | Torii | Evidence |
| --- | --- | --- | --- |
| crash/restore | pending two green nightly runs | pending two green nightly runs | forced-crash E2E artifacts |
| checkpoint/update | pending zero-loss proof | pending zero-loss proof | checkpoint-update artifacts |
| mdbx_copy under write load | pending | not applicable | runtime image snapshot artifact |
| 24h torii soak | not applicable | pending | index lag, SQL parity, reconnect, corrupt fallback report |
| WAF/proxy abuse suite | pending | pending | Count-to-enforce comparison report |
| cross-account DR drill | shared chain only | pending | quarterly measured RPO/RTO artifact |
| RPO/RTO sign-off | pending | pending | named operator approval before mainnet cutover |

## Rollout

Provision shared `slot` and `slottest` Katana first, then factory/global Torii, then per-game Torii. Shadow factory,
global, and representative game aliases on `slottest`; compare discovery, index height, model counts, and sampled SQL.
Cut over `slottest.*`, then `slot.*`, mainnet factory/global Torii, and finally mainnet per-game Torii.

Mainnet additionally requires two consecutive green forced-crash nights, a green 24h Torii soak, enforced WAF,
successful DR drill, confirmed alert delivery, and signed RPO/RTO. Keep Slot alias targets for at least 14 days after
each cutover.

Bootstrap inputs not owned by this repository are AWS account/Organizations setup, hosted zones, state bucket names,
the DR regional ACM certificate, production alert destinations, approved monthly budgets, KMS/backup destination ARNs,
candidate ECR repository ARNs and their production pull principals, and GitHub environment reviewer rules.

## Protocol Support

The ALB and proxy support HTTP, grpc-web over HTTP/1.1, and WebSocket upgrades. Native gRPC h2c is not supported by the
Node proxy. Long-lived clients must reconnect within the configured WebSocket idle and connection limits.
