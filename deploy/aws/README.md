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
- `AWS_RUNTIME_ECR_IMAGE`
- `AWS_RUNTIME_ECR_IMAGE_DIGEST`
- `AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN`
- `AWS_RUNTIME_TASK_ROLE_ARN`
- `AWS_RUNTIME_SUBNET_IDS`
- `AWS_RUNTIME_SECURITY_GROUP_IDS`
- `AWS_RUNTIME_EFS_FILE_SYSTEM_ID`
- `AWS_RUNTIME_VPC_ID`
- `AWS_RUNTIME_ALB_LISTENER_ARN`
- `AWS_RUNTIME_LOG_GROUP`

Build and push the runtime image from `deploy/aws/runtime-image`, then pin `AWS_RUNTIME_ECR_IMAGE` to an immutable image
digest.

## Runtime Ownership

Runtime operations are intentionally outside Terraform state. The deployer creates one ECS service per Katana or Torii
runtime, one EFS access point per runtime, one target group per runtime, and one ALB path rule per runtime.

The public URL shape is:

- `/x/{runtime}/katana/rpc/v0_9`
- `/x/{runtime}/torii`
- `/x/{runtime}/torii/sql`
- `/x/{runtime}/torii/wss`

## Restore Playbook

1. Find the runtime service tags in ECS and note `RuntimeName`, `RuntimeKind`, and `EfsAccessPointId`.
2. Restore the EFS recovery point from the AWS Backup vault to a temporary EFS file system.
3. Copy the restored runtime directory into the active EFS file system under `/runtimes/{serviceName}`.
4. Force a new ECS deployment for the runtime service.
5. Run `aws-runtime-deployer.yml` with `operation=inspect` and confirm the JSON artifact includes a healthy endpoint.
