# Realms appchain — CDK

Infra for the Phase 1 dev appchain (see `docs/plans/appchain-phase-1.md`).
Account `061906581174`, region `us-east-1`, local profile `realms-appchain`.

## Stacks

| Stack | Contents | Preconditions |
|---|---|---|
| `RealmsAppchainFoundation` | ECR ×2, GitHub OIDC provider + `gha-appchain-{deploy,image,launch}` roles | none |
| `RealmsAppchainDns` | public zone `appchain.realms.world` (outputs the 4 NS values) | none |
| `RealmsAppchainDev` | VPC (public-only, no NAT), ECS cluster, katana EC2 (m6a.large + 50GB attached EBS), shared multi-world torii (Fargate), ALB + ACM + WAF, Route53 records, SNS alarms | NS delegation live (cert validation) **and** EC2 vCPU quota ≥ 2 |

## Deploy

```sh
cd deploy/appchain/cdk
pnpm install --ignore-workspace     # repo declares npm+pnpm workspaces; stay out of them
AWS_PROFILE=realms-appchain npx cdk synth
AWS_PROFILE=realms-appchain npx cdk deploy RealmsAppchainFoundation RealmsAppchainDns
# -> add the NameServers output as an NS record for `appchain` in realms.world DNS
AWS_PROFILE=realms-appchain scripts/push-images.sh
AWS_PROFILE=realms-appchain npx cdk deploy RealmsAppchainDev
```

## Design notes

- **Katana on EC2, not Fargate**: Fargate's service-managed EBS is task-scoped,
  so any task-def change (including a resize) destroys the chain. Here the
  data volume is a standalone EBS (RETAIN) attached to the instance; resize =
  stop → change type → start, chain intact. The instance is a singleton —
  never run two katanas against one chain.
- **Torii config via SSM**: the multi-world `torii.toml` lives in
  `/realms-appchain/dev/torii-config`, injected as an env var at task start
  (ECS-native SSM secret). Game launches append a `WORLD:` entry to the param
  and force a new deployment — no task-definition churn. Torii storage is
  ephemeral by design (reindexes from chain); `desiredCount` starts at 0 until
  the M2 bootstrap writes a real config. SSM standard tier caps the param at
  4KB (~40 worlds) — bump to advanced tier or reset the chain before that.
- **No shell access paths**: no SSH keys; use SSM Session Manager
  (`aws ssm start-session --target <instance-id> --profile realms-appchain`)
  and ECS Exec for torii.
- **Ops on katana** (image bump / restart): session onto the instance, then
  `docker pull … && docker rm -f katana heartbeat` and re-run the two
  `docker run` commands from the user-data (or reboot the instance — user-data
  is idempotent). Automated pipeline lands with M4.
