output "aws_region" {
  value = var.aws_region
}

output "aws_role_to_assume" {
  value = aws_iam_role.github_runtime_deployer.arn
}

output "aws_maintenance_role_to_assume" {
  value = aws_iam_role.github_runtime_maintenance.arn
}

output "aws_runtime_image_role_arn" {
  value = aws_iam_role.github_image_promotion.arn
}

output "aws_runtime_dr_role_arn" {
  value = aws_iam_role.github_dr.arn
}

output "aws_runtime_e2e_role_arn" {
  value = try(aws_iam_role.github_runtime_e2e[0].arn, null)
}

output "aws_runtime_cluster" {
  value = aws_ecs_cluster.runtime.name
}

output "aws_runtime_domain" {
  value = var.domain_name
}

output "aws_runtime_ecr_repository_url" {
  value = aws_ecr_repository.runtime.repository_url
}

output "aws_runtime_task_execution_role_arn" {
  value = aws_iam_role.task_execution.arn
}

output "aws_runtime_task_role_arn" {
  value = aws_iam_role.task.arn
}

output "aws_runtime_subnet_ids" {
  value = join(",", aws_subnet.private[*].id)
}

output "aws_runtime_security_group_ids" {
  value = aws_security_group.runtime_tasks.id
}

output "aws_runtime_efs_file_system_id" {
  value = aws_efs_file_system.runtime.id
}

output "aws_runtime_vpc_id" {
  value = aws_vpc.runtime.id
}

output "aws_runtime_alb_listener_arn" {
  value = aws_lb_listener.https["0"].arn
}

output "aws_runtime_alb_listener_arns" {
  value = jsonencode([for shard in range(var.runtime_shard_count) : aws_lb_listener.https[tostring(shard)].arn])
}

output "aws_runtime_route_hosts" {
  value = [for shard in range(var.runtime_shard_count) : "s${shard}.${replace(var.environment_id, ".", "-")}.${var.domain_name}"]
}

output "aws_runtime_log_group" {
  value = aws_cloudwatch_log_group.runtime.name
}

output "aws_runtime_sns_topic_arn" {
  value = aws_sns_topic.runtime_alerts.arn
}

output "aws_runtime_alb_access_log_bucket" {
  value = aws_s3_bucket.alb_access_logs.bucket
}

output "aws_runtime_control_table_name" {
  value = aws_dynamodb_table.runtime_control.name
}

output "aws_runtime_require_control_table" {
  value = "true"
}

output "aws_runtime_cors_origins" {
  value = join(",", var.cors_origins)
}

output "aws_runtime_upstream_rpc_secret_arn" {
  value = try(aws_secretsmanager_secret.upstream_rpc[0].arn, null)
}

output "aws_runtime_foundation_manifest_parameter" {
  value = aws_ssm_parameter.foundation_manifest.name
}

output "aws_runtime_backup_vault_arn" {
  value = aws_backup_vault.runtime.arn
}

output "aws_runtime_efs_replication_role_arn" {
  value = try(aws_iam_role.efs_replication[0].arn, null)
}

output "github_environment_variables" {
  value = {
    AWS_ROLE_TO_ASSUME                        = aws_iam_role.github_runtime_deployer.arn
    AWS_MAINTENANCE_ROLE_TO_ASSUME            = aws_iam_role.github_runtime_maintenance.arn
    AWS_RUNTIME_IMAGE_ROLE_ARN                = aws_iam_role.github_image_promotion.arn
    AWS_RUNTIME_DR_ROLE_ARN                   = aws_iam_role.github_dr.arn
    AWS_RUNTIME_E2E_ROLE_ARN                  = try(aws_iam_role.github_runtime_e2e[0].arn, null)
    AWS_REGION                                = var.aws_region
    AWS_RUNTIME_CLUSTER                       = aws_ecs_cluster.runtime.name
    AWS_RUNTIME_DOMAIN                        = var.domain_name
    AWS_RUNTIME_ECR_REPOSITORY_URL            = aws_ecr_repository.runtime.repository_url
    AWS_RUNTIME_TASK_EXECUTION_ROLE_ARN       = aws_iam_role.task_execution.arn
    AWS_RUNTIME_TASK_ROLE_ARN                 = aws_iam_role.task.arn
    AWS_RUNTIME_SUBNET_IDS                    = join(",", aws_subnet.private[*].id)
    AWS_RUNTIME_SECURITY_GROUP_IDS            = aws_security_group.runtime_tasks.id
    AWS_RUNTIME_EFS_FILE_SYSTEM_ID            = aws_efs_file_system.runtime.id
    AWS_RUNTIME_VPC_ID                        = aws_vpc.runtime.id
    AWS_RUNTIME_ALB_LISTENER_ARN              = aws_lb_listener.https["0"].arn
    AWS_RUNTIME_ALB_LISTENER_ARNS             = jsonencode([for shard in range(var.runtime_shard_count) : aws_lb_listener.https[tostring(shard)].arn])
    AWS_RUNTIME_LOG_GROUP                     = aws_cloudwatch_log_group.runtime.name
    AWS_RUNTIME_SNS_TOPIC_ARN                 = aws_sns_topic.runtime_alerts.arn
    AWS_RUNTIME_CONTROL_TABLE_NAME            = aws_dynamodb_table.runtime_control.name
    AWS_RUNTIME_REQUIRE_CONTROL_TABLE         = "true"
    AWS_RUNTIME_CORS_ORIGINS                  = join(",", var.cors_origins)
    AWS_RUNTIME_UPSTREAM_RPC_SECRET_ARN       = try(aws_secretsmanager_secret.upstream_rpc[0].arn, null)
    AWS_RUNTIME_FOUNDATION_MANIFEST_PARAMETER = aws_ssm_parameter.foundation_manifest.name
    AWS_RUNTIME_EFS_REPLICATION_ROLE_ARN      = try(aws_iam_role.efs_replication[0].arn, null)
  }
}

output "dr_workflow_environment_variables" {
  value = merge(
    local.is_production ? {
      AWS_RUNTIME_SOURCE_DR_ROLE_ARN       = aws_iam_role.github_dr.arn
      AWS_RUNTIME_EFS_FILE_SYSTEM_ID       = aws_efs_file_system.runtime.id
      AWS_RUNTIME_EFS_REPLICATION_ROLE_ARN = aws_iam_role.efs_replication[0].arn
    } : {},
    local.is_dr ? {
      AWS_RUNTIME_DESTINATION_DR_ROLE_ARN    = aws_iam_role.github_dr.arn
      AWS_RUNTIME_DR_EFS_FILE_SYSTEM_ARN     = aws_efs_file_system.runtime.arn
      AWS_DR_RUNTIME_CLUSTER                 = aws_ecs_cluster.runtime.name
      AWS_DR_RUNTIME_ECR_REPOSITORY_URL      = aws_ecr_repository.runtime.repository_url
      AWS_DR_RUNTIME_TASK_EXECUTION_ROLE_ARN = aws_iam_role.task_execution.arn
      AWS_DR_RUNTIME_TASK_ROLE_ARN           = aws_iam_role.task.arn
      AWS_DR_RUNTIME_SUBNET_IDS              = join(",", aws_subnet.private[*].id)
      AWS_DR_RUNTIME_SECURITY_GROUP_IDS      = aws_security_group.runtime_tasks.id
      AWS_DR_RUNTIME_EFS_FILE_SYSTEM_ID      = aws_efs_file_system.runtime.id
      AWS_DR_RUNTIME_VPC_ID                  = aws_vpc.runtime.id
      AWS_DR_RUNTIME_ALB_LISTENER_ARN        = aws_lb_listener.https["0"].arn
      AWS_DR_RUNTIME_ALB_LISTENER_ARNS       = jsonencode([for shard in range(var.runtime_shard_count) : aws_lb_listener.https[tostring(shard)].arn])
      AWS_DR_RUNTIME_ALB_DNS_NAMES           = jsonencode([for shard in range(var.runtime_shard_count) : aws_lb.runtime[tostring(shard)].dns_name])
      AWS_DR_RUNTIME_ALB_HOSTED_ZONE_IDS     = jsonencode([for shard in range(var.runtime_shard_count) : aws_lb.runtime[tostring(shard)].zone_id])
      AWS_DR_RUNTIME_LOG_GROUP               = aws_cloudwatch_log_group.runtime.name
      AWS_DR_RUNTIME_SNS_TOPIC_ARN           = aws_sns_topic.runtime_alerts.arn
      AWS_DR_RUNTIME_CONTROL_TABLE_NAME      = aws_dynamodb_table.runtime_control.name
      AWS_DR_RUNTIME_CORS_ORIGINS            = join(",", var.cors_origins)
      AWS_DR_RUNTIME_UPSTREAM_RPC_SECRET_ARN = try(aws_secretsmanager_secret.upstream_rpc[0].arn, null)
    } : {}
  )
}
