# AWS Game Runtime

This directory contains the AWS-owned runtime foundation for Katana and Torii replacements. Terraform owns shared
infrastructure. GitHub Actions own runtime mutations through `config/deployer/clean/cli/aws-runtime.ts`.

## Foundation

Apply `deploy/aws/terraform` once per AWS account/environment. The important outputs map directly to GitHub
environment variables:

- `AWS_ROLE_TO_ASSUME`
- `AWS_REGION`
- `AWS_RUNTIME_CLUSTER`
- `AWS_RUNTIME_DOMAIN`
- `AWS_RUNTIME_ECR_REPOSITORY_URL`
- `AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN`
- `AWS_RUNTIME_TASK_ROLE_ARN`
- `AWS_RUNTIME_SUBNET_IDS`
- `AWS_RUNTIME_SECURITY_GROUP_IDS`
- `AWS_RUNTIME_EFS_FILE_SYSTEM_ID`
- `AWS_RUNTIME_VPC_ID`
- `AWS_RUNTIME_ALB_LISTENER_ARN`
- `AWS_RUNTIME_LOG_GROUP`
- `AWS_RUNTIME_SNS_TOPIC_ARN`
- `AWS_RUNTIME_ALB_ACCESS_LOG_BUCKET`

Operator-set GitHub environment variables:

- `RUNTIME_PROVIDER` (`slot` by default; flip one environment to `aws` during rollout)
- `AWS_RUNTIME_ECR_IMAGE` only for emergency pinned-image deploys where no version is supplied
- `AWS_RUNTIME_HEALTH_START_PERIOD_SECONDS` optionally raises the ECS health-check start period above the 90s floor for long snapshot restores or cold reindexing.

Optional Terraform variables:

- `alert_email_addresses` subscribes email endpoints to the foundation SNS topic.
- `alert_webhook_url` subscribes one HTTPS webhook endpoint to the foundation SNS topic.
- `enable_vpc_endpoints` defaults to `true` and creates private S3, ECR, and CloudWatch Logs endpoints.

## GitHub Environment Checklist

Configure these GitHub environments before dispatching AWS runtime workflows:

- `slot.blitz`
- `slot.eternum`
- `mainnet.blitz`
- `mainnet.eternum`

Each environment needs the Terraform output variables from the Foundation section. Each environment also needs the
operator-set variables that are not Terraform outputs:

- `RUNTIME_PROVIDER`
- `AWS_RUNTIME_ECR_IMAGE`
- `AWS_RUNTIME_HEALTH_START_PERIOD_SECONDS`

Set `RUNTIME_PROVIDER=slot` until that environment is intentionally rolled to AWS. Keep `AWS_RUNTIME_ECR_IMAGE` empty
unless using an emergency pinned image instead of a versioned ECR tag.

Mainnet environments must set required reviewers and deployment branch policy = `next`.

## Remote State

Terraform state for the runtime foundation uses an S3 backend with the committed key
`aws-runtime/foundation.tfstate` and DynamoDB lock table `aws-runtime-foundation-locks`. The backend bucket is supplied
during initialization because S3 bucket names must be globally unique and are account-owned bootstrap infrastructure.

Bootstrap once per AWS account before applying the foundation:

```sh
aws s3api create-bucket --bucket <state-bucket> --region us-east-1
aws s3api put-bucket-versioning --bucket <state-bucket> --versioning-configuration Status=Enabled
aws s3api put-bucket-encryption --bucket <state-bucket> --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
aws dynamodb create-table --table-name aws-runtime-foundation-locks --billing-mode PAY_PER_REQUEST --attribute-definitions AttributeName=LockID,AttributeType=S --key-schema AttributeName=LockID,KeyType=HASH
```

Initialize or migrate local state with the account-specific backend config:

```sh
terraform -chdir=deploy/aws/terraform init -migrate-state \
  -backend-config="bucket=<state-bucket>" \
  -backend-config="dynamodb_table=aws-runtime-foundation-locks" \
  -backend-config="region=us-east-1"
```

Build and push the runtime image with the `AWS Runtime Image` workflow. It builds `deploy/aws/runtime-image` for
`linux/amd64`, tags the image as `{dojo_version}-{gitsha}`, pushes it to `AWS_RUNTIME_ECR_REPOSITORY_URL`, and writes
the digest to the workflow summary. Runtime deploys with `--version` use
`${AWS_RUNTIME_ECR_REPOSITORY_URL}:{version}` and fail before task registration if that tag is missing.

## E2E Validation

Run the on-demand runtime validation from the repository root after applying the foundation and publishing a runtime
image:

```sh
AWS_RUNTIME_E2E_ENVIRONMENT=slot.blitz \
AWS_RUNTIME_E2E_RUNTIME_KIND=katana \
AWS_RUNTIME_E2E_RUNTIME_NAME=aws-runtime-e2e-smoke \
AWS_RUNTIME_E2E_VERSION=<dojo-version-tag> \
make aws-runtime-e2e
```

For Torii runs, also set `AWS_RUNTIME_E2E_RPC_URL` and `AWS_RUNTIME_E2E_WORLD_ADDRESS`. The harness runs the IAM guard
and then deploys, inspects, resizes, deletes, audits for zero runtime-tagged AWS resources, recreates, inspects,
deletes, and audits again. Use `AWS_RUNTIME_E2E_ARGS=--dry-run make aws-runtime-e2e` to print the planned
machine-readable command sequence without contacting AWS.

The `AWS Runtime E2E` workflow runs the same harness nightly and on demand for both Katana and Torii. It uploads
`aws-runtime-e2e-result.json` for each runtime kind; keep those artifacts with the storage validation sign-off records.
Set `AWS_RUNTIME_E2E_RPC_URL` and `AWS_RUNTIME_E2E_WORLD_ADDRESS` on the selected GitHub environment before enabling
the Torii leg.

## Access Control

The Terraform OIDC trust enumerates the allowed GitHub environments: `slot.blitz`, `slot.eternum`, `mainnet.blitz`,
and `mainnet.eternum`. Mainnet GitHub environments must set required reviewers and restrict deployment branches to
`next`. The deployer uses a single role shared by the allowed environments, but each environment is listed explicitly in
the trust policy; new GitHub environments cannot assume it until they are added to `github_environments`.

## Runtime Ownership

Runtime operations are intentionally outside Terraform state. The deployer creates one ECS service per Katana or Torii
runtime, one EFS access point per runtime, one target group per runtime, and one ALB path rule per runtime.
The `inspect` operation probes the public health endpoint and records the result in the JSON artifact. Katana inspect
also posts `starknet_chainId` to the public `/rpc/v0_9` route so the advertised RPC path is tested with the same probe.

The public URL shape is:

- `/x/{env}/{runtime}/katana/rpc/v0_9`
- `/x/{env}/{runtime}/katana`
- `/x/{env}/{runtime}/katana/health`
- `/x/{env}/{runtime}/torii`
- `/x/{env}/{runtime}/torii/sql`
- `/x/{env}/{runtime}/torii/health`

`{env}` is the normalized deployment environment, for example `slot-blitz` or `mainnet-eternum`.

## Protocol Support

The ALB and path proxy support plain HTTP, grpc-web over HTTP/1.1, and WebSocket upgrades on Torii routes. Native gRPC
h2c is not supported by the Node path proxy. The ALB idle timeout is 3600 seconds; clients should still use keepalives
for long-lived subscriptions.

ALB access logs are written to `AWS_RUNTIME_ALB_ACCESS_LOG_BUCKET` with a 30-day lifecycle. The foundation also alarms
on ALB-generated 5xx responses, EFS IO pressure, and NAT port-allocation errors through `AWS_RUNTIME_SNS_TOPIC_ARN`.

Runtime tasks use a single NAT gateway for general private-subnet egress. S3, ECR, and CloudWatch Logs traffic uses VPC
endpoints when `enable_vpc_endpoints=true`; if the NAT gateway's AZ is impaired, non-endpoint private egress is the
accepted blast radius for this foundation.

## Katana Trust Model

AWS Katana RPC endpoints are public and unauthenticated. They are for dev-grade chains only, with known prefunded dev
accounts. Production-value chains need an authentication and abuse-control design before they use this runtime path.

Katana runtimes accept optional container env vars:

- `KATANA_CHAIN_ID`
- `KATANA_BLOCK_TIME`
- `KATANA_EXTRA_ARGS` for simple whitespace-separated extra Katana flags; the entrypoint splits this without shell eval.

## Storage Architecture

Runtime databases live on task-local Fargate ephemeral storage. EFS is mounted at `/snapshots` and is reserved for
runtime snapshots and AWS Backup recovery points. Live mdbx and SQLite WAL files do not run on EFS.

Snapshots are engine-specific: Torii SQLite databases are copied with `VACUUM INTO`, while Katana uses `mdbx_copy`.
If `mdbx_copy` is unavailable, the snapshot script pauses the Katana process, copies the local data directory, and
resumes it immediately after the copy. Each committed snapshot is a `{kind}-{unixTimestamp}.tar.zst` artifact with a
matching `{kind}-{unixTimestamp}.json` sidecar and a `latest.json` pointer. The sidecar records the runtime kind,
runtime version, world address, creation timestamp, and SHA-256 of the compressed artifact; restore skips missing,
stale, or checksum-mismatched pairs.

The default RPO target is five minutes on hard crash and zero data loss on graceful deploy/resize/stop. Mainnet cutover
requires signed-off crash/restore validation results before `RUNTIME_PROVIDER=aws` is enabled.

Set `AWS_RUNTIME_HEALTH_START_PERIOD_SECONDS` when a runtime needs more than 90 seconds to restore from snapshots or
complete a cold Torii reindex before ECS health checks can judge it.

Runtime delete removes snapshot data by default. The deployer first runs a short-lived ECS cleanup task against the
runtime access point, then deletes the listener rule, target group, and access point. Use `--retain-data` or the
workflow `retain_data` input only when intentionally keeping snapshots for a later recreate.

## Storage Validation Results

Mainnet cutover stays blocked until this table has two consecutive green nightly crash/restore runs and an explicit
RPO/RTO sign-off for each runtime kind.

| Check | Katana | Torii | Evidence |
| --- | --- | --- | --- |
| crash/restore | pending live nightly | pending live nightly | `make aws-runtime-e2e` nightly crash/restore artifact |
| 24h torii soak | not applicable | pending live soak | Slot-baseline comparison dashboard |
| mdbx_copy snapshot opens under write load | pending container validation | not applicable | runtime-image validation artifact |
| RPO/RTO sign-off | pending | pending | operator sign-off before mainnet cutover |

## Restore Playbook

Terraform keeps one AWS Backup stream for runtime snapshots: the custom vault named after `project_name`. Run and record
a restore drill from that vault once per quarter.

1. Find the runtime service tags in ECS and note `RuntimeName`, `RuntimeKind`, and `EfsAccessPointId`.
2. Restore the EFS recovery point from the `${project_name}` AWS Backup vault to a temporary EFS file system.
3. Copy the desired snapshot files into the active access point under `/snapshots`.
4. Force a new ECS deployment for the runtime service so the entrypoint restores the newest valid snapshot.
5. Run `aws-runtime-deployer.yml` with `operation=inspect` and confirm the JSON artifact includes a healthy endpoint
   and `restoredFromSnapshot` with the restored snapshot timestamp.
