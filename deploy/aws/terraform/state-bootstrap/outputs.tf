output "state_bucket_name" {
  value = aws_s3_bucket.state.bucket
}

output "state_kms_key_arn" {
  value = aws_kms_key.state.arn
}

output "lock_table_name" {
  value = aws_dynamodb_table.locks.name
}

output "github_oidc_provider_arn" {
  value = aws_iam_openid_connect_provider.github.arn
}

output "replication_role_arn" {
  value = try(aws_iam_role.state_replication[0].arn, null)
}

output "ecr_replication_configuration_registry_id" {
  value = try(aws_ecr_replication_configuration.runtime[0].registry_id, null)
}
